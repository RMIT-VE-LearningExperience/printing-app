"use client";

import { useState } from "react";
import { sendSignInLinkToEmail } from "firebase/auth";
import { Box, Button, TextField, Typography, Stack, Alert, CircularProgress } from "@mui/material";
import { initializeFirebaseClient } from "../../lib/firebase-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState("");

  const handleSendLink = async () => {
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const auth = initializeFirebaseClient();

      const actionCodeSettings = {
        url: `${window.location.origin}/login/callback?email=${encodeURIComponent(email)}`,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);

      // Save email to localStorage for the callback
      window.localStorage.setItem("pendingAdminEmail", email);

      setLinkSent(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send sign-in link";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && email.trim()) {
      void handleSendLink();
    }
  };

  const textFieldColor = error ? "error" : "primary";

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
        }}
      >
        <Typography variant="h4" fontWeight={700} mb={2} textAlign="center">
          Login
        </Typography>

        {linkSent ? (
          <Stack spacing={2}>
            <Alert severity="success">
              Check your email for a sign-in link. Click the link to continue.
            </Alert>
            <Typography variant="body2" color="#666" textAlign="center">
              The link will expire in 24 hours.
            </Typography>
            <Button
              onClick={() => {
                setLinkSent(false);
                setEmail("");
              }}
              sx={{ mt: 2 }}
            >
              Send another link
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              onKeyPress={handleKeyPress}
              color={textFieldColor}
              fullWidth
              disabled={loading}
              autoFocus
            />

            {error && <Alert severity="error">{error}</Alert>}

            <Button
              variant="contained"
              onClick={() => void handleSendLink()}
              disabled={loading || !email.trim()}
              fullWidth
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : "Send Link"}
            </Button>

            <Typography variant="caption" color="#999" textAlign="center" sx={{ mt: 3 }}>
              A link will be sent to your email. Click to access the admin site.
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
