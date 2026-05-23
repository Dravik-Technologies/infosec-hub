import axios from 'axios';

const BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';
const http = axios.create({ baseURL: BASE, withCredentials: true, timeout: 15000 });
const TOKEN_KEY = 'scorva_token';
const SELECTED_SITE_KEY = 'scorva_selected_site';

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const selectedSite = localStorage.getItem(SELECTED_SITE_KEY);

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (selectedSite) {
    config.headers = config.headers || {};
    config.headers['x-selected-site'] = selectedSite;
  }

  return config;
});

http.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 && !window.location.pathname.includes('login')) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

const get  = url        => http.get(url).then(r => r.data);
const post = (url, d)   => http.post(url, d).then(r => r.data);
const patch = (url, d)  => http.patch(url, d).then(r => r.data);
const del  = url        => http.delete(url).then(r => r.data);
const postWithConfig = (url, d, config = {}) => http.post(url, d, config).then(r => r.data);
const postForm = (url, formData) => http.post(url, formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
}).then(r => r.data);

export const api = {
  // ATO
  ato:         { list: () => get('/api/ato'), create: d => post('/api/ato', d), update: (id, d) => patch(`/api/ato/${id}`, d), remove: id => del(`/api/ato/${id}`) },
  // ConMon
  conmon:      {
    list: () => get('/api/conmon'),
    create: d => post('/api/conmon', d),
    update: (id, d) => patch(`/api/conmon/${id}`, d),
    remove: id => del(`/api/conmon/${id}`),
    bulk: d => post('/api/conmon/bulk', d),
    importExcel: ({ file }) => {
      const fd = new FormData();
      fd.append('file', file);
      return postForm('/api/conmon/import-excel', fd);
    },
  },
  // Controls
  controls:    {
    list: () => get('/api/controls'),
    create: d => post('/api/controls', d),
    update: (id, d) => patch(`/api/controls/${id}`, d),
    remove: id => del(`/api/controls/${id}`),
    bulk: d => post('/api/controls/bulk', d),
    bulkDelete: ids => post('/api/controls/bulk-delete', { ids }),
  },
  // POAM
  poam:        {
    list: () => get('/api/poam'),
    create: d => post('/api/poam', d),
    update: (id, d) => patch(`/api/poam/${id}`, d),
    remove: id => del(`/api/poam/${id}`),
    backfillTasks: () => post('/api/poam/backfill-tasks', {}),
    transitionRiskWorkflow: (id, d) => post(`/api/poam/${id}/risk-workflow`, d),
  },
  // Tasks
  tasks:       { list: () => get('/api/tasks'), listMine: () => get('/api/tasks/mine'), create: d => post('/api/tasks', d), update: (id, d) => patch(`/api/tasks/${id}`, d), remove: id => del(`/api/tasks/${id}`) },
  // Users
  users:       { list: () => get('/api/users'), create: d => post('/api/users', d), update: (id, d) => patch(`/api/users/${id}`, d), remove: id => del(`/api/users/${id}`) },
  // Workstations
  workstations:{
    list: () => get('/api/workstations'),
    create: d => post('/api/workstations', d),
    update: (id, d) => patch(`/api/workstations/${id}`, d),
    remove: id => del(`/api/workstations/${id}`),
    bulk: rows => post('/api/workstations/bulk', { rows }),
    bulkDelete: ids => post('/api/workstations/bulk-delete', { ids }),
  },
  // YubiKeys
  yubikeys:    {
    list: () => get('/api/yubikeys'),
    create: d => post('/api/yubikeys', d),
    update: (id, d) => patch(`/api/yubikeys/${id}`, d),
    remove: id => del(`/api/yubikeys/${id}`),
    bulk: rows => post('/api/yubikeys/bulk', { rows }),
    bulkDelete: ids => post('/api/yubikeys/bulk-delete', { ids }),
  },
  // Agreements
  agreements:  { list: () => get('/api/agreements'), create: d => post('/api/agreements', d), update: (id, d) => patch(`/api/agreements/${id}`, d), remove: id => del(`/api/agreements/${id}`) },
  // Licenses
  licenses:    {
    list: () => get('/api/licenses'),
    create: d => post('/api/licenses', d),
    update: (id, d) => patch(`/api/licenses/${id}`, d),
    remove: id => del(`/api/licenses/${id}`),
    bulk: rows => post('/api/licenses/bulk', { rows }),
    bulkDelete: ids => post('/api/licenses/bulk-delete', { ids }),
  },
  // Trackers
  trackers:    { list: () => get('/api/trackers'), create: d => post('/api/trackers', d), update: (id, d) => patch(`/api/trackers/${id}`, d), remove: id => del(`/api/trackers/${id}`) },
  // Audit
  audit:       { list: (p = {}) => http.get('/api/audit', { params: p }).then(r => r.data) },
  // Notifications
  notifications: {
    list: () => get('/api/notifications'),
    markRead: id => patch(`/api/notifications/${id}/read`, {}),
    markAllRead: () => post('/api/notifications/read-all', {}),
    remove: id => del(`/api/notifications/${id}`),
  },
  // Sites
  sites:       { list: () => get('/api/sites'), create: d => post('/api/sites', d), update: (id, d) => patch(`/api/sites/${id}`, d), remove: id => del(`/api/sites/${id}`) },
  // Threat Intel (NVD CVE feed — proxied via backend)
  threats:  { latest: () => get('/api/threats/latest') },
  // ConMon Metrics & KPIs
  metrics:  { get: () => get('/api/metrics') },
  // Security Events
  securityEvents: {
    list:   () => get('/api/security-events'),
    create: d  => post('/api/security-events', d),
    update: (id, d) => patch(`/api/security-events/${id}`, d),
    remove: id => del(`/api/security-events/${id}`),
  },
  // Evidence artifacts
  evidence: {
    list: ({ resourceType, resourceId }) => http.get('/api/evidence', { params: { resourceType, resourceId } }).then(r => r.data),
    upload: ({ resourceType, resourceId, file, artifactType, notes }) => {
      const fd = new FormData();
      fd.append('resourceType', resourceType);
      fd.append('resourceId', resourceId);
      fd.append('file', file);
      if (artifactType) fd.append('artifactType', artifactType);
      if (notes) fd.append('notes', notes);
      return postForm('/api/evidence', fd);
    },
    download: id => http.get(`/api/evidence/${id}/download`, { responseType: 'blob' }).then(r => ({
      blob: r.data,
      filename: extractFilename(r, 'evidence.bin'),
    })),
    remove: id => del(`/api/evidence/${id}`),
  },
  checklist: {
    templates:     () => get('/api/checklist/templates'),
    template:      id => get(`/api/checklist/templates/${id}`),
    items:         (p = {}) => http.get('/api/checklist/items', { params: p }).then(r => r.data),
  },
  campaigns: {
    list:           (p = {}) => http.get('/api/checklist/campaigns', { params: p }).then(r => r.data),
    create:         d        => postWithConfig('/api/checklist/campaigns', d, { timeout: 60000 }),
    get:            id       => get(`/api/checklist/campaigns/${id}`),
    update:         (id, d)  => patch(`/api/checklist/campaigns/${id}`, d),
    items:          (p = {}) => http.get('/api/checklist/campaign-items', { params: p }).then(r => r.data),
    updateItem:     (id, d)  => patch(`/api/checklist/campaign-items/${id}`, d),
    updateSection:  (id, d)  => patch(`/api/checklist/campaign-sections/${id}`, d),
    createItemTask: (id)     => post(`/api/checklist/campaign-items/${id}/task`, {}),
    createItemPoam: (id)     => post(`/api/checklist/campaign-items/${id}/poam`, {}),
  },
  // ISSM Program View (cross-site aggregate)
  aggregate: { metrics: () => get('/api/aggregate/metrics') },
  // Excel report exports (return raw blob + suggested filename)
  reports:  {
    poam:     () => http.get('/api/reports/poam',     { responseType: 'blob' }).then(r => ({ blob: r.data, filename: extractFilename(r, 'POAM_Report.xlsx') })),
    controls: () => http.get('/api/reports/controls', { responseType: 'blob' }).then(r => ({ blob: r.data, filename: extractFilename(r, 'Controls_Report.xlsx') })),
  },
};

function extractFilename(response, fallback) {
  const cd = response.headers['content-disposition'] || '';
  const match = cd.match(/filename="?([^";\n]+)"?/i);
  return match ? match[1] : fallback;
}
