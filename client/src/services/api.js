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
      localStorage.removeItem("token");
      window.location.href = "/login";
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
  getAll: (params = {}) => api.get("/configs", { params }),

  // Get resolved configuration
  getById: (id, includeProvenance = false) =>
    api.get(`/configs/${id}`, { params: { provenance: includeProvenance } }),

  // Get raw configuration data (just this level's overrides)
  getRawById: (id) => api.get(`/configs/${id}`, { params: { raw: true } }),

  // Create new configuration
  create: (configData) => api.post("/configs", configData),

  // Update configuration
  update: (id, data) => api.put(`/configs/${id}`, data),

  // Rename configuration
  rename: (id, name) => api.put(`/configs/${id}/rename`, { name }),

  // Delete configuration
  delete: (id) => api.delete(`/configs/${id}`),

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
  getChildren: (id) => api.get(`/configs/${id}/children`),
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
