import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// Converts the URL-safe base64 VAPID key into the Uint8Array the Push API expects.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// One Firestore doc per device/browser subscription, keyed off its endpoint so
// re-subscribing the same device overwrites rather than duplicates.
const subscriptionDocId = (endpoint) => btoa(endpoint).replace(/[^a-zA-Z0-9]/g, '').slice(-64);

export const isPushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

// iOS/iPadOS Safari only supports Web Push for a site that's been added to the
// Home Screen — `Notification`/`PushManager` exist in a regular Safari tab
// (isPushSupported() above can return true there), but subscribing silently
// fails because it's not actually usable outside that installed context.
// `navigator.standalone` is Safari's own non-standard flag for that; the
// display-mode media query is the standard equivalent other browsers use.
export const isIos = () =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

export const isRunningStandalone = () =>
  typeof window !== 'undefined' &&
  (window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches);

// True when push looks supported by the API surface but iOS will actually
// reject it because the site hasn't been added to the Home Screen yet.
export const needsIosInstallForPush = () => isIos() && !isRunningStandalone();

export async function getExistingPushSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(uid) {
  if (!isPushSupported()) throw new Error('Este navegador no soporta notificaciones push');
  if (needsIosInstallForPush()) {
    throw new Error('En iPhone/iPad, agrega TaskPulse a tu pantalla de inicio primero (Compartir → Agregar a inicio) y ábrela desde ahí antes de activar el push.');
  }
  if (!VAPID_PUBLIC_KEY) throw new Error('Falta configurar la llave pública VAPID (VITE_VAPID_PUBLIC_KEY)');

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  const json = subscription.toJSON();
  await setDoc(doc(db, 'users', uid, 'pushSubscriptions', subscriptionDocId(json.endpoint)), {
    ...json,
    userAgent: navigator.userAgent,
    createdAt: new Date().toISOString()
  });

  return subscription;
}

export async function unsubscribeFromPush(uid) {
  const subscription = await getExistingPushSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await deleteDoc(doc(db, 'users', uid, 'pushSubscriptions', subscriptionDocId(endpoint)));
}
