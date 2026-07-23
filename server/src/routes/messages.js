import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscription.js";
import { serializeRows } from "../lib/serialize.js";

export const messagesRouter = Router();
messagesRouter.use(requireAuth);
messagesRouter.use(requireActiveSubscription);

function toClientShape(m) {
  return { id: m.id, from: m.fromUserId, to: m.toUserId, text: m.text, createdAt: m.createdAt };
}

messagesRouter.get("/", async (req, res) => {
  const rows = await prisma.message.findMany({
    where: { OR: [{ fromUserId: req.userId }, { toUserId: req.userId }] },
    orderBy: { createdAt: "asc" },
  });
  res.json(serializeRows(rows.map(toClientShape)));
});

messagesRouter.post("/", async (req, res) => {
  const { toUserId, text } = req.body || {};
  if (!toUserId || !text?.trim()) return res.status(400).json({ error: "Destinataire et message requis." });

  try {
    const row = await prisma.message.create({
      data: { fromUserId: req.userId, toUserId, text: text.trim() },
    });
    res.status(201).json(toClientShape(row));
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Impossible d'envoyer le message." });
  }
});
