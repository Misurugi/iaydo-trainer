const express  = require('express');
const multer   = require('multer');
const nodemailer = require('nodemailer');
const XLSX     = require('xlsx');
const fs       = require('fs');
const path     = require('path');

const app  = express();
const PORT = 5000;
const DIR  = __dirname;

// When running as Electron app, use writable userData dir; otherwise use __dirname
const DATA_DIR       = process.env.IAYDO_DATA_DIR   || DIR;
const STATIC_DIR     = process.env.IAYDO_STATIC_DIR || path.join(DIR, 'static');
const CONFIG_FILE    = path.join(DATA_DIR, 'config.json');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');

app.use(express.json());
app.get('/data/questions.json', (req, res) => res.sendFile(QUESTIONS_FILE));
app.use(express.static(STATIC_DIR));

const upload = multer({ storage: multer.memoryStorage() });

// ── Config ────────────────────────────────────────────────────────────────

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

app.get('/api/config', (req, res) => {
  const cfg = loadConfig();
  res.json({
    reviewer_email:    cfg.reviewer_email    || '',
    smtp_user:         cfg.smtp_user         || '',
    smtp_password_set: !!cfg.smtp_password,
  });
});

app.post('/api/config', (req, res) => {
  const cfg  = loadConfig();
  const data = req.body;
  if (data.reviewer_email != null) cfg.reviewer_email = data.reviewer_email;
  if (data.smtp_user      != null) cfg.smtp_user      = data.smtp_user;
  if (data.smtp_password)          cfg.smtp_password  = data.smtp_password;
  saveConfig(cfg);
  res.json({ ok: true });
});

// ── Upload questions ──────────────────────────────────────────────────────

app.post('/api/upload-questions', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'Файл не выбран' });

  const filename = req.file.originalname.toLowerCase();
  let questions  = [];

  try {
    if (filename.endsWith('.xlsx')) {
      const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (!rows.length) return res.status(400).json({ ok: false, error: 'Файл пустой' });

      const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
      const col = {};
      headers.forEach((h, i) => {
        if (['term', 'термин'].includes(h))             col.term       = i;
        else if (['level', 'уровень'].includes(h))      col.level      = i;
        else if (['definition', 'определение'].includes(h)) col.definition = i;
      });
      if (Object.keys(col).length < 3) {
        return res.status(400).json({ ok: false, error: `Не найдены нужные колонки. Нашёл: ${headers.join(', ')}` });
      }
      for (const row of rows.slice(1)) {
        const term       = String(row[col.term]       || '').trim();
        const definition = String(row[col.definition] || '').trim();
        const level      = parseInt(row[col.level])   || 0;
        if (term && definition) questions.push({ term, level, definition });
      }

    } else if (filename.endsWith('.csv')) {
      const text = req.file.buffer.toString('utf8').replace(/^﻿/, '');
      const lines = text.split(/\r?\n/).filter(Boolean);
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const col = {};
      headers.forEach((h, i) => {
        if (['term', 'термин'].includes(h))             col.term       = i;
        else if (['level', 'уровень'].includes(h))      col.level      = i;
        else if (['definition', 'определение'].includes(h)) col.definition = i;
      });
      for (const line of lines.slice(1)) {
        const parts     = line.split(',');
        const term       = (parts[col.term]       || '').trim();
        const definition = (parts[col.definition] || '').trim();
        const level      = parseInt(parts[col.level]) || 0;
        if (term && definition) questions.push({ term, level, definition });
      }

    } else {
      return res.status(400).json({ ok: false, error: 'Поддерживаются только .xlsx и .csv' });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Ошибка разбора файла: ' + e.message });
  }

  if (!questions.length) return res.status(400).json({ ok: false, error: 'Не найдено ни одного термина' });

  if (fs.existsSync(QUESTIONS_FILE)) fs.copyFileSync(QUESTIONS_FILE, QUESTIONS_FILE + '.bak');
  fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questions, null, 2), 'utf8');

  const byLevel = {};
  questions.forEach(q => { byLevel[q.level] = (byLevel[q.level] || 0) + 1; });
  res.json({ ok: true, total: questions.length, by_level: byLevel });
});

// ── Submit test ───────────────────────────────────────────────────────────

app.post('/api/submit-test', async (req, res) => {
  const cfg     = loadConfig();
  const missing = ['reviewer_email', 'smtp_user', 'smtp_password'].filter(k => !cfg[k]);
  if (missing.length) {
    return res.status(400).json({ ok: false, error: 'Почта не настроена. Перейди в раздел «Настройки».' });
  }

  const { student_name = '—', level = '?', answers = [] } = req.body;
  const submitted_at = new Date().toLocaleString('ru-RU');

  const rows = answers.map((a, i) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;color:#666">${i + 1}</td>
      <td style="padding:8px;border:1px solid #ddd">${a.question || ''}</td>
      <td style="padding:8px;border:1px solid #ddd">${a.answer   || '<em style="color:#999">нет ответа</em>'}</td>
      <td style="padding:8px;border:1px solid #ddd;color:#2d6a4f;font-size:0.9em">${a.correct || ''}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;max-width:860px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="border-bottom:2px solid #8b0000;padding-bottom:10px;color:#8b0000">Тест по иайдо</h2>
  <table style="margin-bottom:20px;border-collapse:collapse">
    <tr><td style="padding:4px 16px 4px 0;font-weight:bold">Сдающий:</td><td>${student_name}</td></tr>
    <tr><td style="padding:4px 16px 4px 0;font-weight:bold">Кю-ранг:</td><td>${level} кю</td></tr>
    <tr><td style="padding:4px 16px 4px 0;font-weight:bold">Дата / время:</td><td>${submitted_at}</td></tr>
  </table>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#f5f0eb">
      <th style="padding:8px;border:1px solid #ddd;width:36px">№</th>
      <th style="padding:8px;border:1px solid #ddd">Вопрос</th>
      <th style="padding:8px;border:1px solid #ddd">Ответ сдающего</th>
      <th style="padding:8px;border:1px solid #ddd;color:#2d6a4f">Правильный ответ</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_password },
    });
    await transporter.sendMail({
      from:    cfg.smtp_user,
      to:      cfg.reviewer_email,
      subject: `Иайдо — тест — ${student_name} — ${level} кю — ${submitted_at}`,
      html,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`Iaydo trainer -> http://localhost:${PORT}`);
});

module.exports = { server };
