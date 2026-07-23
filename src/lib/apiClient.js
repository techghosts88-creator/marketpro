// MarketPro API client — the frontend never talks to Postgres directly
// anymore. All data access goes through the Express backend (see /server).
//
// If VITE_API_URL is not set, MarketPro runs in local demo mode: built-in
// accounts, data kept in the browser only. Set VITE_API_URL to point at your
// deployed backend to switch to real accounts and a real database.

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const isRemoteConfigured = Boolean(API_URL);

const TOKEN_KEY = "marketpro:token";

export function getToken() {
  try { return window.localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
}
export function setToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch (e) { /* storage unavailable */ }
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Erreur ${res.status}`);
    err.status = res.status;
    if (data.billing) err.billing = data.billing;
    throw err;
  }
  return data;
}

export const api = {
  register: (payload) => request("/api/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload }),
  me: () => request("/api/auth/me"),

  profiles: () => request("/api/profiles"),

  list: (resource) => request(`/api/${resource}`),
  create: (resource, body) => request(`/api/${resource}`, { method: "POST", body }),
  update: (resource, id, body) => request(`/api/${resource}/${id}`, { method: "PATCH", body }),
  remove: (resource, id) => request(`/api/${resource}/${id}`, { method: "DELETE" }),

  messages: () => request("/api/messages"),
  sendMessage: (toUserId, text) => request("/api/messages", { method: "POST", body: { toUserId, text } }),

  billingStatus: () => request("/api/billing/status"),
  pay: (method) => request("/api/billing/pay", { method: "POST", body: { method } }),
};
