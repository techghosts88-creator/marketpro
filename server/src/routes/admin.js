import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireSuperAdmin } from "../middleware/admin.js";
import { computeBillingStatus } from "../lib/billing.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireSuperAdmin);

function toAdminRow(p) {
  return {
    id: p.id, username: p.username, role: p.role,
    boutique: p.boutique, company: p.company, city: p.city, phone: p.phone,
    isSuperAdmin: p.isSuperAdmin, createdAt: p.createdAt,
    billing: computeBillingStatus(p),
  };
}

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.profile.findMany({ orderBy: { createdAt: "desc" } });
  res.json(users.map(toAdminRow));
});

adminRouter.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte administrateur." });
  }
  try {
    await prisma.profile.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    res.status(404).json({ error: "Utilisateur introuvable." });
  }
});

adminRouter.post("/users/:id/reset-password", async (req, res) => {
  const { newPassword } = req.body || {};
  const password = newPassword && newPassword.length >= 4 ? newPassword : crypto.randomBytes(4).toString("hex");
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.profile.update({ where: { id: req.params.id }, data: { passwordHash } });
    // Return the plain password once so the admin can communicate it to the
    // user — it is never stored or logged anywhere, only hashed above.
    res.json({ ok: true, temporaryPassword: password });
  } catch (e) {
    res.status(404).json({ error: "Utilisateur introuvable." });
  }
});
