/* Firebase web config is public client configuration, not a server secret.
   Set these values from Firebase Console > Project settings > Your apps.
   Never put service-account keys, Resend keys, or other server secrets here. */
self.MOLECULE_FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_WEB_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_FIREBASE_APP_ID",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  vapidKey: "YOUR_WEB_PUSH_VAPID_PUBLIC_KEY"
};
