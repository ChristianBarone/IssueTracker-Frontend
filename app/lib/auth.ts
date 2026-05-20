const AUTH_STORAGE_KEY = 'issuetracker.currentUser';

export const AUTH_USERS = [
  { username: 'Andreu-Caro', key: 'Mxk4bUdzGtId8imUNgVKHUiheNKT4AKl' },
  { username: 'Marti-Piris', key: 'QOSJI1vaqyQM3QoJF1WILQeZU03Rq4YT' },
  { username: 'Hala-Alkhatib', key: '2dYzNAcecKbK15Zj2OJo4mbQVLTlSzBJ' },
  { username: 'Aleks-Shahverdyan', key: 'wzkS4JLIQc836R4PAM6RcziMoTElN21G' },
  { username: 'Christian-Alejandro-Barone', key: 'Yc8yGG2YVBNpeEzcSa5lHZrrkaiXAbRd' }
];

export const USERNAMES = AUTH_USERS.map((user) => user.username);

export function isKnownUser(username: string) {
  return USERNAMES.includes(username);
}

export function getApiKey(username: string) {
  return AUTH_USERS.find((user) => user.username === username)?.key
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
  return getStoredUser()?.username;
}

export function getStoredApiKey() {
  return getStoredUser()?.apiKey;
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