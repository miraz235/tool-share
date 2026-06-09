import axios, { AxiosInstance } from "axios";

declare const process: { env: Record<string, string | undefined> };

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL as string;
export const API_BASE = `${BACKEND_URL}/api`;

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("toolshare_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const setToken = (token: string | null): void => {
  if (token) localStorage.setItem("toolshare_token", token);
  else localStorage.removeItem("toolshare_token");
};

export const getToken = (): string | null => localStorage.getItem("toolshare_token");

// Build a fully-qualified URL for an uploaded image path returned by /api/upload
export const imageUrl = (path?: string | null): string => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/api/")) return `${BACKEND_URL}${path}`;
  return `${API_BASE}/files/${path}`;
};
