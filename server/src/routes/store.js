import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { serializeRows, serializeRow } from "../lib/serialize.js";

export const storeRouter = Router();

// Public: fetch a merchant's storefront (boutique name + in-stock products).
// No auth — this is what an end customer's browser calls directly.
storeRouter.get("/:username", async (req, res) => {
  const profile = await prisma.profile.findUnique({ where: { username: req.params.username } });
  if (!profile || profile.role !== "merchant") return res.status(404).json({ error: "Boutique introuvable." });

  const products = await prisma.product.findMany({
    where: { ownerId: profile.id, stock: { gt: 0 } },
    orderBy: { name: "asc" },
  });

  res.json({
    boutique: profile.boutique,
    city: profile.city,
    products: serializeRows(products).map((p) => ({ id: p.id, name: p.name, unit: p.unit, price: p.price, stock: p.stock, category: p.category, photoUrl: p.photoUrl })),
  });
});

// Public: place an order. Validates stock, computes the total from current
// prices (never trusts a client-supplied price), and decrements stock
// immediately in the same transaction — matching "l'article est soustrait
// du stock dès que le client valide sa commande".
storeRouter.post("/:username/order", async (req, res) => {
  const { phone, customerName, items } = req.body || {};
  if (!phone || !String(phone).trim()) return res.status(400).json({ error: "Un numéro de téléphone est requis pour valider la commande." });
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: "Le panier est vide." });

  const profile = await prisma.profile.findUnique({ where: { username: req.params.username } });
  if (!profile || profile.role !== "merchant") return res.status(404).json({ error: "Boutique introuvable." });

  try {
    const order = await prisma.$transaction(async (tx) => {
      let total = 0;
      const itemsData = [];

      for (const item of items) {
        const product = await tx.product.findFirst({ where: { id: item.productId, ownerId: profile.id } });
        if (!product) throw new Error(`Produit introuvable.`);
        const qty = Number(item.qty) || 0;
        if (qty <= 0) throw new Error("Quantité invalide.");
        if (Number(product.stock) < qty) throw new Error(`Stock insuffisant pour ${product.name}.`);

        await tx.product.update({ where: { id: product.id }, data: { stock: { decrement: qty } } });

        const unitPrice = Number(product.price);
        total += unitPrice * qty;
        itemsData.push({ productId: product.id, productName: product.name, qty, unitPrice });
      }

      return tx.order.create({
        data: {
          ownerId: profile.id,
          customerPhone: String(phone).trim(),
          customerName: customerName ? String(customerName).trim() : null,
          total,
          items: { create: itemsData },
        },
        include: { items: true },
      });
    });

    const { items: _items, ...orderRest } = order;
    res.status(201).json(serializeRow(orderRest));
  } catch (e) {
    console.error("Order error:", e.message);
    res.status(400).json({ error: e.message || "Impossible d'enregistrer la commande." });
  }
});
