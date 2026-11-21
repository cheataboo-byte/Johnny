const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const emailApiKey = defineSecret("RESEND_API_KEY");
const emailFrom = defineString("EMAIL_FROM", { default: "molecule lab <updates@example.com>" });
const appOrigin = defineString("APP_ORIGIN", { default: "https://example.com" });

function boundedText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

async function deliverEmail({ to, title, body, url, announcementId }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${emailApiKey.value()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `molecule-${announcementId}-${to}`
    },
    body: JSON.stringify({
      from: emailFrom.value(),
      to: [to],
      subject: title,
      text: `${body}\n\nOpen molecule: ${url}`
    })
  });
  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Email provider rejected the request (${response.status}): ${responseText.slice(0, 300)}`);
  }
}

exports.deliverAnnouncement = onDocumentCreated(
  { document: "announcements/{announcementId}", retry: true, secrets: [emailApiKey] },
  async event => {
    const announcement = event.data?.data();
    if (!announcement ||
        !boundedText(announcement.title, 120) ||
        /[\r\n]/.test(announcement.title) ||
        !boundedText(announcement.body, 2000) ||
        (announcement.url && (typeof announcement.url !== "string" || !announcement.url.startsWith("/") || announcement.url.startsWith("//"))) ||
        (announcement.category && !["science", "product", "service"].includes(announcement.category))) {
      throw new Error("Announcement is invalid; expected a short title, body and optional same-site path.");
    }
    const announcementId = event.params.announcementId;
    const url = new URL(announcement.url || "/", appOrigin.value()).toString();
    const users = await db.collection("users").where("notifications.inApp", "==", true).get();
    const failures = [];

    for (const userDoc of users.docs) {
      const prefs = userDoc.get("notifications") || {};
      const notificationRef = userDoc.ref.collection("notifications").doc(announcementId);
      const delivery = await db.runTransaction(async transaction => {
        const existing = await transaction.get(notificationRef);
        if (existing.exists) return existing.get("delivery") || {};
        const state = {
          push: prefs.push === true ? "pending" : "skipped",
          email: prefs.email === true ? "pending" : "skipped"
        };
        transaction.create(notificationRef, {
          title: announcement.title.trim(),
          body: announcement.body.trim(),
          url,
          category: announcement.category || "science",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          readAt: null,
          delivery: state
        });
        return state;
      });

      if (prefs.push === true && ["pending", "failed"].includes(delivery.push)) {
        const deviceDocs = await userDoc.ref.collection("devices").get();
        const tokens = deviceDocs.docs.map(doc => doc.get("token")).filter(Boolean);
        try {
          if (!tokens.length) {
            await notificationRef.update({ "delivery.push": "skipped" });
          } else {
            for (let offset = 0; offset < tokens.length; offset += 500) {
              const batch = tokens.slice(offset, offset + 500);
              if (!batch.length) continue;
            const result = await admin.messaging().sendEachForMulticast({
              tokens: batch,
              data: {
                title: announcement.title.trim(),
                body: announcement.body.trim(),
                url,
                category: announcement.category || "science"
              },
              webpush: { fcmOptions: { link: url } }
            });
            const invalid = result.responses
              .map((item, index) => ({ item, token: batch[index] }))
              .filter(({ item }) => ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(item.error?.code));
            await Promise.all(invalid.map(async ({ token }) => {
              const stale = deviceDocs.docs.find(doc => doc.get("token") === token);
              if (stale) await stale.ref.delete();
            }));
              if (result.failureCount > invalid.length) {
                throw new Error(`${result.failureCount - invalid.length} push deliveries failed.`);
              }
            }
            await notificationRef.update({ "delivery.push": "sent" });
          }
        } catch (error) {
          await notificationRef.update({ "delivery.push": "failed" });
          failures.push({ uid: userDoc.id, channel: "push", message: error.message });
        }
      }

      if (prefs.email === true && ["pending", "failed"].includes(delivery.email)) {
        try {
          const userRecord = await admin.auth().getUser(userDoc.id);
          if (userRecord.emailVerified && userRecord.email) {
            await deliverEmail({
              to: userRecord.email,
              title: announcement.title.trim(),
              body: announcement.body.trim(),
              url,
              announcementId
            });
            await notificationRef.update({ "delivery.email": "sent" });
          } else {
            await notificationRef.update({ "delivery.email": "skipped" });
          }
        } catch (error) {
          await notificationRef.update({ "delivery.email": "failed" });
          failures.push({ uid: userDoc.id, channel: "email", message: error.message });
        }
      }
    }
    if (failures.length) {
      logger.error("Some announcement deliveries failed; retrying the announcement.", { announcementId, failures });
      throw new Error(`${failures.length} notification channels failed.`);
    }
  }
);

exports.deleteMyAccount = onCall(async request => {
  if (!request.auth || request.data?.confirm !== true) {
    throw new HttpsError("unauthenticated", "Sign in again before deleting your account.");
  }
  const authenticatedAt = Number(request.auth.token.auth_time || 0);
  if (Date.now() / 1000 - authenticatedAt > 300) {
    throw new HttpsError("failed-precondition", "For your security, sign out and sign back in before deleting your account.");
  }
  const userRef = db.collection("users").doc(request.auth.uid);
  await db.recursiveDelete(userRef);
  await admin.auth().deleteUser(request.auth.uid);
  return { deleted: true };
});
