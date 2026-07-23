import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscription.js";
import { serializeRow } from "../lib/serialize.js";

export const ordersRouter = Router();
ordersRouter.use(requireAuth);
ordersRouter.use(requireActiveSubscription);

function toOrderShape(o) {
  const row = serializeRow({ id: o.id, customerPhone: o.customerPhone, customerName: o.customerName, status: o.status, total: o.total, createdAt: o.createdAt });
  row.items = o.items.map((it) => ({ id: it.id, productName: it.productName, qty: Number(it.qty), unitPrice: Number(it.unitPrice) }));
  return row;
}

ordersRouter.get("/", async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { ownerId: req.userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(orders.map(toOrderShape));
});

ordersRouter.patch("/:id", async (req, res) => {
  const { status } = req.body || {};
  if (!["nouvelle", "traitee", "annulee"].includes(status)) return res.status(400).json({ error: "Statut invalide." });
  const result = await prisma.order.updateMany({ where: { id: req.params.id, ownerId: req.userId }, data: { status } });
  if (result.count === 0) return res.status(404).json({ error: "Commande introuvable." });
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
  res.json(toOrderShape(order));
});
