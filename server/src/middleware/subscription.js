import { prisma } from "../lib/prisma.js";
import { hasActiveAccess, computeBillingStatus } from "../lib/billing.js";

// Applied after requireAuth on routes that should be locked once the trial
// runs out (business data + messaging), but never on /api/auth or
// /api/billing themselves — a locked-out user still needs to log in and
// pay.
export async function requireActiveSubscription(req, res, next) {
  const profile = await prisma.profile.findUnique({ where: { id: req.userId } });
  if (!profile) return res.status(404).json({ error: "Profil introuvable." });

  if (!hasActiveAccess(profile)) {
    return res.status(402).json({
      error: "Votre période d'essai est terminée. Passez au mode Premium pour continuer.",
      billing: computeBillingStatus(profile),
    });
  }
  next();
}
