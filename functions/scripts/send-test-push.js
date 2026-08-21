// Standalone helper — NOT deployed, not wired into index.js. Sends one push
// directly to a browser subscription, to verify the whole pipeline
// (subscribe -> this script -> service worker receives -> OS shows it)
// before trusting the real scheduled function (index.js) to do it on its own.
//
// Usage:
//   node scripts/send-test-push.js path/to/subscription.json
//   (or, without a file) SUBSCRIPTION_JSON='{"endpoint":...}' node scripts/send-test-push.js
require('dotenv').config();
const fs = require('fs');
const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_CONTACT = process.env.VAPID_CONTACT_EMAIL;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Falta VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en functions/.env (copiá .env.example).');
  process.exit(1);
}
webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const filePath = process.argv[2];
const raw = filePath ? fs.readFileSync(filePath, 'utf8') : process.env.SUBSCRIPTION_JSON;
if (!raw) {
  console.error('Uso: node scripts/send-test-push.js <archivo-suscripcion.json>');
  process.exit(1);
}

const subscription = JSON.parse(raw);
const payload = JSON.stringify({
  title: '🔔 Prueba de push',
  body: 'Si ves esto como notificación del sistema, el pipeline completo funciona.',
  url: '/'
});

webpush.sendNotification(subscription, payload)
  .then(() => console.log('Push enviado correctamente. Revisa el dispositivo suscrito.'))
  .catch((err) => {
    console.error('Error al enviar push:', err.statusCode, err.body || err.message);
    process.exit(1);
  });
