import { NextRequest, NextResponse } from "next/server";
import { auth, adminDb } from "../../../lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    // Verify superadmin caller
    const authHeader = req.headers.get("Authorization");
    const idToken = authHeader?.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const decoded = await auth.verifyIdToken(idToken);
    const callerDoc = await adminDb.collection("admins").doc(decoded.uid).get();
    const callerData = callerDoc.data() as { role?: string; active?: boolean } | undefined;
    if (!callerDoc.exists || !callerData?.active || callerData.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json() as {
      action: "addDirect" | "deactivate" | "reactivate" | "changeRole";
      uid?: string;
      name?: string;
      email?: string;
      staffNumber?: string;
      role?: "admin" | "superadmin";
      newRole?: "admin" | "superadmin";
    };

    const { action } = body;

    switch (action) {
      case "addDirect": {
        const { name, email, staffNumber, role } = body;
        if (!name || !email || !staffNumber) {
          return NextResponse.json(
            { error: "name, email, and staffNumber are required" },
            { status: 400 },
          );
        }

        // Get or create Firebase Auth user
        let uid: string;
        try {
          const existingUser = await auth.getUserByEmail(email);
          uid = existingUser.uid;
        } catch (err: unknown) {
          const firebaseErr = err as { code?: string };
          if (firebaseErr.code === "auth/user-not-found") {
            const newUser = await auth.createUser({ email });
            uid = newUser.uid;
          } else {
            throw err;
          }
        }

        // Reject if already in admins collection
        const existing = await adminDb.collection("admins").doc(uid).get();
        if (existing.exists) {
          return NextResponse.json(
            { error: "This user is already an admin" },
            { status: 409 },
          );
        }

        await adminDb.collection("admins").doc(uid).set({
          name,
          email,
          staffNumber,
          role: role === "superadmin" ? "superadmin" : "admin",
          active: true,
          addedAt: new Date(),
        });

        return NextResponse.json({ message: "Admin added", uid }, { status: 200 });
      }

      case "deactivate": {
        const { uid } = body;
        if (!uid) return NextResponse.json({ error: "uid is required" }, { status: 400 });
        if (uid === decoded.uid) {
          return NextResponse.json(
            { error: "Cannot deactivate your own account" },
            { status: 400 },
          );
        }
        await adminDb.collection("admins").doc(uid).update({ active: false });
        return NextResponse.json({ message: "Admin deactivated" }, { status: 200 });
      }

      case "reactivate": {
        const { uid } = body;
        if (!uid) return NextResponse.json({ error: "uid is required" }, { status: 400 });
        await adminDb.collection("admins").doc(uid).update({ active: true });
        return NextResponse.json({ message: "Admin reactivated" }, { status: 200 });
      }

      case "changeRole": {
        const { uid, newRole } = body;
        if (!uid || !newRole) {
          return NextResponse.json({ error: "uid and newRole are required" }, { status: 400 });
        }
        if (newRole !== "admin" && newRole !== "superadmin") {
          return NextResponse.json(
            { error: "newRole must be 'admin' or 'superadmin'" },
            { status: 400 },
          );
        }
        if (uid === decoded.uid) {
          return NextResponse.json(
            { error: "Cannot change your own role" },
            { status: 400 },
          );
        }
        await adminDb.collection("admins").doc(uid).update({ role: newRole });
        return NextResponse.json({ message: "Role updated" }, { status: 200 });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin manage error:", message);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
