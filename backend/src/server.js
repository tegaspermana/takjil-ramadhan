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
const PORT = process.env.PORT || 3001;
const defaultDb1 = join(__dirname, '..', 'database', 'takjil.db');
const defaultDb2 = join(__dirname, '..', '..', 'database', 'takjil.db');
const DB_PATH = process.env.DB_PATH || (fs.existsSync(dirname(defaultDb1)) ? defaultDb1 : defaultDb2);

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
app.use(express.static(join(__dirname, '..', 'frontend')));

// Initialize database
function initDatabase() {
    const db = new Database(DB_PATH);

    // Check if old table with UNIQUE constraint exists
    const tableInfo = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='registrations'
    `).get();

    // If table exists and has UNIQUE constraint, drop it
    if (tableInfo && tableInfo.sql && tableInfo.sql.includes('UNIQUE(tanggal, kode_jalan)')) {
        console.log('Old table with UNIQUE constraint detected. Dropping and recreating...');

        // Backup data if any
        const existingData = db.prepare('SELECT * FROM registrations').all();

        // Drop old table
        db.prepare('DROP TABLE IF EXISTS registrations').run();

        // Create new table without UNIQUE constraint
        db.exec(`
            CREATE TABLE registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tanggal INTEGER NOT NULL CHECK (tanggal BETWEEN 1 AND 30),
                kode_jalan TEXT NOT NULL,
                nama_keluarga TEXT NOT NULL,
                whatsapp TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Restore data if any existed
        if (existingData.length > 0) {
            const insertStmt = db.prepare(`
                INSERT INTO registrations (tanggal, kode_jalan, nama_keluarga, whatsapp, created_at)
                VALUES (?, ?, ?, ?, ?)
            `);

            for (const row of existingData) {
                insertStmt.run(
                    row.tanggal,
                    row.kode_jalan,
                    row.nama_keluarga,
                    row.whatsapp,
                    row.created_at
                );
            }
            console.log(`Restored ${existingData.length} records`);
        }
    } else {
        // Create table if it doesn't exist
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
    }

    // Create settings table (unchanged)
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

    // Add start_date column if it's missing in older DBs
    const cols = db.prepare("PRAGMA table_info('settings')").all();
    const hasStartDate = cols.some(c => c.name === 'start_date');
    if (!hasStartDate) {
        try {
            db.prepare("ALTER TABLE settings ADD COLUMN start_date TEXT DEFAULT NULL").run();
            console.log('Added start_date column to settings');
        } catch (err) {
            console.warn('Could not add start_date column:', err.message);
        }
    }

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
        //const duplicateStmt = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE tanggal = ? AND kode_jalan = ?');
        //const duplicateResult = duplicateStmt.get(dateNum, kode_jalan);
        //if (duplicateResult.count > 0) {
        //    return res.status(400).json({
        //        success: false,
        //        error: 'Kode jalan ini sudah terdaftar di tanggal ini'
        //});
        //}

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

// Update registration
app.put('/api/registrations/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { tanggal, kode_jalan, nama_keluarga, whatsapp } = req.body;

        if (!tanggal || !kode_jalan || !nama_keluarga || !whatsapp) {
            return res.status(400).json({ success: false, error: 'Semua field harus diisi' });
        }

        const dateNum = parseInt(tanggal);
        if (!isValidDate(dateNum)) {
            return res.status(400).json({ success: false, error: 'Tanggal harus antara 1-30' });
        }

        // Check phase 2 availability
        if (dateNum > 20) {
            const settingsRow = db.prepare('SELECT phase2_unlocked FROM settings WHERE id = 1').get();
            if (!settingsRow.phase2_unlocked) {
                return res.status(400).json({ success: false, error: 'Tanggal 21-30 belum dibuka' });
            }
        }

        // Validate WhatsApp format
        if (!isValidWhatsApp(whatsapp)) {
            return res.status(400).json({ success: false, error: 'Format WhatsApp tidak valid. Harus diawali 62' });
        }

        // Check max 2 registrations per day excluding this id
        const countStmt = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE tanggal = ? AND id != ?');
        const countResult = countStmt.get(dateNum, id);
        if (countResult.count >= 2) {
            return res.status(400).json({ success: false, error: 'Tanggal ini sudah penuh (2 keluarga)' });
        }

        // Check duplicate house code for same date excluding this id
        //const duplicateStmt = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE tanggal = ? AND kode_jalan = ? AND id != ?');
        //const duplicateResult = duplicateStmt.get(dateNum, kode_jalan, id);
        //if (duplicateResult.count > 0) {
        //    return res.status(400).json({ success: false, error: 'Kode jalan ini sudah terdaftar di tanggal ini' });
        //}

        const updateStmt = db.prepare(`
            UPDATE registrations
            SET tanggal = ?, kode_jalan = ?, nama_keluarga = ?, whatsapp = ?
            WHERE id = ?
        `);

        const result = updateStmt.run(dateNum, kode_jalan, nama_keluarga, whatsapp, id);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: 'Data tidak ditemukan' });
        }

        res.json({ success: true, message: 'Data berhasil diperbarui' });

    } catch (error) {
        console.error('Error updating registration:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Clear all registrations
app.delete('/api/registrations', (req, res) => {
    try {
        const stmt = db.prepare('DELETE FROM registrations');
        const result = stmt.run();

        res.json({
            success: true,
            message: `Berhasil menghapus ${result.changes} data pendaftaran`,
            deletedCount: result.changes
        });
    } catch (error) {
        console.error('Error clearing registrations:', error);
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
        const { phase2_unlocked, admin_password, app_title, start_date } = req.body;

        // Validate start_date if present (expect YYYY-MM-DD)
        if (start_date && !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
            return res.status(400).json({ success: false, error: 'start_date harus dalam format YYYY-MM-DD' });
        }

        const stmt = db.prepare(`
            UPDATE settings 
            SET phase2_unlocked = ?, 
                admin_password = COALESCE(?, admin_password),
                app_title = COALESCE(?, app_title),
                start_date = COALESCE(?, start_date),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `);

        stmt.run(
            phase2_unlocked ? 1 : 0,
            admin_password,
            app_title,
            start_date
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
        // Get settings for start_date
        const settingsStmt = db.prepare('SELECT start_date FROM settings WHERE id = 1');
        const settings = settingsStmt.get();

        // Get all registrations
        const stmt = db.prepare(`
            SELECT tanggal, kode_jalan, nama_keluarga, whatsapp
            FROM registrations 
            ORDER BY tanggal, created_at
        `);

        const registrations = stmt.all();

        // Function to calculate actual date
        function calculateActualDate(ramadhanDate, startDate) {
            if (!startDate) return '';
            try {
                const base = new Date(startDate + 'T00:00:00');
                const actualDate = new Date(base);
                actualDate.setDate(base.getDate() + (ramadhanDate - 1));

                // Format as mm/dd/yyyy
                const month = (actualDate.getMonth() + 1).toString().padStart(2, '0');
                const day = actualDate.getDate().toString().padStart(2, '0');
                const year = actualDate.getFullYear();

                return `${month}/${day}/${year}`;
            } catch (error) {
                return '';
            }
        }

        // Convert to CSV
        const headers = ['Actual Date (mm/dd/yyyy)', 'Ramadhan Date', 'Nama Keluarga', 'Kode Jalan', 'Nomor WhatsApp'];
        const csvRows = registrations.map(reg => [
            calculateActualDate(reg.tanggal, settings?.start_date),
            reg.tanggal,
            `"${reg.nama_keluarga}"`,
            reg.kode_jalan,
            reg.whatsapp
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
    res.sendFile(join(__dirname, '..', 'frontend', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(join(__dirname, '..', 'frontend', 'admin.html'));
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
