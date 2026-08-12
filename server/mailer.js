const nodemailer = require('nodemailer');
const { getLocalDateStr } = require('./dateUtils');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PRIORITY_RANK = { baja: 0, media: 1, alta: 2, urgente: 3 };
const RANK_TO_PRIORITY = ['baja', 'media', 'alta', 'urgente'];

// Mirrors client/src/components/TaskItem.jsx's getEffectivePriority: priority only
// ever escalates upward as the deadline (dueDate) closes in, never persisted.
function getEffectivePriority(task) {
  if (task.done || task.trash || !task.dueDate) return task.priority || 'media';

  const todayStr = getLocalDateStr();
  const diffDays = Math.round(
    (new Date(task.dueDate + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000
  );

  let floor = null;
  if (diffDays <= 0) floor = 'urgente';
  else if (diffDays === 1) floor = 'alta';
  else if (diffDays <= 3) floor = 'media';

  if (!floor) return task.priority || 'media';

  const currentRank = PRIORITY_RANK[task.priority] ?? PRIORITY_RANK.media;
  return RANK_TO_PRIORITY[Math.max(currentRank, PRIORITY_RANK[floor])];
}

function generateTaskEmailHTML(pendingTasks, scheduledTime) {
  const dateStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const taskRows = pendingTasks.map((t, idx) => {
    const effectivePriority = getEffectivePriority(t);

    let priorityBg = '#e2e8f0';
    let priorityColor = '#334155';
    if (effectivePriority === 'urgente') {
      priorityBg = '#fee2e2';
      priorityColor = '#991b1b';
    } else if (effectivePriority === 'alta') {
      priorityBg = '#fef3c7';
      priorityColor = '#92400e';
    } else if (effectivePriority === 'media') {
      priorityBg = '#dbeafe';
      priorityColor = '#1e40af';
    }

    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; font-weight: bold; color: #374151;">${idx + 1}</td>
        <td style="padding: 12px; color: #111827;">
          <div style="font-weight: 600; font-size: 15px;">${escapeHtml(t.title)}</div>
          ${t.description ? `<div style="font-size: 13px; color: #6b7280; margin-top: 4px;">${escapeHtml(t.description)}</div>` : ''}
        </td>
        <td style="padding: 12px; text-align: center;">
          <span style="background-color: ${priorityBg}; color: ${priorityColor}; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
            ${effectivePriority}
          </span>
        </td>
        <td style="padding: 12px; text-align: center; color: #4b5563; font-size: 13px; font-weight: 500;">
          ${t.category ? escapeHtml(t.category) : 'General'}
        </td>
        <td style="padding: 12px; text-align: right; color: #6b7280; font-size: 13px;">
          ${t.dueDate ? t.dueDate.split('-').reverse().join('/') : '--/--'}<br>
          <span style="font-weight: 600;">${t.dueTime || '--:--'}</span>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Resumen Diario de Tareas Pendientes</title>
    </head>
    <body style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f8fc; margin: 0; padding: 20px; color: #202124;">
      <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e0e0e0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        
        <!-- Gmail Header Banner -->
        <div style="background-color: #ea4335; padding: 24px 30px; color: #ffffff; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.3px;">
              📬 Resumen Diario de Tareas Pendientes
            </h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">
              Gmail Task Manager • Envío automático (${scheduledTime} hrs)
            </p>
          </div>
        </div>

        <!-- Content Info -->
        <div style="padding: 24px 30px 10px 30px;">
          <div style="background-color: #f8f9fa; border-left: 4px solid #ea4335; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 14px; color: #3c4043;">
              📅 <strong>Fecha:</strong> ${dateStr} <br>
              📊 <strong>Tareas Pendientes:</strong> <span style="background: #ea4335; color: white; padding: 2px 8px; border-radius: 10px; font-weight: bold;">${pendingTasks.length}</span>
            </p>
          </div>

          ${pendingTasks.length === 0 ? `
            <div style="text-align: center; padding: 40px 20px; color: #5f6368;">
              <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
              <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #202124;">¡Felicidades! No tienes tareas pendientes.</h3>
              <p style="margin: 0; font-size: 14px;">Todas tus actividades asignadas han sido completadas.</p>
            </div>
          ` : `
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr style="background-color: #f1f3f4; color: #5f6368; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                  <th style="padding: 10px; text-align: left; width: 30px;">#</th>
                  <th style="padding: 10px; text-align: left;">Tarea y Descripción</th>
                  <th style="padding: 10px; text-align: center; width: 90px;">Prioridad</th>
                  <th style="padding: 10px; text-align: center; width: 90px;">Categoría</th>
                  <th style="padding: 10px; text-align: right; width: 80px;">Fecha / Hora</th>
                </tr>
              </thead>
              <tbody>
                ${taskRows}
              </tbody>
            </table>
          `}
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 18px 30px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #5f6368;">
          <p style="margin: 0 0 4px 0;">Este es un resumen automático enviado desde tu aplicación <strong>Gmail Task Manager</strong>.</p>
          <p style="margin: 0; color: #9aa0a6;">Organiza tus pendientes eficientemente cada día.</p>
        </div>

      </div>
    </body>
    </html>
  `;
}

async function sendTaskSummaryEmail(settings, pendingTasks) {
  if (!settings.senderEmail || !settings.senderPass || !settings.recipientEmail) {
    throw new Error('Faltan credenciales de Gmail (Email remitente, Contraseña de aplicación o Destinatario). Por favor configúralos en los ajustes.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: settings.senderEmail,
      pass: settings.senderPass
    }
  });

  const htmlContent = generateTaskEmailHTML(pendingTasks, settings.scheduledTime);

  const mailOptions = {
    from: `"Gmail Task Manager" <${settings.senderEmail}>`,
    to: settings.recipientEmail,
    subject: `📋 Resumen de Tareas Pendientes (${pendingTasks.length} pendientes) - ${new Date().toLocaleDateString('es-ES')}`,
    html: htmlContent
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}

module.exports = {
  generateTaskEmailHTML,
  sendTaskSummaryEmail
};
