import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App;
let adminDb: Firestore;

// Initialize Firebase Admin SDK for server-side use
if (!getApps().length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    // Initialize with individual service account credentials
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        // Replace escaped newlines in private key
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    throw new Error(
      'Firebase Admin SDK configuration is missing. Please set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY environment variables.'
    );
  }
} else {
  app = getApps()[0];
}

adminDb = getFirestore(app);

export { app, adminDb };
