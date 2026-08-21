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

export async function getExistingPushSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(uid) {
  if (!isPushSupported()) throw new Error('Este navegador no soporta notificaciones push');
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
