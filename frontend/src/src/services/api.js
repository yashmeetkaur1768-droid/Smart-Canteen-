const BASE_URL = '/api';

// ── Token / User storage ─────────────────────────────────────────────────────
export const getToken = () => localStorage.getItem('canteen_token');
export const setToken = (token) => localStorage.setItem('canteen_token', token);
export const clearToken = () => localStorage.removeItem('canteen_token');

export const getUser = () => {
  const raw = localStorage.getItem('canteen_user');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
};
export const setUser = (user) => localStorage.setItem('canteen_user', JSON.stringify(user));
export const clearUser = () => localStorage.removeItem('canteen_user');

// ── Core request ─────────────────────────────────────────────────────────────
export async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();

    if (response.status === 401) {
      // Session expired or invalid — clear storage and emit event
      clearToken();
      clearUser();
      window.dispatchEvent(new CustomEvent('auth:expired'));
      // Do NOT throw — let the component decide what to show
      return data;
    }

    if (response.status === 403) {
      throw new Error(data.message || 'Access denied.');
    }

    if (!response.ok) {
      throw new Error(data.message || `HTTP error ${response.status}`);
    }

    return data;
  } catch (err) {
    if (err.message !== 'Access denied.') {
      console.error(`API Error [${endpoint}]:`, err);
    }
    throw err;
  }
}

// ── Auth APIs ────────────────────────────────────────────────────────────────
export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const signup = (name, email, phone, password) =>
  request('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, phone, password }) });

export const staffLogin = (username, password) =>
  request('/staff/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const logout = () =>
  request('/auth/logout', { method: 'POST' });

export const getMe = () => request('/auth/me');

// ── Student APIs ─────────────────────────────────────────────────────────────
export const fetchMenu = () => request('/menu');
export const fetchInventory = () => request('/inventory');
export const placeOrder = (orderData) => request('/orders', { method: 'POST', body: JSON.stringify(orderData) });
export const fetchOrder = (orderId) => request(`/orders/${orderId}`);
export const fetchStudentOrders = (studentId) => request(`/students/${studentId}/orders`);
export const cancelOrder = (orderId, reason) => request(`/orders/${orderId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });

// ── Queue & Live Tracking ────────────────────────────────────────────────────
export const fetchLiveQueue = () => request('/queue');

// ── Staff APIs ───────────────────────────────────────────────────────────────
export const fetchStaffDashboard = () => request('/staff/dashboard');
export const staffStartPrep = (orderId) => request(`/staff/orders/${orderId}/start`, { method: 'POST' });
export const staffMarkReady = (orderId) => request(`/staff/orders/${orderId}/ready`, { method: 'POST' });
export const staffCompleteOrder = (orderId) => request(`/staff/orders/${orderId}/complete`, { method: 'POST' });
export const updateMenuItem = (itemId, data) => request(`/staff/menu/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const updateInventory = (itemId, data) => request(`/staff/inventory/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const fetchCancellations = () => request('/staff/cancellations');
