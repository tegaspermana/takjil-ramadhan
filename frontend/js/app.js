// Takjil Ramadhan - Main Application
// ====================================

// Configuration
const API_BASE_URL = window.location.origin;
const HOUSE_CODES = [
    // WB Series (45)
    'WB-01', 'WB-02', 'WB-03', 'WB-05', 'WB-06', 'WB-07', 'WB-08', 'WB-09', 'WB-10',
    'WB-11', 'WB-12', 'WB-14', 'WB-15', 'WB-16', 'WB-17', 'WB-18', 'WB-19', 'WB-20',
    'WB-21', 'WB-22', 'WB-23', 'WB-24', 'WB-25', 'WB-26', 'WB-27', 'WB-28', 'WB-29', 'WB-30',
    'WB-31', 'WB-32', 'WB-33', 'WB-34', 'WB-35', 'WB-36', 'WB-37', 'WB-38', 'WB-39', 'WB-40',
    'WB-41', 'WB-42', 'WB-43', 'WB-45', 'WB-46', 'WB-47', 'WB-48',

    // PN Series (43)
    'PN-01', 'PN-02', 'PN-03', 'PN-05', 'PN-06', 'PN-07', 'PN-08', 'PN-09', 'PN-10',
    'PN-11', 'PN-12', 'PN-14', 'PN-15', 'PN-16', 'PN-17', 'PN-18', 'PN-19', 'PN-20',
    'PN-21', 'PN-22', 'PN-23', 'PN-24', 'PN-25', 'PN-26', 'PN-27', 'PN-28', 'PN-29', 'PN-30',
    'PN-31', 'PN-32', 'PN-33', 'PN-34', 'PN-35', 'PN-36', 'PN-37', 'PN-38', 'PN-39', 'PN-41',
    'PN-43', 'PN-45', 'PN-47',

    // MB Series (3)
    'MB-01', 'MB-02', 'MB-03',

    // LP Series (13)
    'LP-01', 'LP-02', 'LP-03', 'LP-05', 'LP-06', 'LP-07', 'LP-08', 'LP-09', 'LP-10',
    'LP-11', 'LP-12', 'LP-14', 'LP-16',

    // PW Series (12)
    'PW-01', 'PW-02', 'PW-03', 'PW-05', 'PW-06', 'PW-07', 'PW-08', 'PW-09', 'PW-10',
    'PW-11', 'PW-12', 'PW-14',

    // SL Series (11)
    'SL-01', 'SL-02', 'SL-03', 'SL-05', 'SL-06', 'SL-07', 'SL-08', 'SL-09', 'SL-10',
    'SL-12', 'SL-14',

    // LS Series (9)
    'LS-01', 'LS-02', 'LS-03', 'LS-05', 'LS-06', 'LS-07', 'LS-08', 'LS-10', 'LS-12',

    // RW Series (4)
    'RW-03', 'RW-05', 'RW-07', 'RW-09',

    // ML Series (12)
    'ML-01', 'ML-02', 'ML-03', 'ML-05', 'ML-06', 'ML-07', 'ML-08', 'ML-09', 'ML-10',
    'ML-11', 'ML-12', 'ML-14',

    //Lainnya
    'Lainnya'
];

// Global State
let registrations = [];
let settings = {};
let selectedDate = null;
let currentUserDateView = 'grid'; // 'grid' or 'table'

// Initialize Application
document.addEventListener('DOMContentLoaded', function () {
    console.log('Takjil App Initializing...');
    initApp();
});

async function initApp() {
    try {
        // Load house codes dropdown
        populateHouseCodes();

        // Initialize richer autocomplete for Kode Jalan
        initHouseAutocomplete();

        // Load initial data
        await loadData();

        // Render UI
        renderUserDateOverview();
        updateStats();

        // Setup event listeners
        setupEventListeners();

        // Hide loading, show app
        document.getElementById('loading').style.display = 'none';
        document.getElementById('app').classList.remove('hidden');

        console.log('App initialized successfully');

    } catch (error) {
        console.error('App initialization error:', error);
        // Show an actionable error message with retry
        document.getElementById('loading').innerHTML = `
            <div class="text-center">
                <div class="text-red-600">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                    <p class="text-lg font-semibold">Gagal memuat aplikasi</p>
                    <p class="text-sm mt-2">Periksa koneksi atau coba lagi.</p>
                    <button id="retry-btn" class="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Coba lagi</button>
                </div>
            </div>
        `;

        // Attach retry handler
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                document.getElementById('loading').innerHTML = `
                    <div class="inline-block loading-spinner rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                    <p class="mt-4 text-gray-600">Memuat aplikasi...</p>
                `;
                // Re-run initialization
                initApp();
            });
        }
    }
}

function populateHouseCodes() {
    const input = document.getElementById('house-code');
    const datalist = document.getElementById('house-code-list');
    if (!input) return;

    if (datalist) {
        datalist.innerHTML = '';
        HOUSE_CODES.forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            datalist.appendChild(opt);
        });
    } else {
        // Fallback for select element (legacy)
        const select = input;
        select.innerHTML = '<option value="">Pilih Kode Jalan</option>';
        HOUSE_CODES.forEach(code => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = code;
            select.appendChild(option);
        });
    }
}

// Helper: fetch with timeout (avoids indefinite hangs)
function fetchWithTimeout(url, options = {}, timeout = 8000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
    ]);
}

async function loadData() {
    try {
        // Load registrations with timeout
        const regResponse = await fetchWithTimeout(`${API_BASE_URL}/api/registrations`, {}, 8000);
        if (!regResponse.ok) throw new Error(`Registrations fetch failed: ${regResponse.status}`);
        const regData = await regResponse.json();

        if (regData.success) registrations = regData.data;

        // Load settings with timeout
        const settingsResponse = await fetchWithTimeout(`${API_BASE_URL}/api/settings`, {}, 8000);
        if (!settingsResponse.ok) throw new Error(`Settings fetch failed: ${settingsResponse.status}`);
        const settingsData = await settingsResponse.json();

        if (settingsData.success) settings = settingsData.data;

    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
}

function renderDateGrid() {
    const grid = document.getElementById('date-grid');
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
            <div class="date-card ${statusClass} rounded-xl p-4 text-white cursor-pointer ${isLocked ? 'opacity-70' : 'hover:shadow-lg'}"
                 onclick="${!isLocked ? `openRegistrationModal(${date})` : ''}">
                <div class="text-center">
                    <div class="font-bold text-xl mb-1">${date}</div>
                    <div class="text-sm opacity-90 mb-2">${dayName}${fullDateStr ? ' • ' + fullDateStr : ''}</div>
                    <div class="text-xs font-semibold bg-white/30 px-2 py-1 rounded-full inline-block">
                         ${status === 'available' ? 'Tersedia' :
                status === 'partial' ? '1/2 Terisi' :
                    status === 'full' ? 'Penuh' : 'Tertutup'}
                    </div>
                </div>
            </div>
        `;
    }

    grid.innerHTML = html;
}

function updateStats() {
    const total = registrations.length;
    const percent = Math.round((total / 60) * 100);
    const uniqueDates = new Set(registrations.map(r => r.tanggal)).size;
    const availableDates = 30 - uniqueDates;

    document.getElementById('total-registrations').textContent = total;
    document.getElementById('filled-percentage').textContent = `${percent}%`;
    document.getElementById('available-dates').textContent = availableDates;
    document.getElementById('phase-status').textContent = settings.phase2_unlocked ? 'Terbuka' : 'Tertutup';
    document.getElementById('phase-status').className = `text-2xl font-bold ${settings.phase2_unlocked ? 'text-emerald-600' : 'text-gray-600'}`;
}

// User Date View Functions
function setUserDateView(view) {
    currentUserDateView = view;

    const gridView = document.getElementById('user-date-grid-view');
    const tableView = document.getElementById('user-date-table-view');
    const gridBtn = document.getElementById('user-grid-view-btn');
    const tableBtn = document.getElementById('user-table-view-btn');

    if (view === 'grid') {
        gridView.classList.remove('hidden');
        tableView.classList.add('hidden');
        gridBtn.className = 'px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition';
        tableBtn.className = 'px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition';
    } else {
        gridView.classList.add('hidden');
        tableView.classList.remove('hidden');
        gridBtn.className = 'px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition';
        tableBtn.className = 'px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition';
    }

    renderUserDateOverview();
}

function renderUserDateOverview() {
    if (currentUserDateView === 'grid') {
        renderDateGrid();
    } else {
        renderUserDateTable();
    }
}

function renderUserDateTable() {
    const tbody = document.getElementById('user-date-table-body');
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
        let statusText = 'Tersedia';
        let statusColor = 'text-emerald-600';
        let bgColor = 'bg-emerald-50';
        let isLocked = false;

        if (date > 20 && !settings.phase2_unlocked) {
            statusText = 'Tertutup';
            statusColor = 'text-gray-600';
            bgColor = 'bg-gray-50';
            isLocked = true;
        } else if (filled === 2) {
            statusText = 'Penuh';
            statusColor = 'text-red-600';
            bgColor = 'bg-red-50';
        } else if (filled === 1) {
            statusText = '1/2 Terisi';
            statusColor = 'text-amber-600';
            bgColor = 'bg-amber-50';
        }

        // Create registrants list
        let registrantsHtml = '';
        if (dateRegs.length > 0) {
            registrantsHtml = dateRegs.map(reg => `${reg.kode_jalan} - ${reg.nama_keluarga}`).join('<br>');
        } else {
            registrantsHtml = '<span class="text-gray-400">-</span>';
        }

        const canClick = !isLocked && filled < 2;
        const buttonHtml = canClick
            ? `<button onclick="openRegistrationModal(${date})" class="mt-2 px-3 py-1 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 transition">
                Daftar
               </button>`
            : '';

        html += `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="font-medium text-gray-900">${date} Ramadhan</div>
                            ${fullDateStr ? `<div class="text-sm text-gray-500">${fullDateStr}</div>` : ''}
                            <div class="mt-1">
                                <span class="px-2 py-1 text-xs font-medium rounded-full ${bgColor} ${statusColor}">
                                    ${statusText}
                                </span>
                            </div>
                            ${buttonHtml}
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-900">
                    ${registrantsHtml}
                </td>
            </tr>
        `;
    }

    tbody.innerHTML = html;
}

function setupEventListeners() {
    // Registration form submit
    const form = document.getElementById('registration-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // Admin link click
    const adminLink = document.querySelector('a[href="/admin"]');
    if (adminLink) {
        adminLink.addEventListener('click', function (e) {
            e.preventDefault();
            window.open('/admin', '_blank');
        });
    }
}

async function openRegistrationModal(date) {
    selectedDate = date;

    // Check if slot is full
    const dateRegs = registrations.filter(r => r.tanggal === date);
    const isFull = dateRegs.length >= 2;

    // Update modal title and date first
    document.getElementById('modal-title').textContent = `Daftar Takjil - Tanggal ${date} Ramadhan`;
    document.getElementById('selected-date').value = date;

    // Get form and full message elements
    const form = document.getElementById('registration-form');
    const fullMessage = document.getElementById('full-slot-message');

    if (isFull) {
        // Hide form and show full message
        if (form) form.style.display = 'none';
        if (fullMessage) fullMessage.style.display = 'block';

        // Update full message content
        if (fullMessage) {
            fullMessage.innerHTML = `
                <div class="text-center py-6">
                    <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-calendar-times text-red-600 text-2xl"></i>
                    </div>
                    <h4 class="text-lg font-semibold text-gray-800 mb-2">Slot Penuh</h4>
                    <p class="text-gray-600 mb-4">Tanggal ${date} Ramadhan sudah penuh terdaftar.</p>
                    <p class="text-sm font-medium text-gray-700 mb-4">Sudah terdaftar:</p>
                    ${dateRegs.map(reg => `
                        <div class="text-sm text-gray-600 mb-2 p-2 bg-gray-50 rounded">
                            <i class="fas fa-home mr-2"></i>
                            ${reg.kode_jalan} - ${reg.nama_keluarga}
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } else {
        // Show form and hide full message
        if (form) form.style.display = 'block';
        if (fullMessage) fullMessage.style.display = 'none';

        // Reset form
        document.getElementById('family-name').value = '';
        document.getElementById('house-code').value = '';
        document.getElementById('whatsapp').value = '';
        document.getElementById('form-error').classList.add('hidden');
    }

    // Show modal immediately
    document.getElementById('registration-modal').classList.remove('hidden');
    document.getElementById('registration-modal').classList.add('flex');

    // Load latest data in background (only if not full)
    if (!isFull) {
        try {
            await loadData();

            // Update the grid with fresh data
            renderUserDateOverview();
            updateStats();

            // Update existing registrations display with fresh data
            const updatedDateRegs = registrations.filter(r => r.tanggal === date);
            console.log(`Loaded ${updatedDateRegs.length} registrations for date ${date}`);

            // Remove existing registrations display
            const existingContainer = document.querySelector('.existing-registrations');
            if (existingContainer) existingContainer.remove();

            // Show updated existing registrations
            if (updatedDateRegs.length > 0) {
                const details = document.createElement('div');
                details.className = 'existing-registrations mb-4 p-4 bg-gray-50 rounded-lg';
                details.innerHTML = `
                    <p class="text-sm font-medium text-gray-700 mb-2">Sudah terdaftar:</p>
                    ${updatedDateRegs.map(reg => `
                        <div class="text-sm text-gray-600 mb-1">
                            <i class="fas fa-home mr-2"></i>
                            ${reg.kode_jalan} - ${reg.nama_keluarga}
                        </div>
                    `).join('')}
                `;

                // Insert after the modal header (title + close button) but before the form
                const modalHeader = document.getElementById('modal-title').parentElement;
                modalHeader.after(details);
            }
        } catch (error) {
            console.error('Error loading latest data for modal:', error);
            // Modal is already shown, so we don't need to do anything special here
        }
    }
}

function closeModal(refresh = false) {
    document.getElementById('registration-modal').classList.add('hidden');
    document.getElementById('registration-modal').classList.remove('flex');

    if (refresh) {
        // Re-fetch data and update UI without a full page reload
        loadData().then(() => {
            renderUserDateOverview();
            updateStats();
        }).catch(err => {
            console.error('Error refreshing data after modal close:', err);
        });
    }
}

function closeSuccessModal() {
    document.getElementById('success-modal').classList.add('hidden');
    document.getElementById('success-modal').classList.remove('flex');
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const familyName = document.getElementById('family-name').value.trim();
    let houseCode = document.getElementById('house-code').value;
    const whatsapp = document.getElementById('whatsapp').value.trim();
    const date = parseInt(document.getElementById('selected-date').value);
    const errorDiv = document.getElementById('form-error');

    // Normalize house code to uppercase for case-insensitive validation
    houseCode = houseCode.toUpperCase();
    document.getElementById('house-code').value = houseCode;

    // Validation
    if (!familyName || !houseCode || !whatsapp) {
        showError('Semua field harus diisi');
        return;
    }

    // Ensure the house code matches known codes
    if (!HOUSE_CODES.includes(houseCode)) {
        showError('Kode Jalan tidak valid. Pilih dari daftar.');
        return;
    }

    const whatsappClean = whatsapp.replace(/\D/g, '');
    if (!/^08[0-9]{9,}$/.test(whatsappClean)) {
        showError('Nomor WhatsApp tidak valid. Harus diawali 08 dan minimal 10 digit');
        return;
    }

    // Format WhatsApp number
    const formattedWhatsApp = '62' + whatsappClean.substring(1);

    // Show loading state
    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const submitLoading = document.getElementById('submit-loading');

    submitText.classList.add('hidden');
    submitLoading.classList.remove('hidden');
    submitBtn.disabled = true;
    errorDiv.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/api/registrations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tanggal: date,
                kode_jalan: houseCode,
                nama_keluarga: familyName,
                whatsapp: formattedWhatsApp
            })
        });

        const data = await response.json();

        if (data.success) {
            // Reload data
            await loadData();

            // Update UI
            renderUserDateOverview();
            updateStats();

            // Show success message
            document.getElementById('success-message').innerHTML = `
                Terima kasih <strong>${familyName}</strong>!<br>
                Pendaftaran untuk tanggal ${date} Ramadhan berhasil.
            `;
            closeModal();
            document.getElementById('success-modal').classList.remove('hidden');
            document.getElementById('success-modal').classList.add('flex');

        } else {
            showError(data.error || 'Gagal menyimpan data');
        }

    } catch (error) {
        console.error('Submit error:', error);
        showError('Koneksi error. Silakan coba lagi.');
    } finally {
        // Reset button state
        submitText.classList.remove('hidden');
        submitLoading.classList.add('hidden');
        submitBtn.disabled = false;
    }
}

function showError(message) {
    const errorDiv = document.getElementById('form-error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

// Initialize richer autocomplete for house codes
function initHouseAutocomplete() {
    const input = document.getElementById('house-code');
    const suggestions = document.getElementById('house-suggestions');
    if (!input || !suggestions) return;

    let items = [];
    let selected = -1;

    function render(list) {
        suggestions.innerHTML = '';
        if (!list.length) {
            suggestions.classList.add('hidden');
            input.setAttribute('aria-expanded', 'false');
            return;
        }

        list.forEach((code, idx) => {
            const div = document.createElement('div');
            div.className = 'px-3 py-2 cursor-pointer hover:bg-gray-100';
            div.setAttribute('role', 'option');
            div.textContent = code;
            div.addEventListener('mousedown', (e) => {
                // use mousedown to select before blur
                e.preventDefault();
                select(idx);
                choose();
            });
            suggestions.appendChild(div);
        });
        suggestions.classList.remove('hidden');
        input.setAttribute('aria-expanded', 'true');
    }

    function filter(val) {
        const q = val.trim().toLowerCase();
        if (!q) return HOUSE_CODES.slice(0, 10);
        return HOUSE_CODES.filter(c => c.toLowerCase().includes(q)).slice(0, 10);
    }

    function select(idx) {
        const children = suggestions.children;
        if (selected >= 0 && children[selected]) children[selected].classList.remove('bg-gray-100');
        selected = idx;
        if (selected >= 0 && children[selected]) children[selected].classList.add('bg-gray-100');
    }

    function choose() {
        if (selected >= 0 && suggestions.children[selected]) {
            input.value = suggestions.children[selected].textContent;
        }
        hide();
    }

    function hide() {
        suggestions.classList.add('hidden');
        input.setAttribute('aria-expanded', 'false');
        selected = -1;
    }

    input.addEventListener('input', (e) => {
        const list = filter(e.target.value);
        items = list;
        selected = -1;
        render(list);
    });

    input.addEventListener('keydown', (e) => {
        const children = suggestions.children;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selected < children.length - 1) select(selected + 1);
            else if (children.length) select(0);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selected > 0) select(selected - 1);
            else if (children.length) select(children.length - 1);
        } else if (e.key === 'Enter') {
            if (selected >= 0) {
                e.preventDefault();
                choose();
            }
        } else if (e.key === 'Escape') {
            hide();
        }
    });

    // Hide on blur (allow click selection via mousedown)
    input.addEventListener('blur', () => setTimeout(hide, 150));

    // Clicking outside should hide
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) hide();
    });

    // Pre-populate suggestions on focus
    input.addEventListener('focus', (e) => {
        const list = filter(e.target.value);
        items = list;
        render(list);
    });
}

// Expose functions to global scope
window.openRegistrationModal = openRegistrationModal;
window.closeModal = closeModal;
window.closeSuccessModal = closeSuccessModal;
window.setUserDateView = setUserDateView;

console.log('Takjil App JavaScript loaded');