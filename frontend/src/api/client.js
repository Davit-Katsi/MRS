import axios from "axios";

const API_BASE_URL = "http://localhost:5000";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add Bearer token automatically if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mrs_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
