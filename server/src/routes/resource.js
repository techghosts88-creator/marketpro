import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscription.js";
import { serializeRow, serializeRows } from "../lib/serialize.js";

// Every business table (products, clients, suppliers, sales, purchases,
// expenses, debts) follows the same shape: `id`, `ownerId`, some fields,
// `createdAt`. This factory gives each one the same owner-scoped CRUD
// behaviour without repeating the same code seven times.
export function createResourceRouter(modelName) {
  const router = Router();
  const model = prisma[modelName];
  router.use(requireAuth);
  router.use(requireActiveSubscription);

  router.get("/", async (req, res) => {
    const rows = await model.findMany({ where: { ownerId: req.userId }, orderBy: { createdAt: "desc" } });
    res.json(serializeRows(rows));
  });

  router.post("/", async (req, res) => {
    // Ignore any id/ownerId the client tries to send, except we DO allow a
    // client-generated id through: the frontend creates an optimistic local
    // record with its own uuid before this request completes, and reusing
    // that same id here means no reconciliation is needed afterwards.
    const { id, ownerId, owner, ...data } = req.body || {};
    try {
      const row = await model.create({ data: { ...data, ...(id ? { id } : {}), ownerId: req.userId } });
      res.status(201).json(serializeRow(row));
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: "Impossible de créer l'enregistrement." });
    }
  });

  router.patch("/:id", async (req, res) => {
    const { id: _ignored, ownerId, owner, ...data } = req.body || {};
    try {
      const result = await model.updateMany({ where: { id: req.params.id, ownerId: req.userId }, data });
      if (result.count === 0) return res.status(404).json({ error: "Introuvable." });
      const row = await model.findUnique({ where: { id: req.params.id } });
      res.json(serializeRow(row));
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: "Impossible de mettre à jour l'enregistrement." });
    }
  });

  router.delete("/:id", async (req, res) => {
    const result = await model.deleteMany({ where: { id: req.params.id, ownerId: req.userId } });
    if (result.count === 0) return res.status(404).json({ error: "Introuvable." });
    res.status(204).end();
  });

  return router;
}
