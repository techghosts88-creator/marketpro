import { computeBillingStatus } from "./billing.js";

export function toPublicProfile(p) {
  return {
    id: p.id,
    username: p.username,
    role: p.role,
    boutique: p.boutique,
    company: p.company,
    city: p.city,
    phone: p.phone,
    avatar: p.avatar,
    categories: p.categories || [],
    isSuperAdmin: !!p.isSuperAdmin,
    billing: computeBillingStatus(p),
  };
}

// Prisma's Decimal fields (qty, amount, price, stock, threshold, balance,
// amountPaid, amountDue) don't serialize to plain numbers by default — the
// frontend expects plain numbers for arithmetic, so convert them here.
// `dueDate` is a date-only column but Prisma returns a full JS Date; the
// frontend expects a plain "YYYY-MM-DD" string for it (used directly in
// <input type="date"> and date-math helpers), so it's special-cased.
export function serializeRow(row) {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (value && typeof value === "object" && typeof value.toNumber === "function") {
      out[key] = value.toNumber();
    } else if (value instanceof Date) {
      out[key] = key === "dueDate" ? value.toISOString().slice(0, 10) : value.toISOString();
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function serializeRows(rows) {
  return rows.map(serializeRow);
}
