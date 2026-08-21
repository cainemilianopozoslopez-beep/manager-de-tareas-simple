import React, { useState, useEffect, useRef, useCallback } from 'react';
import PulseHeader from './components/PulseHeader';
import PulseSidebar from './components/PulseSidebar';
import MatrixView from './components/MatrixView';
import TaskList from './components/TaskList';
import TaskModal from './components/TaskModal';
import SettingsModal from './components/SettingsModal';
import Login from './components/Login';
import ProfileModal from './components/ProfileModal';
import StatsDashboard from './components/StatsDashboard';
import CalendarView from './components/CalendarView';
import MatrixOnboarding from './components/MatrixOnboarding';
import { CheckCircle2, AlertCircle, Plus, LayoutGrid, List, Calendar, BarChart2 } from 'lucide-react';
import { getTodayStr, dateStrDaysFromToday, advanceRecurringTasks, filterTasks, filterByTab, filterByCategory, filterBySearch } from './taskUtils';
import {
  subscribeAuth,
  subscribeUserTasks,
  addFirebaseTask,
  updateFirebaseTask,
  deleteFirebaseTask,
  batchApplyFirebaseAction,
  getUserSettings,
  updateUserSettings,
  exportUserBackup,
  importUserBackup,
  deleteUserAccount,
  logoutUser
} from './firebase';
import { isPushSupported, getExistingPushSubscription, subscribeToPush, unsubscribeFromPush } from './push';

const BASE_CATEGORIES = ['trabajo', 'personal', 'urgente', 'ideas', 'general'];

const DEFAULT_GUEST_TASKS = [
  {
    id: 'guest-task-1',
    title: 'Probar panel de tareas como Invitado 👤',
    description: 'Esta tarea solo existe temporalmente mientras la pestaña esté abierta.',
    priority: 'media',
    category: 'personal',
    dueDate: getTodayStr(),
    dueTime: '12:00',
    recurrence: 'none',
    starred: true,
    done: false,
    trash: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'guest-task-2',
    title: 'Crear una nueva tarea temporal',
    description: 'Recuerda que al cerrar la página todo lo creado en Modo Invitado se borrará.',
    priority: 'alta',
    category: 'trabajo',
    dueDate: getTodayStr(),
    dueTime: '16:00',
    recurrence: 'none',
    starred: false,
    done: false,
    trash: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export default function App() {
  // Authentication State (Saved Account or Guest Session)
  const [user, setUser] = useState(() => {
    const savedSession = sessionStorage.getItem('gmail_task_guest_user');
    if (savedSession) return JSON.parse(savedSession);
    const savedLocal = localStorage.getItem('gmail_task_user');
    if (!savedLocal) return null;
    const parsed = JSON.parse(savedLocal);
    // Accounts cached before the Firebase migration have no uid — no longer valid,
    // since every registered user must now come from Firebase Auth.
    if (!parsed.isGuest && !parsed.uid) {
      localStorage.removeItem('gmail_task_user');
      return null;
    }
    return parsed;
  });

  // Local Tasks State (Guest mode only — sessionStorage, so it truly clears when the
  // tab/page closes, matching the "se borrará al cerrar la página" promise on the
  // login screen. A previous version also mirrored this to localStorage, which
  // silently survived browser restarts; that leftover key is purged below.)
  const [guestTasks, setGuestTasks] = useState(() => {
    const savedSessionTasks = sessionStorage.getItem('gmail_task_guest_tasks');
    return savedSessionTasks ? JSON.parse(savedSessionTasks) : DEFAULT_GUEST_TASKS;
  });

  // Theme State ('light' | 'dark')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('gmail_task_theme') || user?.theme || 'light';
  });

  const [tasks, setTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [settings, setSettings] = useState(null);
  const [currentTab, setCurrentTab] = useState('inbox');
  const [activeView, setActiveView] = useState('matrix'); // 'matrix' | 'list' | 'calendar' | 'stats'
  const [currentCategory, setCurrentCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced mirror of searchQuery: the input updates searchQuery on every keystroke
  // (instant UI + instant in-memory counts), but the task fetch only re-runs off this
  // value, so we don't fire a server round-trip per character.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  // Sticks (unlike the transient toast) until a snapshot succeeds again — the
  // toast alone is easy to miss, and on a cold/offline first load there's no
  // cached data yet, so the board otherwise looks like it lost everything.
  const [firestoreError, setFirestoreError] = useState(false);
  const [toast, setToast] = useState(null);

  // Bulk selection: ids of tasks currently checked for a batch action.
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Browser Notification State
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Web Push subscription for this device/browser (null = not subscribed).
  const [pushSubscription, setPushSubscription] = useState(null);

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  // Prefilled due date when composing from the calendar (null = default to today).
  const [composeDate, setComposeDate] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Tracks which task-due notifications have already fired today (id-date keys)
  const notifiedTaskKeysRef = useRef(new Set());

  // Undo-able deletion: ids in here are hidden from view immediately, but the actual
  // server/local mutation is deferred until the undo window elapses without a click.
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set());
  const deleteTimeoutsRef = useRef({});
  const emptyTrashTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const UNDO_WINDOW_MS = 5000;

  // Keep guest tasks synced to sessionStorage (survives a reload of the same
  // tab, but not a new tab or browser restart — see the note above).
  useEffect(() => {
    if (user?.isGuest) {
      sessionStorage.setItem('gmail_task_guest_tasks', JSON.stringify(guestTasks));
    }
  }, [guestTasks, user]);

  // One-time cleanup: purge the old localStorage guest-task mirror from
  // earlier versions, which persisted guest data across browser restarts
  // despite the login screen promising it gets erased on page close.
  useEffect(() => {
    localStorage.removeItem('gmail_task_local_tasks');
  }, []);

  // Apply Theme attribute to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gmail_task_theme', theme);
  }, [theme]);

  // Debounce the search term that drives task fetching (300ms after the last keystroke).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Restore/sync the registered-user session from Firebase Auth itself (not just the
  // localStorage cache) — this is what makes the login persist across reloads and
  // devices. Never overrides an active guest session.
  useEffect(() => {
    const unsubscribe = subscribeAuth((firebaseUser) => {
      if (!firebaseUser) return;
      setUser(prev => {
        if (prev?.isGuest) return prev;
        const restored = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
          isGuest: false,
          theme: prev?.theme || 'light'
        };
        localStorage.setItem('gmail_task_user', JSON.stringify(restored));
        return restored;
      });
    });
    return () => unsubscribe();
  }, []);

  // Memoized so it's a stable dependency for the notification callbacks/effects below
  // (it only touches refs and setters, so it never needs to change identity).
  const showToast = useCallback((message, type = 'success', options = {}) => {
    const { action = null, duration = 4000 } = options;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type, action });
    toastTimeoutRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  // Handle Registered User Login
  const handleLoginSuccess = (userData) => {
    sessionStorage.removeItem('gmail_task_guest_user');
    sessionStorage.removeItem('gmail_task_guest_tasks');
    setUser(userData);
    localStorage.setItem('gmail_task_user', JSON.stringify(userData));
    if (userData.theme) {
      setTheme(userData.theme);
    }
    showToast(`¡Bienvenido de nuevo, ${userData.username}!`);
  };

  // Handle Guest Login
  const handleGuestLogin = () => {
    localStorage.removeItem('gmail_task_user');
    const guestUser = { username: 'Invitado', isGuest: true, theme: 'light' };
    setUser(guestUser);
    sessionStorage.setItem('gmail_task_guest_user', JSON.stringify(guestUser));
    sessionStorage.setItem('gmail_task_guest_tasks', JSON.stringify(DEFAULT_GUEST_TASKS));
    setGuestTasks(DEFAULT_GUEST_TASKS);
    showToast('👤 Modo Invitado iniciado. ¡Todo lo que crees se borrará al cerrar la pestaña!');
  };

  // Handle Logout (Wipes guest data completely)
  const handleLogout = () => {
    if (user?.isGuest) {
      sessionStorage.removeItem('gmail_task_guest_user');
      sessionStorage.removeItem('gmail_task_guest_tasks');
      setGuestTasks(DEFAULT_GUEST_TASKS);
      showToast('Modo Invitado finalizado. Datos borrados.');
    } else {
      localStorage.removeItem('gmail_task_user');
      logoutUser().catch(err => console.error('Error al cerrar sesión en Firebase:', err));
      showToast('Sesión cerrada correctamente.');
    }
    setUser(null);
  };

  // Handle Toggle Dark/Light Theme
  const handleToggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);

    if (user) {
      const updatedUser = { ...user, theme: newTheme };
      setUser(updatedUser);
      if (user.isGuest) {
        sessionStorage.setItem('gmail_task_guest_user', JSON.stringify(updatedUser));
      } else {
        localStorage.setItem('gmail_task_user', JSON.stringify(updatedUser));
        if (user.uid) {
          try {
            await updateUserSettings(user.uid, { theme: newTheme });
          } catch (err) {
            console.error('Error al guardar preferencia de tema:', err);
          }
        }
      }
    }
    showToast(`Modo ${newTheme === 'dark' ? 'Oscuro 🌙' : 'Claro ☀️'} activado`);
  };

  // Handle Profile Update
  const handleUpdateProfile = (updatedUserData) => {
    const newUserState = { ...user, ...updatedUserData };
    setUser(newUserState);
    localStorage.setItem('gmail_task_user', JSON.stringify(newUserState));
    if (updatedUserData.theme) {
      setTheme(updatedUserData.theme);
    }
    showToast('Perfil actualizado correctamente');
  };

  // Permanently delete the account and all of its data (right to erasure).
  // Throws on failure so ProfileModal can show the error and let the user retry —
  // only clears local session state after Firestore + Auth deletion succeed.
  const handleDeleteAccount = async (password) => {
    await deleteUserAccount(password);
    localStorage.removeItem('gmail_task_user');
    setUser(null);
    showToast('Tu cuenta y tus datos fueron eliminados permanentemente.');
  };

  // Request Web Browser Notification Permission
  const requestNotificationPermission = useCallback(async (showSuccessToast = true) => {
    if (!('Notification' in window)) {
      showToast('Tu navegador no soporta notificaciones de escritorio', 'error');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        if (showSuccessToast) {
          showToast('🔔 ¡Permiso de notificaciones concedido exitosamente!');
        }
      } else if (permission === 'denied') {
        showToast('⚠️ Permiso de notificaciones denegado', 'error');
      }
    } catch (err) {
      console.error('Error al pedir permisos:', err);
    }
  }, [showToast]);

  // Web Push: separate from the Notification permission above — this is the
  // part that lets alerts arrive with every tab of the app closed. Requires
  // both the Notification permission (requested here if missing) AND a
  // PushManager subscription persisted to Firestore so the backend knows
  // where to deliver to.
  const enablePushNotifications = useCallback(async () => {
    if (!isPushSupported()) {
      showToast('Este navegador no soporta notificaciones push', 'error');
      return;
    }
    if (user?.isGuest) {
      showToast('El modo invitado no guarda datos en la nube — inicia sesión para usar push', 'error');
      return;
    }
    try {
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission !== 'granted') {
          showToast('⚠️ Permiso de notificaciones denegado', 'error');
          return;
        }
      }
      const subscription = await subscribeToPush(user.uid);
      setPushSubscription(subscription);
      showToast('🔔 Notificaciones push activadas en este dispositivo');
    } catch (err) {
      console.error('Error al activar push:', err);
      showToast('No se pudo activar el push: ' + err.message, 'error');
    }
  }, [user, showToast]);

  const disablePushNotifications = useCallback(async () => {
    if (!user || user.isGuest) return;
    try {
      await unsubscribeFromPush(user.uid);
      setPushSubscription(null);
      showToast('Notificaciones push desactivadas en este dispositivo');
    } catch (err) {
      console.error('Error al desactivar push:', err);
      showToast('No se pudo desactivar el push', 'error');
    }
  }, [user, showToast]);

  // Load any existing subscription for this device on login (so the Settings
  // panel reflects reality instead of always starting "off"), and listen for
  // the SW's push-received side-channel message (see public/sw.js) purely so
  // we have something observable in the page console while testing.
  useEffect(() => {
    if (!user || user.isGuest || !isPushSupported()) {
      setPushSubscription(null);
      return;
    }
    let cancelled = false;
    getExistingPushSubscription().then((sub) => { if (!cancelled) setPushSubscription(sub); });

    const onMessage = (event) => {
      if (event.data?.type === 'push-received') {
        console.log('[push] recibido:', event.data.title, '-', event.data.body);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, [user]);

  // Dispatch Native Web Notification
  const triggerBrowserNotification = useCallback((isManualTest = true) => {
    if (!('Notification' in window)) {
      showToast('Tu navegador no soporta notificaciones de escritorio', 'error');
      return;
    }

    if (Notification.permission !== 'granted') {
      requestNotificationPermission(true);
      return;
    }

    const pendingTasks = allTasks.filter(t => !t.done && !t.trash);
    const count = pendingTasks.length;
    const titleText = count === 0 
      ? '🎉 ¡No tienes tareas pendientes hoy!' 
      : `📬 Resumen Diario: ${count} ${count === 1 ? 'tarea pendiente' : 'tareas pendientes'}`;

    const bodyText = pendingTasks.length > 0 
      ? pendingTasks.slice(0, 3).map((t, i) => `${i + 1}. ${t.title} [${t.priority}]`).join('\n')
      : 'Has completado todas tus actividades asignadas.';

    try {
      const notif = new Notification(titleText, {
        body: bodyText,
        icon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
        tag: 'gmail-task-summary'
      });

      notif.onclick = () => {
        window.focus();
      };

      if (isManualTest) {
        showToast('🔔 Notificación de prueba enviada al escritorio');
      }
    } catch (err) {
      console.error('Error al emitir notificación:', err);
    }
  }, [allTasks, showToast, requestNotificationPermission]);

  // Subscribe to Firestore Tasks in real-time when user has a Firebase UID
  useEffect(() => {
    if (!user || user.isGuest || !user.uid) return;

    setLoading(true);
    const unsubscribe = subscribeUserTasks(
      user.uid,
      (firestoreTasks) => {
        const advanced = advanceRecurringTasks(firestoreTasks);
        setAllTasks(advanced);
        setLoading(false);
        setFirestoreError(false);

        // advanceRecurringTasks only changes dueDate in the in-memory copy —
        // it never used to reach Firestore, so a recurring task's stored
        // dueDate stayed on its very first occurrence forever. That silently
        // broke reminders for it (the GitHub Actions push job reads dueDate
        // straight from Firestore, with no idea this client-side rollover
        // logic exists, so it could never match "due today" again). Persist
        // whichever tasks actually rolled forward so the stored date matches
        // what's on screen. Safe to fire-and-forget: once written, the next
        // snapshot echo has dueDate >= today, so advanceRecurringTasks no
        // longer flags it and this doesn't loop.
        if (advanced !== firestoreTasks) {
          const byId = new Map(firestoreTasks.map(t => [t.id, t]));
          advanced.forEach(t => {
            const original = byId.get(t.id);
            if (original && original.dueDate !== t.dueDate) {
              updateFirebaseTask(user.uid, t.id, { dueDate: t.dueDate, done: false }).catch(err => {
                console.error('Error al persistir avance de recurrencia:', err);
              });
            }
          });
        }
      },
      () => {
        // Keep whatever tasks were last loaded instead of wiping them to
        // empty — a subscription error is usually transient (network blip),
        // not "you have zero tasks now". If this is the very first load
        // (nothing cached yet), the board still ends up empty — firestoreError
        // renders a persistent banner for that case instead of only a 4s toast.
        setLoading(false);
        setFirestoreError(true);
        showToast('No se pudo conectar con el servidor. Tus tareas visibles pueden no estar actualizadas.', 'error');
      }
    );

    return () => unsubscribe();
  }, [user, showToast]);

  // Fetch Tasks (Handles Server DB, Firestore, or Guest Session Storage)
  const fetchTasks = useCallback(async () => {
    if (!user) return;

    if (user.isGuest) {
      const advancedGuestTasks = advanceRecurringTasks(guestTasks);
      if (advancedGuestTasks !== guestTasks) {
        setGuestTasks(advancedGuestTasks);
      }
      const filtered = filterTasks(advancedGuestTasks, {
        tab: currentTab,
        category: currentCategory,
        search: debouncedSearch
      });
      setTasks(filtered);
      setAllTasks(advancedGuestTasks);
      return;
    }

    if (user.uid) {
      // User is authenticated via Firebase: filter in-memory from Firestore allTasks
      const filtered = filterTasks(allTasks, {
        tab: currentTab,
        category: currentCategory,
        search: debouncedSearch
      });
      setTasks(filtered);
    }
  }, [user, currentTab, currentCategory, debouncedSearch, guestTasks, allTasks]);

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    if (!user || user.isGuest || !user.uid) return;
    try {
      const data = await getUserSettings(user.uid);
      setSettings(data);
    } catch (err) {
      console.error('Error al cargar configuración:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchTasks();
    fetchSettings();
  }, [fetchTasks, fetchSettings]);

  // Client-side timer: per-task due notifications + daily summary (with catch-up, not exact-second dependent)
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      const now = new Date();
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayStr = getTodayStr();

      // Individual task-due notifications (fires once per task per day, as soon as its dueTime arrives)
      if (notificationPermission === 'granted') {
        const sourceTasks = user.isGuest ? guestTasks : allTasks;
        sourceTasks.forEach(t => {
          if (t.done || t.trash || !t.dueTime) return;
          const taskDate = t.dueDate || todayStr;
          if (taskDate !== todayStr || t.dueTime > currentTimeStr) return;

          const key = `${t.id}-${todayStr}`;
          if (notifiedTaskKeysRef.current.has(key)) return;
          notifiedTaskKeysRef.current.add(key);

          try {
            const notif = new Notification(`⏰ ${t.title}`, {
              body: t.description || `Tarea programada para las ${t.dueTime}`,
              tag: `task-due-${t.id}`
            });
            notif.onclick = () => window.focus();
          } catch (err) {
            console.error('Error al emitir notificación de tarea:', err);
          }
        });
      }

      // Daily summary browser notification (fires once per day once the scheduled time has passed)
      if (
        notificationPermission === 'granted' &&
        settings?.autoSendEnabled &&
        settings?.scheduledTime &&
        (settings.notificationMode === 'browser' || settings.notificationMode === 'both')
      ) {
        const lastNotifiedDay = localStorage.getItem('gmail_task_last_browser_summary_date');
        if (lastNotifiedDay !== todayStr && currentTimeStr >= settings.scheduledTime) {
          localStorage.setItem('gmail_task_last_browser_summary_date', todayStr);
          triggerBrowserNotification(false);
        }
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [user, settings, allTasks, guestTasks, notificationPermission, triggerBrowserNotification]);

  // Gmail-style keyboard shortcuts. Global single keys plus a `g`-then-letter chord for
  // navigating views. Ignored while typing in a field or when any modal is open.
  const lastGRef = useRef(0);
  useEffect(() => {
    const onKey = (e) => {
      if (!user) return;
      const tag = e.target.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;
      const modalOpen = isTaskModalOpen || isSettingsOpen || isProfileModalOpen;
      if (typing || modalOpen || e.metaKey || e.ctrlKey || e.altKey) return;

      const now = Date.now();
      const afterG = now - lastGRef.current < 1000;
      lastGRef.current = 0;

      // `g` then an initial → jump to a view (i=inbox, h=hoy, v=vencidas, s=semana,
      // d=destacadas, p=programadas, c=completadas, b=basura/papelera).
      if (afterG) {
        const map = { i: 'inbox', h: 'today', v: 'overdue', s: 'week', d: 'starred', p: 'scheduled', c: 'completed', b: 'trash' };
        const tab = map[e.key.toLowerCase()];
        if (tab) { e.preventDefault(); setCurrentTab(tab); }
        return;
      }

      if (e.key === 'g') { lastGRef.current = now; return; }
      if (e.key === 'c') { e.preventDefault(); setEditingTask(null); setIsTaskModalOpen(true); return; }
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('task-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [user, isTaskModalOpen, isSettingsOpen, isProfileModalOpen]);

  // ---- Bulk selection ----
  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectMany = (ids) => setSelectedIds(new Set(ids));
  const clearSelection = () => setSelectedIds(new Set());

  // Clear the selection whenever the visible set changes, so a batch action can never
  // hit tasks the user can no longer see.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentTab, currentCategory, debouncedSearch]);

  const handleBulkAction = async (action, value) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    if (user?.isGuest) {
      setGuestTasks(prev => {
        if (action === 'delete') return prev.filter(t => !selectedIds.has(t.id));
        return prev.map(t => {
          if (!selectedIds.has(t.id)) return t;
          const u = { ...t, updatedAt: new Date().toISOString() };
          if (action === 'done') u.done = true;
          else if (action === 'pending') u.done = false;
          else if (action === 'trash') u.trash = true;
          else if (action === 'restore') u.trash = false;
          else if (action === 'category') u.category = (value || 'general').toLowerCase();
          return u;
        });
      });
      clearSelection();
      showToast(`Acción aplicada a ${ids.length} ${ids.length === 1 ? 'tarea' : 'tareas'}`);
      return;
    }

    if (user?.uid) {
      try {
        await batchApplyFirebaseAction(user.uid, ids, action, value);
        clearSelection();
        showToast(`Acción aplicada a ${ids.length} ${ids.length === 1 ? 'tarea' : 'tareas'}`);
      } catch (err) {
        console.error('Error en Firestore (acción en lote):', err);
        showToast('No se pudo aplicar la acción en lote', 'error');
      }
    }
  };

  // Create or Edit Task
  const handleSaveTask = async (taskData) => {
    if (user?.isGuest) {
      if (taskData.id) {
        setGuestTasks(prev => prev.map(t => t.id === taskData.id ? { ...t, ...taskData, updatedAt: new Date().toISOString() } : t));
        showToast('Tarea actualizada correctamente');
      } else {
        const newTask = {
          ...taskData,
          id: 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
          starred: false,
          done: false,
          trash: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setGuestTasks(prev => [newTask, ...prev]);
        showToast('Nueva tarea guardada');
      }
      return;
    }

    if (!user?.uid) return;
    try {
      if (taskData.id) {
        await updateFirebaseTask(user.uid, taskData.id, taskData);
        showToast('Tarea actualizada correctamente');
      } else {
        await addFirebaseTask(user.uid, {
          ...taskData,
          starred: false,
          done: false,
          trash: false
        });
        showToast('Nueva tarea guardada');
      }
    } catch (err) {
      console.error('Error al guardar en Firestore:', err);
      showToast('Error al guardar la tarea', 'error');
      // Re-thrown so TaskModal's handleSubmit sees the failure and keeps the
      // form open with what the user typed, instead of closing as if it saved.
      throw err;
    }
  };

  // Toggle Done
  const handleToggleDone = async (id) => {
    const target = (user?.isGuest ? guestTasks : allTasks).find(t => t.id === id);
    const nextDone = target ? !target.done : true;
    const nextSubtasks = target && target.subtasks ? target.subtasks.map(s => ({ ...s, done: nextDone })) : [];

    if (user?.isGuest) {
      setGuestTasks(prev => prev.map(t => t.id === id ? { ...t, done: nextDone, subtasks: nextSubtasks, updatedAt: new Date().toISOString() } : t));
      showToast(nextDone ? 'Tarea marcada como realizada' : 'Tarea reabierta como pendiente');
      return;
    }

    if (user?.uid) {
      try {
        await updateFirebaseTask(user.uid, id, { done: nextDone, subtasks: nextSubtasks });
        showToast(nextDone ? 'Tarea marcada como realizada' : 'Tarea reabierta como pendiente');
      } catch (err) {
        console.error('Error en Firestore:', err);
        showToast('Error al actualizar estado', 'error');
      }
    }
  };

  // Toggle Starred
  const handleToggleStar = async (id) => {
    if (user?.isGuest) {
      setGuestTasks(prev => prev.map(t => t.id === id ? { ...t, starred: !t.starred, updatedAt: new Date().toISOString() } : t));
      return;
    }

    if (user?.uid) {
      try {
        const target = allTasks.find(t => t.id === id);
        if (target) {
          await updateFirebaseTask(user.uid, id, { starred: !target.starred });
        }
      } catch (err) {
        console.error('Error en Firestore:', err);
        showToast('Error al destacar tarea', 'error');
      }
    }
  };

  // Actually performs a task deletion (trash it, or wipe it for good if already trashed).
  // Called only after the undo window in handleDeleteTask has elapsed.
  const commitDeleteTask = async (id) => {
    if (user?.isGuest) {
      setGuestTasks(prev => {
        const target = prev.find(t => t.id === id);
        if (!target) return prev;
        if (!target.trash) {
          return prev.map(t => t.id === id ? { ...t, trash: true } : t);
        } else {
          return prev.filter(t => t.id !== id);
        }
      });
      return;
    }

    if (user?.uid) {
      try {
        const target = allTasks.find(t => t.id === id);
        if (target) {
          if (!target.trash) {
            await updateFirebaseTask(user.uid, id, { trash: true });
          } else {
            await deleteFirebaseTask(user.uid, id);
          }
        }
      } catch (err) {
        console.error('Error en Firestore:', err);
        showToast('Error al eliminar tarea', 'error');
      }
    }
  };

  // Delete Task: hides it immediately and shows an "Undo" toast instead of blocking
  // with a confirm() dialog. The real deletion (or permanent wipe) only happens if
  // the undo window elapses without the user clicking "Deshacer".
  const handleDeleteTask = (id) => {
    const target = visibleAllTasks.find(t => t.id === id);
    const isPermanent = Boolean(target?.trash);

    setPendingDeleteIds(prev => new Set(prev).add(id));

    deleteTimeoutsRef.current[id] = setTimeout(() => {
      delete deleteTimeoutsRef.current[id];
      setPendingDeleteIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      commitDeleteTask(id);
    }, UNDO_WINDOW_MS);

    showToast(
      isPermanent ? 'Tarea eliminada permanentemente' : 'Tarea movida a la papelera',
      'success',
      {
        duration: UNDO_WINDOW_MS,
        action: {
          label: 'Deshacer',
          onClick: () => {
            clearTimeout(deleteTimeoutsRef.current[id]);
            delete deleteTimeoutsRef.current[id];
            setPendingDeleteIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            setToast(null);
          }
        }
      }
    );
  };

  // Actually empties the trash. Called only after the undo window has elapsed.
  const commitEmptyTrash = async () => {
    if (user?.isGuest) {
      setGuestTasks(prev => prev.filter(t => !t.trash));
      return;
    }

    if (user?.uid) {
      const ids = allTasks.filter(t => t.trash).map(t => t.id);
      if (ids.length === 0) return;
      try {
        await batchApplyFirebaseAction(user.uid, ids, 'delete');
      } catch (err) {
        console.error('Error en Firestore (vaciar papelera):', err);
        showToast('No se pudo vaciar la papelera', 'error');
      }
    }
  };

  // Empty Trash: same undo pattern as handleDeleteTask, applied to every trashed task at once.
  const handleEmptyTrash = () => {
    // A second click while the first batch's undo window is still open would
    // overwrite emptyTrashTimeoutRef, orphaning the first timer (it still fires,
    // but its own "Deshacer" button can no longer cancel it) and making the
    // second toast's undo cancel the wrong batch. Nothing changed in between —
    // the trashed set is identical until the pending batch actually commits —
    // so just ignore the repeat click instead.
    if (emptyTrashTimeoutRef.current) return;

    const trashedIds = visibleAllTasks.filter(t => t.trash).map(t => t.id);
    if (trashedIds.length === 0) return;

    setPendingDeleteIds(prev => {
      const next = new Set(prev);
      trashedIds.forEach(id => next.add(id));
      return next;
    });

    emptyTrashTimeoutRef.current = setTimeout(() => {
      emptyTrashTimeoutRef.current = null;
      setPendingDeleteIds(prev => {
        const next = new Set(prev);
        trashedIds.forEach(id => next.delete(id));
        return next;
      });
      commitEmptyTrash();
    }, UNDO_WINDOW_MS);

    showToast('Papelera vaciada', 'success', {
      duration: UNDO_WINDOW_MS,
      action: {
        label: 'Deshacer',
        onClick: () => {
          clearTimeout(emptyTrashTimeoutRef.current);
          emptyTrashTimeoutRef.current = null;
          setPendingDeleteIds(prev => {
            const next = new Set(prev);
            trashedIds.forEach(id => next.delete(id));
            return next;
          });
          setToast(null);
        }
      }
    });
  };

  // Save Settings
  const handleSaveSettings = async (newSettings) => {
    if (user?.isGuest) {
      showToast('La configuración de notificaciones pertenece a la cuenta real, no está disponible en Modo Invitado', 'error');
      return;
    }
    if (!user?.uid) return;
    try {
      const data = await updateUserSettings(user.uid, newSettings);
      setSettings(data);
      showToast('Configuración de alerta guardada correctamente');
    } catch (err) {
      console.error('Error al guardar la configuración:', err);
      showToast('Error al guardar configuración', 'error');
      // Re-thrown so SettingsModal's handleSubmit sees the failure and skips
      // its own "guardado" success banner instead of showing it unconditionally.
      throw err;
    }
  };

  // Download a full backup (settings + tasks) of the real account's data as a JSON
  // file — built entirely client-side from Firestore, no server involved.
  const handleExportBackup = async () => {
    if (user?.isGuest) {
      showToast('El respaldo pertenece a la cuenta real, no está disponible en Modo Invitado', 'error');
      return;
    }
    if (!user?.uid) return;
    try {
      const backup = await exportUserBackup(user.uid, user, settings);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gmail-task-manager-backup-${getTodayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Respaldo descargado correctamente');
    } catch (err) {
      console.error('Error al exportar el respaldo:', err);
      showToast('No se pudo generar el respaldo', 'error');
    }
  };

  // Restore a previously exported backup file: upserts each task by id and merges
  // the settings doc. Does not delete tasks missing from the file.
  const handleImportBackup = async (file) => {
    if (user?.isGuest) {
      showToast('El respaldo pertenece a la cuenta real, no está disponible en Modo Invitado', 'error');
      return;
    }
    if (!user?.uid) return;

    const confirmed = window.confirm(
      'Esto creará o actualizará tareas y ajustes a partir del archivo de respaldo. Esta acción no se puede deshacer. ¿Continuar?'
    );
    if (!confirmed) return;

    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (err) {
      console.error('Error al leer el archivo de respaldo:', err);
      showToast('El archivo no es un respaldo JSON válido', 'error');
      return;
    }

    try {
      const count = await importUserBackup(user.uid, parsed);
      showToast(`Respaldo restaurado: ${count} tareas`, 'success');
      fetchSettings();
    } catch (err) {
      // Distinct from the JSON.parse failure above: the file was valid, the
      // restore itself failed (network, permissions, a Firestore limit) — telling
      // the user "invalid file" here would send them chasing the wrong problem.
      console.error('Error al restaurar el respaldo en Firestore:', err);
      showToast('Error al restaurar el respaldo: ' + err.message, 'error');
    }
  };

  const handleMoveToQuadrant = async (taskId, targetQuadrant) => {
    const today = getTodayStr();
    let updates = {};
    if (targetQuadrant === 'q1') {
      updates = { priority: 'urgente', dueDate: today };
    } else if (targetQuadrant === 'q2') {
      updates = { priority: 'alta', dueDate: dateStrDaysFromToday(3) };
    } else if (targetQuadrant === 'q3') {
      // getEisenhowerQuadrant treats `starred` as "important" regardless of
      // priority — without clearing it, a starred task dropped here silently
      // stays in Q1/Q2 (wrong quadrant, but the toast still said "moved").
      updates = { priority: 'media', dueDate: today, starred: false };
    } else if (targetQuadrant === 'q4') {
      // Q4 also needs "not urgent" (getEisenhowerQuadrant checks dueDate <=
      // tomorrow), not just "not important" — a task dropped here that was
      // already due today/tomorrow stayed urgent-by-date and landed in Q3
      // instead. Clearing the due date/time is the honest read of "Revisar":
      // no urgency, review whenever, rather than picking an arbitrary future date.
      updates = { priority: 'baja', starred: false, dueDate: null, dueTime: null };
    }

    if (user?.isGuest) {
      setGuestTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));
      showToast('Tarea movida de cuadrante', 'success');
      return;
    }

    if (user?.uid) {
      try {
        await updateFirebaseTask(user.uid, taskId, updates);
        showToast('Tarea movida de cuadrante', 'success');
      } catch (err) {
        console.error('Error en Firestore:', err);
        showToast('Error al mover tarea', 'error');
      }
    }
  };

  const handleToggleSubtask = async (taskId, subtaskId) => {
    const targetList = user?.isGuest ? guestTasks : allTasks;
    const target = targetList.find(t => t.id === taskId);
    if (!target) return;

    const currentSubtasks = target.subtasks || [];
    const updatedSubtasks = currentSubtasks.map(s => s.id === subtaskId ? { ...s, done: !s.done } : s);

    const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every(s => s.done);
    let nextDone = target.done;
    if (allDone && !target.done) {
      nextDone = true;
      showToast(`🎉 ¡Completaste todos los pasos de "${target.title}"! Tarea hecha.`, 'success');
    } else if (!allDone && target.done) {
      nextDone = false;
    }

    const updates = { subtasks: updatedSubtasks, done: nextDone };

    if (user?.isGuest) {
      setGuestTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));
      return;
    }

    if (user?.uid) {
      try {
        await updateFirebaseTask(user.uid, taskId, updates);
      } catch (err) {
        console.error('Error en Firestore:', err);
        showToast('Error al actualizar paso', 'error');
      }
    }
  };

  // If user is not logged in, render Login View
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} onGuestLogin={handleGuestLogin} />;
  }

  // Tasks pending an "undo" window are hidden everywhere immediately, as if already gone.
  const visibleTasks = tasks.filter(t => !pendingDeleteIds.has(t.id));
  const visibleAllTasks = allTasks.filter(t => !pendingDeleteIds.has(t.id));

  // Compute counts for sidebar. Applies the same category/search filters as the
  // visible list (and the same per-tab filters, via filterByTab) so a badge can
  // never claim tasks a section isn't actually showing.
  const countsBase = filterBySearch(filterByCategory(visibleAllTasks, currentCategory), searchQuery);
  const counts = {
    pending: filterByTab(countsBase, 'pending').length,
    today: filterByTab(countsBase, 'today').length,
    overdue: filterByTab(countsBase, 'overdue').length,
    week: filterByTab(countsBase, 'week').length,
    starred: filterByTab(countsBase, 'starred').length,
    scheduled: filterByTab(countsBase, 'scheduled').length,
    completed: filterByTab(countsBase, 'completed').length,
    trash: filterByTab(countsBase, 'trash').length
  };

  // Same category/search-filtered set, reused as the `tasks` prop for Matrix,
  // Calendar and Stats — previously only the List view honored the search bar
  // and category filter, so searching while on any other view silently did
  // nothing and looked broken. Deliberately NOT also filtering by `currentTab`
  // here: that's a List-specific "which folder" concept (e.g. Papelera), while
  // these three views are meant to show one global picture.
  const globallyFilteredTasks = countsBase;

  // "Progreso de hoy" / Pulso Diario ring: tasks actually due today, not the
  // account's entire all-time completion ratio (what visibleAllTasks would give).
  const todayStrForProgress = getTodayStr();
  const todaysTasksForProgress = visibleAllTasks.filter(t => !t.trash && t.dueDate === todayStrForProgress);

  // Categories are a free-text field server-side; surface whatever custom values are in use
  // alongside the defaults, so the sidebar filter and the task form both offer them.
  const customCategories = Array.from(
    new Set(
      visibleAllTasks
        .map(t => (t.category || '').toLowerCase().trim())
        .filter(c => c && !BASE_CATEGORIES.includes(c))
    )
  ).sort();
  const availableCategories = [...BASE_CATEGORIES, ...customCategories];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      {/* Toast Notification */}
      {toast && (
        <div
          role="alert"
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
          style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          backgroundColor: 'var(--pulse-surface-elevated, #202124)',
          color: 'var(--pulse-text-primary, #ffffff)',
          padding: '12px 20px',
          borderRadius: '24px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          fontSize: '14px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 300,
          borderLeft: toast.type === 'error' ? '4px solid var(--pulse-q1-accent, #ea4335)' : '4px solid var(--pulse-q4-accent, #34a853)'
        }} className="animate-fade-in">
          {toast.type === 'error' ? <AlertCircle size={18} color="var(--pulse-q1-accent, #ea4335)" /> : <CheckCircle2 size={18} color="var(--pulse-q4-accent, #34a853)" />}
          <span>{toast.message}</span>
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              style={{
                marginLeft: '8px',
                color: '#8ab4f8',
                fontWeight: '700',
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                padding: '4px 6px',
                borderRadius: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <PulseHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenCompose={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
        onOpenSettings={() => { setIsSettingsOpen(true); setIsSidebarOpen(false); }}
        user={user}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenProfile={() => { setIsProfileModalOpen(true); setIsSidebarOpen(false); }}
        onLogout={handleLogout}
        onToggleSidebar={() => setIsSidebarOpen(open => !open)}
        activeView={activeView}
        onChangeView={setActiveView}
        completedCount={todaysTasksForProgress.filter(t => t.done).length}
        totalCount={todaysTasksForProgress.length}
      />

      {/* Persistent offline/connection banner — stays up (unlike the 4s toast)
          until a Firestore snapshot succeeds again. */}
      {firestoreError && (
        <div style={{
          backgroundColor: '#fef7e0',
          color: '#7a5c00',
          borderBottom: '1px solid #f2c94c',
          padding: '8px 20px',
          fontSize: '13px',
          fontWeight: '600',
          textAlign: 'center',
          flexShrink: 0
        }}>
          ⚠️ Sin conexión con el servidor — mostrando lo último guardado, puede no estar actualizado.
        </div>
      )}

      {/* Main App Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Sidebar */}
        <PulseSidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          currentCategory={currentCategory}
          onSelectCategory={setCurrentCategory}
          counts={counts}
          categories={availableCategories}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeView={activeView}
          onChangeView={setActiveView}
        />

        {/* Main Section: Matrix 2x2, Stats Dashboard, Calendar, or Task List */}
        {activeView === 'matrix' ? (
          <>
          <MatrixOnboarding />
          <MatrixView
            tasks={globallyFilteredTasks}
            loading={loading}
            onToggleDone={handleToggleDone}
            onToggleStar={handleToggleStar}
            onEdit={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onDelete={handleDeleteTask}
            onOpenComposeWithQuadrant={(defaultPriority) => {
              setEditingTask({ priority: defaultPriority, dueDate: defaultPriority === 'urgente' || defaultPriority === 'media' ? getTodayStr() : '' });
              setIsTaskModalOpen(true);
            }}
            onMoveToQuadrant={handleMoveToQuadrant}
            onToggleSubtask={handleToggleSubtask}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
          </>
        ) : activeView === 'stats' ? (
          <StatsDashboard tasks={globallyFilteredTasks} />
        ) : activeView === 'calendar' ? (
          <CalendarView
            tasks={globallyFilteredTasks}
            onEdit={(task) => {
              setComposeDate(null);
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onCompose={(dateStr) => {
              setEditingTask(null);
              setComposeDate(dateStr);
              setIsTaskModalOpen(true);
            }}
          />
        ) : (
          <TaskList
            tasks={visibleTasks}
            loading={loading}
            currentTab={currentTab}
            onRefresh={fetchTasks}
            onToggleDone={handleToggleDone}
            onToggleStar={handleToggleStar}
            onEdit={(task) => {
              setEditingTask(task);
              setIsTaskModalOpen(true);
            }}
            onDelete={handleDeleteTask}
            onEmptyTrash={handleEmptyTrash}
            onToggleSubtask={handleToggleSubtask}
            currentCategory={currentCategory}
            searchQuery={searchQuery}
            onClearCategory={() => setCurrentCategory('')}
            onClearSearch={() => setSearchQuery('')}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectMany={selectMany}
            onClearSelection={clearSelection}
            onBulkAction={handleBulkAction}
            categories={availableCategories}
          />
        )}

      </div>

      {/* Task Compose / Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
          setComposeDate(null);
        }}
        onSave={handleSaveTask}
        initialTask={editingTask}
        initialDate={composeDate}
        categories={availableCategories}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        isGuest={Boolean(user?.isGuest)}
        onSaveSettings={handleSaveSettings}
        onTriggerNotification={triggerBrowserNotification}
        notificationPermission={notificationPermission}
        onRequestPermission={requestNotificationPermission}
        pushSupported={isPushSupported()}
        pushSubscribed={Boolean(pushSubscription)}
        onEnablePush={enablePushNotifications}
        onDisablePush={disablePushNotifications}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />


      {/* Account / Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUpdateProfile={handleUpdateProfile}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* Mobile Floating Action Button (Gmail-style FAB) */}
      <button
        onClick={() => {
          setEditingTask(null);
          setComposeDate(null);
          setIsTaskModalOpen(true);
        }}
        className="mobile-fab-btn"
        aria-label="Nueva Tarea"
      >
        <Plus size={20} />
        <span>Tarea</span>
      </button>

      {/* Mobile Bottom Navigation Bar (Gmail-style bottom bar) */}
      <nav className="mobile-bottom-nav" aria-label="Navegación móvil">
        <button
          onClick={() => setActiveView('matrix')}
          className={`mobile-nav-item ${activeView === 'matrix' ? 'active' : ''}`}
        >
          <LayoutGrid size={20} />
          <span>Matriz</span>
        </button>
        <button
          onClick={() => setActiveView('list')}
          className={`mobile-nav-item ${activeView === 'list' ? 'active' : ''}`}
        >
          <List size={20} />
          <span>Lista</span>
        </button>
        <button
          onClick={() => setActiveView('calendar')}
          className={`mobile-nav-item ${activeView === 'calendar' ? 'active' : ''}`}
        >
          <Calendar size={20} />
          <span>Agenda</span>
        </button>
        <button
          onClick={() => setActiveView('stats')}
          className={`mobile-nav-item ${activeView === 'stats' ? 'active' : ''}`}
        >
          <BarChart2 size={20} />
          <span>Métricas</span>
        </button>
      </nav>

    </div>
  );
}
