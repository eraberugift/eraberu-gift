require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { nanoid } = require('nanoid');
const { z } = require('zod');
const path = require('path');

const app = express();

// ★★★ CSPを明示的に設定（unsafe-eval を追加） ★★★
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",  // ← ★ これが必要！
          "https://unpkg.com",
        ],
        scriptSrcElem: [
          "'self'",
          "'unsafe-inline'",
          "https://unpkg.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// public を静的公開
app.use(express.static(path.join(__dirname, 'public')));

const itemSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  imageUrl: z.string().url().or(z.literal('')).transform(v => v || ''),
  descShort: z.string().max(80).optional(),
  descLong: z.string().max(800).optional(),
});
const catalogSchema = z.object({
  title: z.string().min(1).max(120),
  message: z.string().max(1000).optional(),
  items: z.array(itemSchema).length(3),
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, env: { port: process.env.PORT, baseUrl: process.env.BASE_URL } });
});

app.post('/api/catalog', async (req, res) => {
  const parsed = catalogSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.format() });
  }
  const shareId = nanoid(10);
  const createdAt = new Date().toISOString();
  const payload = { shareId, createdAt, ...parsed.data };

  try {
    const r = await fetch(process.env.MAKE_WEBHOOK_CREATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let data = {};
    try {
      data = await r.json();
    } catch {}
    if (!r.ok) return res.status(502).json({ error: 'MAKE_CREATE_FAILED', detail: data });

    const base = process.env.BASE_URL || 'http://localhost:3000';
    res.json({ shareId, shareUrl: data.shareUrl || `${base}/s/${shareId}` });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'MAKE_CREATE_REQUEST_ERROR' });
  }
});

app.get('/api/catalog/:shareId', async (req, res) => {
  const shareId = req.params.shareId;
  try {
    const r = await fetch(process.env.MAKE_WEBHOOK_READ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId }),
    });
    let data = {};
    try {
      data = await r.json();
    } catch {}
    if (!r.ok || !data?.title) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'MAKE_READ_REQUEST_ERROR' });
  }
});

app.get('/s/:shareId', (_req, res) => {
  res.type('html').send(`<!doctype html>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Gift Catalog</title>
  <style>
    body{font-family:system-ui,-apple-system;max-width:960px;margin:24px auto;padding:0 16px}
    .grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
    .card{border:1px solid #e5e5e5;border-radius:16px;padding:12px}
    .img{aspect-ratio:4/3;background:#f3f3f3;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center}
  </style>
  <div id="app">Loading…</div>
  <script>
    const shareId = location.pathname.split('/').pop();
    fetch('/api/catalog/' + shareId)
      .then(r => r.json())
      .then(cat => {
        if (cat.error) {
          document.getElementById('app').innerHTML = '<p>カタログが見つかりません。</p>';
          return;
        }
        document.title = cat.title + ' | Gift Catalog';
        const items = cat.items
          .map(
            it => \`<a class="card" href="\${it.url}" target="_blank">
          <div class="img">\${it.imageUrl ? '<img src="' + it.imageUrl + '" style="width:100%;height:100%;object-fit:cover"/>' : 'No Image'}</div>
          <div><strong>\${it.name}</strong></div>
          \${it.descShort ? '<div style="color:#555;font-size:14px;">' + it.descShort + '</div>' : ''}
        </a>\`
          )
          .join('');
        document.getElementById('app').innerHTML = \`
        <h1>\${cat.title}</h1>
        \${cat.message ? '<p>' + cat.message + '</p>' : ''}
        <div class="grid">\${items}</div>\`;
      })
      .catch(() => {
        document.getElementById('app').innerHTML = '<p>読み込みに失敗しました。</p>';
      });
  </script>`);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server on http://localhost:' + port));