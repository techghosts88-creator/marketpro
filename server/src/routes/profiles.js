import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { toPublicProfile } from "../lib/serialize.js";

export const profilesRouter = Router();

// Any signed-in user can see the directory (needed for the supplier
// directory and to show the other participant's name in messages).
profilesRouter.get("/", requireAuth, async (_req, res) => {
  const profiles = await prisma.profile.findMany({ orderBy: { createdAt: "asc" } });
  res.json(profiles.map(toPublicProfile));
});
