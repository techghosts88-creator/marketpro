import { api, isRemoteConfigured } from "./apiClient";

const OUTBOX_KEY = "marketpro:outbox";

function loadOutbox() {
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveOutbox(ops) {
  try { window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops)); } catch (e) { /* storage unavailable */ }
}

export function queueWrite(op) {
  const ops = loadOutbox();
  ops.push(op);
  saveOutbox(ops);
}

async function performWrite(op) {
  if (op.type === "create") { await api.create(op.resource, op.body); return true; }
  if (op.type === "update") { await api.update(op.resource, op.id, op.body); return true; }
  if (op.type === "delete") { await api.remove(op.resource, op.id); return true; }
  return true;
}

// Try a write immediately; if it fails (offline, network error), queue it
// for later instead of losing the change. The UI is always updated
// optimistically by the caller before this runs, so the user never waits.
export async function syncWrite(op) {
  if (!isRemoteConfigured) return;
  if (!navigator.onLine) { queueWrite(op); return; }
  try {
    const ok = await performWrite(op);
    if (!ok) queueWrite(op);
  } catch (e) {
    queueWrite(op);
  }
}

// Called on reconnect (and on mount) to flush anything queued while offline.
export async function flushOutbox() {
  if (!isRemoteConfigured) return;
  const ops = loadOutbox();
  if (!ops.length) return;
  const remaining = [];
  for (const op of ops) {
    try {
      const ok = await performWrite(op);
      if (!ok) remaining.push(op);
    } catch (e) {
      remaining.push(op);
    }
  }
  saveOutbox(remaining);
}
