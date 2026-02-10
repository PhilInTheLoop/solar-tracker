// Main Application Logic

let currentSettings = {};
let currentReadings = [];
let currentStats = {};
let monthlyComparison = [];

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Wire up auth callback
    onAuthRequired = showLoginScreen;

    // Setup all event listeners once
    setupLoginForm();
    setupLogout();
    setupChangePin();
    setupTabs();
    setupForms();
    setupImport();

    // Check if we have a valid session
    const token = getAuthToken();
    if (token) {
        try {
            await authApi.status();
            hideLoginScreen();
            await loadData();
        } catch {
            showLoginScreen();
        }
    } else {
        showLoginScreen();
    }
});

// Auth UI
function showLoginScreen() {
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-pin').focus();
}

function hideLoginScreen() {
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
}

function setupLoginForm() {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = document.getElementById('login-pin').value;
        const errorEl = document.getElementById('login-error');

        if (!pin) return;

        try {
            const result = await authApi.login(pin);
            setAuthToken(result.token);
            errorEl.classList.add('hidden');
            document.getElementById('login-pin').value = '';
            hideLoginScreen();
            await loadData();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.classList.remove('hidden');
            document.getElementById('login-pin').select();
        }
    });
}

function setupLogout() {
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try { await authApi.logout(); } catch {}
        clearAuthToken();
        showLoginScreen();
    });
}

function setupChangePin() {
    document.getElementById('change-pin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPin = document.getElementById('current-pin').value;
        const newPin = document.getElementById('new-pin').value;
        const confirmPin = document.getElementById('confirm-pin').value;

        if (newPin !== confirmPin) {
            showMessage('Neue PIN stimmt nicht überein!', 'error');
            return;
        }

        try {
            await authApi.changePin(currentPin, newPin);
            document.getElementById('change-pin-form').reset();
            showMessage('PIN erfolgreich geändert! Bitte neu anmelden.', 'success');
            // PIN change invalidates sessions, redirect to login
            clearAuthToken();
            showLoginScreen();
        } catch (err) {
            showMessage(err.message, 'error');
        }
    });
}

// Tab Navigation
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update button styles
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('tab-active');
                b.classList.add('text-gray-500');
            });
            btn.classList.add('tab-active');
            btn.classList.remove('text-gray-500');

            // Show/hide content
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(`tab-${tabId}`).classList.remove('hidden');

            // Refresh charts when switching to charts tab
            if (tabId === 'charts') {
                renderCharts();
            }
        });
    });
}

// Form Setup
function setupForms() {
    // Reading form
    document.getElementById('reading-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('reading-date').value;
        const meterReading = parseFloat(document.getElementById('meter-reading').value);

        try {
            await readingsApi.create({ date, meter_reading: meterReading });
            document.getElementById('reading-form').reset();
            await loadData();
            showMessage('Eintrag gespeichert!', 'success');
        } catch (err) {
            showMessage(err.message, 'error');
        }
    });

    // Settings form
    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const settings = {
            plant_size_kwp: document.getElementById('setting-plant-size').value,
            price_per_kwh: document.getElementById('setting-price').value,
            expected_yield_per_kwp: document.getElementById('setting-expected-yield').value,
            initial_meter_reading: document.getElementById('setting-initial-reading').value,
            start_date: document.getElementById('setting-start-date').value,
            address: document.getElementById('setting-address').value,
            latitude: document.getElementById('setting-latitude').value,
            longitude: document.getElementById('setting-longitude').value
        };

        try {
            await settingsApi.updateBulk(settings);
            await loadData();
            showMessage('Einstellungen gespeichert!', 'success');
        } catch (err) {
            showMessage(err.message, 'error');
        }
    });

    // PVGIS button
    document.getElementById('fetch-pvgis').addEventListener('click', fetchPvgisData);
}

// Import Setup
function setupImport() {
    const dropZone = document.getElementById('import-drop-zone');
    const fileInput = document.getElementById('import-file');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-amber-400', 'bg-amber-50');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-amber-400', 'bg-amber-50');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-amber-400', 'bg-amber-50');
        const file = e.dataTransfer.files[0];
        if (file) await importFile(file);
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) await importFile(file);
    });
}

async function importFile(file) {
    const status = document.getElementById('import-status');
    status.classList.remove('hidden', 'text-red-500', 'text-green-500');
    status.textContent = 'Importiere...';
    status.classList.add('text-gray-500');

    try {
        const result = await readingsApi.importExcel(file);
        status.textContent = result.message;
        status.classList.remove('text-gray-500');
        status.classList.add('text-green-500');
        await loadData();
    } catch (err) {
        status.textContent = err.message;
        status.classList.remove('text-gray-500');
        status.classList.add('text-red-500');
    }
}

// Load all data
async function loadData() {
    try {
        [currentSettings, currentReadings, currentStats, monthlyComparison] = await Promise.all([
            settingsApi.getAll(),
            readingsApi.getAll(),
            readingsApi.getStatistics(),
            readingsApi.getMonthlyComparison()
        ]);

        updateUI();
    } catch (err) {
        console.error('Error loading data:', err);
    }
}

// Update UI
function updateUI() {
    // Summary cards
    document.getElementById('total-yield').textContent = `${formatNumber(currentStats.total_yield)} kWh`;
    document.getElementById('total-revenue').textContent = `${formatNumber(currentStats.total_revenue)} EUR`;
    document.getElementById('yield-per-kwp').textContent = `${formatNumber(currentStats.total_yield_per_kwp)} kWh`;

    // Performance calculation
    const avgYearlyYield = currentStats.years_active > 0
        ? currentStats.total_yield / currentStats.years_active
        : 0;
    const performancePct = currentStats.expected_yearly_yield > 0
        ? (avgYearlyYield / currentStats.expected_yearly_yield) * 100
        : 0;
    const perfEl = document.getElementById('performance');
    perfEl.textContent = `${performancePct.toFixed(1)}%`;
    perfEl.className = 'text-lg font-bold ' + (performancePct >= 100 ? 'stat-positive' : performancePct >= 80 ? 'text-amber-600' : 'stat-negative');

    // Year filter
    updateYearFilter();

    // Settings form
    updateSettingsForm();

    // Readings list
    updateReadingsList();

    // Yearly table
    updateYearlyTable();

    // Charts
    renderDashboardCharts();
}

function updateYearFilter() {
    const select = document.getElementById('year-filter');
    const years = [...new Set(currentReadings.map(r => r.date.substring(0, 4)))].sort().reverse();

    select.innerHTML = '<option value="all">Alle Jahre</option>';
    years.forEach(year => {
        select.innerHTML += `<option value="${year}">${year}</option>`;
    });
}

function updateSettingsForm() {
    document.getElementById('setting-plant-size').value = currentSettings.plant_size_kwp || '';
    document.getElementById('setting-price').value = currentSettings.price_per_kwh || '';
    document.getElementById('setting-expected-yield').value = currentSettings.expected_yield_per_kwp || '';
    document.getElementById('setting-initial-reading').value = currentSettings.initial_meter_reading || '';
    document.getElementById('setting-start-date').value = currentSettings.start_date || '';
    document.getElementById('setting-address').value = currentSettings.address || '';
    document.getElementById('setting-latitude').value = currentSettings.latitude || '';
    document.getElementById('setting-longitude').value = currentSettings.longitude || '';
}

function updateReadingsList() {
    const container = document.getElementById('readings-list');
    const countEl = document.getElementById('readings-count');

    countEl.textContent = `${currentReadings.length} Einträge`;

    if (currentReadings.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Keine Einträge</p>';
        return;
    }

    // Show last 50 readings (most recent first)
    const recentReadings = [...currentReadings].reverse().slice(0, 50);

    container.innerHTML = recentReadings.map(r => `
        <div class="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
            <div>
                <span class="font-medium">${formatDate(r.date)}</span>
                <span class="text-gray-500 ml-2">${formatNumber(r.meter_reading)} kWh</span>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-amber-600 font-medium">+${formatNumber(r.yield_kwh)} kWh</span>
                <button onclick="deleteReading(${r.id})" class="text-red-400 hover:text-red-600">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function updateYearlyTable() {
    const tbody = document.getElementById('yearly-table');
    const yearlyStats = currentStats.yearly_stats || [];

    tbody.innerHTML = yearlyStats.reverse().map(s => `
        <tr class="border-b">
            <td class="py-2">${s.year}</td>
            <td class="text-right">${formatNumber(s.yield_kwh)} kWh</td>
            <td class="text-right">${formatNumber(s.yield_per_kwp)}</td>
            <td class="text-right">${formatNumber(s.revenue)} EUR</td>
            <td class="text-right ${s.performance_pct >= 100 ? 'stat-positive' : s.performance_pct >= 80 ? 'text-amber-600' : 'stat-negative'}">
                ${s.performance_pct}%
            </td>
        </tr>
    `).join('');
}

// Charts
function renderDashboardCharts() {
    const yearlyStats = currentStats.yearly_stats || [];
    const currentYear = new Date().getFullYear();

    if (yearlyStats.length > 0) {
        createYearlyChart(
            document.getElementById('yearly-chart').getContext('2d'),
            yearlyStats
        );
    }

    if (currentReadings.length > 0) {
        createMonthlyChart(
            document.getElementById('monthly-chart').getContext('2d'),
            currentReadings,
            currentYear
        );
    }
}

function renderCharts() {
    if (currentReadings.length > 0) {
        createCumulativeChart(
            document.getElementById('cumulative-chart').getContext('2d'),
            currentReadings
        );
    }

    if (monthlyComparison.length > 0) {
        createYearComparisonChart(
            document.getElementById('year-comparison-chart').getContext('2d'),
            monthlyComparison
        );
    }
}

// PVGIS
async function fetchPvgisData() {
    const loading = document.getElementById('pvgis-loading');
    const result = document.getElementById('pvgis-result');

    loading.classList.remove('hidden');
    result.classList.add('hidden');

    try {
        const lat = parseFloat(currentSettings.latitude) || 48.1351;
        const lon = parseFloat(currentSettings.longitude) || 11.5820;
        const peakpower = parseFloat(currentSettings.plant_size_kwp) || 4.84;

        const pvgisData = await referenceApi.getPvgis(lat, lon, peakpower);

        document.getElementById('pvgis-expected').textContent = `${formatNumber(pvgisData.yearly_yield)} kWh/Jahr`;

        const avgYearlyYield = currentStats.years_active > 0
            ? currentStats.total_yield / currentStats.years_active
            : 0;
        document.getElementById('your-average').textContent = `${formatNumber(avgYearlyYield)} kWh/Jahr`;

        createReferenceChart(
            document.getElementById('reference-chart').getContext('2d'),
            monthlyComparison,
            pvgisData.monthly_yields,
            currentStats.years_active
        );

        result.classList.remove('hidden');
    } catch (err) {
        showMessage('PVGIS Daten konnten nicht geladen werden: ' + err.message, 'error');
    } finally {
        loading.classList.add('hidden');
    }
}

// Delete reading
async function deleteReading(id) {
    if (!confirm('Eintrag löschen?')) return;

    try {
        await readingsApi.delete(id);
        await loadData();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

// Helpers
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(num);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'short' });
}

function showMessage(msg, type) {
    // Simple alert for now, could be replaced with toast
    alert(msg);
}
