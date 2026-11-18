const API_BASE = '/api';

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else if (contentType && contentType.includes('text/csv')) {
    data = await response.blob();
    return data;
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error || response.statusText || 'Request failed';
    const error = new Error(errorMsg);
    error.status = response.status;
    error.details = data?.details;
    throw error;
  }

  return data;
}

export const api = {
  // Products
  getProducts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/products${q ? `?${q}` : ''}`);
  },
  getProduct: (id) => apiRequest(`/products/${id}`),
  createProduct: (data) => apiRequest('/products', { method: 'POST', body: data }),
  getCategories: () => apiRequest('/products/categories'),

  // Lots
  createRestock: (data) => apiRequest('/lots/restock', { method: 'POST', body: data }),
  updateLotDate: (lotId, data) => apiRequest(`/lots/${lotId}/date`, { method: 'PATCH', body: data }),

  // Billing
  createBill: (data) => apiRequest('/bills', { method: 'POST', body: data }),
  getBills: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/bills${q ? `?${q}` : ''}`);
  },
  getBill: (id) => apiRequest(`/bills/${id}`),
  returnBillItem: (billId, data) => apiRequest(`/bills/${billId}/return`, { method: 'POST', body: data }),

  // Movements
  getMovements: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/movements${q ? `?${q}` : ''}`);
  },
  createTransfer: (data) => apiRequest('/movements/transfer', { method: 'POST', body: data }),
  createAdjustment: (data) => apiRequest('/movements/adjustment', { method: 'POST', body: data }),

  // Reconciliation
  getSystemStock: (location = 'Shop') => apiRequest(`/counts/system-stock?location=${location}`),
  previewCount: (data) => apiRequest('/counts/preview', { method: 'POST', body: data }),
  postCount: (data) => apiRequest('/counts/post', { method: 'POST', body: data }),
  getCounts: (location = '') => apiRequest(`/counts${location ? `?location=${location}` : ''}`),
  getCount: (id) => apiRequest(`/counts/${id}`),

  // Reports & Dashboard
  getDashboard: (range = '7') => apiRequest(`/reports/dashboard?range=${range}`),
  getReports: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/reports/summary${q ? `?${q}` : ''}`);
  },
  exportCSV: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/reports/export-csv${q ? `?${q}` : ''}`);
  },
};
