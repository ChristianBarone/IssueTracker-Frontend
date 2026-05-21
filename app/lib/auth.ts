const AUTH_STORAGE_KEY = 'issuetracker.currentUser';

export interface AuthUser {
  id: number;
  username: string;
  key: string;
}

export const AUTH_USERS = [
  { id: 3, username: 'Andreu-Caro', key: 'Mxk4bUdzGtId8imUNgVKHUiheNKT4AKl' },
  { id: 2, username: 'Marti-Piris', key: 'QOSJI1vaqyQM3QoJF1WILQeZU03Rq4YT' },
  { id: 4, username: 'Hala-Alkhatib', key: '2dYzNAcecKbK15Zj2OJo4mbQVLTlSzBJ' },
  { id: 5, username: 'Aleks-Shahverdyan', key: 'wzkS4JLIQc836R4PAM6RcziMoTElN21G' },
  { id: 6, username: 'Christian-Alejandro-Barone', key: 'Yc8yGG2YVBNpeEzcSa5lHZrrkaiXAbRd' }
] as const satisfies ReadonlyArray<AuthUser>;

export const USERNAMES = AUTH_USERS.map((user) => user.username);

function normalizeForMatch(input: string) {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/@/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

export function isKnownUser(username: string) {
  const key = username.replace('@', '').trim().toLowerCase();
  return AUTH_USERS.some((u) => normalizeForMatch(u.username) === normalizeForMatch(key));
}

export function getApiKey(username: string) {
  const key = username.replace('@', '').trim().toLowerCase();
  return AUTH_USERS.find((user) => normalizeForMatch(user.username) === normalizeForMatch(key))?.key
}

export function getUserIdByUsername(username: string): number | null {
  const key = username.replace('@', '').trim().toLowerCase();
  return AUTH_USERS.find((user) => normalizeForMatch(user.username) === normalizeForMatch(key))?.id ?? null;
}

export function getUserByUsername(username: string): AuthUser | null {
  const key = username.replace('@', '').trim().toLowerCase();
  return AUTH_USERS.find((user) => normalizeForMatch(user.username) === normalizeForMatch(key)) ?? null;
}

export function getUserById(id: number): AuthUser | null {
    return AUTH_USERS.find((user) => user.id === id) ?? null;
}
export function getStoredUser() {
  try {
    if (globalThis.window === undefined) return null;

    const value = globalThis.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!value) return null;

    const parsed = JSON.parse(value) as { username?: string; key?: string };
    if (parsed.username && parsed.key && isKnownUser(parsed.username)) {
      return { username: parsed.username, apiKey: parsed.key };
    }
  } catch {
    console.error("Error getting the stored auth user")
  }

  return null;
}

export function getStoredUsername() {
  return getStoredUser()?.username ?? null;
}

export function getStoredApiKey() {
  return getStoredUser()?.apiKey ?? null;
}

export function setStoredUser(username: string) {
  if (globalThis.window === undefined) return;

  const key = getApiKey(username);
  if (!key) return;

  globalThis.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ username, key }));
}

export function clearStoredUser() {
  if (globalThis.window === undefined) return;

  globalThis.localStorage.removeItem(AUTH_STORAGE_KEY);
}