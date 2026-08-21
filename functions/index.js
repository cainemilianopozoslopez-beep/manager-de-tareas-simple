const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const webpush = require('web-push');

admin.initializeApp();
const db = admin.firestore();

// Personal single-user-timezone app — there's no per-user timezone stored,
// so "today"/"now" for due-task comparisons are computed in one fixed zone
// rather than per-request UTC (which would make the 08:00 task fire at a
// different wall-clock hour depending on server region). Matches the client,
// which always uses the browser's local time (see taskUtils.js).
const TIMEZONE = process.env.APP_TIMEZONE || 'America/Mexico_City';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_CONTACT = process.env.VAPID_CONTACT_EMAIL || 'mailto:admin@example.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

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
// have several devices/browsers). A subscription that the browser has since
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

// Mirrors the client-side due-task check in App.jsx (the `setInterval` there),
// but server-side so it fires even with every tab/browser closed. Dedup uses
// a persisted `pushNotifiedAt` field on the task itself (the client's
// equivalent, `notifiedTaskKeysRef`, is in-memory and only lasts one tab
// session — this needs to survive across every 5-minute run).
exports.sendDueTaskPushes = onSchedule(
  { schedule: 'every 5 minutes', timeZone: TIMEZONE },
  async () => {
    if (!VAPID_PRIVATE_KEY) {
      logger.warn('VAPID_PRIVATE_KEY no configurada — saltando envío de push.');
      return;
    }

    const { dateStr: todayStr, timeStr: currentTimeStr } = nowPartsInTimeZone(TIMEZONE);

    // Iterates per-user `tasks` subcollections rather than a top-level
    // collectionGroup('tasks') query — a collectionGroup query on `dueDate`
    // needs a manually-provisioned composite index (nothing to query yet
    // until one exists), while `users/{uid}/tasks` scoped queries are
    // covered by Firestore's automatic single-field indexes with zero setup.
    // Fine tradeoff for a personal app: this is one extra read per user, not
    // per task, so it stays cheap regardless of task count.
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

    logger.info(`sendDueTaskPushes: ${due.length} tarea(s) vencida(s) de ${scanned} revisada(s) para ${todayStr}.`);

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
        logger.error(`Error enviando push para tarea ${taskDoc.id} (uid ${uid}):`, err);
      }
    }
  }
);
