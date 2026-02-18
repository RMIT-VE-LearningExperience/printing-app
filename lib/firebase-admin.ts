import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getPrivateKey() {
  const value = process.env.FIREBASE_PRIVATE_KEY;
  if (!value) {
    return undefined;
  }

  return value.replace(/\\n/g, "\n");
}

function initAdminApp() {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const app = initAdminApp();

export const db = getFirestore(app);
