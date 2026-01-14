// Takjil Ramadhan - Admin Panel
// ==============================

// Configuration
const API_BASE_URL = window.location.origin;
const ITEMS_PER_PAGE = 10;

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

function showAdminDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').classList.remove('hidden');
    loadAdminData();
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

            const row = document.createElement('tr');
            row.className = 'table-row';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">${rowNumber}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                        ${reg.tanggal} Ramadhan
                    </span>
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

console.log('Takjil Admin JavaScript loaded');