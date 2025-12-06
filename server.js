require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { nanoid } = require('nanoid');
const { z } = require('zod');
const path = require('path');

const app = express();

// -----------------------------
// CSP
// -----------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        scriptSrcElem: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
        "'self'",
        "https://hook.eu2.make.com",
        "https://*.googleapis.com",
        "https://script.google.com"
      ],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------
// Zod Schemas
// -----------------------------
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

const itemsInputSchema = z.object({
  catalogId: z.string().min(1),
  urlCount: z.number().min(1).max(3),
  title1: z.string().min(1),
  url1: z.string().url(),
  title2: z.string().optional(),
  url2: z.string().optional(),
  title3: z.string().optional(),
  url3: z.string().optional(),
});

// -----------------------------
// /api/items_input
// -----------------------------
app.post('/api/items_input', async (req, res) => {
  const parsed = itemsInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_ITEMS_INPUT', issues: parsed.error.format() });
  }

  const payload = parsed.data;

  try {
    const r = await fetch(process.env.MAKE_WEBHOOK_ITEMS_INPUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data = {};
    try { data = await r.json(); } catch {}

    const catalogId = data.catalog_id || data.catalogId || payload.catalogId;

    return res.json({ ok: true, catalog_id: catalogId });

  } catch {
    return res.status(502).json({ error: 'MAKE_ITEMS_INPUT_REQUEST_ERROR' });
  }
});

// -----------------------------
// ★ /api/start_status_check
// -----------------------------
app.post('/api/start_status_check', async (req, res) => {
  const { catalogId } = req.body;
  if (!catalogId) return res.status(400).json({ error: "catalogId is required" });

  console.log("📡 Status check for:", catalogId);

  try {
    const r = await fetch(process.env.MAKE_WEBHOOK_STATUS_CHECK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogId })
    });

    const data = await r.json();
    console.log("📥 Response:", data);
    
    return res.json(data);

  } catch (e) {
    console.error("❌ Error:", e);
    return res.status(502).json({ error: "MAKE_STATUS_CHECK_REQUEST_ERROR" });
  }
});

// -----------------------------
// /api/catalog
// -----------------------------
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
    try { data = await r.json(); } catch {}

    if (!r.ok) return res.status(502).json({ error: 'MAKE_CREATE_FAILED', detail: data });

    const base = process.env.BASE_URL || 'http://localhost:3000';
    res.json({ shareId, shareUrl: data.shareUrl || `${base}/s/${shareId}` });

  } catch {
    res.status(502).json({ error: 'MAKE_CREATE_REQUEST_ERROR' });
  }
});

// -----------------------------
// /api/catalog/:shareId
// -----------------------------
app.get('/api/catalog/:shareId', async (req, res) => {
  const shareId = req.params.shareId;

  try {
    const r = await fetch(process.env.MAKE_WEBHOOK_READ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId }),
    });

    let data = {};
    try { data = await r.json(); } catch {}

    if (!r.ok || !data?.title) return res.status(404).json({ error: 'NOT_FOUND' });

    res.json(data);

  } catch {
    res.status(502).json({ error: 'MAKE_READ_REQUEST_ERROR' });
  }
});

// -----------------------------
// シェアページ
// -----------------------------
app.get('/s/:shareId', (_req, res) => {
  res.type('html').send(`
    <!doctype html>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Gift Catalog</title>
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
          const items = cat.items.map(it => \`
            <a href="\${it.url}" target="_blank"><div>\${it.name}</div></a>\`
          ).join('');
          document.getElementById('app').innerHTML =
            \`<h1>\${cat.title}</h1><div>\${items}</div>\`;
        });
    </script>
  `);
});

// ===============================
// Google Sheets API 設定
// ===============================
const { google } = require("googleapis");

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

// ===============================
// Google Sheets → Node.js → フロント
// ===============================
app.get("/api/sheets/catalog/:id", async (req, res) => {
  const catalogId = req.params.id;
  const sheetId = process.env.SHEET_ID;

  try {
    const sheets = await getSheetsClient();

    // ★ シート名を修正：items_output
    const range = "items_output!A:Z";

    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = r.data.values;
    if (!rows || rows.length <= 1)
      return res.status(404).json({ error: "No data" });

    const headers = rows[0];
    const items = rows.slice(1).map(row =>
      Object.fromEntries(headers.map((h, i) => [h, row[i]]))
    );

    // ★ catalog_id をキーに検索
    const catalog = items.find(row => row.catalog_id === catalogId);

    if (!catalog) {
      return res.status(404).json({ error: "Catalog not found" });
    }

    // ★ confirm.html 用にフィールド名を変換（フロントと合わせる）
    const mapped = {
      gift1_title: catalog.title1,
      gift1_desc400: catalog.desc1_long,
      gift1_img: catalog.imgData1,

      gift2_title: catalog.title2,
      gift2_desc400: catalog.desc2_long,
      gift2_img: catalog.imgData2,

      gift3_title: catalog.title3,
      gift3_desc400: catalog.desc3_long,
      gift3_img: catalog.imgData3,
    };

    res.json({ success: true, catalog: mapped });

  } catch (e) {
    console.error("Sheets API Error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================
// Google Sheets → OGP ステータス参照
// ===============================
app.get("/api/sheets/ogp_status/:id", async (req, res) => {
  const catalogId = req.params.id;
  const sheetId = process.env.SHEET_ID;

  try {
    const sheets = await getSheetsClient();

    // ★ ogp_status シートを読む
    const range = "ogp_status!A:E"; 
    // A:catalog_id, B:urlCount, C:item1_status, D:item2_status, E:item3_status

    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    const rows = r.data.values;
    if (!rows || rows.length <= 1)
      return res.json({ success: false, error: "No rows" });

    const headers = rows[0];
    const body = rows.slice(1);

    // catalogId に一致する行を探す
    const row = body.find(r => r[0] === catalogId);

    if (!row) {
      return res.json({ success: false, error: "Not found" });
    }

    // ステータスを返す
    const status = {
      urlCount: Number(row[1] || 0),
      item1: row[2] || "",
      item2: row[3] || "",
      item3: row[4] || "",
    };

    return res.json({ success: true, status });

  } catch (e) {
    console.error("Sheets Status API Error:", e);
    return res.json({ success: false, error: e.message });
  }
});



// -----------------------------
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server on http://localhost:' + port));
