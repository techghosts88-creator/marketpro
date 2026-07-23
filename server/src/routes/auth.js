import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { toPublicProfile } from "../lib/serialize.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  try {
    const { role, name, city, username, password } = req.body || {};
    if (!username || !password || !role) {
      return res.status(400).json({ error: "Identifiant, mot de passe et rôle sont requis." });
    }
    if (!["merchant", "supplier"].includes(role)) {
      return res.status(400).json({ error: "Rôle invalide." });
    }

    const existing = await prisma.profile.findUnique({ where: { username } });
    if (existing) return res.status(409).json({ error: "Cet identifiant est déjà utilisé." });

    const passwordHash = await bcrypt.hash(password, 10);
    const profile = await prisma.profile.create({
      data: {
        username,
        passwordHash,
        role,
        boutique: role === "merchant" ? (name || "Ma boutique") : null,
        company: role === "supplier" ? (name || "Mon entreprise") : null,
        city: city || null,
        phone: "",
        avatar: (name?.[0] || "M").toUpperCase(),
        categories: [],
      },
    });

    const token = signToken({ id: profile.id, role: profile.role });
    res.status(201).json({ token, user: toPublicProfile(profile) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la création du compte." });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Identifiant et mot de passe requis." });

    const profile = await prisma.profile.findUnique({ where: { username } });
    if (!profile) return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });

    const valid = await bcrypt.compare(password, profile.passwordHash);
    if (!valid) return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });

    const token = signToken({ id: profile.id, role: profile.role });
    res.json({ token, user: toPublicProfile(profile) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la connexion." });
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const profile = await prisma.profile.findUnique({ where: { id: req.userId } });
  if (!profile) return res.status(404).json({ error: "Profil introuvable." });
  res.json({ user: toPublicProfile(profile) });
});
