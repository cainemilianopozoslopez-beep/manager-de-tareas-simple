import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';

// Fallback configuration if environment variables are not set
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForInitializationOnly12345",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gmail-task-manager-demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gmail-task-manager-demo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gmail-task-manager-demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef1234567890"
};

// Check if valid Firebase config exists
export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID
);

let app = null;
let auth = null;
let db = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.warn('Firebase initialization notice:', err.message);
}

export { app, auth, db };

// Auth Helper Functions
export const loginWithEmail = (email, password) => {
  if (!auth) Promise.reject(new Error('Firebase no está configurado'));
  return signInWithEmailAndPassword(auth, email, password);
};

export const registerWithEmail = (email, password) => {
  if (!auth) Promise.reject(new Error('Firebase no está configurado'));
  return createUserWithEmailAndPassword(auth, email, password);
};

export const loginWithGoogle = () => {
  if (!auth) Promise.reject(new Error('Firebase no está configurado'));
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};

export const logoutUser = () => {
  if (!auth) return Promise.resolve();
  return signOut(auth);
};

export const subscribeAuth = (callback) => {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, callback);
};

// Firestore CRUD Helper Functions
export const subscribeUserTasks = (userId, callback) => {
  if (!db || !userId) return () => {};
  const tasksRef = collection(db, 'users', userId, 'tasks');
  const q = query(tasksRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(tasks);
  }, (err) => {
    console.error('Firestore subscription error:', err);
    callback([]);
  });
};

export const addFirebaseTask = async (userId, taskData) => {
  if (!db || !userId) throw new Error('Firestore no está configurado');
  const tasksRef = collection(db, 'users', userId, 'tasks');
  const docData = {
    ...taskData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  delete docData.id; // ensure no client id collision
  const docRef = await addDoc(tasksRef, docData);
  return { id: docRef.id, ...docData };
};

export const updateFirebaseTask = async (userId, taskId, updates) => {
  if (!db || !userId || !taskId) throw new Error('Firestore no está configurado');
  const taskRef = doc(db, 'users', userId, 'tasks', taskId);
  await updateDoc(taskRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
};

export const deleteFirebaseTask = async (userId, taskId) => {
  if (!db || !userId || !taskId) throw new Error('Firestore no está configurado');
  const taskRef = doc(db, 'users', userId, 'tasks', taskId);
  await deleteDoc(taskRef);
};
