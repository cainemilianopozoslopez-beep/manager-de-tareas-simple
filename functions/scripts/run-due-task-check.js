// Runs the "check for due tasks and push a notification" job as a plain
// script — designed to run on a schedule from GitHub Actions (see
// .github/workflows/send-due-pushes.yml), not as a deployed Firebase Cloud
// Function (that would need the Blaze billing plan; this doesn't).
//
// Needs, as environment variables (GitHub Actions injects these from repo
// secrets; for a local run, put them in functions/.env — see .env.example):
//   FIREBASE_SERVICE_ACCOUNT_JSON  — full JSON contents of a Firebase service
//                                    account key (Project Settings > Service
//                                    accounts > Generate new private key)
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_CONTACT_EMAIL
//   APP_TIMEZONE (optional, defaults to America/Mexico_City)
require('dotenv').config();
const admin = require('firebase-admin');
const webpush = require('web-push');

// GitHub's secret UI, and copy-paste in general, easily introduces a stray
// trailing newline/space around a pasted value — trim every secret so that
// doesn't turn into a cryptic "invalid base64"/JSON-parse failure.
const env = (name) => (process.env[name] || '').trim();

const serviceAccountJson = env('FIREBASE_SERVICE_ACCOUNT_JSON');
if (!serviceAccountJson) {
  console.error('Falta FIREBASE_SERVICE_ACCOUNT_JSON (llave de cuenta de servicio de Firebase).');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(serviceAccountJson)) });
const db = admin.firestore();

// Personal single-user-timezone app — there's no per-user timezone stored,
// so "today"/"now" for due-task comparisons are computed in one fixed zone
// rather than the CI runner's UTC clock (which would make an 08:00 task fire
// at the wrong wall-clock hour). Matches the client, which always uses the
// browser's local time (see client/src/taskUtils.js).
const TIMEZONE = env('APP_TIMEZONE') || 'America/Mexico_City';

const VAPID_PUBLIC_KEY = env('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = env('VAPID_PRIVATE_KEY');
const VAPID_CONTACT = env('VAPID_CONTACT_EMAIL');

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Falta VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.');
  process.exit(1);
}
webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function nowPartsInTimeZone(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date()).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    timeStr: `${parts.hour}:${parts.minute}`
  };
}

// Sends one push to every subscription registered for this user (they may
// have several devices/browsers). A subscription the browser has since
// revoked/expired comes back as a 404/410 from the push service — that's
// expected steady-state, not an error, so we just delete it and move on.
async function sendPushToUser(uid, payload) {
  const subsSnap = await db.collection('users').doc(uid).collection('pushSubscriptions').get();
  await Promise.allSettled(
    subsSnap.docs.map(async (subDoc) => {
      const sub = subDoc.data();
      const subscription = { endpoint: sub.endpoint, keys: sub.keys };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await subDoc.ref.delete();
        } else {
          throw err;
        }
      }
    })
  );
}

// Mirrors the client-side due-task check in App.jsx (the `setInterval`
// there), but server-side so it fires even with every tab/browser closed.
// Dedup uses a persisted `pushNotifiedAt` field on the task itself (the
// client's equivalent, `notifiedTaskKeysRef`, is in-memory and only lasts
// one tab session — this needs to survive across every run of this script).
async function main() {
  const { dateStr: todayStr, timeStr: currentTimeStr } = nowPartsInTimeZone(TIMEZONE);

  // Iterates per-user `tasks` subcollections rather than a top-level
  // collectionGroup('tasks') query — a collectionGroup query on `dueDate`
  // needs a manually-provisioned composite index, while `users/{uid}/tasks`
  // scoped queries are covered by Firestore's automatic single-field
  // indexes with zero setup. Fine tradeoff for a personal app: this is one
  // extra read per user, not per task.
  const usersSnap = await db.collection('users').listDocuments();
  let scanned = 0;
  const due = [];
  for (const userRef of usersSnap) {
    const tasksSnap = await userRef.collection('tasks').where('dueDate', '==', todayStr).get();
    scanned += tasksSnap.size;
    tasksSnap.docs.forEach((d) => {
      const t = d.data();
      if (!t.done && !t.trash && t.dueTime && t.dueTime <= currentTimeStr && !t.pushNotifiedAt) {
        due.push({ uid: userRef.id, taskDoc: d, task: t });
      }
    });
  }

  console.log(`${due.length} tarea(s) vencida(s) de ${scanned} revisada(s) para ${todayStr} ${currentTimeStr} (${TIMEZONE}).`);

  for (const { uid, taskDoc, task } of due) {
    try {
      await sendPushToUser(uid, {
        title: `⏰ ${task.title}`,
        body: task.description || `Tarea programada para las ${task.dueTime}`,
        url: '/',
        tag: `task-due-${taskDoc.id}`
      });
      await taskDoc.ref.update({ pushNotifiedAt: new Date().toISOString() });
    } catch (err) {
      console.error(`Error enviando push para tarea ${taskDoc.id} (uid ${uid}):`, err);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error en run-due-task-check:', err);
    process.exit(1);
  });
