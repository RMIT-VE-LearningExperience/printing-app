import { NextRequest, NextResponse } from "next/server";
import { auth, adminDb } from "../../../lib/firebase-admin";
import { getApps } from "firebase-admin/app";

const GA_PROPERTY_ID = process.env.GA_PROPERTY_ID;
const TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function getToken(): Promise<string> {
  // Reuse the credential already initialised by firebase-admin to avoid hanging
  // on ADC discovery. Firebase Admin creds include cloud-platform scope which
  // GA4 Data API accepts.
  const app = getApps()[0];
  const credential = (app as unknown as { options: { credential?: { getAccessToken: () => Promise<{ access_token: string }> } } })
    .options?.credential;

  if (credential?.getAccessToken) {
    const result = await withTimeout(credential.getAccessToken(), TIMEOUT_MS, "getAccessToken");
    return result.access_token;
  }

  throw new Error("No Firebase credential available to authenticate Analytics requests");
}

async function runReport(token: string, body: object) {
  if (!GA_PROPERTY_ID) throw new Error("GA_PROPERTY_ID is not configured");
  const res = await withTimeout(
    fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY_ID}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    TIMEOUT_MS,
    "GA4 runReport",
  );
  const json = await res.json() as {
    rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[];
    error?: { message: string; code?: number };
  };
  if (json.error) throw new Error(`GA4 error ${json.error.code ?? ""}: ${json.error.message}`);
  return json;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const idToken = authHeader?.replace("Bearer ", "");
    if (!idToken) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const decoded = await auth.verifyIdToken(idToken);
    const callerDoc = await adminDb.collection("admins").doc(decoded.uid).get();
    const callerData = callerDoc.data() as { role?: string; active?: boolean } | undefined;
    if (!callerDoc.exists || !callerData?.active || callerData.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!GA_PROPERTY_ID) {
      return NextResponse.json({ error: "Analytics not configured on this environment" }, { status: 503 });
    }

    const token = await getToken();

    const [summaryReport, topPagesReport, dailyReport] = await Promise.all([
      runReport(token, {
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
        ],
      }),
      runReport(token, {
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 10,
      }),
      runReport(token, {
        dateRanges: [{ startDate: "13daysAgo", endDate: "today" }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
    ]);

    const summaryRow = summaryReport.rows?.[0];
    const summary = {
      pageViews: parseInt(summaryRow?.metricValues?.[0]?.value ?? "0", 10),
      activeUsers: parseInt(summaryRow?.metricValues?.[1]?.value ?? "0", 10),
      sessions: parseInt(summaryRow?.metricValues?.[2]?.value ?? "0", 10),
      bounceRate: parseFloat(summaryRow?.metricValues?.[3]?.value ?? "0"),
      avgSessionDuration: parseFloat(summaryRow?.metricValues?.[4]?.value ?? "0"),
    };

    const topPages = (topPagesReport.rows ?? []).map((row) => ({
      path: row.dimensionValues?.[0]?.value ?? "/",
      views: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    }));

    const dailyViews = (dailyReport.rows ?? []).map((row) => {
      const raw = row.dimensionValues?.[0]?.value ?? "00000000";
      const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      return { date, views: parseInt(row.metricValues?.[0]?.value ?? "0", 10) };
    });

    return NextResponse.json({ summary, topPages, dailyViews }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Analytics API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
