const TOKEN_KEY = "mrs_token";
const ROLE_KEY = "mrs_role"; // "admin" | "supplier"
const USER_KEY = "mrs_user"; // optional (email/name)

export function setAuth({ token, role, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole() {
  return localStorage.getItem(ROLE_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function isLoggedIn() {
  return Boolean(getToken());
}
