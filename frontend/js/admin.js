// Takjil Ramadhan - Admin Panel
// ==============================

// Configuration
const API_BASE_URL = window.location.origin;
const ITEMS_PER_PAGE = 10;

// Available house codes (same source as frontend)
const HOUSE_CODES = [
    'WB-01', 'WB-02', 'WB-03', 'WB-05', 'WB-06', 'WB-07', 'WB-08', 'WB-09', 'WB-10', 'WB-11', 'WB-12', 'WB-14', 'WB-15', 'WB-16', 'WB-17', 'WB-18', 'WB-19', 'WB-20', 'WB-21', 'WB-22', 'WB-23', 'WB-24', 'WB-25', 'WB-26', 'WB-27', 'WB-28', 'WB-29', 'WB-30', 'WB-31', 'WB-32', 'WB-33', 'WB-34', 'WB-35', 'WB-36', 'WB-37', 'WB-38', 'WB-39', 'WB-40', 'WB-41', 'WB-42', 'WB-43', 'WB-45', 'WB-46', 'WB-47', 'WB-48',
    'PN-01', 'PN-02', 'PN-03', 'PN-05', 'PN-06', 'PN-07', 'PN-08', 'PN-09', 'PN-10', 'PN-11', 'PN-12', 'PN-14', 'PN-15', 'PN-16', 'PN-17', 'PN-18', 'PN-19', 'PN-20', 'PN-21', 'PN-22', 'PN-23', 'PN-24', 'PN-25', 'PN-26', 'PN-27', 'PN-28', 'PN-29', 'PN-30', 'PN-31', 'PN-32', 'PN-33', 'PN-34', 'PN-35', 'PN-36', 'PN-37', 'PN-38', 'PN-39', 'PN-41', 'PN-43', 'PN-45', 'PN-47',
    'MB-01', 'MB-02', 'MB-03',
    'LP-01', 'LP-02', 'LP-03', 'LP-05', 'LP-06', 'LP-07', 'LP-08', 'LP-09', 'LP-10', 'LP-11', 'LP-12', 'LP-14', 'LP-16',
    'PW-01', 'PW-02', 'PW-03', 'PW-05', 'PW-06', 'PW-07', 'PW-08', 'PW-09', 'PW-10', 'PW-11', 'PW-12', 'PW-14',
    'SL-01', 'SL-02', 'SL-03', 'SL-05', 'SL-06', 'SL-07', 'SL-08', 'SL-09', 'SL-10', 'SL-12', 'SL-14',
    'LS-01', 'LS-02', 'LS-03', 'LS-05', 'LS-06', 'LS-07', 'LS-08', 'LS-10', 'LS-12',
    'RW-03', 'RW-05', 'RW-07', 'RW-09',
    'ML-01', 'ML-02', 'ML-03', 'ML-05', 'ML-06', 'ML-07', 'ML-08', 'ML-09', 'ML-10', 'ML-11', 'ML-12', 'ML-14'
];

// Global State
let registrations = [];
let settings = {};
let currentPage = 1;
let searchQuery = '';

// Check authentication on load
document.addEventListener('DOMContentLoaded', function () {
    const isAuthenticated = sessionStorage.getItem('takjil_admin') === 'true';
    if (isAuthenticated) {
        showAdminDashboard();
    }
});

async function handleLogin() {
    const password = document.getElementById('admin-password').value;
    const errorDiv = document.getElementById('login-error');

    if (!password) {
        errorDiv.textContent = 'Password harus diisi';
        errorDiv.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (data.success) {
            sessionStorage.setItem('takjil_admin', 'true');
            showAdminDashboard();
        } else {
            errorDiv.textContent = 'Password salah';
            errorDiv.classList.remove('hidden');
            document.getElementById('admin-password').value = '';
            document.getElementById('admin-password').focus();
        }
    } catch (error) {
        errorDiv.textContent = 'Koneksi error. Coba lagi.';
        errorDiv.classList.remove('hidden');
    }
}

async function showAdminDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').classList.remove('hidden');
    await loadAdminData();
    // Initialize edit modal autocomplete
    initEditHouseAutocomplete();
    // Initialize date overview
    renderDateOverview();
}

function handleLogout() {
    sessionStorage.removeItem('takjil_admin');
    location.reload();
}

async function loadAdminData() {
    try {
        // Load settings
        const settingsResponse = await fetch(`${API_BASE_URL}/api/settings`);
        const settingsData = await settingsResponse.json();
        if (settingsData.success) {
            settings = settingsData.data;
            updatePhaseToggle();
        }

        // Load registrations
        await refreshData();

    } catch (error) {
        console.error('Error loading admin data:', error);
        alert('Gagal memuat data admin');
    }
}

async function refreshData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/registrations`);
        const data = await response.json();

        if (data.success) {
            registrations = data.data;
            updateStats();
            renderTable();
            renderDateOverview();
        }
    } catch (error) {
        console.error('Error refreshing data:', error);
        alert('Gagal memuat data');
    }
}

function updateStats() {
    const total = registrations.length;
    const uniqueDates = new Set(registrations.map(r => r.tanggal)).size;
    const percent = Math.round((total / 60) * 100);

    document.getElementById('stats-total').textContent = total;
    document.getElementById('stats-dates').textContent = `${uniqueDates}/30`;
    document.getElementById('stats-percent').textContent = `${percent}%`;
    document.getElementById('stats-phase').textContent = settings.phase2_unlocked ? 'Terbuka' : 'Tertutup';
    document.getElementById('stats-phase').className = `text-2xl font-bold ${settings.phase2_unlocked ? 'text-emerald-600' : 'text-red-600'}`;
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    const searchInput = document.getElementById('search-input');

    // Apply search filter
    let filteredData = registrations;
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredData = registrations.filter(reg =>
            reg.nama_keluarga.toLowerCase().includes(query) ||
            reg.kode_jalan.toLowerCase().includes(query) ||
            reg.whatsapp.includes(query)
        );
    }

    // Calculate pagination
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageData = filteredData.slice(startIndex, endIndex);

    // Clear table
    tbody.innerHTML = '';

    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-12 text-center text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-4"></i>
                    <p>${searchQuery ? 'Tidak ditemukan data yang sesuai' : 'Belum ada data pendaftaran'}</p>
                </td>
            </tr>
        `;
    } else {
        pageData.forEach((reg, index) => {
            const rowNumber = startIndex + index + 1;
            const dateRegs = registrations.filter(r => r.tanggal === reg.tanggal);
            const status = dateRegs.length >= 2 ? 'full' : dateRegs.length === 1 ? 'partial' : 'available';

            // compute full date display if settings.start_date provided
            let dayName = '';
            let fullDateStr = '';
            if (settings && settings.start_date) {
                try {
                    const base = new Date(settings.start_date + 'T00:00:00');
                    const dateObj = new Date(base);
                    dateObj.setDate(base.getDate() + (reg.tanggal - 1));
                    dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
                    fullDateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                } catch (err) {
                    // ignore
                }
            }

            const row = document.createElement('tr');
            row.className = 'table-row';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">${rowNumber}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                        ${reg.tanggal} Ramadhan
                    </span>
                    ${dayName ? `<div class="text-sm text-gray-500 mt-1">${dayName} • ${fullDateStr}</div>` : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap font-medium">${reg.kode_jalan}</td>
                <td class="px-6 py-4">${reg.nama_keluarga}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <a href="https://wa.me/${reg.whatsapp}" target="_blank" 
                       class="text-blue-600 hover:text-blue-800 hover:underline">
                        ${reg.whatsapp}
                    </a>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="status-badge status-${status}">
                        ${status === 'available' ? 'Tersedia' :
                    status === 'partial' ? '1/2 Terisi' : 'Penuh'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <button onclick="openEditModal(${reg.id})" class="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition mr-2">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteRegistration(${reg.id})" 
                            class="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Update table info
    document.getElementById('table-count').textContent = filteredData.length;
    document.getElementById('table-info').textContent =
        `Menampilkan ${startIndex + 1}-${Math.min(endIndex, totalItems)} dari ${totalItems} data`;

    // Update pagination
    renderPagination(totalPages);

    // Setup search input listener
    if (searchInput) {
        searchInput.value = searchQuery;
        searchInput.addEventListener('input', function (e) {
            searchQuery = e.target.value.toLowerCase();
            currentPage = 1;
            renderTable();
        });
    }
}

function renderPagination(totalPages) {
    const paginationDiv = document.getElementById('pagination');
    paginationDiv.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous button
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.className = `px-3 py-1 border border-gray-300 rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`;
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    };
    paginationDiv.appendChild(prevButton);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = `px-3 py-1 border border-gray-300 ${currentPage === i ? 'bg-emerald-600 text-white' : 'hover:bg-gray-50'}`;
        pageButton.onclick = () => {
            currentPage = i;
            renderTable();
        };
        paginationDiv.appendChild(pageButton);
    }

    // Next button
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.className = `px-3 py-1 border border-gray-300 rounded ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`;
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    };
    paginationDiv.appendChild(nextButton);
}

async function deleteRegistration(id) {
    if (!confirm('Hapus data ini?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/registrations/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            await refreshData();
        } else {
            alert('Gagal menghapus: ' + data.error);
        }
    } catch (error) {
        alert('Koneksi error');
    }
}

async function exportToCSV() {
    if (registrations.length === 0) {
        alert('Tidak ada data untuk diexport');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/export/csv`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `takjil_registrasi_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (error) {
        alert('Gagal export data');
    }
}

async function togglePhase2() {
    const newValue = !settings.phase2_unlocked;

    try {
        const response = await fetch(`${API_BASE_URL}/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phase2_unlocked: newValue,
                admin_password: settings.admin_password,
                app_title: settings.app_title
            })
        });

        const data = await response.json();

        if (data.success) {
            settings.phase2_unlocked = newValue;
            updatePhaseToggle();
            updateStats();
            alert(`Tanggal 21-30 sekarang: ${newValue ? 'TERBUKA' : 'TERTUTUP'}`);
        } else {
            alert('Gagal update settings');
        }
    } catch (error) {
        alert('Koneksi error');
    }
}

async function clearAllData() {
    if (!confirm('⚠️ PERINGATAN: Ini akan menghapus SEMUA data pendaftaran secara permanen!\n\nApakah Anda yakin ingin melanjutkan?')) {
        return;
    }

    if (!confirm('Konfirmasi akhir: Semua data akan hilang dan tidak dapat dikembalikan. Lanjutkan?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/registrations`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            alert(`✅ ${data.message}`);
            // Refresh the data
            await refreshData();
        } else {
            alert('❌ Gagal menghapus data: ' + data.error);
        }
    } catch (error) {
        console.error('Error clearing data:', error);
        alert('❌ Koneksi error saat menghapus data');
    }
}

// Edit modal handlers
function openEditModal(id) {
    const reg = registrations.find(r => r.id === id);
    if (!reg) return alert('Data tidak ditemukan');

    document.getElementById('edit-id').value = reg.id;
    document.getElementById('edit-tanggal').value = reg.tanggal;
    document.getElementById('edit-house-code').value = reg.kode_jalan;
    document.getElementById('edit-family-name').value = reg.nama_keluarga;
    document.getElementById('edit-whatsapp').value = reg.whatsapp;
    document.getElementById('edit-error').classList.add('hidden');

    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('edit-modal').classList.add('flex');
}

function closeEditModal(refresh = false) {
    document.getElementById('edit-modal').classList.add('hidden');
    document.getElementById('edit-modal').classList.remove('flex');
    if (refresh) refreshData();
}

// Handle edit form submit
const editForm = document.getElementById('edit-form');
if (editForm) {
    editForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const id = parseInt(document.getElementById('edit-id').value);
        const tanggal = parseInt(document.getElementById('edit-tanggal').value);
        const kode_jalan = document.getElementById('edit-house-code').value.trim().toUpperCase();
        document.getElementById('edit-house-code').value = kode_jalan;
        const nama_keluarga = document.getElementById('edit-family-name').value.trim();
        const whatsapp = document.getElementById('edit-whatsapp').value.trim();
        const errorDiv = document.getElementById('edit-error');

        // Basic validation
        if (!tanggal || !kode_jalan || !nama_keluarga || !whatsapp) {
            errorDiv.textContent = 'Semua field harus diisi';
            errorDiv.classList.remove('hidden');
            return;
        }

        // Validate whatsapp (expect starting with 62)
        if (!/^62\d{9,}$/.test(whatsapp)) {
            errorDiv.textContent = 'Format WhatsApp tidak valid. Harus diawali 62';
            errorDiv.classList.remove('hidden');
            return;
        }

        // Validate kode_jalan exists
        if (!HOUSE_CODES.includes(kode_jalan)) {
            errorDiv.textContent = 'Kode Jalan tidak valid. Pilih dari daftar.';
            errorDiv.classList.remove('hidden');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/registrations/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tanggal, kode_jalan, nama_keluarga, whatsapp })
            });

            const data = await response.json();
            if (data.success) {
                closeEditModal(true);
            } else {
                errorDiv.textContent = data.error || 'Gagal menyimpan';
                errorDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Edit save error:', error);
            errorDiv.textContent = 'Koneksi error';
            errorDiv.classList.remove('hidden');
        }
    });
}

function initEditHouseAutocomplete() {
    const input = document.getElementById('edit-house-code');
    const suggestions = document.getElementById('edit-house-suggestions');
    const datalist = document.getElementById('edit-house-datalist');
    if (!input || !suggestions) return;

    // populate fallback datalist
    if (datalist) {
        datalist.innerHTML = '';
        HOUSE_CODES.forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            datalist.appendChild(opt);
        });
    }

    let selected = -1;

    function render(list) {
        suggestions.innerHTML = '';
        if (!list.length) {
            suggestions.classList.add('hidden');
            return;
        }
        list.forEach((code, idx) => {
            const div = document.createElement('div');
            div.className = 'px-3 py-2 cursor-pointer hover:bg-gray-100';
            div.setAttribute('role', 'option');
            div.textContent = code;
            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = code;
                hide();
            });
            suggestions.appendChild(div);
        });
        suggestions.classList.remove('hidden');
    }

    function filter(val) {
        const q = val.trim().toLowerCase();
        if (!q) return HOUSE_CODES.slice(0, 10);
        return HOUSE_CODES.filter(c => c.toLowerCase().includes(q)).slice(0, 10);
    }

    function hide() {
        suggestions.classList.add('hidden');
        selected = -1;
    }

    input.addEventListener('input', (e) => {
        const list = filter(e.target.value);
        selected = -1;
        render(list);
    });

    input.addEventListener('keydown', (e) => {
        const children = suggestions.children;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selected < children.length - 1) selected++;
            else selected = 0;
            if (children[selected]) {
                Array.from(children).forEach(c => c.classList.remove('bg-gray-100'));
                children[selected].classList.add('bg-gray-100');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selected > 0) selected--;
            else selected = children.length - 1;
            if (children[selected]) {
                Array.from(children).forEach(c => c.classList.remove('bg-gray-100'));
                children[selected].classList.add('bg-gray-100');
            }
        } else if (e.key === 'Enter') {
            if (selected >= 0 && suggestions.children[selected]) {
                e.preventDefault();
                input.value = suggestions.children[selected].textContent;
                hide();
            }
        } else if (e.key === 'Escape') {
            hide();
        }
    });

    input.addEventListener('blur', () => setTimeout(hide, 150));
    input.addEventListener('focus', (e) => render(filter(e.target.value)));
}

function updatePhaseToggle() {
    const btn = document.getElementById('phase-toggle');
    if (settings.phase2_unlocked) {
        btn.innerHTML = '<i class="fas fa-lock mr-2"></i>Tutup Tanggal 21-30';
        btn.className = 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition';
    } else {
        btn.innerHTML = '<i class="fas fa-lock-open mr-2"></i>Buka Tanggal 21-30';
        btn.className = 'px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition';
    }

    // Populate start date input if available
    const startInput = document.getElementById('start-date-input');
    if (startInput) {
        startInput.value = settings.start_date || '';
    }
}

async function saveSettings() {
    const startInput = document.getElementById('start-date-input');
    const startDate = startInput ? startInput.value : null;

    try {
        const response = await fetch(`${API_BASE_URL}/api/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phase2_unlocked: settings.phase2_unlocked,
                admin_password: settings.admin_password,
                app_title: settings.app_title,
                start_date: startDate || null
            })
        });

        const data = await response.json();
        if (data.success) {
            settings.start_date = startDate || null;
            alert('Tanggal mulai tersimpan');
        } else {
            alert('Gagal menyimpan settings');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Koneksi error saat menyimpan');
    }
}

// Global state for date view
let currentDateView = 'grid'; // 'grid' or 'table'

function setDateView(view) {
    currentDateView = view;

    const gridView = document.getElementById('date-grid-view');
    const tableView = document.getElementById('date-table-view');
    const gridBtn = document.getElementById('grid-view-btn');
    const tableBtn = document.getElementById('table-view-btn');

    if (view === 'grid') {
        gridView.classList.remove('hidden');
        tableView.classList.add('hidden');
        gridBtn.className = 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition';
        tableBtn.className = 'px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition';
    } else {
        gridView.classList.add('hidden');
        tableView.classList.remove('hidden');
        gridBtn.className = 'px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition';
        tableBtn.className = 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition';
    }

    renderDateOverview();
}

function renderDateOverview() {
    if (currentDateView === 'grid') {
        renderDateGrid();
    } else {
        renderDateTable();
    }
}

function renderDateGrid() {
    const grid = document.getElementById('admin-date-grid');
    if (!grid) return;

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    let html = '';

    for (let date = 1; date <= 30; date++) {
        const dateRegs = registrations.filter(r => r.tanggal === date);
        const filled = dateRegs.length;
        const available = 2 - filled;

        // Compute full calendar date and weekday if start_date is configured
        let dayName = dayNames[(date - 1) % 7];
        let fullDateStr = '';
        if (settings && settings.start_date) {
            try {
                const base = new Date(settings.start_date + 'T00:00:00');
                const dateObj = new Date(base);
                dateObj.setDate(base.getDate() + (date - 1));
                dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
                fullDateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            } catch (err) {
                // keep defaults
            }
        }

        // Determine status
        let status = 'available';
        let statusClass = 'status-available';
        let isLocked = false;

        if (date > 20 && !settings.phase2_unlocked) {
            status = 'locked';
            statusClass = 'status-locked';
            isLocked = true;
        } else if (filled === 2) {
            status = 'full';
            statusClass = 'status-full';
        } else if (filled === 1) {
            status = 'partial';
            statusClass = 'status-partial';
        }

        html += `
            <div class="date-card ${statusClass} rounded-lg p-3 text-white text-center ${isLocked ? 'opacity-70' : ''}">
                <div class="font-bold text-lg mb-1">${date}</div>
                <div class="text-xs opacity-90 mb-1">${dayName}</div>
                <div class="text-xs font-semibold bg-white/20 px-2 py-1 rounded">
                    ${filled}/2
                </div>
                <div class="text-xs mt-1">
                    ${status === 'available' ? 'Tersedia' :
                status === 'partial' ? '1/2 Terisi' :
                    status === 'full' ? 'Penuh' : 'Tertutup'}
                </div>
            </div>
        `;
    }

    grid.innerHTML = html;
}

function renderDateTable() {
    const tbody = document.getElementById('date-table-body');
    if (!tbody) return;

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    let html = '';

    for (let date = 1; date <= 30; date++) {
        const dateRegs = registrations.filter(r => r.tanggal === date);
        const filled = dateRegs.length;

        // Compute full calendar date and weekday if start_date is configured
        let dayName = dayNames[(date - 1) % 7];
        let fullDateStr = '';
        if (settings && settings.start_date) {
            try {
                const base = new Date(settings.start_date + 'T00:00:00');
                const dateObj = new Date(base);
                dateObj.setDate(base.getDate() + (date - 1));
                dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
                fullDateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            } catch (err) {
                // keep defaults
            }
        }

        // Determine status
        let status = 'available';
        let statusClass = 'table-status-available';
        let statusText = 'Tersedia';
        let isLocked = false;

        if (date > 20 && !settings.phase2_unlocked) {
            status = 'locked';
            statusClass = 'table-status-locked';
            statusText = 'Tertutup';
            isLocked = true;
        } else if (filled === 2) {
            status = 'full';
            statusClass = 'table-status-full';
            statusText = 'Penuh';
        } else if (filled === 1) {
            status = 'partial';
            statusClass = 'table-status-partial';
            statusText = '1/2 Terisi';
        }

        // Create registrants list
        let registrantsHtml = '';
        if (dateRegs.length > 0) {
            registrantsHtml = dateRegs.map(reg => `${reg.kode_jalan} - ${reg.nama_keluarga}`).join('<br>');
        } else {
            registrantsHtml = '<span class="text-gray-400">Belum ada pendaftar</span>';
        }

        html += `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="font-medium">${date} Ramadhan</span>
                    ${fullDateStr ? `<br><span class="text-sm text-gray-500">${fullDateStr}</span>` : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm">${dayName}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <span class="text-sm font-medium">${filled}/2</span>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm">${registrantsHtml}</div>
                </td>
            </tr>
        `;
    }

    tbody.innerHTML = html;
}

function printTable() {
    window.print();
}

// Expose functions to global scope
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.refreshData = refreshData;
window.exportToCSV = exportToCSV;
window.togglePhase2 = togglePhase2;
window.printTable = printTable;
window.deleteRegistration = deleteRegistration;
window.saveSettings = saveSettings;
window.setDateView = setDateView;

console.log('Takjil Admin JavaScript loaded');