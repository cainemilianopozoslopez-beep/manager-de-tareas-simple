const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const {
  getAllTasks, getTaskById, createTask, updateTask, deleteTaskById, emptyTrash, batchAction,
  getUser, updateUser, getSettings, updateSettings,
  getBackup, restoreBackup, runMaintenance
} = require('./db');
const { hashPassword, verifyPassword } = require('./auth');
const { filterTasks } = require('./taskFilters');
const { getLocalDateStr } = require('./dateUtils');
const { sendTaskSummaryEmail, generateTaskEmailHTML } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 5000;

// Restrict CORS to the local Vite dev origins only. There's no auth layer, so
// leaving this open would let any website you visit call this API on localhost
// (and reach unauthenticated endpoints like /api/backup/export, which leaks the
// Gmail app password). Ports 5173/5174 cover Vite's default and its fallback.
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  // `vite preview` (production build, used to exercise the PWA/service worker)
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4174',
  'http://127.0.0.1:4174'
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin / non-browser callers (curl, the cron job) that send no Origin.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Origen no permitido por CORS'));
  }
}));
app.use(bodyParser.json());

// ----------------------------------------------------
// AUTH & USER PROFILE ENDPOINTS
// ----------------------------------------------------

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = getUser();

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Por favor ingresa usuario y contraseña' });
  }

  const validUser = (username.trim().toLowerCase() === user.username.toLowerCase()) &&
                    verifyPassword(password.trim(), user.password);

  if (validUser) {
    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      user: { username: user.username, theme: user.theme || 'light' }
    });
  } else {
    res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos.' });
  }
});

// Get User Profile
app.get('/api/user/profile', (req, res) => {
  const user = getUser();
  res.json({ username: user.username, theme: user.theme || 'light' });
});

// Update User Profile (Username, Password, Theme)
app.put('/api/user/profile', (req, res) => {
  const { username, password, theme } = req.body;
  const patch = {};
  if (username && username.trim()) patch.username = username.trim();
  // Store only the hash, never the plaintext the user typed.
  if (password && password.trim()) patch.password = hashPassword(password.trim());
  if (theme) patch.theme = theme;

  const user = updateUser(patch);
  res.json({
    message: 'Perfil de usuario actualizado correctamente',
    user: { username: user.username, theme: user.theme }
  });
});

// ----------------------------------------------------
// TASKS ENDPOINTS
// ----------------------------------------------------

// Get tasks with optional status/category filter. Filtering logic lives in
// ./taskFilters (mirrored client-side in taskUtils.js) so all three call sites
// — this route, the client's guest branch, and the client's sidebar counts —
// share one definition instead of three hand-synced copies.
app.get('/api/tasks', (req, res) => {
  const { filter, category, search } = req.query;
  res.json(filterTasks(getAllTasks(), { filter, category, search }));
});

// Normalize a subtasks payload into a clean [{id, text, done}] array, dropping
// empties and coercing types so malformed client input can't corrupt the store.
function sanitizeSubtasks(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(s => s && typeof s.text === 'string' && s.text.trim())
    .map(s => ({
      id: (typeof s.id === 'string' && s.id) ? s.id : 'sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      text: s.text.trim(),
      done: Boolean(s.done)
    }));
}

// Create task
app.post('/api/tasks', (req, res) => {
  const { title, description, priority, category, dueDate, dueTime, recurrence, subtasks } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'El título de la tarea es obligatorio' });
  }

  const newTask = createTask({
    title: title.trim(),
    description: (description || '').trim(),
    priority: priority || 'media',
    category: category || 'general',
    dueDate: dueDate || getLocalDateStr(),
    dueTime: dueTime || '',
    recurrence: recurrence || 'none',
    subtasks: sanitizeSubtasks(subtasks)
  });

  res.status(201).json(newTask);
});

// Update task (partial: only the provided fields change)
app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, priority, category, dueDate, dueTime, recurrence, starred, done, trash, subtasks } = req.body;

  // A provided title must be non-empty (POST already enforces this; keep PUT consistent).
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: 'El título de la tarea es obligatorio' });
  }

  const patch = {};
  if (title !== undefined) patch.title = title.trim();
  if (description !== undefined) patch.description = description.trim();
  if (priority !== undefined) patch.priority = priority;
  if (category !== undefined) patch.category = category;
  if (dueDate !== undefined) patch.dueDate = dueDate;
  if (dueTime !== undefined) patch.dueTime = dueTime;
  if (recurrence !== undefined) patch.recurrence = recurrence;
  if (subtasks !== undefined) patch.subtasks = sanitizeSubtasks(subtasks);
  if (starred !== undefined) patch.starred = Boolean(starred);
  if (done !== undefined) patch.done = Boolean(done);
  if (trash !== undefined) patch.trash = Boolean(trash);

  const updated = updateTask(id, patch);
  if (!updated) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.json(updated);
});

// Toggle done state
app.patch('/api/tasks/:id/toggle', (req, res) => {
  const cur = getTaskById(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.json(updateTask(cur.id, { done: !cur.done }));
});

// Toggle starred state
app.patch('/api/tasks/:id/star', (req, res) => {
  const cur = getTaskById(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.json(updateTask(cur.id, { starred: !cur.starred }));
});

// Delete task (Move to trash, or delete permanently if already trashed)
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const cur = getTaskById(id);
  if (!cur) return res.status(404).json({ error: 'Tarea no encontrada' });

  if (!cur.trash) {
    const task = updateTask(id, { trash: true });
    return res.json({ message: 'Tarea movida a la papelera', task });
  }
  deleteTaskById(id);
  res.json({ message: 'Tarea eliminada permanentemente', id });
});

// Empty trash
app.delete('/api/tasks-trash/empty', (req, res) => {
  emptyTrash();
  res.json({ message: 'Papelera vaciada con éxito' });
});

// Batch action over many tasks in a single atomic transaction (used by bulk selection).
const BATCH_ACTIONS = ['done', 'pending', 'trash', 'restore', 'delete', 'category'];
app.patch('/api/tasks/batch', (req, res) => {
  const { ids, action, value } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Se requiere "ids" (array no vacío)' });
  }
  if (!BATCH_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `Acción no válida. Usa una de: ${BATCH_ACTIONS.join(', ')}` });
  }
  const affected = batchAction(ids, action, value);
  res.json({ message: 'Acción en lote aplicada', action, affected });
});

// ----------------------------------------------------
// SETTINGS & EMAIL ENDPOINTS
// ----------------------------------------------------

// Get Settings
app.get('/api/settings', (req, res) => {
  res.json(getSettings());
});

// Update Settings
app.post('/api/settings', (req, res) => {
  const { notificationMode, senderEmail, senderPass, recipientEmail, scheduledTime, autoSendEnabled } = req.body;
  const patch = {};
  if (notificationMode) patch.notificationMode = notificationMode;
  if (senderEmail !== undefined) patch.senderEmail = senderEmail.trim();
  if (senderPass !== undefined) patch.senderPass = senderPass.trim();
  if (recipientEmail !== undefined) patch.recipientEmail = recipientEmail.trim();
  if (scheduledTime) patch.scheduledTime = scheduledTime;
  if (autoSendEnabled !== undefined) patch.autoSendEnabled = Boolean(autoSendEnabled);

  const settings = updateSettings(patch);
  res.json({ message: 'Configuración actualizada con éxito', settings });
});

// Send Instant Email Summary
app.post('/api/send-summary', async (req, res) => {
  const settings = getSettings();
  const pendingTasks = getAllTasks().filter(t => !t.done && !t.trash);

  try {
    const info = await sendTaskSummaryEmail(settings, pendingTasks);
    // Granular update: only stamp our own fields, so anything the user changed while
    // the async SMTP send was in flight is untouched.
    updateSettings({ lastSentAt: new Date().toISOString(), lastSentStatus: 'Exitoso: ' + (info.messageId || 'Correo enviado') });
    res.json({ success: true, message: 'Resumen diario de tareas enviado con éxito a ' + settings.recipientEmail, info });
  } catch (err) {
    // Don't stamp lastSentAt on failure: the cron dedupe keys off it to decide "already
    // sent today", so touching it here would block same-day retries. Status only.
    updateSettings({ lastSentStatus: 'Error: ' + err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get HTML Email Preview
app.get('/api/email-preview', (req, res) => {
  const pendingTasks = getAllTasks().filter(t => !t.done && !t.trash);
  const html = generateTaskEmailHTML(pendingTasks, getSettings().scheduledTime);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// ----------------------------------------------------
// BACKUP / RESTORE ENDPOINTS
// ----------------------------------------------------

// Export a full backup (user, settings, tasks) as a downloadable JSON file
app.get('/api/backup/export', (req, res) => {
  const filename = `gmail-tasks-backup-${getLocalDateStr()}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(getBackup(), null, 2));
});

// Restore from a previously exported backup, replacing all current data
app.post('/api/backup/import', (req, res) => {
  const incoming = req.body;

  const isValid = incoming && typeof incoming === 'object'
    && incoming.user && typeof incoming.user.username === 'string'
    && incoming.settings && typeof incoming.settings === 'object'
    && Array.isArray(incoming.tasks)
    // Every task must have a title and a usable string id (they become the primary key).
    && incoming.tasks.every(t => t && typeof t.id === 'string' && t.id && typeof t.title === 'string');

  if (!isValid) {
    return res.status(400).json({ error: 'El archivo no tiene el formato esperado de un respaldo de Gmail Task Manager' });
  }

  try {
    restoreBackup(incoming);
    res.json({ message: 'Respaldo restaurado correctamente', taskCount: incoming.tasks.length });
  } catch (err) {
    console.error('Error al restaurar el respaldo:', err);
    res.status(400).json({ error: 'No se pudo restaurar: el archivo contiene datos inválidos' });
  }
});

// ----------------------------------------------------
// CRON SCHEDULER (Daily fixed time check every minute)
// ----------------------------------------------------

cron.schedule('* * * * *', async () => {
  // Reads no longer roll recurring tasks forward, so do it here once a minute. This
  // is also where a day-boundary advance happens for an app left running overnight.
  runMaintenance();
  const settings = getSettings();

  if (!settings.autoSendEnabled || !settings.scheduledTime) {
    return;
  }

  // Solo enviar correo si la preferencia del usuario incluye Gmail
  if (settings.notificationMode !== 'gmail' && settings.notificationMode !== 'both') {
    return;
  }

  const now = new Date();
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  if (currentTimeStr >= settings.scheduledTime) {
    const todayStr = getLocalDateStr(now);
    const lastSentDay = settings.lastSentAt ? getLocalDateStr(new Date(settings.lastSentAt)) : '';

    if (lastSentDay !== todayStr) {
      console.log(`⏰ Cron triggered daily task summary at ${currentTimeStr}`);
      const pendingTasks = getAllTasks().filter(t => !t.done && !t.trash);
      try {
        await sendTaskSummaryEmail(settings, pendingTasks);
        updateSettings({ lastSentAt: new Date().toISOString(), lastSentStatus: `Automático Exitoso (${currentTimeStr})` });
        console.log('✅ Correo resumen enviado exitosamente por Cron');
      } catch (err) {
        // lastSentAt intentionally left untouched on failure so the next cron tick
        // (still today, since currentTimeStr >= scheduledTime) retries instead of
        // silently waiting until tomorrow.
        updateSettings({ lastSentStatus: `Error en Cron (${currentTimeStr}): ${err.message}` });
        console.error('❌ Error al enviar correo en Cron:', err.message);
      }
    }
  }
});

app.listen(PORT, () => {
  // One upkeep pass on boot: hash a legacy plaintext password and roll any recurring
  // tasks forward, so the app is in a consistent state before the first request.
  runMaintenance();
  console.log(`🚀 Servidor Backend corriendo en http://localhost:${PORT}`);
});
