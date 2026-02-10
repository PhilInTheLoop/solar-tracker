// API Helper Functions

const API_BASE = '/api';

// Auth token management
function getAuthToken() {
    return localStorage.getItem('solar_auth_token');
}

function setAuthToken(token) {
    localStorage.setItem('solar_auth_token', token);
}

function clearAuthToken() {
    localStorage.removeItem('solar_auth_token');
}

// Callback for when auth is required (set by app.js)
let onAuthRequired = null;

async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    const mergedOptions = { ...options, headers: { ...headers, ...options.headers } };

    const response = await fetch(url, mergedOptions);

    if (response.status === 401) {
        clearAuthToken();
        if (onAuthRequired) onAuthRequired();
        throw new Error('Nicht angemeldet');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
}

// Auth API (login doesn't use apiRequest since it's unauthenticated)
const authApi = {
    login: async (pin) => {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Login fehlgeschlagen' }));
            throw new Error(error.detail);
        }
        return response.json();
    },
    logout: () => apiRequest('/auth/logout', { method: 'POST' }),
    status: () => apiRequest('/auth/status'),
    changePin: (currentPin, newPin) => apiRequest('/auth/change-pin', {
        method: 'POST',
        body: JSON.stringify({ current_pin: currentPin, new_pin: newPin })
    })
};

// Readings API
const readingsApi = {
    getAll: () => apiRequest('/readings'),
    getStatistics: () => apiRequest('/readings/statistics'),
    getMonthlyComparison: () => apiRequest('/readings/monthly-comparison'),
    create: (data) => apiRequest('/readings', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    delete: (id) => apiRequest(`/readings/${id}`, { method: 'DELETE' }),
    importExcel: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const token = getAuthToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`${API_BASE}/readings/import-excel`, {
            method: 'POST',
            headers,
            body: formData
        });
        if (response.status === 401) {
            clearAuthToken();
            if (onAuthRequired) onAuthRequired();
            throw new Error('Nicht angemeldet');
        }
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
            throw new Error(error.detail);
        }
        return response.json();
    }
};

// Settings API
const settingsApi = {
    getAll: () => apiRequest('/settings'),
    update: (key, value) => apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({ key, value })
    }),
    updateBulk: (settings) => apiRequest('/settings/bulk', {
        method: 'PUT',
        body: JSON.stringify(settings)
    })
};

// Reference API
const referenceApi = {
    getPvgis: (lat, lon, peakpower) =>
        apiRequest(`/reference/pvgis?lat=${lat}&lon=${lon}&peakpower=${peakpower}`),
    getTypicalYields: () => apiRequest('/reference/typical-yields')
};
