import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', '..', 'database', 'takjil.db');

// Ensure database directory exists
const dbDir = dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '..', '..', 'frontend')));

// Initialize database
function initDatabase() {
    const db = new Database(DB_PATH);

    // Create tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tanggal INTEGER NOT NULL CHECK (tanggal BETWEEN 1 AND 30),
            kode_jalan TEXT NOT NULL,
            nama_keluarga TEXT NOT NULL,
            whatsapp TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tanggal, kode_jalan)
        );
        
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            phase2_unlocked BOOLEAN DEFAULT FALSE,
            admin_password TEXT DEFAULT 'takjil2026',
            app_title TEXT DEFAULT 'Takjil Ramadhan 1447H',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        INSERT OR IGNORE INTO settings (id) VALUES (1);
    `);

    console.log('Database initialized at:', DB_PATH);
    return db;
}

const db = initDatabase();

// Helper function to validate date
function isValidDate(date) {
    return Number.isInteger(date) && date >= 1 && date <= 30;
}

// Helper function to validate WhatsApp
function isValidWhatsApp(whatsapp) {
    return /^62\d{9,}$/.test(whatsapp);
}

// API Routes

// Get all registrations
app.get('/api/registrations', (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT * FROM registrations 
            ORDER BY tanggal ASC, created_at ASC
        `);
        const registrations = stmt.all();
        res.json({ success: true, data: registrations });
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Add new registration
app.post('/api/registrations', (req, res) => {
    try {
        const { tanggal, kode_jalan, nama_keluarga, whatsapp } = req.body;

        // Validate required fields
        if (!tanggal || !kode_jalan || !nama_keluarga || !whatsapp) {
            return res.status(400).json({
                success: false,
                error: 'Semua field harus diisi'
            });
        }

        // Validate date
        const dateNum = parseInt(tanggal);
        if (!isValidDate(dateNum)) {
            return res.status(400).json({
                success: false,
                error: 'Tanggal harus antara 1-30'
            });
        }

        // Check phase 2 availability
        if (dateNum > 20) {
            const settings = db.prepare('SELECT phase2_unlocked FROM settings WHERE id = 1').get();
            if (!settings.phase2_unlocked) {
                return res.status(400).json({
                    success: false,
                    error: 'Tanggal 21-30 belum dibuka'
                });
            }
        }

        // Validate WhatsApp format
        if (!isValidWhatsApp(whatsapp)) {
            return res.status(400).json({
                success: false,
                error: 'Format WhatsApp tidak valid. Harus diawali 62'
            });
        }

        // Check max 2 registrations per day
        const countStmt = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE tanggal = ?');
        const countResult = countStmt.get(dateNum);
        if (countResult.count >= 2) {
            return res.status(400).json({
                success: false,
                error: 'Tanggal ini sudah penuh (2 keluarga)'
            });
        }

        // Check duplicate house code for same date
        const duplicateStmt = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE tanggal = ? AND kode_jalan = ?');
        const duplicateResult = duplicateStmt.get(dateNum, kode_jalan);
        if (duplicateResult.count > 0) {
            return res.status(400).json({
                success: false,
                error: 'Kode jalan ini sudah terdaftar di tanggal ini'
            });
        }

        // Insert registration
        const insertStmt = db.prepare(`
            INSERT INTO registrations (tanggal, kode_jalan, nama_keluarga, whatsapp) 
            VALUES (?, ?, ?, ?)
        `);

        const result = insertStmt.run(dateNum, kode_jalan, nama_keluarga, whatsapp);

        res.json({
            success: true,
            message: 'Pendaftaran berhasil',
            id: result.lastInsertRowid
        });

    } catch (error) {
        console.error('Error adding registration:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Delete registration
app.delete('/api/registrations/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const stmt = db.prepare('DELETE FROM registrations WHERE id = ?');
        const result = stmt.run(id);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        }

        res.json({ success: true, message: 'Data berhasil dihapus' });

    } catch (error) {
        console.error('Error deleting registration:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Get settings
app.get('/api/settings', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM settings WHERE id = 1');
        const settings = stmt.get();
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Update settings
app.put('/api/settings', (req, res) => {
    try {
        const { phase2_unlocked, admin_password, app_title } = req.body;

        const stmt = db.prepare(`
            UPDATE settings 
            SET phase2_unlocked = ?, 
                admin_password = COALESCE(?, admin_password),
                app_title = COALESCE(?, app_title),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `);

        stmt.run(
            phase2_unlocked ? 1 : 0,
            admin_password,
            app_title
        );

        res.json({ success: true, message: 'Settings updated' });

    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Admin login
app.post('/api/admin/login', (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ success: false, error: 'Password required' });
        }

        const stmt = db.prepare('SELECT admin_password FROM settings WHERE id = 1');
        const settings = stmt.get();

        if (password === settings.admin_password) {
            res.json({ success: true, message: 'Login successful' });
        } else {
            res.status(401).json({ success: false, error: 'Password salah' });
        }

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Export to CSV
app.get('/api/export/csv', (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT tanggal, kode_jalan, nama_keluarga, whatsapp, 
                   DATE(created_at) as tanggal_daftar
            FROM registrations 
            ORDER BY tanggal, created_at
        `);

        const registrations = stmt.all();

        // Convert to CSV
        const headers = ['Tanggal', 'Kode Jalan', 'Nama Keluarga', 'WhatsApp', 'Tanggal Daftar'];
        const csvRows = registrations.map(reg => [
            reg.tanggal,
            reg.kode_jalan,
            `"${reg.nama_keluarga}"`,
            reg.whatsapp,
            reg.tanggal_daftar
        ]);

        const csv = [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=takjil_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);

    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    try {
        // Test database connection
        db.prepare('SELECT 1 as test').get();
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(500).json({ success: false, status: 'unhealthy', error: error.message });
    }
});

// Serve frontend pages
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, '..', '..', 'frontend', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(join(__dirname, '..', '..', 'frontend', 'admin.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 Takjil Ramadhan Server
    =========================
    📍 Local:    http://localhost:${PORT}
    🌐 Network:  http://0.0.0.0:${PORT}
    📊 Database: ${DB_PATH}
    ⏰ Started:  ${new Date().toLocaleString('id-ID')}
    `);
});