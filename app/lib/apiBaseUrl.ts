import {getStoredApiKey} from "@/app/lib/auth";

const ENV_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getApiBaseUrl() {
  if (ENV_BASE_URL) {
    return trimTrailingSlash(ENV_BASE_URL);
  }

  if (globalThis.window !== undefined) {
    const host = globalThis.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }

  return 'https://issuetracker-ff8u.onrender.com';
}

export const getHeaders = () => ({
  'Authorization': getStoredApiKey() ?? '',
  'Content-Type': 'application/json',
});

export const getFormDataHeaders = () => ({
  'Authorization': getStoredApiKey() ?? ''
});