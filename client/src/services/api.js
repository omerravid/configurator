import axios from "axios";

const API_BASE = "/api";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';

      // Allow component-level 401 handling for settings endpoints
      const settingsEndpoints = [
        '/settings/databases',
        '/settings/mongodb',
        '/settings/storage',
        '/settings/data'
      ];

      const isSettingsEndpoint = settingsEndpoints.some(endpoint => url.includes(endpoint));

      if (!isSettingsEndpoint) {
        // Prevent multiple redirects
        if (!window.__redirecting401 && window.location.pathname !== '/login') {
          window.__redirecting401 = true;
          try { localStorage.removeItem('token'); } catch {}
          window.location.replace('/login');
        }
      }
      // For settings endpoints, let the component handle the 401
    }
    return Promise.reject(error);
  },
);

// Auth API
export const authAPI = {
  login: (username, password) =>
    api.post("/auth/login", { username, password }),

  register: (username, password, role) =>
    api.post("/auth/register", { username, password, role }),

  getCurrentUser: () => api.get("/auth/me"),

  refreshToken: () => api.post("/auth/refresh"),
};

// Configurations API
export const configAPI = {
  // Get all configurations
  getAll: (includeArchived = false) => {
    const params = includeArchived ? { includeArchived: 'true' } : {};
    return api.get("/configs", { params });
  },

  // Get resolved configuration
  getById: (id, includeProvenance = false) =>
    api.get(`/configs/${id}`, { params: { provenance: includeProvenance } }),

  // Get raw configuration data (just this level's overrides)
  getRawById: (id) => api.get(`/configs/${id}`, { params: { raw: true } }),

  // Create new configuration
  create: (configData) => api.post("/configs", configData),

  // Update configuration
  update: (id, data) => {
    console.log("=== configAPI.update called ===");
    console.log("id:", id);
    console.log("id type:", typeof id);
    console.log("id stringified:", JSON.stringify(id));
    console.log("URL will be:", `/configs/${id}`);

    // Check if id is an object and warn
    if (typeof id === 'object' && id !== null) {
      console.error("ERROR: ID is an object, not a string!", id);
      throw new Error(`Invalid ID type: received object instead of string. ID: ${JSON.stringify(id)}`);
    }

    // Ensure id is converted to string
    const stringId = String(id);
    console.log("Using stringId:", stringId);

    return api.put(`/configs/${stringId}`, data);
  },

  // Rename configuration
  rename: (id, name) => api.put(`/configs/${id}/rename`, { name }),

  // Delete configuration
  delete: (id) => api.delete(`/configs/${id}`),

  // Archive configuration
  archive: (id, archiveChildren = true) =>
    api.post(`/configs/${id}/archive`, { archiveChildren }),

  // Restore archived configuration
  restore: (id) => api.post(`/configs/${id}/restore`),

  // Get value at specific path
  getValueAtPath: (id, path, minimal = false) =>
    api.get(`/configs/${id}/data`, { params: { path, minimal } }),

  // Get by path (alias for getValueAtPath)
  getByPath: (id, path, minimal = false) =>
    api.get(`/configs/${id}/data`, { params: { path, minimal } }),

  // Commit user configuration
  commit: (id) => api.post(`/configs/${id}/commit`),

  // Get components with their versions
  getComponents: () => api.get("/configs/components"),

  // Get child configurations
  getChildren: (id, includeArchived = false) => {
    const params = includeArchived ? { includeArchived: 'true' } : {};
    return api.get(`/configs/${id}/children`, { params });
  },

  // Import folder with JSON and binary files
  importFolder: (formData) => {
    return api.post("/folder-import", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // Replace a file in a configuration
  replaceFile: (configId, propertyPath, file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('configId', configId);
    formData.append('propertyPath', propertyPath);

    return api.post("/file-management/replace", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
};

// Users API
export const userAPI = {
  getAll: () => api.get("/users"),

  getById: (id) => api.get(`/users/${id}`),

  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),

  delete: (id) => api.delete(`/users/${id}`),

  getConfigurations: (id) => api.get(`/users/${id}/configurations`),
};

export default api;
