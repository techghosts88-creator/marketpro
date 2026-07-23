import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { computeBillingStatus, subscriptionEndDate, SUBSCRIPTION_PRICE } from "../lib/billing.js";

export const billingRouter = Router();
billingRouter.use(requireAuth);

const VALID_METHODS = ["wave", "orange", "mtn", "moov"];

billingRouter.get("/status", async (req, res) => {
  const profile = await prisma.profile.findUnique({ where: { id: req.userId } });
  if (!profile) return res.status(404).json({ error: "Profil introuvable." });
  res.json(computeBillingStatus(profile));
});

// IMPORTANT: this does not actually charge anyone. There is no real
// Wave/Orange Money/MTN Money/Moov Money integration yet — a genuine
// implementation would redirect the user to that provider's payment page
// (or open their USSD/app flow), then wait for a webhook from the provider
// confirming the charge before marking the payment "completed" below.
// Here, the payment is marked completed immediately so the rest of the
// subscription flow (trial countdown, locking, premium unlock) can be
// built and tested end-to-end. Swap the body of this handler for a real
// provider integration when you have merchant API credentials.
billingRouter.post("/pay", async (req, res) => {
  const { method } = req.body || {};
  if (!VALID_METHODS.includes(method)) {
    return res.status(400).json({ error: "Moyen de paiement invalide." });
  }

  try {
    const profile = await prisma.profile.findUnique({ where: { id: req.userId } });
    if (!profile) return res.status(404).json({ error: "Profil introuvable." });

    const periodStart = new Date();
    const periodEnd = subscriptionEndDate(
      profile.paidUntil && new Date(profile.paidUntil) > periodStart ? new Date(profile.paidUntil) : periodStart
    );

    await prisma.payment.create({
      data: {
        ownerId: req.userId,
        amount: SUBSCRIPTION_PRICE,
        method,
        status: "completed",
        periodStart,
        periodEnd,
      },
    });

    const updated = await prisma.profile.update({
      where: { id: req.userId },
      data: { paidUntil: periodEnd },
    });

    res.status(201).json(computeBillingStatus(updated));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de l'enregistrement du paiement." });
  }
});
