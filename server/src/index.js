import "dotenv/config";
import express from "express";
import cors from "cors";

import { authRouter } from "./routes/auth.js";
import { profilesRouter } from "./routes/profiles.js";
import { messagesRouter } from "./routes/messages.js";
import { createResourceRouter } from "./routes/resource.js";

const app = express();

// CORS_ORIGIN should be the exact URL of the deployed frontend (no trailing
// slash), e.g. https://marketpro-frontend.onrender.com. Comma-separate
// multiple origins (e.g. local dev + production) if needed.
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/non-browser requests (no Origin header) and any
      // configured origin. In local dev, an empty allow-list permits everything.
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

app.get("/", (_req, res) => res.json({ ok: true, service: "marketpro-backend" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/products", createResourceRouter("product"));
app.use("/api/clients", createResourceRouter("client"));
app.use("/api/suppliers", createResourceRouter("supplier"));
app.use("/api/sales", createResourceRouter("sale"));
app.use("/api/purchases", createResourceRouter("purchase"));
app.use("/api/expenses", createResourceRouter("expense"));
app.use("/api/debts", createResourceRouter("debt"));

app.use((req, res) => res.status(404).json({ error: "Route inconnue." }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`MarketPro backend listening on port ${PORT}`));
