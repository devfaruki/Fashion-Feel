import axios from "axios";

const envApiBaseURL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";
const envAssetBaseURL =
  process.env.NEXT_PUBLIC_ASSET_BASE_URL?.replace(/\/$/, "") || "";

const baseURL = envApiBaseURL || "http://localhost:3000";

function isPrivateHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function getPublicAssetBaseUrl() {
  if (envAssetBaseURL) return envAssetBaseURL;
  if (envApiBaseURL && !isPrivateHost(new URL(envApiBaseURL).hostname)) {
    return envApiBaseURL;
  }
  return baseURL;
}

export function resolveAssetUrl(value?: string | null) {
  if (!value) return "";
  if (/^(data:|blob:)/i.test(value)) return value;

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (!isPrivateHost(parsed.hostname)) return value;

      const publicBase = getPublicAssetBaseUrl();
      return `${publicBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return value;
    }
  }

  if (/^\/\//.test(value)) return value;

  const normalized = value.startsWith("/") ? value : `/${value}`;
  if (!normalized.startsWith("/public/")) return value;

  return `${getPublicAssetBaseUrl()}${normalized}`;
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
});

api.interceptors.response.use((response) => {
  response.data = normalizeAssetPaths(response.data);
  return response;
});
