import { prisma } from "../lib/prisma.js";

// Applied after requireAuth. Only the account flagged is_super_admin may
// proceed. See server/src/routes/auth.js for how that flag gets set
// (matches SUPER_ADMIN_USERNAME on register/login).
export async function requireSuperAdmin(req, res, next) {
  const profile = await prisma.profile.findUnique({ where: { id: req.userId } });
  if (!profile?.isSuperAdmin) {
    return res.status(403).json({ error: "Accès réservé à l'administrateur." });
  }
  next();
}
