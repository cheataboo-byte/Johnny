# molecule lab

A bilingual, installable biochemistry learning app. The UI and ingredient rules run in the browser; real account sync, remote announcements, and push/email delivery use Firebase services configured by the project owner.

## Run locally

The demo works without Firebase and keeps its demo profile on the current browser/device. Serve this folder over HTTP rather than opening `index.html` directly; ES modules and service workers need a web origin.

For example, with Python installed:

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000`. Real push notifications require HTTPS in deployment (localhost is allowed for development).

## Chemistry guide and virtual lab

The app's built-in guide combines curated compounds, everyday product examples, and concept explanations. BioBot is a deterministic, rule-based educational guide, not a generative AI or a substitute for professional advice. It can compare known entries and make cautious name-based deductions; a deduction is not chemical identification.

When a named chemical is not in the local guide, BioBot can query the public NIH PubChem PUG REST API for database properties and a structure image. That lookup sends the chemical name to PubChem and requires an internet connection. Questions and chat transcripts are not saved; signed-in users' topic keys (such as a canonical compound or product category) are saved to personalize the science spotlight. Do not enter personal or sensitive information in chat.

The Virtual Reaction & Formulation Lab is a visual simulation, not a procedure or measurement device. It only calculates an idealized CO₂ gas volume from hypothetical 1:1 mole inputs; pH, temperature change, real reaction rate, and real yields are not predicted. Bleach with acids or ammonia and strong acid/base pairings are blocked without equations, quantities, yields, or gas animations. Never perform hazardous mixtures in real life.

The CO₂ stoichiometry calculation also has a small optional Python API. The browser always calculates locally first; when the API is available, it independently checks the limiting reagent and ideal-gas result and labels the active source. If the service is unreachable or returns an invalid result, the local calculation remains visible with a status message. Only hypothetical bicarbonate/acid amounts, temperature, and assumed pressure are sent; account details, profile data, product scans, and chat text are never sent to this API. It does not estimate final pH or temperature change.

For local development, install the API dependencies and run the service in a second terminal:

```powershell
py -m pip install -r python-api/requirements.txt
py -m uvicorn main:app --app-dir python-api --host 127.0.0.1 --port 8001
```

Run its focused model tests with:

```powershell
py -m unittest discover -s python-api/tests
```

For Firebase Hosting, deploy the stateless public calculation service to Cloud Run in the region configured in `firebase.json` (currently `us-central1`), then deploy Hosting:

```powershell
gcloud run deploy molecule-science-api --source python-api --region us-central1 --allow-unauthenticated
firebase deploy --only hosting
```

The Hosting `/api/**` rewrite proxies to that Cloud Run service. The endpoint accepts only bounded numeric inputs for the one supported virtual reaction and stores nothing. If using another host, set `SCIENCE_API_BASE_URL` in `science-api-client.js` to the API's base URL and configure explicit CORS origins; do not use `*` for production.

## Configure real accounts and sync

1. Create a Firebase project and register a **Web app**.
2. Enable **Authentication → Email/Password** and set the authorized domains and email templates.
3. Create a **Firestore database**.
4. Copy the web app's public Firebase config into `firebase-config.js`. Also copy the **Web Push certificates → Key pair** into `vapidKey`.
5. In Firebase Console, create a **Web Push certificate** and enable Cloud Messaging for the project.
6. Install the Firebase CLI, sign in, and select the project:

   ```powershell
   npm install -g firebase-tools
   firebase login
   firebase use --add
   ```

7. Deploy Firestore rules, hosting, and Cloud Functions:

   ```powershell
   firebase deploy
   ```

The Firebase web config and VAPID public key are client configuration, not service-account secrets. Do not put service-account JSON, private keys, or the Resend API key in `firebase-config.js`.

## Configure email delivery

Email updates are sent only to verified Firebase Auth email addresses whose owner opted in. The Cloud Function uses Resend; create a verified sender/domain and set its key as a Firebase Functions secret:

```powershell
firebase functions:secrets:set RESEND_API_KEY
```

Set the `EMAIL_FROM` and `APP_ORIGIN` function parameters to a verified sender (for example, `molecule lab <updates@your-domain.example>`) and your deployed HTTPS origin (for example, `https://your-site.web.app`) when prompted during deployment. Do not use the example defaults in production. Cloud Functions/Firestore deployment may require a billing-enabled Firebase plan.

## Publish a notification

The app never lets an unauthenticated browser send arbitrary email or push messages. To publish an update, use an administrator account in Firebase Console to create a document in the `announcements` collection. Client Firestore rules deny access to this collection; the console/Admin SDK bypasses client rules. The document shape is:

```json
{
  "title": "Science database update",
  "body": "A new educational ingredient spotlight is available.",
  "category": "science",
  "url": "/"
}
```

The deployed `deliverAnnouncement` function creates an in-app notification for opted-in users and delivers browser push/email only when those channels are enabled. Push requires each device to grant browser permission. Email requires a verified address and a correctly configured Resend sender. Delivery failures are logged and retried by Cloud Functions. Review Firebase logs and test with your own accounts before announcing to users.

## Profile and privacy boundaries

- Age is an optional broad range, never a birth date. Gender is optional and is **not** used to score suggestions.
- Skin preferences/concerns and allergy notes are optional. The app asks for explicit consent before saving concerns/allergy notes; a scan can flag an exact ingredient-name match only. This is not an allergy/safety checker.
- The rule-based engine cannot diagnose, account for medications, verify a formula, or replace advice from a qualified clinician. Do not add medication, emergency, or identifying medical-record details.
- Firebase Authentication handles real credentials. Firestore rules scope records to the signed-in UID. Account deletion uses a callable function, requires a recent sign-in, and removes that user's Firestore subtree and Auth account.
- Demo data is local to the device and is not a real account or cloud backup. Use Settings to export or delete data.

## Files

- `index.html` — app layout and accessible forms
- `styles.css` — responsive UI; Khmer text uses Noto Sans Khmer with local fallbacks
- `app.js` — analyzer, personalization, account/settings UI, and app behavior
- `bio-knowledge.js` — curated compounds, everyday-object and concept guides, cautious name deductions, and PubChem lookup
- `virtual-lab.js` — virtual-only reagent models, safety lockouts, and canvas animation
- `science-api-client.js`, `python-api/` — validated optional Python CO₂ model, Cloud Run container, and unit tests
- `firebase-client.js`, `firebase-config.js` — Firebase browser integration/config
- `firebase.json`, `firestore.rules`, `functions/` — hosting, user-scoped data rules, push/email delivery and account deletion
- `service-worker.js`, `manifest.webmanifest` — offline shell, push notifications, and install support
