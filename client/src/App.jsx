import React, { useState, useEffect, useRef, useCallback } from 'react';
import PulseHeader from './components/PulseHeader';
import PulseSidebar from './components/PulseSidebar';
import MatrixView from './components/MatrixView';
import TaskList from './components/TaskList';
import TaskModal from './components/TaskModal';
import SettingsModal from './components/SettingsModal';
import EmailPreviewModal from './components/EmailPreviewModal';
import Login from './components/Login';
import ProfileModal from './components/ProfileModal';
import StatsDashboard from './components/StatsDashboard';
import CalendarView from './components/CalendarView';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { getTodayStr, dateStrDaysFromToday, advanceRecurringTasks, filterTasks, filterByTab, filterByCategory, filterBySearch } from './taskUtils';
import {
  db,
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
  logoutUser
} from './firebase';

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

  // Local Tasks State (Stored persistently in localStorage)
  const [guestTasks, setGuestTasks] = useState(() => {
    const savedLocalTasks = localStorage.getItem('gmail_task_local_tasks') || sessionStorage.getItem('gmail_task_guest_tasks');
    return savedLocalTasks ? JSON.parse(savedLocalTasks) : DEFAULT_GUEST_TASKS;
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
  // No async send-in-progress state needed while email sending is deferred (see
  // handleSendEmailNow) — kept as a prop so EmailPreviewModal's button still works
  // once that feature ships.
  const [sending] = useState(false);
  const [toast, setToast] = useState(null);

  // Bulk selection: ids of tasks currently checked for a batch action.
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Browser Notification State
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  // Prefilled due date when composing from the calendar (null = default to today).
  const [composeDate, setComposeDate] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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

  // Synchronize Tasks to localStorage so they persist across sessions
  useEffect(() => {
    if (user?.isGuest) {
      localStorage.setItem('gmail_task_local_tasks', JSON.stringify(guestTasks));
    }
  }, [guestTasks, user]);

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
    const unsubscribe = subscribeUserTasks(user.uid, (firestoreTasks) => {
      const advanced = advanceRecurringTasks(firestoreTasks);
      setAllTasks(advanced);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

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
      const modalOpen = isTaskModalOpen || isSettingsOpen || isPreviewOpen || isProfileModalOpen;
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
  }, [user, isTaskModalOpen, isSettingsOpen, isPreviewOpen, isProfileModalOpen]);

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
          id: 'task-' + Date.now(),
          starred: false,
          done: false,
          trash: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setGuestTasks(prev => [newTask, ...prev]);
        setCurrentTab('inbox');
        setCurrentCategory('');
        setSearchQuery('');
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
        setCurrentTab('inbox');
        setCurrentCategory('');
        setSearchQuery('');
        showToast('Nueva tarea guardada');
      }
    } catch (err) {
      console.error('Error al guardar en Firestore:', err);
      showToast('Error al guardar la tarea', 'error');
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

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const count = await importUserBackup(user.uid, parsed);
      showToast(`Respaldo restaurado: ${count} tareas`, 'success');
      fetchSettings();
    } catch (err) {
      console.error('Error al restaurar el respaldo:', err);
      showToast('El archivo no es un respaldo JSON válido', 'error');
    }
  };

  // Send Email Summary — email sending needs a server that can hold the Gmail
  // credentials safely, which the cloud version doesn't have yet (planned as a
  // follow-up serverless function). Browser notifications keep working meanwhile.
  const handleSendEmailNow = async () => {
    if (user?.isGuest) {
      showToast('El envío de correo usa la cuenta real, no está disponible en Modo Invitado', 'error');
      return;
    }
    showToast('✉️ El envío automático de correo todavía no está disponible en la versión web. Mientras tanto, usá las notificaciones del navegador.', 'error');
  };

  const handleMoveToQuadrant = async (taskId, targetQuadrant) => {
    const today = getTodayStr();
    let updates = {};
    if (targetQuadrant === 'q1') {
      updates = { priority: 'urgente', dueDate: today };
    } else if (targetQuadrant === 'q2') {
      updates = { priority: 'alta', dueDate: dateStrDaysFromToday(3) };
    } else if (targetQuadrant === 'q3') {
      updates = { priority: 'media', dueDate: today };
    } else if (targetQuadrant === 'q4') {
      updates = { priority: 'baja' };
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
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          backgroundColor: '#202124',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '24px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          fontSize: '14px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 300,
          borderLeft: toast.type === 'error' ? '4px solid #ea4335' : '4px solid #34a853'
        }} className="animate-fade-in">
          {toast.type === 'error' ? <AlertCircle size={18} color="#ea4335" /> : <CheckCircle2 size={18} color="#34a853" />}
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
        onOpenPreview={() => { setIsPreviewOpen(true); setIsSidebarOpen(false); }}
        user={user}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenProfile={() => { setIsProfileModalOpen(true); setIsSidebarOpen(false); }}
        onLogout={handleLogout}
        onToggleSidebar={() => setIsSidebarOpen(open => !open)}
        activeView={activeView}
        onChangeView={setActiveView}
        completedCount={visibleAllTasks.filter(t => !t.trash && t.done).length}
        totalCount={visibleAllTasks.filter(t => !t.trash).length}
      />

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
          <MatrixView
            tasks={visibleAllTasks}
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
        ) : activeView === 'stats' ? (
          <StatsDashboard tasks={visibleAllTasks} />
        ) : activeView === 'calendar' ? (
          <CalendarView
            tasks={visibleAllTasks}
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
        onSaveSettings={handleSaveSettings}
        onTriggerNotification={triggerBrowserNotification}
        notificationPermission={notificationPermission}
        onRequestPermission={requestNotificationPermission}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />

      {/* Email Preview Modal */}
      <EmailPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onSendNow={handleSendEmailNow}
        sending={sending}
        pendingTasks={visibleAllTasks.filter(t => !t.done && !t.trash)}
        scheduledTime={settings?.scheduledTime}
      />

      {/* Account / Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUpdateProfile={handleUpdateProfile}
      />

    </div>
  );
}
