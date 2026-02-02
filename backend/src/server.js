import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

const NODE_ENV = process.env.NODE_ENV || 'production';
const IS_PROD = NODE_ENV === 'production';

const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_COOKIE = 'takjil_admin';

// Optional (kalau suatu hari frontend beda domain)
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';

// Body limits (Step 4)
const JSON_LIMIT = process.env.JSON_LIMIT || '12kb';
const FORM_LIMIT = process.env.FORM_LIMIT || '6kb';

// Rate limits (Step 4)
const RL_PUBLIC_POST_WINDOW_MS = 10 * 60 * 1000;
const RL_PUBLIC_POST_LIMIT = Number(process.env.RL_PUBLIC_POST_LIMIT || 20);

const RL_PUBLIC_GET_WINDOW_MS = 5 * 60 * 1000;
const RL_PUBLIC_GET_LIMIT = Number(process.env.RL_PUBLIC_GET_LIMIT || 120);

// Optional: limit heavy admin actions (export, delete all)
const RL_ADMIN_EXPORT_WINDOW_MS = 10 * 60 * 1000;
const RL_ADMIN_EXPORT_LIMIT = Number(process.env.RL_ADMIN_EXPORT_LIMIT || 30);

/**
 * Behind reverse proxy (Cloudflare Tunnel):
 * trust proxy diperlukan agar req.secure dan x-forwarded-proto bekerja benar.
 */
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
    helmet({
        contentSecurityPolicy: false, // CDN assets; CSP kita rapikan nanti (Step lanjutan)
        crossOriginEmbedderPolicy: false
    })
);

// CORS: default same-origin (lebih aman). Aktifkan hanya jika dibutuhkan.
if (CORS_ORIGIN) {
    app.use(
        cors({
            origin: CORS_ORIGIN,
            credentials: true
        })
    );
}

// Payload limits (Step 4)
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: FORM_LIMIT }));
app.use(cookieParser());

// Error handler khusus body parser (invalid JSON / payload too large)
app.use((err, req, res, next) => {
    // payload too large
    if (err?.type === 'entity.too.large') {
        return res.status(413).json({ success: false, error: 'Payload terlalu besar' });
    }
    // JSON parse error
    if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({ success: false, error: 'JSON tidak valid' });
    }
    return next(err);
});

// Serve static frontend from repo root or docker layout
const frontendPath1 = join(__dirname, '..', 'frontend'); // if server.js is /app/src
const frontendPath2 = join(__dirname, '..', '..', 'frontend'); // if server.js is /backend/src
const FRONTEND_DIR = fs.existsSync(frontendPath1) ? frontendPath1 : frontendPath2;
app.use(express.static(FRONTEND_DIR));

// Resolve DB path
const defaultDb1 = join(__dirname, '..', 'database', 'takjil.db');
const defaultDb2 = join(__dirname, '..', '..', 'database', 'takjil.db');
const DB_PATH =
    process.env.DB_PATH ||
    (fs.existsSync(dirname(defaultDb1)) ? defaultDb1 : defaultDb2);

const dbDir = dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// ---------------------
// Database init
// ---------------------
function initDatabase() {
    const db = new Database(DB_PATH);

    db.exec(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal INTEGER NOT NULL CHECK (tanggal BETWEEN 1 AND 30),
      kode_jalan TEXT NOT NULL,
      nama_keluarga TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      phase2_unlocked BOOLEAN DEFAULT FALSE,
      admin_password TEXT DEFAULT 'takjil2026',
      app_title TEXT DEFAULT 'Takjil Ramadhan 1447H',
      start_date TEXT DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO settings (id) VALUES (1);
  `);

    // ensure start_date exists (older DB)
    const cols = db.prepare("PRAGMA table_info('settings')").all();
    const hasStartDate = cols.some((c) => c.name === 'start_date');
    if (!hasStartDate) {
        try {
            db.prepare("ALTER TABLE settings ADD COLUMN start_date TEXT DEFAULT NULL").run();
        } catch (_) { }
    }

    // indexes
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_registrations_tanggal ON registrations(tanggal);
    CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at);
  `);

    migrateAdminPassword(db);
    return db;
}

// migrate plaintext admin_password -> bcrypt hash (once)
function migrateAdminPassword(db) {
    const row = db.prepare('SELECT admin_password FROM settings WHERE id=1').get();
    const stored = row?.admin_password || '';
    const looksHashed = /^\$2[aby]\$/.test(stored);
    if (looksHashed) return;

    const source = process.env.ADMIN_PASSWORD || stored || 'takjil2026';
    const hash = bcrypt.hashSync(source, 12);
    db.prepare('UPDATE settings SET admin_password=?, updated_at=CURRENT_TIMESTAMP WHERE id=1').run(hash);
}

const db = initDatabase();

// ---------------------
// Step 4: Backend allowlist HOUSE_CODES (sinkron dengan frontend)
// ---------------------
const HOUSE_CODES = new Set([
    // WB Series
    'WB-01', 'WB-02', 'WB-03', 'WB-05', 'WB-06', 'WB-07', 'WB-08', 'WB-09', 'WB-10',
    'WB-11', 'WB-12', 'WB-14', 'WB-15', 'WB-16', 'WB-17', 'WB-18', 'WB-19', 'WB-20',
    'WB-21', 'WB-22', 'WB-23', 'WB-24', 'WB-25', 'WB-26', 'WB-27', 'WB-28', 'WB-29', 'WB-30',
    'WB-31', 'WB-32', 'WB-33', 'WB-34', 'WB-35', 'WB-36', 'WB-37', 'WB-38', 'WB-39', 'WB-40',
    'WB-41', 'WB-42', 'WB-43', 'WB-45', 'WB-46', 'WB-47', 'WB-48',

    // PN Series
    'PN-01', 'PN-02', 'PN-03', 'PN-05', 'PN-06', 'PN-07', 'PN-08', 'PN-09', 'PN-10',
    'PN-11', 'PN-12', 'PN-14', 'PN-15', 'PN-16', 'PN-17', 'PN-18', 'PN-19', 'PN-20',
    'PN-21', 'PN-22', 'PN-23', 'PN-24', 'PN-25', 'PN-26', 'PN-27', 'PN-28', 'PN-29', 'PN-30',
    'PN-31', 'PN-32', 'PN-33', 'PN-34', 'PN-35', 'PN-36', 'PN-37', 'PN-38', 'PN-39', 'PN-41',
    'PN-43', 'PN-45', 'PN-47',

    // MB Series
    'MB-01', 'MB-02', 'MB-03',

    // LP Series
    'LP-01', 'LP-02', 'LP-03', 'LP-05', 'LP-06', 'LP-07', 'LP-08', 'LP-09', 'LP-10',
    'LP-11', 'LP-12', 'LP-14', 'LP-16',

    // PW Series
    'PW-01', 'PW-02', 'PW-03', 'PW-05', 'PW-06', 'PW-07', 'PW-08', 'PW-09', 'PW-10',
    'PW-11', 'PW-12', 'PW-14',

    // SL Series
    'SL-01', 'SL-02', 'SL-03', 'SL-05', 'SL-06', 'SL-07', 'SL-08', 'SL-09', 'SL-10',
    'SL-12', 'SL-14',

    // LS Series
    'LS-01', 'LS-02', 'LS-03', 'LS-05', 'LS-06', 'LS-07', 'LS-08', 'LS-10', 'LS-12',

    // RW Series
    'RW-03', 'RW-05', 'RW-07', 'RW-09',

    // ML Series
    'ML-01', 'ML-02', 'ML-03', 'ML-05', 'ML-06', 'ML-07', 'ML-08', 'ML-09', 'ML-10',
    'ML-11', 'ML-12', 'ML-14',

    'LAINNYA'
]);

// ---------------------
// Helpers
// ---------------------
function isValidDate(n) {
    return Number.isInteger(n) && n >= 1 && n <= 30;
}

function normalizeWhatsApp(input) {
    const digits = String(input || '').replace(/\D/g, '');
    // Terima format 62xxxxxxxxxx (10-15 digit total termasuk 62) - kamu pakai range 8-13 setelah 62.
    if (/^62\d{8,13}$/.test(digits)) return digits;
    if (/^08\d{8,13}$/.test(digits)) return '62' + digits.slice(1);
    return null;
}

function sanitizeName(input) {
    const s = String(input ?? '').trim();
    // remove control chars
    return s.replace(/[\u0000-\u001F\u007F]/g, '');
}

function sanitizeHouseCode(input) {
    return String(input ?? '').trim().toUpperCase();
}

function buildValidationError(fields) {
    return { success: false, error: 'Validasi gagal', fields };
}

/**
 * Step 5 (defense-in-depth): origin/referer check "soft"
 * - Jika header Origin/Referer ada -> harus match origin request sendiri.
 * - Jika tidak ada (mis. curl) -> allow.
 */
function requireSameOriginSoft(req, res, next) {
    const origin = req.get('origin');
    const referer = req.get('referer');
    if (!origin && !referer) return next();

    // construct expected origin
    const proto = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const host = req.get('host');
    const expected = `${proto}://${host}`;

    const okOrigin = origin ? origin === expected : true;
    const okReferer = referer ? referer.startsWith(expected + '/') || referer === expected : true;

    if (!okOrigin || !okReferer) {
        return res.status(403).json({ success: false, error: 'Forbidden (origin mismatch)' });
    }
    return next();
}

function requireAdmin(req, res, next) {
    try {
        const token = req.cookies?.[ADMIN_COOKIE];
        if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });
        if (!JWT_SECRET) return res.status(500).json({ success: false, error: 'Server misconfigured' });

        const payload = jwt.verify(token, JWT_SECRET);
        if (payload?.role !== 'admin') throw new Error('bad role');
        next();
    } catch {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
}

function logAudit(event, meta = {}) {
    // minimal structured logging (Step 7 foundation)
    try {
        console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...meta }));
    } catch {
        console.log(`[${event}]`, meta);
    }
}

// ---------------------
// Step 4: Rate limiters
// ---------------------
const jsonRateLimitHandler = (req, res /*, next, options */) => {
    res.status(429).json({
        success: false,
        error: 'Terlalu banyak request, coba lagi nanti'
    });
};

const publicPostLimiter = rateLimit({
    windowMs: RL_PUBLIC_POST_WINDOW_MS,
    limit: RL_PUBLIC_POST_LIMIT,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: jsonRateLimitHandler
});

const publicGetLimiter = rateLimit({
    windowMs: RL_PUBLIC_GET_WINDOW_MS,
    limit: RL_PUBLIC_GET_LIMIT,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: jsonRateLimitHandler
});

// Rate limit login (anti-bruteforce) - review: dibuat lebih ketat
const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: Number(process.env.RL_ADMIN_LOGIN_LIMIT || 10),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: jsonRateLimitHandler
});

// Optional limiter export
const exportLimiter = rateLimit({
    windowMs: RL_ADMIN_EXPORT_WINDOW_MS,
    limit: RL_ADMIN_EXPORT_LIMIT,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: jsonRateLimitHandler
});

// ---------------------
// Validation (Step 4)
// ---------------------
function validateRegistrationPayload(body) {
    const fields = {};

    const tanggalRaw = body?.tanggal;
    const kodeRaw = body?.kode_jalan;
    const namaRaw = body?.nama_keluarga;
    const waRaw = body?.whatsapp;

    const tanggal = parseInt(tanggalRaw, 10);
    const kode = sanitizeHouseCode(kodeRaw);
    const nama = sanitizeName(namaRaw);
    const wa = normalizeWhatsApp(waRaw);

    if (!tanggalRaw) fields.tanggal = 'Tanggal wajib diisi';
    else if (!isValidDate(tanggal)) fields.tanggal = 'Tanggal harus 1-30';

    if (!kodeRaw) fields.kode_jalan = 'Kode jalan wajib diisi';
    else if (!HOUSE_CODES.has(kode)) fields.kode_jalan = 'Kode jalan tidak valid';

    if (!namaRaw) fields.nama_keluarga = 'Nama keluarga wajib diisi';
    else if (nama.length > 60) fields.nama_keluarga = 'Nama keluarga maksimal 60 karakter';
    else if (nama.length < 2) fields.nama_keluarga = 'Nama keluarga terlalu pendek';

    if (!waRaw) fields.whatsapp = 'WhatsApp wajib diisi';
    else if (!wa) fields.whatsapp = 'Format WhatsApp tidak valid';

    const ok = Object.keys(fields).length === 0;
    return ok ? { ok, value: { tanggal, kode_jalan: kode, nama_keluarga: nama, whatsapp: wa } } : { ok, fields };
}

// ---------------------
// Routes
// ---------------------

// Public settings (NO admin_password)
app.get('/api/settings', (req, res) => {
    try {
        const row = db.prepare(`
      SELECT phase2_unlocked, app_title, start_date, updated_at
      FROM settings WHERE id=1
    `).get();

        res.json({
            success: true,
            data: {
                ...row,
                phase2_unlocked: !!row?.phase2_unlocked
            }
        });
    } catch (e) {
        console.error('settings get error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin update settings (protected) + origin soft-check
app.put('/api/settings', requireAdmin, requireSameOriginSoft, (req, res) => {
    try {
        const { phase2_unlocked, app_title, start_date, admin_password } = req.body || {};

        if (start_date && !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
            return res.status(400).json({ success: false, error: 'start_date must be YYYY-MM-DD' });
        }

        let newPassHash = null;
        if (typeof admin_password === 'string' && admin_password.trim().length >= 6) {
            newPassHash = bcrypt.hashSync(admin_password.trim(), 12);
        }

        db.prepare(`
      UPDATE settings
      SET phase2_unlocked = COALESCE(?, phase2_unlocked),
          app_title = COALESCE(?, app_title),
          start_date = COALESCE(?, start_date),
          admin_password = COALESCE(?, admin_password),
          updated_at = CURRENT_TIMESTAMP
      WHERE id=1
    `).run(
            phase2_unlocked === undefined ? null : phase2_unlocked ? 1 : 0,
            app_title ?? null,
            start_date ?? null,
            newPassHash
        );

        logAudit('admin.settings.update', { ip: req.ip });
        res.json({ success: true });
    } catch (e) {
        console.error('settings put error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin login (HttpOnly cookie) + rate limit
app.post('/api/admin/login', loginLimiter, (req, res) => {
    try {
        const { password } = req.body || {};
        if (!password) return res.status(400).json({ success: false, error: 'Password required' });
        if (!JWT_SECRET) return res.status(500).json({ success: false, error: 'JWT_SECRET missing' });

        const row = db.prepare('SELECT admin_password FROM settings WHERE id=1').get();
        const stored = row?.admin_password || '';

        const ok = bcrypt.compareSync(password, stored);
        if (!ok) {
            logAudit('admin.login.fail', { ip: req.ip });
            return res.status(401).json({ success: false, error: 'Password salah' });
        }

        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });

        // Dynamic Secure cookie: HTTPS only (local HTTP OK, Cloudflare HTTPS OK)
        const isHttps = req.secure || req.get('x-forwarded-proto') === 'https';

        res.cookie(ADMIN_COOKIE, token, {
            httpOnly: true,
            secure: isHttps,
            sameSite: 'Strict',
            maxAge: 2 * 60 * 60 * 1000,
            path: '/'
        });

        logAudit('admin.login.success', { ip: req.ip });
        res.json({ success: true });
    } catch (e) {
        console.error('login error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
    res.json({ success: true, role: 'admin' });
});

app.post('/api/admin/logout', requireAdmin, requireSameOriginSoft, (req, res) => {
    const isHttps = req.secure || req.get('x-forwarded-proto') === 'https';
    res.clearCookie(ADMIN_COOKIE, {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'Strict',
        path: '/'
    });
    logAudit('admin.logout', { ip: req.ip });
    res.json({ success: true });
});

// ================================
// Step 2: Public registrations (NO WhatsApp / PII)
// Step 4: rate limit GET untuk anti-scraping
// ================================
app.get('/api/public/registrations', publicGetLimiter, (req, res) => {
    try {
        const rows = db.prepare(`
      SELECT id, tanggal, kode_jalan, nama_keluarga, created_at
      FROM registrations
      ORDER BY tanggal ASC, created_at ASC
    `).all();

        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('public registrations get error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin registrations (WITH WhatsApp) - protected
app.get('/api/registrations', requireAdmin, (req, res) => {
    try {
        const rows = db.prepare(`
      SELECT * FROM registrations
      ORDER BY tanggal ASC, created_at ASC
    `).all();
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('admin registrations get error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Create registration (public) + Step 4: rate limit + validation
app.post('/api/registrations', publicPostLimiter, (req, res) => {
    try {
        const v = validateRegistrationPayload(req.body || {});
        if (!v.ok) return res.status(400).json(buildValidationError(v.fields));

        const { tanggal: dateNum, kode_jalan, nama_keluarga, whatsapp } = v.value;

        // phase 2 lock
        if (dateNum > 20) {
            const s = db.prepare('SELECT phase2_unlocked FROM settings WHERE id=1').get();
            if (!s?.phase2_unlocked) return res.status(400).json({ success: false, error: 'Tanggal 21-30 belum dibuka' });
        }

        // max 2 per day
        const count = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE tanggal=?').get(dateNum);
        if ((count?.count || 0) >= 2) {
            return res.status(400).json({ success: false, error: 'Tanggal ini sudah penuh (2 keluarga)' });
        }

        db.prepare(`
      INSERT INTO registrations (tanggal, kode_jalan, nama_keluarga, whatsapp)
      VALUES (?, ?, ?, ?)
    `).run(dateNum, kode_jalan, nama_keluarga, whatsapp);

        res.json({ success: true, message: 'Pendaftaran berhasil' });
    } catch (e) {
        console.error('registrations post error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin: update registration (protected) + origin soft-check + validation reuse
app.put('/api/registrations/:id', requireAdmin, requireSameOriginSoft, (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);

        const v = validateRegistrationPayload(req.body || {});
        if (!v.ok) return res.status(400).json(buildValidationError(v.fields));

        const { tanggal: dateNum, kode_jalan, nama_keluarga, whatsapp } = v.value;

        // max 2 per day excluding this id
        const count = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE tanggal=? AND id!=?').get(dateNum, id);
        if ((count?.count || 0) >= 2) {
            return res.status(400).json({ success: false, error: 'Tanggal ini sudah penuh (2 keluarga)' });
        }

        const result = db.prepare(`
      UPDATE registrations
      SET tanggal=?, kode_jalan=?, nama_keluarga=?, whatsapp=?
      WHERE id=?
    `).run(dateNum, kode_jalan, nama_keluarga, whatsapp, id);

        if (result.changes === 0) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });

        logAudit('admin.registration.update', { ip: req.ip, id });
        res.json({ success: true });
    } catch (e) {
        console.error('registrations put error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin: delete registration (protected) + origin soft-check
app.delete('/api/registrations/:id', requireAdmin, requireSameOriginSoft, (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const result = db.prepare('DELETE FROM registrations WHERE id=?').run(id);
        if (result.changes === 0) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });

        logAudit('admin.registration.delete', { ip: req.ip, id });
        res.json({ success: true });
    } catch (e) {
        console.error('registrations delete id error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin: clear all (protected) + origin soft-check
app.delete('/api/registrations', requireAdmin, requireSameOriginSoft, (req, res) => {
    try {
        const result = db.prepare('DELETE FROM registrations').run();
        logAudit('admin.registration.delete_all', { ip: req.ip, deletedCount: result.changes });
        res.json({ success: true, deletedCount: result.changes });
    } catch (e) {
        console.error('registrations delete all error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin: export CSV (protected) + origin soft-check + optional limiter
app.get('/api/export/csv', requireAdmin, requireSameOriginSoft, exportLimiter, (req, res) => {
    try {
        const settings = db.prepare('SELECT start_date FROM settings WHERE id=1').get();
        const startDate = settings?.start_date || null;

        const rows = db.prepare(`
      SELECT tanggal, kode_jalan, nama_keluarga, whatsapp, created_at
      FROM registrations
      ORDER BY tanggal ASC, created_at ASC
    `).all();

        function calcActualDate(ramadhanDay, start) {
            if (!start) return '';
            const [y, m, d] = start.split('-').map(Number);
            const base = new Date(Date.UTC(y, m - 1, d));
            const target = new Date(base.getTime() + (ramadhanDay - 1) * 86400000);
            const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(target.getUTCDate()).padStart(2, '0');
            const yyyy = target.getUTCFullYear();
            return `${mm}/${dd}/${yyyy}`;
        }

        function csvCell(val) {
            const s0 = String(val ?? '');
            const s = /^[=+\-@\t\r\n]/.test(s0) ? `'${s0}` : s0; // CSV injection mitigation
            const escaped = s.replace(/"/g, '""');
            return `"${escaped}"`;
        }

        const header = ['Actual Date', 'Ramadhan Date', 'Nama Keluarga', 'Kode Jalan', 'Nomor WhatsApp', 'Created At'];
        const lines = [];
        lines.push(header.map(csvCell).join(','));

        for (const r of rows) {
            lines.push(
                [
                    calcActualDate(r.tanggal, startDate),
                    r.tanggal,
                    r.nama_keluarga,
                    r.kode_jalan,
                    r.whatsapp,
                    r.created_at
                ].map(csvCell).join(',')
            );
        }

        const csv = '\ufeff' + lines.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=takjil_${new Date().toISOString().slice(0, 10)}.csv`);
        logAudit('admin.export.csv', { ip: req.ip });
        res.send(csv);
    } catch (e) {
        console.error('export csv error', e);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
});

// Health
app.get('/api/health', (req, res) => {
    try {
        db.prepare('SELECT 1 as ok').get();
        res.json({ success: true, status: 'healthy', time: new Date().toISOString() });
    } catch (e) {
        res.status(500).json({ success: false, status: 'unhealthy' });
    }
});

// Pages
app.get('/', (req, res) => res.sendFile(join(FRONTEND_DIR, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(join(FRONTEND_DIR, 'admin.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Takjil server running on http://0.0.0.0:${PORT}`);
    console.log(`Frontend dir: ${FRONTEND_DIR}`);
    console.log(`DB: ${DB_PATH}`);
    console.log(`JSON_LIMIT: ${JSON_LIMIT}`);
    console.log(`RateLimit public POST: ${RL_PUBLIC_POST_LIMIT}/${RL_PUBLIC_POST_WINDOW_MS / 60000}min`);
    console.log(`RateLimit public GET: ${RL_PUBLIC_GET_LIMIT}/${RL_PUBLIC_GET_WINDOW_MS / 60000}min`);
});
