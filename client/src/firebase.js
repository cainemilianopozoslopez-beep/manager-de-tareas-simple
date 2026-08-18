import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch
} from 'firebase/firestore';

// Firebase Configuration from Google Console
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAf6WELd32a_QxLGwjZ__6sRf032B-lNJI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "manager-de-tareas.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "manager-de-tareas",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "manager-de-tareas.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "244336389802",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:244336389802:web:1ddcbf42feda027a2eead3"
};

// Initialize Firebase App & Firestore Database
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const isFirebaseConfigured = true;

// Export Firebase instance and Firestore
export { app, auth, db };

// ---- Error messages -------------------------------------------------------
// Firebase Auth throws errors with a `.code` like 'auth/wrong-password'.
// This maps the codes we actually expect to user-facing Spanish text.
const FIREBASE_ERROR_MESSAGES = {
  'auth/email-already-in-use': 'Ese correo ya está registrado. Intenta iniciar sesión.',
  'auth/invalid-email': 'El correo electrónico no es válido.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/user-not-found': 'Ese correo aún no está registrado. Haz clic en "¿No tienes cuenta? Regístrate".',
  'auth/wrong-password': 'Contraseña incorrecta. Revisa tu contraseña o restablece tu acceso.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos. Si es tu primera vez, haz clic en "¿No tienes cuenta? Regístrate".',
  'auth/too-many-requests': 'Demasiados intentos fallidos. Espera un momento y vuelve a intentar.',
  'auth/requires-recent-login': 'Por seguridad, debes volver a iniciar sesión.',
  'auth/network-request-failed': 'Error de conexión. Revisa tu conexión a internet.'
};

export function translateFirebaseError(err) {
  return FIREBASE_ERROR_MESSAGES[err?.code] || 'Ocurrió un error inesperado. Intenta de nuevo.';
}

// ---- Auth helpers -----------------------------------------------------------
export const loginWithEmail = (email, password) => {
  if (!auth) return Promise.reject(new Error('Firebase no está configurado'));
  return signInWithEmailAndPassword(auth, email, password);
};

export const registerWithEmail = (email, password) => {
  if (!auth) return Promise.reject(new Error('Firebase no está configurado'));
  return createUserWithEmailAndPassword(auth, email, password);
};

export const resetUserPassword = (email) => {
  if (!auth) return Promise.reject(new Error('Firebase no está configurado'));
  return sendPasswordResetEmail(auth, email);
};

export const logoutUser = () => {
  if (!auth) return Promise.resolve();
  return signOut(auth);
};

export const subscribeAuth = (callback) => {
  if (!auth) return () => { };
  return onAuthStateChanged(auth, callback);
};

// Updates the display name on the Firebase Auth user record itself.
export const updateUserDisplayName = async (displayName) => {
  if (!auth?.currentUser) throw new Error('No hay sesión activa');
  await updateProfile(auth.currentUser, { displayName });
};

// Password changes require a recent login; we re-authenticate with the current
// password first (Firebase throws 'auth/requires-recent-login' otherwise).
export const changeUserPassword = async (currentPassword, newPassword) => {
  if (!auth?.currentUser) throw new Error('No hay sesión activa');
  const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
  await reauthenticateWithCredential(auth.currentUser, cred);
  await updatePassword(auth.currentUser, newPassword);
};

// ---- Firestore: tasks live per-user at users/{uid}/tasks/{taskId}, matching
// firestore.rules (which only grants access under users/{request.auth.uid}) ----
const userTasksRef = (userId) => collection(db, 'users', userId, 'tasks');

// `onError`, if given, is called on a subscription error (e.g. a transient network
// blip) INSTEAD of `callback` — so a temporary Firestore hiccup surfaces as an error
// the caller can show, rather than silently wiping the task list to empty (which used
// to look indistinguishable from "you have no tasks" and could look like data loss).
export const subscribeUserTasks = (userId, callback, onError) => {
  if (!db) return () => {};
  const q = query(userTasksRef(userId), orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(tasks);
  }, (err) => {
    console.error('Firestore subscription error:', err);
    onError?.(err);
  });
};

export const addFirebaseTask = async (userId, taskData) => {
  if (!db) throw new Error('Firestore no está configurado');
  const docData = {
    ...taskData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  delete docData.id;
  delete docData.userId;
  const docRef = await addDoc(userTasksRef(userId), docData);
  return { id: docRef.id, ...docData };
};

export const updateFirebaseTask = async (userId, taskId, updates) => {
  if (!db || !taskId) throw new Error('Firestore no está configurado');
  const taskRef = doc(db, 'users', userId, 'tasks', taskId);
  await updateDoc(taskRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
};

export const deleteFirebaseTask = async (userId, taskId) => {
  if (!db || !taskId) throw new Error('Firestore no está configurado');
  const taskRef = doc(db, 'users', userId, 'tasks', taskId);
  await deleteDoc(taskRef);
};

// Applies one bulk action ('done'/'pending'/'trash'/'restore'/'category'/'delete') to
// many task ids in a single atomic write — mirrors the server's PATCH /tasks/batch.
export const batchApplyFirebaseAction = async (userId, ids, action, value) => {
  if (!db) throw new Error('Firestore no está configurado');
  const batch = writeBatch(db);
  ids.forEach(id => {
    const ref = doc(db, 'users', userId, 'tasks', id);
    if (action === 'delete') {
      batch.delete(ref);
      return;
    }
    const updates = { updatedAt: new Date().toISOString() };
    if (action === 'done') updates.done = true;
    else if (action === 'pending') updates.done = false;
    else if (action === 'trash') updates.trash = true;
    else if (action === 'restore') updates.trash = false;
    else if (action === 'category') updates.category = (value || 'general').toLowerCase();
    batch.update(ref, updates);
  });
  await batch.commit();
};

// ---- Firestore: settings (one doc per user, at users/{uid}/settings/main) ----
export const DEFAULT_USER_SETTINGS = {
  theme: 'light',
  notificationMode: 'browser',
  scheduledTime: '08:00',
  autoSendEnabled: true
};

export const getUserSettings = async (userId) => {
  if (!db || !userId) return { ...DEFAULT_USER_SETTINGS };
  const ref = doc(db, 'users', userId, 'settings', 'main');
  const snap = await getDoc(ref);
  return snap.exists() ? { ...DEFAULT_USER_SETTINGS, ...snap.data() } : { ...DEFAULT_USER_SETTINGS };
};

export const updateUserSettings = async (userId, updates) => {
  if (!db || !userId) throw new Error('Firestore no está configurado');
  const ref = doc(db, 'users', userId, 'settings', 'main');
  await setDoc(ref, updates, { merge: true });
  return getUserSettings(userId);
};

// ---- Backup export / import (client-side, no server involved) ----
export const exportUserBackup = async (userId, userInfo, settings) => {
  if (!db || !userId) throw new Error('Firestore no está configurado');
  const snap = await getDocs(userTasksRef(userId));
  const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return {
    exportedAt: new Date().toISOString(),
    user: { username: userInfo?.username || '', email: userInfo?.email || '' },
    settings,
    tasks
  };
};

// Restores a previously exported backup: overwrites/creates each task by id and
// merges the settings doc. Runs as one atomic batch.
export const importUserBackup = async (userId, backup) => {
  if (!db || !userId) throw new Error('Firestore no está configurado');
  const tasks = Array.isArray(backup?.tasks) ? backup.tasks : [];
  const batch = writeBatch(db);
  tasks.forEach(t => {
    const { id, ...rest } = t;
    const ref = id
      ? doc(db, 'users', userId, 'tasks', id)
      : doc(userTasksRef(userId));
    batch.set(ref, { ...rest, updatedAt: new Date().toISOString() });
  });
  if (backup?.settings && userId) {
    batch.set(doc(db, 'users', userId, 'settings', 'main'), backup.settings, { merge: true });
  }
  await batch.commit();
  return tasks.length;
};

// ---- Account deletion (GDPR-style "right to erasure") ----
// Requires a recent login, same as changeUserPassword — re-authenticates with the
// current password first. Deletes every task and the settings doc, then the Auth
// account itself. Firestore writes happen in batches of 500 (Firestore's per-batch
// limit); this is fine for a personal task list but would need paging past a few
// hundred thousand tasks, which is not a realistic scenario here.
export const deleteUserAccount = async (currentPassword) => {
  if (!auth?.currentUser) throw new Error('No hay sesión activa');
  const user = auth.currentUser;
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);

  const snap = await getDocs(userTasksRef(user.uid));
  const docRefs = snap.docs.map(d => d.ref);
  docRefs.push(doc(db, 'users', user.uid, 'settings', 'main'));
  for (let i = 0; i < docRefs.length; i += 500) {
    const batch = writeBatch(db);
    docRefs.slice(i, i + 500).forEach(ref => batch.delete(ref));
    await batch.commit();
  }

  await deleteUser(user);
};
