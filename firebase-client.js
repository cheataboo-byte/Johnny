/* Firebase adapter. SDK modules are loaded only after real project config
   exists, so the science-fair demo can still run without Firebase set up. */
const FIREBASE_VERSION = "12.6.0";
const SDK_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
let app, auth, db, functions, messaging, sdk;
let configured = false;

const config = () => window.MOLECULE_FIREBASE_CONFIG || {};
const readyConfig = () => {
  const c = config();
  return Boolean(c.apiKey && c.projectId && c.appId && !c.apiKey.startsWith("YOUR_"));
};

export async function initializeFirebase() {
  if (!readyConfig()) return { configured: false, error: "" };
  try {
    const [appSdk, authSdk, firestoreSdk, functionsSdk] = await Promise.all([
      import(`${SDK_BASE}/firebase-app.js`),
      import(`${SDK_BASE}/firebase-auth.js`),
      import(`${SDK_BASE}/firebase-firestore.js`),
      import(`${SDK_BASE}/firebase-functions.js`)
    ]);
    sdk = { appSdk, authSdk, firestoreSdk, functionsSdk };
    app = appSdk.initializeApp(config());
    auth = authSdk.getAuth(app);
    db = firestoreSdk.getFirestore(app);
    functions = functionsSdk.getFunctions(app);
    configured = true;
    return { configured: true, error: "" };
  } catch (error) {
    console.error("Firebase could not be initialized.", error);
    return { configured: false, error: error.message || "Firebase initialization failed." };
  }
}

export function firebaseIsConfigured() { return configured; }
export function observeAuth(callback) {
  if (!configured) return () => {};
  return sdk.authSdk.onAuthStateChanged(auth, callback);
}
export async function createAccount(email, password, displayName) {
  const credential = await sdk.authSdk.createUserWithEmailAndPassword(auth, email, password);
  await sdk.authSdk.updateProfile(credential.user, { displayName });
  const userRef = sdk.firestoreSdk.doc(db, "users", credential.user.uid);
  const profile = {
    name: displayName,
    email: credential.user.email,
    focus: "barrier",
    bot: { name: "BioBot", avatar: "🧬", tone: "friendly" },
    saved: [],
    readUpdates: [],
    details: { ageRange: "prefer-not", gender: "prefer-not", skinType: "unsure", concerns: [], allergies: "" },
    notifications: { inApp: true, push: false, email: false },
    chemTopicHistory: [],
    createdAt: sdk.firestoreSdk.serverTimestamp(),
    updatedAt: sdk.firestoreSdk.serverTimestamp()
  };
  await sdk.firestoreSdk.setDoc(userRef, profile);
  await sdk.authSdk.sendEmailVerification(credential.user);
  return credential.user;
}
export function resendVerificationEmail() {
  if (!auth.currentUser) throw new Error("Sign in to request a verification email.");
  return sdk.authSdk.sendEmailVerification(auth.currentUser);
}
export async function refreshEmailVerification() {
  if (!auth.currentUser) return false;
  await sdk.authSdk.reload(auth.currentUser);
  return Boolean(auth.currentUser.emailVerified);
}
export async function signInAccount(email, password) {
  const result = await sdk.authSdk.signInWithEmailAndPassword(auth, email, password);
  return result.user;
}
export function signOutAccount() { return sdk.authSdk.signOut(auth); }
export function sendPasswordReset(email) { return sdk.authSdk.sendPasswordResetEmail(auth, email); }

export async function loadUserData(user) {
  const fs = sdk.firestoreSdk;
  const userSnap = await fs.getDoc(fs.doc(db, "users", user.uid));
  if (!userSnap.exists()) throw new Error("Your account profile is missing. Contact the app administrator.");
  const scanQuery = fs.query(fs.collection(db, "users", user.uid, "scans"), fs.orderBy("at", "desc"), fs.limit(40));
  const [scanSnap, notificationSnap] = await Promise.all([
    fs.getDocs(scanQuery),
    fs.getDocs(fs.query(fs.collection(db, "users", user.uid, "notifications"), fs.orderBy("createdAt", "desc"), fs.limit(30)))
  ]);
  return {
    profile: { ...userSnap.data(), email: user.email || userSnap.data().email, name: user.displayName || userSnap.data().name },
    scans: scanSnap.docs.map(document => ({ ...document.data(), id: document.id })),
    notifications: notificationSnap.docs.map(document => ({ ...document.data(), id: document.id }))
  };
}
export async function saveUserProfile(uid, profile) {
  const { scans, email, uid: ignoredUid, emailVerified, notificationsList, createdAt, updatedAt, ...safeProfile } = profile;
  await sdk.firestoreSdk.setDoc(
    sdk.firestoreSdk.doc(db, "users", uid),
    { ...safeProfile, email, updatedAt: sdk.firestoreSdk.serverTimestamp() },
    { merge: true }
  );
}
export async function saveUserScan(uid, scan) {
  await sdk.firestoreSdk.setDoc(
    sdk.firestoreSdk.doc(db, "users", uid, "scans", String(scan.id)),
    { ...scan, at: scan.at || new Date().toISOString() }
  );
}
export function listenToNotifications(uid, callback, onError) {
  const fs = sdk.firestoreSdk;
  const q = fs.query(fs.collection(db, "users", uid, "notifications"), fs.orderBy("createdAt", "desc"), fs.limit(30));
  return fs.onSnapshot(q, snapshot => callback(snapshot.docs.map(d => ({ ...d.data(), id: d.id }))), onError);
}
export function markNotificationRead(uid, id) {
  return sdk.firestoreSdk.updateDoc(sdk.firestoreSdk.doc(db, "users", uid, "notifications", id), { readAt: sdk.firestoreSdk.serverTimestamp() });
}
export async function enableBrowserPush(uid) {
  if (!config().vapidKey || config().vapidKey.startsWith("YOUR_")) throw new Error("Add the Web Push certificate key to firebase-config.js first.");
  if (!("serviceWorker" in navigator) || !("Notification" in window)) throw new Error("This browser does not support web push notifications.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Browser notification permission was not granted.");
  const messagingSdk = await import(`${SDK_BASE}/firebase-messaging.js`);
  const supported = await messagingSdk.isSupported();
  if (!supported) throw new Error("Push notifications are not supported in this browser.");
  messaging = messagingSdk.getMessaging(app);
  const registration = await navigator.serviceWorker.register("./service-worker.js");
  const token = await messagingSdk.getToken(messaging, { vapidKey: config().vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("The browser did not provide a push subscription.");
  const tokenHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenId = Array.from(new Uint8Array(tokenHash), byte => byte.toString(16).padStart(2, "0")).join("");
  await sdk.firestoreSdk.setDoc(sdk.firestoreSdk.doc(db, "users", uid, "devices", tokenId), {
    token, userAgent: navigator.userAgent.slice(0, 180), updatedAt: sdk.firestoreSdk.serverTimestamp()
  });
  return messaging;
}
export async function listenToForegroundPush(callback) {
  const messagingSdk = await import(`${SDK_BASE}/firebase-messaging.js`);
  if (!(await messagingSdk.isSupported())) return () => {};
  messaging = messagingSdk.getMessaging(app);
  return messagingSdk.onMessage(messaging, payload => callback(payload));
}
export async function requestAccountDeletion() {
  const callable = sdk.functionsSdk.httpsCallable(functions, "deleteMyAccount");
  await callable({ confirm: true });
}
export async function exportAccountData(uid) {
  const data = await loadUserData(auth.currentUser);
  const profile = data.profile;
  return { uid, profile, scans: data.scans, notifications: data.notifications };
}
export async function clearPushDevice(uid) {
  if (!messaging) {
    if (!(await (await import(`${SDK_BASE}/firebase-messaging.js`)).isSupported())) return;
    messaging = (await import(`${SDK_BASE}/firebase-messaging.js`)).getMessaging(app);
  }
  const messagingSdk = await import(`${SDK_BASE}/firebase-messaging.js`);
  const registration = await navigator.serviceWorker.register("./service-worker.js");
  const token = await messagingSdk.getToken(messaging, { vapidKey: config().vapidKey, serviceWorkerRegistration: registration });
  if (token) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    await sdk.firestoreSdk.deleteDoc(sdk.firestoreSdk.doc(db, "users", uid, "devices", tokenId));
    await messagingSdk.deleteToken(messaging);
  }
}
