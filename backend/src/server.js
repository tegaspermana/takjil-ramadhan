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

// Optional: set if you host frontend on different origin
// Example: CORS_ORIGIN=https://your-domain.example
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';

app.set('trust proxy', 1); // required behind reverse proxies for secure cookies [5](https://docs.docker.com/get-started/docker-concepts/running-containers/sharing-local-files/)[6](https://thomaswildetech.com/blog/2025/07/08/applying-appropriate-file-permissions-on-docker-bind-mounts/)
app.disable('x-powered-by'); // reduce fingerprinting in production [3](https://stackoverflow.com/questions/75205873/error-nodeinternal-modules-cjs-loader1056-throw-err)[11](https://tutorialreference.com/javascript/examples/faq/javascript-error-cannot-find-module-internal-modules-cjs-loader)

app.use(
    helmet({
        contentSecurityPolicy: false, // keep off for now (CDN assets); harden later
        crossOriginEmbedderPolicy: false
    })
);

if (CORS_ORIGIN) {
    app.use(
        cors({
            origin: CORS_ORIGIN,
            credentials: true
        })
    );
} else {
    app.use(cors());
}

app.use(express.json());
app.use(cookieParser());

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

    // Create registrations table
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

    // Settings table
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

    // Ensure start_date exists (in case of older DB)
    const cols = db.prepare("PRAGMA table_info('settings')").all();
    const hasStartDate = cols.some((c) => c.name === 'start_date');
    if (!hasStartDate) {
        try {
            db.prepare("ALTER TABLE settings ADD COLUMN start_date TEXT DEFAULT NULL").run();
        } catch (_) { }
    }

    // Helpful indexes
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_registrations_tanggal ON registrations(tanggal);
    CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at);
  `);

    // Migrate admin_password to bcrypt if it is plaintext
    migrateAdminPassword(db);

    return db;
}

function migrateAdminPassword(db) {
    const row = db.prepare('SELECT admin_password FROM settings WHERE id=1').get();
    const stored = row?.admin_password || '';
    const looksHashed = /^\$2[aby]\$/.test(stored);

    // If already hashed, do nothing
    if (looksHashed) return;

    // If env ADMIN_PASSWORD exists, use it; otherwise keep stored default
    const source = process.env.ADMIN_PASSWORD || stored || 'takjil2026';
    const hash = bcrypt.hashSync(source, 12);
    db.prepare('UPDATE settings SET admin_password=?, updated_at=CURRENT_TIMESTAMP WHERE id=1').run(hash);
}

const db = initDatabase();

// ---------------------
// Helpers
// ---------------------
function isValidDate(n) {
    return Number.isInteger(n) && n >= 1 && n <= 30;
}

function normalizeWhatsApp(input) {
    const digits = String(input || '').replace(/\D/g, '');
    if (/^62\d{8,13}$/.test(digits)) return digits;
    if (/^08\d{8,13}$/.test(digits)) return '62' + digits.slice(1);
    return null;
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

// Rate limit login (anti-bruteforce) [7](https://github.com/WiseLibs/better-sqlite3/discussions/1270)[8](https://answers.netlify.com/t/better-sqlite3-no-longer-installing/142578)
const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false
});

// ---------------------
// Routes
// ---------------------

// Public settings (never include admin_password)
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

// Admin update settings (protected)
app.put('/api/settings', requireAdmin, (req, res) => {
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

        res.json({ success: true });
    } catch (e) {
        console.error('settings put error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin login (sets HttpOnly cookie) [1](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md)[2](https://www.npmjs.com/package/better-sqlite3)
app.post('/api/admin/login', loginLimiter, (req, res) => {
    try {
        const { password } = req.body || {};
        if (!password) return res.status(400).json({ success: false, error: 'Password required' });
        if (!JWT_SECRET) return res.status(500).json({ success: false, error: 'JWT_SECRET missing' });

        const row = db.prepare('SELECT admin_password FROM settings WHERE id=1').get();
        const stored = row?.admin_password || '';

        const ok = bcrypt.compareSync(password, stored);
        if (!ok) return res.status(401).json({ success: false, error: 'Password salah' });

        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });

        res.cookie(ADMIN_COOKIE, token, {
            httpOnly: true,
            secure: IS_PROD,          // keep true in production (HTTPS)
            sameSite: 'Strict',       // helps mitigate CSRF
            maxAge: 2 * 60 * 60 * 1000
        });

        res.json({ success: true });
    } catch (e) {
        console.error('login error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
    res.json({ success: true, role: 'admin' });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
    res.clearCookie(ADMIN_COOKIE, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'Strict'
    });
    res.json({ success: true });
});

// Public registrations (⚠️ Step 2 will remove whatsapp from public)
app.get('/api/registrations', (req, res) => {
    try {
        const rows = db.prepare(`
      SELECT * FROM registrations
      ORDER BY tanggal ASC, created_at ASC
    `).all();
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('registrations get error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Create registration (public)
app.post('/api/registrations', (req, res) => {
    try {
        const { tanggal, kode_jalan, nama_keluarga, whatsapp } = req.body || {};
        if (!tanggal || !kode_jalan || !nama_keluarga || !whatsapp) {
            return res.status(400).json({ success: false, error: 'Semua field harus diisi' });
        }

        const dateNum = parseInt(tanggal, 10);
        if (!isValidDate(dateNum)) return res.status(400).json({ success: false, error: 'Tanggal harus 1-30' });

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

        const wa = normalizeWhatsApp(whatsapp);
        if (!wa) return res.status(400).json({ success: false, error: 'Format WhatsApp tidak valid' });

        db.prepare(`
      INSERT INTO registrations (tanggal, kode_jalan, nama_keluarga, whatsapp)
      VALUES (?, ?, ?, ?)
    `).run(
            dateNum,
            String(kode_jalan).trim().toUpperCase(),
            String(nama_keluarga).trim(),
            wa
        );

        res.json({ success: true, message: 'Pendaftaran berhasil' });
    } catch (e) {
        console.error('registrations post error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin: update registration (protected)
app.put('/api/registrations/:id', requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { tanggal, kode_jalan, nama_keluarga, whatsapp } = req.body || {};

        const dateNum = parseInt(tanggal, 10);
        if (!isValidDate(dateNum)) return res.status(400).json({ success: false, error: 'Tanggal harus 1-30' });

        const wa = normalizeWhatsApp(whatsapp);
        if (!wa) return res.status(400).json({ success: false, error: 'Format WhatsApp tidak valid' });

        // max 2 per day excluding this id
        const count = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE tanggal=? AND id!=?').get(dateNum, id);
        if ((count?.count || 0) >= 2) {
            return res.status(400).json({ success: false, error: 'Tanggal ini sudah penuh (2 keluarga)' });
        }

        const result = db.prepare(`
      UPDATE registrations
      SET tanggal=?, kode_jalan=?, nama_keluarga=?, whatsapp=?
      WHERE id=?
    `).run(
            dateNum,
            String(kode_jalan).trim().toUpperCase(),
            String(nama_keluarga).trim(),
            wa,
            id
        );

        if (result.changes === 0) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true });
    } catch (e) {
        console.error('registrations put error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin: delete registration (protected)
app.delete('/api/registrations/:id', requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const result = db.prepare('DELETE FROM registrations WHERE id=?').run(id);
        if (result.changes === 0) return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        res.json({ success: true });
    } catch (e) {
        console.error('registrations delete id error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin: clear all (protected)
app.delete('/api/registrations', requireAdmin, (req, res) => {
    try {
        const result = db.prepare('DELETE FROM registrations').run();
        res.json({ success: true, deletedCount: result.changes });
    } catch (e) {
        console.error('registrations delete all error', e);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin: export CSV (protected) with OWASP CSV injection mitigation [9](https://github.com/WiseLibs/better-sqlite3/issues/1326)[10](https://github.com/WiseLibs/better-sqlite3/issues/943)
app.get('/api/export/csv', requireAdmin, (req, res) => {
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

        // CSV escape + formula injection mitigation (prefix dangerous starters) [9](https://github.com/WiseLibs/better-sqlite3/issues/1326)[10](https://github.com/WiseLibs/better-sqlite3/issues/943)
        function csvCell(val) {
            const s0 = String(val ?? '');
            const s = /^[=+\-@\t\r\n]/.test(s0) ? `'${s0}` : s0;
            const escaped = s.replace(/"/g, '""');
            return `"${escaped}"`;
        }

        const header = ['Actual Date', 'Ramadhan Date', 'Nama Keluarga', 'Kode Jalan', 'Nomor WhatsApp', 'Created At'];
        const lines = [];
        lines.push(header.map(csvCell).join(','));

        for (const r of rows) {
            lines.push([
                calcActualDate(r.tanggal, startDate),
                r.tanggal,
                r.nama_keluarga,
                r.kode_jalan,
                r.whatsapp,
                r.created_at
            ].map(csvCell).join(','));
        }

        const csv = '\ufeff' + lines.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=takjil_${new Date().toISOString().slice(0, 10)}.csv`);
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
});