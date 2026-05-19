export const AUTH_STORAGE_KEY = 'issuetracker.currentUser';

export const AUTH_USERS = [
  { username: 'Andreu-Caro' },
  { username: 'Marti-Piris' },
  { username: 'Hala-Alkhatib' },
  { username: 'Aleks-shahverdyan' },
  { username: 'Christian-Alejandro-Barone' }
];

export const HARD_CODED_USERS = AUTH_USERS.map((user) => user.username);

function getAuthUser(username: string) {
  return AUTH_USERS.find((user) => user.username === username) ?? null;
}

export function isKnownUser(username: string) {
  return HARD_CODED_USERS.includes(username);
}

export function getStoredAuthUser() {
  if (typeof window === 'undefined') return null;

  const value = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as { username?: string; apiKey?: string };
    if (parsed.username && parsed.apiKey && isKnownUser(parsed.username)) {
      return { username: parsed.username, apiKey: parsed.apiKey };
    }
  } catch {
    return null;
  }

  return null;
}

export function getStoredUser() {
  return getStoredAuthUser()?.username ?? null;
}

export function getStoredApiKey() {
  return getStoredAuthUser()?.apiKey ?? null;
}

const BASE_URL = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8000'
  : 'https://issuetracker-ff8u.onrender.com';

export async function fetchGeneratedApiKey(username: string) {
  const response = await fetch(`${BASE_URL}/auth/bootstrap/${encodeURIComponent(username)}/`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || 'Failed to fetch generated API key');
  }

  if (!payload?.api_key) {
    throw new Error('Backend did not return an API key');
  }

  return { username: String(payload.username ?? username), apiKey: String(payload.api_key) };
}

export function setStoredUser(username: string, apiKey: string) {
  if (typeof window === 'undefined') return;

  const authUser = getAuthUser(username);
  if (!authUser) return;

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ username, apiKey }));
}

export function clearStoredUser() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}