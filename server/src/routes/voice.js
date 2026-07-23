import { Router } from "express";
import { anthropic, isAnthropicConfigured, VOICE_MODEL } from "../lib/anthropic.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscription.js";

export const voiceRouter = Router();
voiceRouter.use(requireAuth);
voiceRouter.use(requireActiveSubscription);

const PAYMENT_METHOD_KEYS = ["especes", "wave", "orange", "mtn", "moov"];

function buildSystemPrompt({ productNames, revenueToday, profitToday, todayISO }) {
  return `Tu es l'assistant vocal de MarketPro, un logiciel de gestion pour commerçants africains (Sénégal, Côte d'Ivoire, etc.). Le commerçant te parle en français courant, parfois avec des tournures locales, pour enregistrer une vente, un achat, une dépense, ou poser une question rapide sur son activité.

Ta seule tâche : analyser le texte transcrit ci-dessous et répondre UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après, sans balises markdown. Le JSON doit avoir exactement cette forme :

{
  "type": "sale" | "purchase" | "expense" | "query" | "unknown",
  "payload": { ... selon le type, voir ci-dessous ... },
  "reply": "une phrase de confirmation courte et naturelle en français, à lire à voix haute au commerçant"
}

Détail de "payload" selon "type" :
- "sale": { "qty": nombre, "unit": texte (ex: "sacs", "cartons", "pièces"), "product": texte, "amount": nombre en FCFA (montant total de la vente), "paymentMethod": une valeur parmi ${JSON.stringify(PAYMENT_METHOD_KEYS)} (déduis-la du texte, "especes" par défaut si rien n'est précisé), "paymentStatus": "paid" | "credit" | "partial", "amountPaid": nombre, "amountDue": nombre, "dueDate": "YYYY-MM-DD" ou null }
  - Si la vente est "à crédit" (rien n'est payé tout de suite), paymentStatus="credit", amountPaid=0, amountDue=amount, et fixe dueDate à 7 jours après aujourd'hui si aucune échéance n'est précisée dans le texte.
  - Si le commerçant dit qu'un client a "versé"/payé une partie ("acompte"), paymentStatus="partial", amountPaid=le montant versé, amountDue=amount-amountPaid, dueDate comme ci-dessus.
  - Sinon paymentStatus="paid", amountPaid=amount, amountDue=0, dueDate=null.
- "purchase": { "qty": nombre, "unit": texte, "product": texte, "amount": nombre en FCFA, "supplier": texte ou null }
- "expense": { "amount": nombre en FCFA, "label": texte court décrivant la dépense }
- "query": pas de payload nécessaire (objet vide {}) — réponds directement à la question dans "reply" en utilisant le contexte ci-dessous.
- "unknown": si tu ne comprends vraiment pas ce que veut le commerçant — dans ce cas "reply" doit l'inviter à reformuler avec un exemple.

Contexte disponible pour répondre aux questions ou identifier des produits déjà connus (utilise ces noms exacts si le commerçant en mentionne un proche) :
- Produits déjà enregistrés : ${productNames.length ? productNames.join(", ") : "aucun pour l'instant"}
- Chiffre d'affaires du jour : ${revenueToday} FCFA
- Bénéfice net du jour (estimé) : ${profitToday} FCFA
- Date d'aujourd'hui : ${todayISO}

Règles importantes :
- Les montants dits "francs" sont déjà en FCFA — ne convertis rien.
- Comprends les variations naturelles de phrasing (le commerçant ne suit aucun script fixe) : "j'ai fait une vente de...", "vends-moi...", "j'ai vendu...", "on m'a acheté...", etc. désignent tous une vente.
- Si un nombre est écrit en toutes lettres ("deux", "trois mille"), convertis-le en chiffre.
- Ne réponds JAMAIS avec autre chose que ce JSON. Pas de phrase d'introduction, pas de \`\`\`json.`;
}

voiceRouter.post("/parse", async (req, res) => {
  if (!isAnthropicConfigured) {
    return res.status(503).json({ error: "L'assistant vocal IA n'est pas configuré sur ce serveur (ANTHROPIC_API_KEY manquante)." });
  }

  const { text, productNames = [], revenueToday = 0, profitToday = 0 } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: "Texte vide." });

  try {
    const systemPrompt = buildSystemPrompt({
      productNames: Array.isArray(productNames) ? productNames.slice(0, 200) : [],
      revenueToday, profitToday,
      todayISO: new Date().toISOString().slice(0, 10),
    });

    const message = await anthropic.messages.create({
      model: VOICE_MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: String(text).trim() }],
    });

    const raw = message.content.find((b) => b.type === "text")?.text || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Réponse IA sans JSON exploitable");

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.type || !parsed.reply) throw new Error("JSON incomplet");
    parsed.payload = parsed.payload || {};

    res.json(parsed);
  } catch (e) {
    console.error("Voice parse error:", e.message);
    res.status(502).json({ error: "L'assistant vocal n'a pas pu traiter la commande." });
  }
});
