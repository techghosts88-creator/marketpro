import { supabase, isSupabaseConfigured } from "./supabaseClient";

const outboxKey = (ownerId) => `marketpro:outbox:${ownerId}`;

function loadOutbox(ownerId) {
  try {
    const raw = window.localStorage.getItem(outboxKey(ownerId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveOutbox(ownerId, ops) {
  try { window.localStorage.setItem(outboxKey(ownerId), JSON.stringify(ops)); } catch (e) { /* storage unavailable */ }
}

// Queue a write to retry later (used when offline or when a write fails).
export function queueWrite(ownerId, op) {
  const ops = loadOutbox(ownerId);
  ops.push(op);
  saveOutbox(ownerId, ops);
}

export function outboxSize(ownerId) {
  return loadOutbox(ownerId).length;
}

// Attempt one write against Supabase. Returns true on success.
async function performWrite(op) {
  const { table, type, row, id, patch } = op;
  if (type === "upsert") {
    const { error } = await supabase.from(table).upsert(row);
    return !error;
  }
  if (type === "update") {
    const { error } = await supabase.from(table).update(patch).eq("id", id);
    return !error;
  }
  if (type === "delete") {
    const { error } = await supabase.from(table).delete().eq("id", id);
    return !error;
  }
  return true;
}

// Try a write immediately; if it fails (offline, network error), queue it
// for later instead of losing the change. UI state is always updated
// optimistically by the caller before this runs, so the user never waits.
export async function syncWrite(ownerId, op) {
  if (!isSupabaseConfigured) return;
  if (!navigator.onLine) { queueWrite(ownerId, op); return; }
  try {
    const ok = await performWrite(op);
    if (!ok) queueWrite(ownerId, op);
  } catch (e) {
    queueWrite(ownerId, op);
  }
}

// Called on reconnect (and on mount) to flush anything queued while offline.
export async function flushOutbox(ownerId) {
  if (!isSupabaseConfigured) return;
  const ops = loadOutbox(ownerId);
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
  saveOutbox(ownerId, remaining);
}
