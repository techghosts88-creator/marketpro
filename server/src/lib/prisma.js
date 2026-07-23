import { PrismaClient } from "@prisma/client";

// A single shared Prisma Client instance for the whole server process.
export const prisma = new PrismaClient();
