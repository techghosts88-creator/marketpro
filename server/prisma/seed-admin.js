// Creates the super admin account if it doesn't exist yet, or resets its
// password if it does — either way you end up with a known-working login.
//
// Usage:
//   SUPER_ADMIN_PASSWORD=your-new-password npm run seed:admin
//
// Uses SUPER_ADMIN_USERNAME (already required for the account to be
// recognised as admin) and SUPER_ADMIN_PASSWORD from your environment (or
// .env file). If SUPER_ADMIN_PASSWORD isn't set, a random one is generated
// and printed once — write it down, it won't be shown again.

import "dotenv/config";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../src/lib/prisma.js";
import { trialEndDate, subscriptionEndDate } from "../src/lib/billing.js";

async function main() {
  const username = (process.env.SUPER_ADMIN_USERNAME || "").trim();
  if (!username) {
    console.error("SUPER_ADMIN_USERNAME is not set. Add it to your .env (or Render environment variables) first.");
    process.exit(1);
  }

  const password = process.env.SUPER_ADMIN_PASSWORD || crypto.randomBytes(4).toString("hex");
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.profile.findUnique({ where: { username } });

  if (existing) {
    await prisma.profile.update({
      where: { id: existing.id },
      data: { passwordHash, isSuperAdmin: true },
    });
    console.log(`Existing account "${username}" updated: password reset and super admin confirmed.`);
  } else {
    await prisma.profile.create({
      data: {
        username,
        passwordHash,
        role: "merchant",
        boutique: "Administration",
        avatar: username[0].toUpperCase(),
        isSuperAdmin: true,
        trialEndsAt: trialEndDate(),
        paidUntil: subscriptionEndDate(), // admin account never gets locked out by the trial
      },
    });
    console.log(`New super admin account "${username}" created.`);
  }

  if (!process.env.SUPER_ADMIN_PASSWORD) {
    console.log(`Password (auto-generated, write it down — it won't be shown again): ${password}`);
  } else {
    console.log("Password set from SUPER_ADMIN_PASSWORD.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
