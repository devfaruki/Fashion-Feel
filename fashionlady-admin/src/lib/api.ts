import axios, { AxiosError } from "axios";
import type { AxiosRequestConfig } from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function resolveAssetUrl(value?: string | null) {
  if (!value) return "";
  if (/^(https?:)?\/\//i.test(value)) return value;
  if (/^(data:|blob:)/i.test(value)) return value;

  const normalized = value.startsWith("/") ? value : `/${value}`;
  if (!normalized.startsWith("/public/")) return value;

  return `${baseURL.replace(/\/$/, "")}${normalized}`;
}

function normalizeAssetPaths<T>(payload: T): T {
  if (typeof payload === "string") {
    return resolveAssetUrl(payload) as T;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeAssetPaths(item)) as T;
  }

  if (payload && typeof payload === "object") {
    const clone = payload as Record<string, unknown>;
    Object.keys(clone).forEach((key) => {
      clone[key] = normalizeAssetPaths(clone[key]);
    });
    return clone as T;
  }

  return payload;
}

export const api = axios.create({
  baseURL: `${baseURL}/api`,
  withCredentials: true, // Send cookies with requests
});

// Request interceptor to add access token
api.interceptors.request.use((config) => {
  const accessToken = sessionStorage.getItem("accessToken");
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    response.data = normalizeAssetPaths(response.data);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as unknown as
      | (Record<string, unknown> & {
          _retry?: boolean;
          headers?: Record<string, unknown>;
        })
      | undefined;

    // If token expired and we haven't already retried
    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (originalRequest) originalRequest._retry = true;

      try {
        // Try to refresh the token
        const refreshResponse = await axios.post(
          `${baseURL}/api/login/refresh-token`,
          {},
          {
            withCredentials: true,
          },
        );

        const newAccessToken = refreshResponse.data.data.accessToken;
        sessionStorage.setItem("accessToken", newAccessToken);
        if (originalRequest) {
          originalRequest.headers = originalRequest.headers ?? {};
          (originalRequest.headers as Record<string, unknown>).Authorization =
            `Bearer ${newAccessToken}`;
          return api(originalRequest as AxiosRequestConfig);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        // This will be handled by the frontend app
        sessionStorage.removeItem("accessToken");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);
