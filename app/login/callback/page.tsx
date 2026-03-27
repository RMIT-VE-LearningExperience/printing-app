"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { Box, CircularProgress, Typography, Alert } from "@mui/material";
import { initializeFirebaseClient, getAuthInstance } from "../../../lib/firebase-client";

export default function LoginCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Processing sign-in...");

  useEffect(() => {
    async function handleCallback() {
      try {
        setStatus("Checking sign-in link...");
        const auth = initializeFirebaseClient();

        // Check if the current URL is a sign-in with email link
        if (!isSignInWithEmailLink(auth, window.location.href)) {
          setError("Invalid or expired sign-in link.");
          return;
        }

        setStatus("Verifying email...");

        // Get the email from localStorage or URL param
        let email = window.localStorage.getItem("pendingAdminEmail");
        if (!email) {
          const urlParams = new URLSearchParams(window.location.search);
          email = urlParams.get("email");
        }

        if (!email) {
          setError("Email not found. Please sign in again.");
          return;
        }

        setStatus("Completing sign-in...");

        // Sign in with the email link
        const userCredential = await signInWithEmailLink(auth, email, window.location.href);
        const idToken = await userCredential.user.getIdToken();

        // Clean up localStorage
        window.localStorage.removeItem("pendingAdminEmail");

        setStatus("Verifying access...");

        // Verify the token and check the allowlist
        const response = await fetch("/api/verify-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Access not authorized");
          // Sign out if not authorized
          await auth.signOut();
          return;
        }

        // Store token in localStorage (client-side auth)
        const data = await response.json();
        window.localStorage.setItem("adminAuthToken", idToken);
        window.localStorage.setItem("adminRole", data.role);

        // Set session cookie so middleware can protect /admin routes
        document.cookie = "adminSession=1; path=/; SameSite=Strict";

        setStatus("Redirecting to admin panel...");
        router.push("/admin");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);
      }
    }

    void handleCallback();
  }, [router]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f5f5",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 400,
          backgroundColor: "white",
          padding: 4,
          borderRadius: 2,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
      >
        {error ? (
          <>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
            <Typography variant="body2" color="#666">
              <a href="/login" style={{ color: "#0066cc", textDecoration: "none" }}>
                Return to login
              </a>
            </Typography>
          </>
        ) : (
          <>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="body1">{status}</Typography>
          </>
        )}
      </Box>
    </Box>
  );
}
