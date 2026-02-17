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

    'LAINNYA'
];

// Escape helper (Step 3: XSS prevention via output encoding) [3](https://tensin.name/blog/docker-bind-mounts.html)[8](https://github.com/WiseLibs/better-sqlite3/issues/549)
function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

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
        populateHouseCodes();
        initHouseAutocomplete();

        await loadData();

        renderUserDateOverview();
        setupEventListeners();

        document.getElementById('loading').style.display = 'none';
        document.getElementById('app').classList.remove('hidden');

        console.log('App initialized successfully');
    } catch (error) {
        console.error('App initialization error:', error);

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

        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                document.getElementById('loading').innerHTML = `
          <div class="inline-block loading-spinner rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          <p class="mt-4 text-gray-600">Memuat aplikasi...</p>
        `;
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

// Helper: fetch with timeout
function fetchWithTimeout(url, options = {}, timeout = 8000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
    ]);
}

async function loadData() {
    try {
        // Step 2: use public endpoint (NO WhatsApp / PII) [1](https://blog.ni18.in/how-to-fix-the-error-while-loading-shared-libraries-in-linux/)[2](https://github.com/WiseLibs/better-sqlite3/issues/943)
        const regResponse = await fetchWithTimeout(`${API_BASE_URL}/api/public/registrations`, {}, 8000);
        if (!regResponse.ok) throw new Error(`Registrations fetch failed: ${regResponse.status}`);
        const regData = await regResponse.json();
        if (regData.success) registrations = regData.data;

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

        let dayName = dayNames[(date - 1) % 7];
        let fullDateStr = '';
        if (settings && settings.start_date) {
            try {
                const base = new Date(settings.start_date + 'T00:00:00');
                const dateObj = new Date(base);
                dateObj.setDate(base.getDate() + (date - 1));
                dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
                fullDateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            } catch (_) { }
        }

        let status = 'available';
        let statusClass = 'status-available';
        let isLocked = false;

        if (date > 20 && !settings.phase2_unlocked) {
            status = 'locked';
            statusClass = 'status-locked';
            isLocked = true;
        } else if (filled === 4) {
            status = 'full';
            statusClass = 'status-full';
        } else if (filled >= 1 && filled < 4) {
            status = 'partial';
            statusClass = 'status-partial';
        }

        html += `
      <div class="date-card ${statusClass} rounded-lg md:rounded-xl p-2 md:p-4 text-white cursor-pointer ${isLocked ? 'opacity-70' : 'hover:shadow-lg'}"
           onclick="${!isLocked ? `openRegistrationModal(${date})` : ''}">
        <div class="text-center">
          <div class="font-bold text-base md:text-xl">${date}</div>
          <div class="text-xs md:text-sm opacity-75">${dayName}</div>
          ${fullDateStr ? `<div class="font-bold text-base">${fullDateStr}</div>` : ''}
          <div class="text-xs mt-2 md:mt-3 mb-1 md:mb-2">
            ${status === 'available' ? 'Tersedia' :
                status === 'partial' ? `${filled}/4 Terisi` :
                    status === 'full' ? 'Penuh' : 'Tertutup'}
          </div>
        </div>
      </div>
    `;
    }

    grid.innerHTML = html;
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
    if (currentUserDateView === 'grid') renderDateGrid();
    else renderUserDateTable();
}

function renderUserDateTable() {
    const tbody = document.getElementById('user-date-table-body');
    if (!tbody) return;

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    let html = '';

    for (let date = 1; date <= 30; date++) {
        const dateRegs = registrations.filter(r => r.tanggal === date);
        const filled = dateRegs.length;

        let dayName = dayNames[(date - 1) % 7];
        let fullDateStr = '';
        if (settings && settings.start_date) {
            try {
                const base = new Date(settings.start_date + 'T00:00:00');
                const dateObj = new Date(base);
                dateObj.setDate(base.getDate() + (date - 1));
                dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
                fullDateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            } catch (_) { }
        }

        let statusText = 'Tersedia';
        let statusColor = 'text-emerald-600';
        let bgColor = 'bg-emerald-50';
        let isLocked = false;

        if (date > 20 && !settings.phase2_unlocked) {
            statusText = 'Tertutup';
            statusColor = 'text-gray-600';
            bgColor = 'bg-gray-50';
            isLocked = true;
        } else if (filled === 4) {
            statusText = 'Penuh';
            statusColor = 'text-red-600';
            bgColor = 'bg-red-50';
        } else if (filled >= 1 && filled < 4) {
            statusText = `${filled}/4 Terisi`;
            statusColor = 'text-amber-600';
            bgColor = 'bg-amber-50';
        }

        let registrantsHtml = '';
        if (dateRegs.length > 0) {
            // Step 3: escape user-controlled values before injecting into HTML [3](https://tensin.name/blog/docker-bind-mounts.html)[8](https://github.com/WiseLibs/better-sqlite3/issues/549)
            registrantsHtml = dateRegs
                .map(reg => `${escapeHtml(reg.kode_jalan)} - ${escapeHtml(reg.nama_keluarga)}`)
                .join('<br>');
        } else {
            registrantsHtml = '<span class="text-gray-400">-</span>';
        }

        const canClick = !isLocked && filled < 4;
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
        <td class="px-4 py-3 text-sm text-gray-900">${registrantsHtml}</td>
      </tr>
    `;
    }

    tbody.innerHTML = html;
}

function setupEventListeners() {
    const form = document.getElementById('registration-form');
    if (form) form.addEventListener('submit', handleFormSubmit);

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

    const existingContainer = document.querySelector('.existing-registrations');
    if (existingContainer) existingContainer.remove();

    const fullMessage = document.getElementById('full-slot-message');
    if (fullMessage) {
        fullMessage.innerHTML = '';
        fullMessage.style.display = 'none';
    }

    const form = document.getElementById('registration-form');
    if (form) form.style.display = 'block';

    document.getElementById('modal-title').textContent = `Daftar Takjil - Tanggal ${date} Ramadhan`;
    document.getElementById('selected-date').value = date;

    document.getElementById('registration-modal').classList.remove('hidden');
    document.getElementById('registration-modal').classList.add('flex');

    try {
        await loadData();
        renderUserDateOverview();

        const dateRegs = registrations.filter(r => r.tanggal === date);
        const isFull = dateRegs.length >= 4;

        document.getElementById('family-name').value = '';
        document.getElementById('house-code').value = '';
        document.getElementById('whatsapp').value = '';
        document.getElementById('form-error').classList.add('hidden');

        if (isFull) {
            if (form) form.style.display = 'none';
            if (fullMessage) fullMessage.style.display = 'block';

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
                ${escapeHtml(reg.kode_jalan)} - ${escapeHtml(reg.nama_keluarga)}
              </div>
            `).join('')}
          </div>
        `;
            }
        } else {
            if (form) form.style.display = 'block';
            if (fullMessage) fullMessage.style.display = 'none';

            if (dateRegs.length > 0) {
                const details = document.createElement('div');
                details.className = 'existing-registrations mb-4 p-4 bg-gray-50 rounded-lg';
                details.innerHTML = `
          <p class="text-sm font-medium text-gray-700 mb-2">Sudah terdaftar:</p>
          ${dateRegs.map(reg => `
            <div class="text-sm text-gray-600 mb-1">
              <i class="fas fa-home mr-2"></i>
              ${escapeHtml(reg.kode_jalan)} - ${escapeHtml(reg.nama_keluarga)}
            </div>
          `).join('')}
        `;
                const modalHeader = document.getElementById('modal-title').parentElement;
                modalHeader.after(details);
            }
        }
    } catch (error) {
        console.error('Error loading latest data for modal:', error);
        // fallback using cached data (already in registrations)
    }
}

function closeModal() {
    const existingContainer = document.querySelector('.existing-registrations');
    if (existingContainer) existingContainer.remove();

    const fullMessage = document.getElementById('full-slot-message');
    if (fullMessage) {
        fullMessage.innerHTML = '';
        fullMessage.style.display = 'none';
    }

    document.getElementById('registration-modal').classList.add('hidden');
    document.getElementById('registration-modal').classList.remove('flex');
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

    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const submitLoading = document.getElementById('submit-loading');

    houseCode = houseCode.toUpperCase();
    document.getElementById('house-code').value = houseCode;

    if (!familyName || !houseCode || !whatsapp) {
        showError('Semua field harus diisi');
        return;
    }

    if (!HOUSE_CODES.includes(houseCode)) {
        showError('Kode Jalan tidak valid. Pilih dari daftar.');
        return;
    }

    const whatsappClean = whatsapp.replace(/\D/g, '');
    if (!/^08[0-9]{9,}$/.test(whatsappClean)) {
        showError('Nomor WhatsApp tidak valid. Harus diawali 08 dan minimal 10 digit');
        return;
    }

    const formattedWhatsApp = '62' + whatsappClean.substring(1);

    submitText.classList.add('hidden');
    submitLoading.classList.remove('hidden');
    submitBtn.disabled = true;
    document.getElementById('form-error').classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/api/registrations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tanggal: date,
                kode_jalan: houseCode,
                nama_keluarga: familyName,
                whatsapp: formattedWhatsApp
            })
        });

        const data = await response.json();

        if (data.success) {
            await loadData();
            renderUserDateOverview();

            // Step 3: escape familyName before innerHTML [3](https://tensin.name/blog/docker-bind-mounts.html)[8](https://github.com/WiseLibs/better-sqlite3/issues/549)
            document.getElementById('success-message').innerHTML = `
        Terima kasih <strong>${escapeHtml(familyName)}</strong>!<br>
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
                e.preventDefault();
                input.value = code;
                hide();
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

    function hide() {
        suggestions.classList.add('hidden');
        input.setAttribute('aria-expanded', 'false');
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
            Array.from(children).forEach(c => c.classList.remove('bg-gray-100'));
            if (children[selected]) children[selected].classList.add('bg-gray-100');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selected > 0) selected--;
            else selected = children.length - 1;
            Array.from(children).forEach(c => c.classList.remove('bg-gray-100'));
            if (children[selected]) children[selected].classList.add('bg-gray-100');
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
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) hide();
    });

    input.addEventListener('focus', (e) => render(filter(e.target.value)));
}

// Expose functions to global scope
window.openRegistrationModal = openRegistrationModal;
window.closeModal = closeModal;
window.closeSuccessModal = closeSuccessModal;
window.setUserDateView = setUserDateView;

console.log('Takjil App JavaScript loaded');