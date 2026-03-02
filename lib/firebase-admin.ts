import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as fs from "fs";

function getPrivateKey() {
  const value = process.env.FIREBASE_PRIVATE_KEY;
  if (!value) {
    return undefined;
  }

  return value.replace(/\\n/g, "\n");
}

function loadServiceAccount() {
  try {
    // Try to load from environment variable path
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credPath && fs.existsSync(credPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(credPath, "utf-8"));
      return serviceAccount;
    }
  } catch (error) {
    console.warn("Could not load service account from GOOGLE_APPLICATION_CREDENTIALS:", error);
  }

  return null;
}

function initAdminApp() {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  // Try to use environment variables first
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (projectId && clientEmail && privateKey) {
    console.log("Initializing Firebase with environment variables");
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  // Try to load from service account file
  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    console.log("Initializing Firebase with service account file");
    return initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  // Fall back to application default credentials
  console.log("Initializing Firebase with application default credentials");
  return initializeApp({
    credential: applicationDefault(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const app = initAdminApp();

export const db = getFirestore(app);
export const bucket = getStorage(app).bucket();
