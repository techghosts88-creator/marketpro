import React, { useState, useMemo, useRef, useEffect, useContext, createContext, useCallback } from "react";
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, Users, Truck, Wallet,
  BarChart3, Settings, Mic, Menu, X, Bell, Search, Plus,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  MoreHorizontal, Sparkles, Globe2, Volume2, CreditCard, LogOut,
  Lock, User, UserPlus, Eye, EyeOff, Clock, MessageCircle, Store,
  MapPin, Send, Coins, ArrowLeft, WifiOff, MicOff, Crown, Upload, Download,
} from "lucide-react";
import logoUrl from "./assets/logo.png";
import { api, isRemoteConfigured, getToken, setToken } from "./lib/apiClient";
import { syncWrite, flushOutbox } from "./lib/offlineSync";

/* =========================================================================
   HELPERS
========================================================================= */

const fmt = (n) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
const fmtNum = (n) => Math.round(n).toLocaleString("fr-FR");
const uid = (() => { let i = 1000; return () => i++; })();

function daysAgoLabelFr(n) { if (n === 0) return "Aujourd'hui"; if (n === 1) return "Hier"; return `Il y a ${n} jours`; }
function daysAgoLabelEn(n) { if (n === 0) return "Today"; if (n === 1) return "Yesterday"; return `${n} days ago`; }

/* =========================================================================
   BILLING / SUBSCRIPTION
   7-day free trial, then 3000 FCFA/year via mobile money. In remote mode the
   backend computes this (see server/src/lib/billing.js); this mirror is used
   for local demo mode and to render the same UI shape either way.
========================================================================= */
const TRIAL_DAYS = 7;
const SUBSCRIPTION_PRICE = 3000;
const SUBSCRIPTION_DAYS = 365;

function trialEndDate(from = new Date()) { const d = new Date(from); d.setDate(d.getDate() + TRIAL_DAYS); return d; }
function subscriptionEndDate(from = new Date()) { const d = new Date(from); d.setDate(d.getDate() + SUBSCRIPTION_DAYS); return d; }

function computeBillingStatus({ trialEndsAt, paidUntil }) {
  const now = new Date();
  const paid = paidUntil ? new Date(paidUntil) : null;
  if (paid && paid > now) {
    return { status: "active", trialEndsAt, paidUntil, daysRemaining: Math.max(0, Math.ceil((paid - now) / 86400000)) };
  }
  const trial = trialEndsAt ? new Date(trialEndsAt) : null;
  if (trial && trial > now) {
    return { status: "trial", trialEndsAt, paidUntil, daysRemaining: Math.max(0, Math.ceil((trial - now) / 86400000)) };
  }
  return { status: "expired", trialEndsAt, paidUntil, daysRemaining: 0 };
}

function isoDateOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function isoTimestampOffset(daysAgoN, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgoN);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function daysAgoFromISO(iso) {
  if (!iso) return 0;
  const then = new Date(iso); then.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - then) / 86400000));
}
function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(`${dateStr}T00:00:00`);
  return Math.round((due - today) / 86400000);
}
function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/* =========================================================================
   OFFLINE PERSISTENCE — data survives reloads and lost connectivity.
   Each merchant/supplier's data is namespaced by username in localStorage.
   This is a pragmatic client-side store; the real backend (the Express API
   in /server, backed by Postgres on Supabase) is synced separately via
   src/lib/offlineSync.js.
========================================================================= */

function usePersistentState(storageKey, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw !== null ? JSON.parse(raw) : initialValue;
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      return initialValue;
    }
  });

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) { /* storage full or unavailable */ }
  }, [storageKey, state]);

  return [state, setState];
}

function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);
  return online;
}

/* =========================================================================
   I18N
========================================================================= */

const TRANSLATIONS = {
  fr: {
    nav: { dashboard: "Tableau de bord", ventes: "Ventes", stocks: "Stocks", achats: "Achats", clients: "Clients", fournisseurs: "Fournisseurs", depenses: "Dépenses", paiements: "Paiements", credits: "Crédits & Dettes", messagerie: "Messagerie", rapports: "Rapports", parametres: "Paramètres", annuaire: "Annuaire" },
    bottomNav: { home: "Accueil", talk: "Parler", more: "Plus" },
    common: {
      newSale: "Nouvelle vente", newPurchase: "Nouvel achat", newExpense: "Nouvelle dépense",
      addProduct: "Ajouter un produit", newClient: "Nouveau client", newSupplier: "Nouveau fournisseur",
      save: "Enregistrer", close: "Fermer", send: "Envoyer", talk: "Parler", talkToMarketPro: "Parler à MarketPro",
      logout: "Se déconnecter", notifications: "Notifications", search: "Rechercher",
      shop: "Boutique", ok: "OK", lowStock: "Stock faible", upToDate: "À jour", settled: "Soldé", due: "dû", cancel: "Annuler",
      offline: "Hors ligne", offlineHint: "Pas de connexion — vos données sont enregistrées sur cet appareil et resteront intactes.",
    },
    login: {
      tagline: "L'ERP vocal intelligent pour le commerce africain",
      loginTab: "Connexion", registerTab: "Créer un compte",
      username: "Identifiant", password: "Mot de passe", confirmPassword: "Confirmer le mot de passe",
      boutiqueName: "Nom de la boutique", city: "Ville", companyName: "Nom de l'entreprise",
      accountType: "Type de compte", merchantOption: "Commerçant", supplierOption: "Fournisseur",
      loginButton: "Se connecter", registerButton: "Créer mon espace",
      errorCredentials: "Identifiant ou mot de passe incorrect.",
      errorPasswordMatch: "Les mots de passe ne correspondent pas.",
      errorUsernameTaken: "Cet identifiant est déjà utilisé.",
      demoHint: "Comptes de démo : awa / 1234 (commerçant), moussa / 1234 (commerçant), sahel / 1234 (fournisseur)",
      welcomeBack: "Chaque utilisateur a son propre espace, protégé par un identifiant et un mot de passe.",
    },
    dashboard: {
      greetingWord: "Bonjour", subtitle: "Dites simplement ce qui s'est passé aujourd'hui",
      revenueToday: "Chiffre d'affaires (jour)", profitToday: "Bénéfice net (jour)", transactionsToday: "Transactions (jour)",
      lowStockCard: "Stock faible", updatedLive: "Mis à jour en direct", marginEstimate: "Estimation à 32% de marge",
      salesPlusPurchases: "Ventes + achats", allGood: "Tout est en ordre",
      salesEvolution: "Évolution des ventes (7 jours)", salesByCategory: "Ventes par catégorie",
      recentActivity: "Activité récente", alerts: "Alertes", noAlerts: "Aucune alerte pour le moment.",
      lowStockAlert: "Stock faible", debtorAlert: "doit", overdueAlert: "en retard",
    },
    sales: {
      title: "Ventes", subtitleCount: (n) => `${n} vente(s) enregistrée(s)`,
      product: "Produit", quantity: "Quantité", client: "Client", amount: "Montant", payment: "Paiement", when: "Quand", empty: "Aucune vente enregistrée.",
      paymentStatus: "Statut du paiement", statusPaid: "Payé", statusCredit: "Crédit", statusPartial: "Partiel",
      depositLabel: "Montant versé maintenant", remainingLabel: "Reste à payer", dueDateLabel: "Échéance du remboursement",
      creditBadge: "Crédit", partialBadge: (v) => `Partiel · reste ${v}`,
    },
    stocks: { title: "Stocks", subtitleCount: (n) => `${n} produit(s) référencé(s)`, product: "Produit", category: "Catégorie", stock: "Stock", unitPrice: "Prix unitaire", status: "État",
      importButton: "Importer un stock", exportButton: "Exporter", importTitle: "Importer votre stock existant",
      importInstructions: "Choisissez un fichier CSV avec les colonnes : nom, unité, stock, seuil, prix, catégorie. La première ligne (en-têtes) est ignorée automatiquement.",
      downloadTemplate: "Télécharger un modèle vide", chooseFile: "Choisir un fichier CSV", importing: "Importation en cours...",
      importSuccess: (n) => `${n} produit(s) importé(s) ✓`, importError: "Le fichier n'a pas pu être lu. Vérifiez le format CSV.",
      importPreview: (n) => `${n} ligne(s) détectée(s), prêtes à importer.`, confirmImport: "Confirmer l'import",
    },
    purchases: { title: "Achats", subtitleCount: (n) => `${n} achat(s) enregistré(s)`, product: "Produit", quantity: "Quantité", supplier: "Fournisseur", amount: "Montant", when: "Quand", empty: "Aucun achat enregistré." },
    clients: { title: "Clients", subtitleCount: (n) => `${n} client(s)`, name: "Nom", phone: "Téléphone", balance: "Solde" },
    suppliers: { title: "Fournisseurs", subtitleCount: (n) => `${n} fournisseur(s)`, name: "Nom", phone: "Téléphone", balanceDue: "Solde dû" },
    expenses: { title: "Dépenses", total: (v) => `Total : ${v}`, label: "Libellé", category: "Catégorie", amount: "Montant", when: "Quand" },
    payments: { title: "Paiements", subtitle: "Moyens de paiement acceptés dans votre boutique", connected: "Moyens de paiement connectés", connectedTag: "Connecté", breakdown: "Ventes par moyen de paiement", transactionsCount: (n) => `${n} vente(s)`, total: "Total encaissé" },
    credits: {
      title: "Crédits & Dettes", subtitle: "Suivez les créances de vos clients et relancez-les au bon moment",
      totalToCollect: "Total à recouvrer", clientsConcerned: "Clients concernés", overdueCount: "En retard",
      reminderSettingsLabel: "Rappeler automatiquement (jours avant échéance)",
      simulatedNote: "Les rappels sont simulés dans cette démonstration — aucun SMS réel n'est envoyé.",
      remindersToday: "Rappels à envoyer aujourd'hui", sendAll: "Tout envoyer", send: "Envoyer un rappel",
      markSettled: "Marquer réglé", newDebt: "Nouvelle créance", client: "Client", amount: "Montant dû", dueDate: "Échéance", status: "Statut",
      statusOverdue: (n) => `En retard de ${n} j`, statusDueSoon: "Bientôt dû", statusUpcoming: "À venir", statusSettled: "Réglé",
      history: "Historique des rappels", noDebts: "Aucune créance en cours.", noReminders: "Aucun rappel à envoyer aujourd'hui.",
      reminderSent: (name) => `Rappel envoyé à ${name} ✓`, allSent: (n) => `${n} rappel(s) envoyé(s) ✓`, settledToast: (name) => `Créance de ${name} marquée réglée ✓`,
      debtAdded: "Créance ajoutée ✓",
    },
    messaging: {
      title: "Messagerie", searchPlaceholder: "Rechercher un contact...", noContacts: "Aucun contact.",
      typeMessage: "Écrire un message...", send: "Envoyer", noMessages: "Aucun message. Dites bonjour !",
      chooseContact: "Choisissez un contact pour démarrer la conversation.",
      merchantTag: "Commerçant", supplierTag: "Fournisseur",
      sessionNote: "Démo locale : changez de compte dans cette même session pour voir les réponses.",
    },
    directory: {
      title: "Annuaire des commerçants", subtitle: "Trouvez des commerçants avec qui faire affaire",
      searchPlaceholder: "Rechercher par nom ou ville...", contact: "Contacter", noResults: "Aucun commerçant trouvé.",
    },
    reports: { title: "Rapports", subtitle: "Résumé de la performance de votre boutique", bestSellers: "Produits les plus vendus", categoryBreakdown: "Répartition par catégorie", noSalesYet: "Pas encore de données de vente.", revenue: "Chiffre d'affaires", profit: "Bénéfice net", expenses: "Dépenses" },
    settings: {
      title: "Paramètres", subtitle: "Profil et préférences vocales",
      shopProfile: "Profil de la boutique", shopName: "Nom de la boutique", phone: "Téléphone", city: "Ville",
      voiceLanguage: "Langue vocale et d'affichage", voiceLanguageHint: "MarketPro comprend plusieurs langues locales.",
      betaNote: "Le wolof, le bambara et le dioula sont en cours de traduction — certains textes restent en français en attendant.",
      account: "Compte", loggedInAs: "Connecté en tant que",
    },
    voice: { listening: "MarketPro écoute", sayOrType: "Dites ou tapez votre commande", understood: "Voici ce que j'ai compris", placeholder: "Ex : J'ai vendu 2 sacs de riz à 50000 francs", examplesTitle: "Vous pouvez dire par exemple :", newCommand: "Nouvelle commande", finish: "Terminer", send: "Envoyer", tapToSpeak: "Appuyez sur le micro pour parler", speakNow: "Parlez maintenant...", notSupported: "La reconnaissance vocale n'est pas prise en charge par ce navigateur. Utilisez Chrome ou tapez votre commande ci-dessous.", micDenied: "Accès au microphone refusé. Vérifiez les autorisations de votre navigateur.", useText: "Utiliser le clavier" },
    toasts: { saleSaved: "Vente enregistrée ✓", purchaseSaved: "Achat enregistré ✓", expenseSaved: "Dépense enregistrée ✓", productAdded: "Produit ajouté ✓", clientAdded: "Client ajouté ✓", supplierAdded: "Fournisseur ajouté ✓" },
    paymentMethods: { especes: "Espèces", wave: "Wave", orange: "Orange Money", mtn: "MTN Money", moov: "Moov Money" },
    billing: {
      navLabel: "Abonnement",
      trialBannerDays: (n) => `Essai gratuit : ${n} jour(s) restant(s)`,
      trialBannerToday: "Essai gratuit : dernier jour",
      upgradeButton: "Passer au Premium",
      title: "Abonnement", subtitle: "Gérez votre abonnement MarketPro",
      planFree: "Mode gratuit (essai)", planPremium: "Mode Premium",
      statusTrial: (n) => `Essai gratuit — ${n} jour(s) restant(s)`,
      statusActive: (date) => `Premium actif jusqu'au ${date}`,
      statusExpired: "Votre essai est terminé",
      priceLabel: "3 000 FCFA / an", priceNote: "Facturé une fois par an, sans engagement.",
      choosePayment: "Choisissez votre moyen de paiement", payNow: "Payer maintenant", processing: "Paiement en cours...",
      paySuccess: "Paiement enregistré. Bienvenue en mode Premium !",
      payError: "Le paiement n'a pas pu être enregistré. Réessayez.",
      simulatedNote: "Démo : le paiement est confirmé immédiatement ici. Une intégration réelle attendrait la confirmation de Wave/Orange/MTN/Moov avant d'activer le compte.",
      lockedTitle: "Votre période d'essai est terminée",
      lockedSubtitle: "Passez au mode Premium pour continuer à utiliser MarketPro — vos données sont conservées et vous les retrouverez immédiatement après paiement.",
      lockedPriceReminder: "3 000 FCFA pour une année complète d'utilisation.",
    },
  },

  en: {
    nav: { dashboard: "Dashboard", ventes: "Sales", stocks: "Inventory", achats: "Purchases", clients: "Clients", fournisseurs: "Suppliers", depenses: "Expenses", paiements: "Payments", credits: "Credits & Debts", messagerie: "Messages", rapports: "Reports", parametres: "Settings", annuaire: "Directory" },
    bottomNav: { home: "Home", talk: "Talk", more: "More" },
    common: {
      newSale: "New sale", newPurchase: "New purchase", newExpense: "New expense",
      addProduct: "Add product", newClient: "New client", newSupplier: "New supplier",
      save: "Save", close: "Close", send: "Send", talk: "Talk", talkToMarketPro: "Talk to MarketPro",
      logout: "Log out", notifications: "Notifications", search: "Search",
      shop: "Shop", ok: "OK", lowStock: "Low stock", upToDate: "Up to date", settled: "Settled", due: "due", cancel: "Cancel",
      offline: "Offline", offlineHint: "No connection — your data is saved on this device and will stay intact.",
    },
    login: {
      tagline: "The smart voice ERP for African commerce",
      loginTab: "Log in", registerTab: "Create an account",
      username: "Username", password: "Password", confirmPassword: "Confirm password",
      boutiqueName: "Shop name", city: "City", companyName: "Company name",
      accountType: "Account type", merchantOption: "Merchant", supplierOption: "Supplier",
      loginButton: "Log in", registerButton: "Create my space",
      errorCredentials: "Incorrect username or password.",
      errorPasswordMatch: "Passwords do not match.",
      errorUsernameTaken: "This username is already taken.",
      demoHint: "Demo accounts: awa / 1234 (merchant), moussa / 1234 (merchant), sahel / 1234 (supplier)",
      welcomeBack: "Every user gets their own space, protected by a username and password.",
    },
    dashboard: {
      greetingWord: "Hello", subtitle: "Just say what happened today",
      revenueToday: "Revenue (today)", profitToday: "Net profit (today)", transactionsToday: "Transactions (today)",
      lowStockCard: "Low stock", updatedLive: "Updated live", marginEstimate: "Estimated at 32% margin",
      salesPlusPurchases: "Sales + purchases", allGood: "Everything looks good",
      salesEvolution: "Sales trend (7 days)", salesByCategory: "Sales by category",
      recentActivity: "Recent activity", alerts: "Alerts", noAlerts: "No alerts right now.",
      lowStockAlert: "Low stock", debtorAlert: "owes", overdueAlert: "overdue",
    },
    sales: {
      title: "Sales", subtitleCount: (n) => `${n} sale(s) recorded`,
      product: "Product", quantity: "Quantity", client: "Client", amount: "Amount", payment: "Payment", when: "When", empty: "No sales recorded yet.",
      paymentStatus: "Payment status", statusPaid: "Paid", statusCredit: "Credit", statusPartial: "Partial",
      depositLabel: "Amount paid now", remainingLabel: "Remaining balance", dueDateLabel: "Repayment due date",
      creditBadge: "Credit", partialBadge: (v) => `Partial · ${v} left`,
    },
    stocks: { title: "Inventory", subtitleCount: (n) => `${n} product(s) listed`, product: "Product", category: "Category", stock: "Stock", unitPrice: "Unit price", status: "Status",
      importButton: "Import stock", exportButton: "Export", importTitle: "Import your existing stock",
      importInstructions: "Choose a CSV file with columns: name, unit, stock, threshold, price, category. The first (header) row is skipped automatically.",
      downloadTemplate: "Download a blank template", chooseFile: "Choose a CSV file", importing: "Importing...",
      importSuccess: (n) => `${n} product(s) imported ✓`, importError: "The file could not be read. Check the CSV format.",
      importPreview: (n) => `${n} row(s) detected, ready to import.`, confirmImport: "Confirm import",
    },
    purchases: { title: "Purchases", subtitleCount: (n) => `${n} purchase(s) recorded`, product: "Product", quantity: "Quantity", supplier: "Supplier", amount: "Amount", when: "When", empty: "No purchases recorded yet." },
    clients: { title: "Clients", subtitleCount: (n) => `${n} client(s)`, name: "Name", phone: "Phone", balance: "Balance" },
    suppliers: { title: "Suppliers", subtitleCount: (n) => `${n} supplier(s)`, name: "Name", phone: "Phone", balanceDue: "Balance due" },
    expenses: { title: "Expenses", total: (v) => `Total: ${v}`, label: "Label", category: "Category", amount: "Amount", when: "When" },
    payments: { title: "Payments", subtitle: "Payment methods accepted in your shop", connected: "Connected payment methods", connectedTag: "Connected", breakdown: "Sales by payment method", transactionsCount: (n) => `${n} sale(s)`, total: "Total collected" },
    credits: {
      title: "Credits & Debts", subtitle: "Track what clients owe you and follow up at the right time",
      totalToCollect: "Total to collect", clientsConcerned: "Clients concerned", overdueCount: "Overdue",
      reminderSettingsLabel: "Auto-remind (days before due date)",
      simulatedNote: "Reminders are simulated in this demo — no real SMS is sent.",
      remindersToday: "Reminders to send today", sendAll: "Send all", send: "Send reminder",
      markSettled: "Mark settled", newDebt: "New debt", client: "Client", amount: "Amount due", dueDate: "Due date", status: "Status",
      statusOverdue: (n) => `${n}d overdue`, statusDueSoon: "Due soon", statusUpcoming: "Upcoming", statusSettled: "Settled",
      history: "Reminder history", noDebts: "No outstanding debts.", noReminders: "No reminders to send today.",
      reminderSent: (name) => `Reminder sent to ${name} ✓`, allSent: (n) => `${n} reminder(s) sent ✓`, settledToast: (name) => `${name}'s debt marked settled ✓`,
      debtAdded: "Debt added ✓",
    },
    messaging: {
      title: "Messages", searchPlaceholder: "Search a contact...", noContacts: "No contacts.",
      typeMessage: "Type a message...", send: "Send", noMessages: "No messages yet. Say hello!",
      chooseContact: "Choose a contact to start the conversation.",
      merchantTag: "Merchant", supplierTag: "Supplier",
      sessionNote: "Local demo: switch accounts in this same session to see replies.",
    },
    directory: {
      title: "Merchant directory", subtitle: "Find merchants to do business with",
      searchPlaceholder: "Search by name or city...", contact: "Contact", noResults: "No merchants found.",
    },
    reports: { title: "Reports", subtitle: "A summary of your shop's performance", bestSellers: "Best-selling products", categoryBreakdown: "Breakdown by category", noSalesYet: "No sales data yet.", revenue: "Revenue", profit: "Net profit", expenses: "Expenses" },
    settings: {
      title: "Settings", subtitle: "Profile and voice preferences",
      shopProfile: "Shop profile", shopName: "Shop name", phone: "Phone", city: "City",
      voiceLanguage: "Voice & display language", voiceLanguageHint: "MarketPro understands several local languages.",
      betaNote: "Wolof, Bambara and Dioula are still being translated — some text will remain in French for now.",
      account: "Account", loggedInAs: "Logged in as",
    },
    voice: { listening: "MarketPro is listening", sayOrType: "Say or type your command", understood: "Here's what I understood", placeholder: "E.g.: I sold 2 bags of rice for 50000 francs", examplesTitle: "You can say for example:", newCommand: "New command", finish: "Finish", send: "Send", tapToSpeak: "Tap the mic to speak", speakNow: "Speak now...", notSupported: "Speech recognition isn't supported by this browser. Use Chrome or type your command below.", micDenied: "Microphone access denied. Check your browser permissions.", useText: "Use keyboard instead" },
    toasts: { saleSaved: "Sale recorded ✓", purchaseSaved: "Purchase recorded ✓", expenseSaved: "Expense recorded ✓", productAdded: "Product added ✓", clientAdded: "Client added ✓", supplierAdded: "Supplier added ✓" },
    paymentMethods: { especes: "Cash", wave: "Wave", orange: "Orange Money", mtn: "MTN Money", moov: "Moov Money" },
    billing: {
      navLabel: "Subscription",
      trialBannerDays: (n) => `Free trial: ${n} day(s) left`,
      trialBannerToday: "Free trial: last day",
      upgradeButton: "Upgrade to Premium",
      title: "Subscription", subtitle: "Manage your MarketPro subscription",
      planFree: "Free mode (trial)", planPremium: "Premium mode",
      statusTrial: (n) => `Free trial — ${n} day(s) left`,
      statusActive: (date) => `Premium active until ${date}`,
      statusExpired: "Your trial has ended",
      priceLabel: "3,000 FCFA / year", priceNote: "Billed once a year, no commitment.",
      choosePayment: "Choose your payment method", payNow: "Pay now", processing: "Processing payment...",
      paySuccess: "Payment recorded. Welcome to Premium!",
      payError: "The payment could not be recorded. Please try again.",
      simulatedNote: "Demo: payment is confirmed immediately here. A real integration would wait for confirmation from Wave/Orange/MTN/Moov before activating the account.",
      lockedTitle: "Your trial period has ended",
      lockedSubtitle: "Upgrade to Premium to keep using MarketPro — your data is kept safe and you'll get it back right after payment.",
      lockedPriceReminder: "3,000 FCFA for a full year of use.",
    },
  },

  wo: { dashboard: { greetingWord: "Nanga def" }, nav: { ventes: "Jaay" } },
  bm: { dashboard: { greetingWord: "I ni sɔgɔma" }, nav: { ventes: "Feere" } },
  dy: { dashboard: { greetingWord: "I ni sɔgɔma" }, nav: { ventes: "Feere" } },
};

const BETA_LANGS = ["wo", "bm", "dy"];

function lookup(dict, path) { return path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), dict); }

const LangContext = createContext(null);
function useLang() { return useContext(LangContext); }

function LangProvider({ children }) {
  const [lang, setLang] = useState("fr");
  const t = useCallback((path, ...args) => {
    let val = lookup(TRANSLATIONS[lang], path);
    if (val === undefined) val = lookup(TRANSLATIONS.fr, path);
    if (typeof val === "function") return val(...args);
    return val === undefined ? path : val;
  }, [lang]);
  const daysAgoLabel = lang === "en" ? daysAgoLabelEn : daysAgoLabelFr;
  return <LangContext.Provider value={{ lang, setLang, t, daysAgoLabel }}>{children}</LangContext.Provider>;
}

/* =========================================================================
   PAYMENT METHODS
========================================================================= */

const PAYMENT_METHODS = [
  { key: "especes", mark: "₣", color: "#334155", text: "#ffffff" },
  { key: "wave", mark: "W", color: "#1DA1E8", text: "#ffffff" },
  { key: "orange", mark: "OM", color: "#FF7900", text: "#ffffff" },
  { key: "mtn", mark: "MTN", color: "#FFCB05", text: "#12130F" },
  { key: "moov", mark: "M", color: "#0A5EB0", text: "#ffffff" },
];
function getMethod(key) { return PAYMENT_METHODS.find((m) => m.key === key) || PAYMENT_METHODS[0]; }

function PaymentBadge({ methodKey, size = "sm" }) {
  const { t } = useLang();
  const m = getMethod(methodKey);
  const big = size === "lg";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${big ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs"}`} style={{ background: `${m.color}1A`, color: m.color }}>
      <span className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 ${big ? "h-6 w-6 text-[10px]" : "h-4 w-4 text-[8px]"}`} style={{ background: m.color, color: m.text }}>{m.mark}</span>
      {t(`paymentMethods.${m.key}`)}
    </span>
  );
}

/* =========================================================================
   BILLING UI — trial banner, hard lock screen, and the subscription page
========================================================================= */
const BILLING_PAYMENT_METHODS = PAYMENT_METHODS.filter((m) => m.key !== "especes");

function PaymentMethodPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {BILLING_PAYMENT_METHODS.map((m) => (
        <button
          key={m.key} type="button" onClick={() => onChange(m.key)}
          className={`flex flex-col items-center gap-2 rounded-xl border py-3.5 text-xs font-semibold transition-colors ${value === m.key ? "border-emerald-600 bg-emerald-50" : "border-slate-900/10 hover:border-slate-900/30"}`}
        >
          <span className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-[11px]" style={{ background: m.color, color: m.text }}>{m.mark}</span>
          {m.key === "orange" ? "Orange Money" : m.key === "mtn" ? "MTN Money" : m.key === "moov" ? "Moov Money" : "Wave"}
        </button>
      ))}
    </div>
  );
}

function TrialBanner({ billing, onOpenBilling }) {
  const { t } = useLang();
  if (!billing || billing.status !== "trial") return null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-3.5">
      <div className="flex items-center gap-2.5 text-sm text-amber-800 font-medium">
        <Clock size={16} />
        {billing.daysRemaining <= 0 ? t("billing.trialBannerToday") : t("billing.trialBannerDays", billing.daysRemaining)}
      </div>
      <button onClick={onOpenBilling} className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 text-white px-4 py-1.5 text-xs font-semibold hover:bg-amber-500">
        <Crown size={13} /> {t("billing.upgradeButton")}
      </button>
    </div>
  );
}

function SubscriptionLockedScreen({ user, onPay, onLogout }) {
  const { t } = useLang();
  const [method, setMethod] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const pay = async () => {
    if (!method || processing) return;
    setProcessing(true); setError("");
    try { await onPay(method); setDone(true); }
    catch (e) { setError(t("billing.payError")); }
    setProcessing(false);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <CheckCircle2 size={40} className="text-emerald-600 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">{t("billing.paySuccess")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img src={logoUrl} alt="MarketPro" className="h-16 w-16 object-contain mb-2" />
          <div className="flex items-center gap-1 font-bold text-xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Market<span className="text-emerald-700">Pro</span></div>
        </div>
        <div className="rounded-3xl border border-slate-900/10 bg-white p-6 sm:p-8 shadow-xl shadow-slate-900/5">
          <div className="flex justify-center mb-4">
            <span className="h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center"><Lock size={24} className="text-amber-600" /></span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 text-center mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{t("billing.lockedTitle")}</h2>
          <p className="text-sm text-slate-500 text-center mb-6">{t("billing.lockedSubtitle")}</p>

          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center mb-6">
            <div className="font-mono text-2xl font-bold text-emerald-700">{fmt(SUBSCRIPTION_PRICE)}</div>
            <div className="text-xs text-slate-500 mt-1">{t("billing.lockedPriceReminder")}</div>
          </div>

          <p className="text-xs font-medium text-slate-600 mb-2.5">{t("billing.choosePayment")}</p>
          <PaymentMethodPicker value={method} onChange={setMethod} />

          {error && <p className="text-xs text-rose-600 mt-4">{error}</p>}

          <button
            type="button" disabled={!method || processing} onClick={pay}
            className="w-full mt-6 rounded-full bg-emerald-600 text-white py-3 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Crown size={16} /> {processing ? t("billing.processing") : `${t("billing.payNow")} — ${fmt(SUBSCRIPTION_PRICE)}`}
          </button>
          <p className="text-[11px] text-slate-400 text-center mt-4">{t("billing.simulatedNote")}</p>

          <button onClick={onLogout} className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-rose-600 py-2 border-t border-slate-100 pt-4">
            <LogOut size={13} /> {t("common.logout")}
          </button>
        </div>
      </div>
    </div>
  );
}

function BillingView({ user, onPay }) {
  const { t } = useLang();
  const billing = user.billing;
  const [method, setMethod] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [justPaid, setJustPaid] = useState(false);

  const pay = async () => {
    if (!method || processing) return;
    setProcessing(true); setError("");
    try { await onPay(method); setJustPaid(true); setMethod(null); }
    catch (e) { setError(t("billing.payError")); }
    setProcessing(false);
  };

  const statusLabel = billing.status === "active"
    ? t("billing.statusActive", formatDate((billing.paidUntil || "").slice(0, 10)))
    : billing.status === "trial"
      ? t("billing.statusTrial", billing.daysRemaining)
      : t("billing.statusExpired");

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={t("billing.title")} subtitle={t("billing.subtitle")} />

      <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-slate-900">{billing.status === "active" ? t("billing.planPremium") : t("billing.planFree")}</span>
          {billing.status === "active" ? <Badge tone="green">Premium</Badge> : billing.status === "trial" ? <Badge tone="amber">{t("billing.planFree")}</Badge> : <Badge tone="red">{t("billing.statusExpired")}</Badge>}
        </div>
        <p className="text-sm text-slate-500">{statusLabel}</p>
      </div>

      <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-mono text-xl font-bold text-slate-900">{t("billing.priceLabel")}</div>
            <div className="text-xs text-slate-500 mt-0.5">{t("billing.priceNote")}</div>
          </div>
          <Crown size={22} className="text-amber-500" />
        </div>
        <p className="text-xs font-medium text-slate-600 mb-2.5">{t("billing.choosePayment")}</p>
        <PaymentMethodPicker value={method} onChange={setMethod} />
        {error && <p className="text-xs text-rose-600 mt-4">{error}</p>}
        {justPaid && <p className="text-xs text-emerald-700 mt-4 flex items-center gap-1.5"><CheckCircle2 size={14} /> {t("billing.paySuccess")}</p>}
        <button
          type="button" disabled={!method || processing} onClick={pay}
          className="w-full mt-5 rounded-full bg-emerald-600 text-white py-3 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          <Crown size={16} /> {processing ? t("billing.processing") : t("billing.payNow")}
        </button>
        <p className="text-[11px] text-slate-400 text-center mt-4">{t("billing.simulatedNote")}</p>
      </div>
    </div>
  );
}

/* =========================================================================
   SEED DATA
========================================================================= */

const CATEGORY_COLORS = { Alimentation: "#059669", Boissons: "#075985", Hygiène: "#a3e635", Autre: "#cbd5e1" };

function seedA() {
  return {
    products: [
      { id: newId(), name: "Riz 50kg", unit: "sacs", stock: 18, threshold: 10, price: 25000, category: "Alimentation" },
      { id: newId(), name: "Sucre", unit: "sacs", stock: 6, threshold: 8, price: 15000, category: "Alimentation" },
      { id: newId(), name: "Huile 5L", unit: "bidons", stock: 32, threshold: 10, price: 8500, category: "Alimentation" },
      { id: newId(), name: "Lait", unit: "cartons", stock: 40, threshold: 15, price: 12500, category: "Boissons" },
      { id: newId(), name: "Savon", unit: "cartons", stock: 4, threshold: 6, price: 9000, category: "Hygiène" },
      { id: newId(), name: "Thé", unit: "boîtes", stock: 25, threshold: 10, price: 3500, category: "Boissons" },
    ],
    clients: [
      { id: newId(), name: "Fatou Diop", phone: "+221 77 123 45 67" },
      { id: newId(), name: "Moussa Ba", phone: "+221 76 234 56 78" },
      { id: newId(), name: "Aïcha Koné", phone: "+225 07 345 67 89" },
      { id: newId(), name: "Client comptant", phone: "—" },
    ],
    suppliers: [
      { id: newId(), name: "Grossiste Sahel", phone: "+221 78 456 78 90", balance: 45000 },
      { id: newId(), name: "Import Plus", phone: "+225 05 567 89 01", balance: 0 },
    ],
    sales: [
      { id: newId(), createdAt: isoTimestampOffset(0, 9), product: "Riz 50kg", qty: 2, unit: "sacs", amount: 50000, client: "Fatou Diop", category: "Alimentation", paymentMethod: "wave", paymentStatus: "paid", amountPaid: 50000, amountDue: 0 },
      { id: newId(), createdAt: isoTimestampOffset(0, 10), product: "Sucre", qty: 5, unit: "sacs", amount: 75000, client: "Client comptant", category: "Alimentation", paymentMethod: "especes", paymentStatus: "paid", amountPaid: 75000, amountDue: 0 },
      { id: newId(), createdAt: isoTimestampOffset(0, 11), product: "Huile 5L", qty: 3, unit: "bidons", amount: 25500, client: "Moussa Ba", category: "Alimentation", paymentMethod: "orange", paymentStatus: "credit", amountPaid: 0, amountDue: 12500, dueDate: isoDateOffset(3) },
      { id: newId(), createdAt: isoTimestampOffset(0, 15), product: "Thé", qty: 4, unit: "boîtes", amount: 14000, client: "Aïcha Koné", category: "Boissons", paymentMethod: "mtn", paymentStatus: "paid", amountPaid: 14000, amountDue: 0 },
      { id: newId(), createdAt: isoTimestampOffset(1, 9), product: "Lait", qty: 6, unit: "cartons", amount: 75000, client: "Client comptant", category: "Boissons", paymentMethod: "especes", paymentStatus: "paid", amountPaid: 75000, amountDue: 0 },
      { id: newId(), createdAt: isoTimestampOffset(1, 14), product: "Savon", qty: 2, unit: "cartons", amount: 32000, client: "Aïcha Koné", category: "Hygiène", paymentMethod: "moov", paymentStatus: "partial", amountPaid: 0, amountDue: 32000 },
    ],
    purchases: [
      { id: newId(), createdAt: isoTimestampOffset(0, 8), product: "Sucre", qty: 10, unit: "sacs", amount: 130000, supplier: "Grossiste Sahel" },
      { id: newId(), createdAt: isoTimestampOffset(2, 9), product: "Savon", qty: 20, unit: "cartons", amount: 160000, supplier: "Import Plus" },
    ],
    expenses: [
      { id: newId(), createdAt: isoTimestampOffset(0, 8), label: "Transport marchandise", amount: 15000, category: "Logistique" },
      { id: newId(), createdAt: isoTimestampOffset(0, 12), label: "Emballages", amount: 8000, category: "Fournitures" },
      { id: newId(), createdAt: isoTimestampOffset(1, 9), label: "Électricité", amount: 22000, category: "Charges" },
    ],
    debts: [
      { id: newId(), clientName: "Moussa Ba", amount: 12500, dueDate: isoDateOffset(3), status: "ouvert", reminders: [] },
      { id: newId(), clientName: "Aïcha Koné", amount: 32000, dueDate: isoDateOffset(-2), status: "ouvert", reminders: [] },
    ],
    weekHistoryBase: [180000, 220000, 195000, 260000, 240000, 0],
  };
}

function seedB() {
  return {
    products: [
      { id: newId(), name: "Chargeurs USB-C", unit: "pièces", stock: 50, threshold: 15, price: 2500, category: "Autre" },
      { id: newId(), name: "Écouteurs Bluetooth", unit: "pièces", stock: 12, threshold: 15, price: 8000, category: "Autre" },
      { id: newId(), name: "Cartes SIM Orange", unit: "pièces", stock: 60, threshold: 20, price: 500, category: "Autre" },
      { id: newId(), name: "Coques téléphone", unit: "pièces", stock: 5, threshold: 10, price: 3000, category: "Autre" },
      { id: newId(), name: "Batteries externes", unit: "pièces", stock: 22, threshold: 8, price: 12000, category: "Autre" },
    ],
    clients: [
      { id: newId(), name: "Kouassi Yao", phone: "+225 07 890 12 34" },
      { id: newId(), name: "Adjoua N'Guessan", phone: "+225 05 901 23 45" },
      { id: newId(), name: "Client comptant", phone: "—" },
    ],
    suppliers: [
      { id: newId(), name: "TechImport CI", phone: "+225 01 234 56 78", balance: 25000 },
      { id: newId(), name: "Distributeur Mobile", phone: "+225 07 345 67 89", balance: 0 },
    ],
    sales: [
      { id: newId(), createdAt: isoTimestampOffset(0, 9), product: "Écouteurs Bluetooth", qty: 3, unit: "pièces", amount: 24000, client: "Kouassi Yao", category: "Autre", paymentMethod: "mtn", paymentStatus: "credit", amountPaid: 0, amountDue: 8000, dueDate: isoDateOffset(5) },
      { id: newId(), createdAt: isoTimestampOffset(0, 13), product: "Chargeurs USB-C", qty: 8, unit: "pièces", amount: 20000, client: "Client comptant", category: "Autre", paymentMethod: "especes", paymentStatus: "paid", amountPaid: 20000, amountDue: 0 },
      { id: newId(), createdAt: isoTimestampOffset(1, 10), product: "Batteries externes", qty: 2, unit: "pièces", amount: 24000, client: "Adjoua N'Guessan", category: "Autre", paymentMethod: "orange", paymentStatus: "paid", amountPaid: 24000, amountDue: 0 },
    ],
    purchases: [{ id: newId(), createdAt: isoTimestampOffset(1, 9), product: "Coques téléphone", qty: 30, unit: "pièces", amount: 60000, supplier: "TechImport CI" }],
    expenses: [{ id: newId(), createdAt: isoTimestampOffset(0, 9), label: "Connexion internet", amount: 12000, category: "Charges" }],
    debts: [{ id: newId(), clientName: "Kouassi Yao", amount: 8000, dueDate: isoDateOffset(5), status: "ouvert", reminders: [] }],
    weekHistoryBase: [60000, 75000, 50000, 90000, 65000, 0],
  };
}

function seedEmpty() {
  return {
    products: [], clients: [{ id: uid(), name: "Client comptant", phone: "—" }],
    suppliers: [], sales: [], purchases: [], expenses: [], debts: [],
    weekHistoryBase: [0, 0, 0, 0, 0, 0],
  };
}

function getSeed(key) { if (key === "A") return seedA(); if (key === "B") return seedB(); return seedEmpty(); }

/* =========================================================================
   ACCOUNTS
========================================================================= */

const DEMO_PAID_UNTIL = subscriptionEndDate(subscriptionEndDate(subscriptionEndDate())).toISOString(); // ~3 years out
const INITIAL_ACCOUNTS = [
  { username: "awa", password: "1234", role: "merchant", boutique: "Boutique Awa", city: "Dakar, Sénégal", avatar: "A", seed: "A", trialEndsAt: DEMO_PAID_UNTIL, paidUntil: DEMO_PAID_UNTIL },
  { username: "moussa", password: "1234", role: "merchant", boutique: "Boutique Moussa", city: "Abidjan, Côte d'Ivoire", avatar: "M", seed: "B", trialEndsAt: DEMO_PAID_UNTIL, paidUntil: DEMO_PAID_UNTIL },
  { username: "sahel", password: "1234", role: "supplier", company: "Grossiste Sahel", city: "Dakar, Sénégal", avatar: "G", categories: ["Alimentation", "Boissons"], phone: "+221 78 456 78 90", trialEndsAt: DEMO_PAID_UNTIL, paidUntil: DEMO_PAID_UNTIL },
];

/* =========================================================================
   VOICE PARSER
========================================================================= */

const VOICE_EXAMPLES_FR = [
  "J'ai vendu 2 sacs de riz à 50000 francs payé par Wave",
  "J'ai vendu 3 bidons d'huile à 25500 francs à crédit dans 5 jours",
  "J'ai vendu 2 cartons de savon à 32000 francs, le client a versé 10000 francs",
  "Dépense de 5000 francs pour le transport",
  "Combien de sucre reste-t-il en stock ?",
  "Qui me doit de l'argent ?",
];

function cleanNumber(s) { return parseInt(String(s).replace(/[\s.]/g, ""), 10) || 0; }
function findProductByName(products, text) { const lower = text.toLowerCase(); return products.find((p) => lower.includes(p.name.toLowerCase().split(" ")[0])); }
function detectPaymentMethod(lower) {
  if (/\bwave\b/.test(lower)) return "wave";
  if (/orange\s*money|\borange\b/.test(lower)) return "orange";
  if (/\bmtn\b/.test(lower)) return "mtn";
  if (/\bmoov\b/.test(lower)) return "moov";
  if (/esp[eè]ces|cash|comptant/.test(lower)) return "especes";
  return null;
}
function parseDueDate(lower) {
  let m = lower.match(/dans\s+(\d+)\s+jours?/);
  if (m) return isoDateOffset(parseInt(m[1], 10));
  m = lower.match(/le\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    const day = parseInt(m[1], 10), month = parseInt(m[2], 10) - 1;
    const year = m[3] ? parseInt(m[3].length === 2 ? `20${m[3]}` : m[3], 10) : new Date().getFullYear();
    return new Date(year, month, day).toISOString().slice(0, 10);
  }
  return null;
}

function parseVoiceCommand(raw, ctx) {
  const text = raw.trim();
  const lower = text.toLowerCase();

  let m = lower.match(/vendu\s+(\d+)\s+([a-zà-ÿ]+)\s+de\s+([a-zà-ÿ0-9\s]+?)\s+(?:à|a)\s+([\d\s.]+)/i);
  if (m) {
    const [, qty, unit, product, amount] = m;
    const total = cleanNumber(amount);
    const paymentMethod = detectPaymentMethod(lower) || "especes";
    const methodLabel = ctx.t(`paymentMethods.${paymentMethod}`);

    const depositMatch = lower.match(/(?:vers[ée]|acompte|d[ée]pos[ée])\s+([\d\s.]+)/);
    const isCredit = /cr[ée]dit/.test(lower);

    let paymentStatus = "paid", amountPaid = total, amountDue = 0, dueDate = null;
    let extra = "";
    if (depositMatch) {
      const deposit = cleanNumber(depositMatch[1]);
      paymentStatus = "partial"; amountPaid = deposit; amountDue = Math.max(0, total - deposit);
      dueDate = parseDueDate(lower) || isoDateOffset(7);
      extra = ` Acompte de ${fmt(deposit)}, reste ${fmt(amountDue)} avant le ${formatDate(dueDate)}.`;
    } else if (isCredit) {
      paymentStatus = "credit"; amountPaid = 0; amountDue = total;
      dueDate = parseDueDate(lower) || isoDateOffset(7);
      extra = ` À crédit, à rembourser avant le ${formatDate(dueDate)}.`;
    }

    return {
      type: "sale",
      payload: { qty: parseInt(qty, 10), unit, product: product.trim(), amount: total, paymentMethod, paymentStatus, amountPaid, amountDue, dueDate },
      reply: `Vente enregistrée : ${qty} ${unit} de ${product.trim()} — ${fmt(total)} (payé par ${methodLabel}).${extra}`,
    };
  }

  m = lower.match(/achet[ée]\s+(\d+)\s+([a-zà-ÿ]+)\s+de\s+([a-zà-ÿ0-9\s]+?)\s+(?:à|a)\s+([\d\s.]+)/i);
  if (m) {
    const [, qty, unit, product, amount] = m;
    return { type: "purchase", payload: { qty: parseInt(qty, 10), unit, product: product.trim(), amount: cleanNumber(amount) }, reply: `Achat enregistré : ${qty} ${unit} de ${product.trim()} — ${fmt(cleanNumber(amount))}.` };
  }

  m = lower.match(/d[ée]pens[ée]?\s+(?:de\s+)?([\d\s.]+)\s*(?:francs?|fcfa)?\s+(?:pour|en)\s+(.+)/i);
  if (m) {
    const [, amount, label] = m;
    return { type: "expense", payload: { amount: cleanNumber(amount), label: label.trim() }, reply: `Dépense enregistrée : ${fmt(cleanNumber(amount))} pour ${label.trim()}.` };
  }

  if (/stock/.test(lower) && (/combien/.test(lower) || /reste/.test(lower))) {
    const p = findProductByName(ctx.products, lower);
    if (p) return { type: "query", reply: `Il reste ${p.stock} ${p.unit} de ${p.name} en stock${p.stock <= p.threshold ? " — alerte stock faible." : "."}` };
    return { type: "query", reply: "Je n'ai pas trouvé ce produit dans votre inventaire." };
  }
  if (/b[ée]n[ée]fice/.test(lower)) return { type: "query", reply: `Votre bénéfice net aujourd'hui est estimé à ${fmt(ctx.profitToday)}.` };
  if (/chiffre d.affaires/.test(lower)) return { type: "query", reply: `Votre chiffre d'affaires aujourd'hui est de ${fmt(ctx.revenueToday)}.` };
  if (/doit|dette|cr[ée]ance/.test(lower)) {
    const open = ctx.debts.filter((d) => d.status !== "reglé");
    if (!open.length) return { type: "query", reply: "Aucun client n'a de paiement en attente." };
    const total = open.reduce((s, d) => s + d.amount, 0);
    return { type: "query", reply: `${open.length} créance(s) en cours, pour un total de ${fmt(total)}.` };
  }

  return { type: "unknown", reply: "Je n'ai pas bien compris. Essayez par exemple : « J'ai vendu 2 sacs de riz à 50000 francs à crédit dans 5 jours »." };
}

/* =========================================================================
   NAV
========================================================================= */

function useMerchantNav() {
  const { t } = useLang();
  return [
    { key: "dashboard", label: t("nav.dashboard"), Icon: LayoutDashboard },
    { key: "ventes", label: t("nav.ventes"), Icon: ShoppingCart },
    { key: "stocks", label: t("nav.stocks"), Icon: Package },
    { key: "achats", label: t("nav.achats"), Icon: Receipt },
    { key: "clients", label: t("nav.clients"), Icon: Users },
    { key: "fournisseurs", label: t("nav.fournisseurs"), Icon: Truck },
    { key: "depenses", label: t("nav.depenses"), Icon: Wallet },
    { key: "paiements", label: t("nav.paiements"), Icon: CreditCard },
    { key: "credits", label: t("nav.credits"), Icon: Coins },
    { key: "messagerie", label: t("nav.messagerie"), Icon: MessageCircle },
    { key: "rapports", label: t("nav.rapports"), Icon: BarChart3 },
    { key: "abonnement", label: t("billing.navLabel"), Icon: Crown },
    { key: "parametres", label: t("nav.parametres"), Icon: Settings },
  ];
}
function useSupplierNav() {
  const { t } = useLang();
  return [
    { key: "annuaire", label: t("nav.annuaire"), Icon: Store },
    { key: "messagerie", label: t("nav.messagerie"), Icon: MessageCircle },
    { key: "abonnement", label: t("billing.navLabel"), Icon: Crown },
    { key: "parametres", label: t("nav.parametres"), Icon: Settings },
  ];
}

/* =========================================================================
   SMALL UI ATOMS
========================================================================= */

function StatCard({ label, value, delta, deltaTone = "up", icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-900/10 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">{label}</span>
        {Icon && <span className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center"><Icon size={15} className="text-emerald-700" /></span>}
      </div>
      <div className="font-mono text-xl sm:text-2xl font-semibold text-slate-900">{value}</div>
      {delta && <div className={`mt-1.5 flex items-center gap-1 text-xs ${deltaTone === "up" ? "text-emerald-700" : "text-amber-600"}`}>{deltaTone === "up" ? <TrendingUp size={13} /> : <AlertTriangle size={13} />} {delta}</div>}
    </div>
  );
}
function Badge({ tone = "slate", children }) {
  const tones = { slate: "bg-slate-100 text-slate-600", green: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", red: "bg-rose-100 text-rose-700", blue: "bg-sky-100 text-sky-800" };
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
function PrimaryButton({ children, onClick, icon: Icon = Plus, className = "" }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-700 text-white px-5 py-2.5 text-sm font-semibold shadow-md shadow-emerald-600/25 hover:-translate-y-0.5 transition-transform ${className}`}><Icon size={16} /> {children}</button>;
}
function EmptyState({ text }) { return <div className="text-center py-14 text-sm text-slate-400">{text}</div>; }
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-6">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-6 sm:p-7 shadow-2xl max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-lg text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h3>
          <button onClick={onClose} aria-label="Fermer" className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) { return <label className="block mb-4"><span className="block text-xs font-medium text-slate-600 mb-1.5">{label}</span>{children}</label>; }
const inputCls = "w-full rounded-xl border border-slate-900/15 px-4 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15";

/* =========================================================================
   LOGIN / REGISTER
========================================================================= */

function LoginScreen({ onLogin, onRegister }) {
  const { t } = useLang();
  const [tab, setTab] = useState("login");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [regRole, setRegRole] = useState("merchant");
  const [regName, setRegName] = useState("");
  const [regCity, setRegCity] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  const submitLogin = async () => {
    if (loading || !username.trim() || !password) return;
    setError(""); setLoading(true);
    const result = await onLogin({ username: username.trim(), password });
    setLoading(false);
    if (result?.error) setError(result.error);
  };

  const submitRegister = async () => {
    if (loading) return;
    if (regPassword !== regConfirm) { setError(t("login.errorPasswordMatch")); return; }
    if (!regUsername.trim() || !regPassword) return;
    setError(""); setLoading(true);
    const result = await onRegister({ role: regRole, name: regName.trim(), city: regCity.trim(), username: regUsername.trim(), password: regPassword });
    setLoading(false);
    if (result?.error) setError(result.error);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-2">
          <img src={logoUrl} alt="MarketPro" className="h-24 w-24 sm:h-28 sm:w-28 object-contain drop-shadow-sm" />
          <div className="flex items-center gap-1 font-bold text-2xl -mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Market<span className="text-emerald-700">Pro</span>
          </div>
        </div>
        <p className="text-center text-sm text-slate-500 mb-8">{t("login.tagline")}</p>

        <div className="rounded-3xl border border-slate-900/10 bg-white p-6 sm:p-8 shadow-xl shadow-slate-900/5">
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
            <button onClick={() => { setTab("login"); setError(""); }} className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === "login" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>{t("login.loginTab")}</button>
            <button onClick={() => { setTab("register"); setError(""); }} className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === "register" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>{t("login.registerTab")}</button>
          </div>

          {tab === "login" ? (
            <div onKeyDown={(e) => { if (e.key === "Enter") submitLogin(); }}>
              <Field label={t("login.username")}>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={username} onChange={(e) => setUsername(e.target.value)} className={`${inputCls} pl-10`} required />
                </div>
              </Field>
              <Field label={t("login.password")}>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} pl-10 pr-10`} required />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </Field>
              {error && <p className="text-xs text-rose-600 mb-4">{error}</p>}
              <button type="button" disabled={loading} onClick={submitLogin} className="w-full rounded-full bg-emerald-600 text-white py-3 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60">{loading ? "…" : t("login.loginButton")}</button>
              {!isRemoteConfigured && <p className="text-xs text-slate-400 text-center mt-4">{t("login.demoHint")}</p>}
            </div>
          ) : (
            <div onKeyDown={(e) => { if (e.key === "Enter") submitRegister(); }}>
              <Field label={t("login.accountType")}>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setRegRole("merchant")} className={`rounded-xl border py-2.5 text-sm font-medium ${regRole === "merchant" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-900/15 text-slate-600"}`}>{t("login.merchantOption")}</button>
                  <button type="button" onClick={() => setRegRole("supplier")} className={`rounded-xl border py-2.5 text-sm font-medium ${regRole === "supplier" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-900/15 text-slate-600"}`}>{t("login.supplierOption")}</button>
                </div>
              </Field>
              <Field label={regRole === "merchant" ? t("login.boutiqueName") : t("login.companyName")}><input value={regName} onChange={(e) => setRegName(e.target.value)} className={inputCls} required /></Field>
              <Field label={t("login.city")}><input value={regCity} onChange={(e) => setRegCity(e.target.value)} className={inputCls} /></Field>
              <Field label={t("login.username")}>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={regUsername} onChange={(e) => setRegUsername(e.target.value)} className={`${inputCls} pl-10`} required />
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("login.password")}><input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className={inputCls} required /></Field>
                <Field label={t("login.confirmPassword")}><input type="password" value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} className={inputCls} required /></Field>
              </div>
              {error && <p className="text-xs text-rose-600 mb-4">{error}</p>}
              <button type="button" disabled={loading} onClick={submitRegister} className="w-full rounded-full bg-gradient-to-br from-emerald-600 to-sky-800 text-white py-3 text-sm font-semibold hover:opacity-90 inline-flex items-center justify-center gap-2 disabled:opacity-60"><UserPlus size={16} /> {loading ? "…" : t("login.registerButton")}</button>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">{t("login.welcomeBack")}</p>
      </div>
    </div>
  );
}

/* =========================================================================
   VOICE OVERLAY
========================================================================= */

/* =========================================================================
   REAL VOICE — Web Speech API (SpeechRecognition + SpeechSynthesis)
   Falls back gracefully (text-only) on browsers without support (e.g. Firefox).
========================================================================= */

const SPEECH_LOCALES = { fr: "fr-FR", en: "en-US", wo: "fr-FR", bm: "fr-FR", dy: "fr-FR" };

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function useSpeechRecognition(lang) {
  const Ctor = useMemo(() => getSpeechRecognitionCtor(), []);
  const supported = !!Ctor;
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState(null);
  const onResultRef = useRef(null);

  useEffect(() => {
    if (!supported) return;
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = SPEECH_LOCALES[lang] || "fr-FR";

    rec.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (interim) setInterimText(interim);
      if (finalText) { setInterimText(""); onResultRef.current?.(finalText.trim()); }
    };
    rec.onerror = (event) => {
      setError(event.error === "not-allowed" || event.error === "permission-denied" ? "denied" : event.error);
      setIsListening(false);
    };
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    return () => { try { rec.stop(); } catch (e) {} recognitionRef.current = null; };
  }, [supported, Ctor, lang]);

  const start = useCallback((onResult) => {
    if (!recognitionRef.current) return;
    onResultRef.current = onResult;
    setError(null);
    setInterimText("");
    try { recognitionRef.current.start(); setIsListening(true); } catch (e) { /* already started */ }
  }, []);

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch (e) {}
    setIsListening(false);
  }, []);

  return { supported, isListening, interimText, error, start, stop };
}

function speak(text, lang) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = SPEECH_LOCALES[lang] || "fr-FR";
    utter.rate = 1;
    window.speechSynthesis.speak(utter);
  } catch (e) { /* TTS not available */ }
}


function VoiceOverlay({ open, onClose, onCommand }) {
  const { t, lang } = useLang();
  const [text, setText] = useState("");
  const [reply, setReply] = useState(null);
  const inputRef = useRef(null);
  const speech = useSpeechRecognition(lang);

  useEffect(() => {
    if (open) {
      setText(""); setReply(null);
      if (!speech.supported) setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      speech.stop();
      window.speechSynthesis?.cancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const submit = (value) => {
    if (!value.trim()) return;
    speech.stop();
    const result = onCommand(value);
    setReply(result.reply);
    speak(result.reply, lang);
  };

  const toggleMic = () => {
    if (speech.isListening) { speech.stop(); return; }
    setReply(null);
    setText("");
    speech.start((finalText) => submit(finalText));
  };

  const displayedText = speech.isListening ? (speech.interimText || text) : text;
  const showMicUI = speech.supported;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-6">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-950 text-white p-6 sm:p-7 shadow-2xl relative">
        <button onClick={onClose} aria-label={t("common.close")} className="absolute top-5 right-5 text-slate-400 hover:text-white"><X size={20} /></button>
        <div className="flex items-center gap-2.5 mb-6">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 flex-shrink-0">
            <Mic size={17} className="text-white" />
            {speech.isListening && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40" />}
          </span>
          <div>
            <div className="font-semibold text-sm">{t("voice.listening")}</div>
            <div className="text-xs text-slate-400">
              {speech.isListening ? t("voice.speakNow") : reply ? t("voice.understood") : showMicUI ? t("voice.tapToSpeak") : t("voice.sayOrType")}
            </div>
          </div>
        </div>

        {!speech.supported && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-3 mb-4 text-xs text-amber-300">{t("voice.notSupported")}</div>
        )}
        {speech.error === "denied" && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 px-4 py-3 mb-4 text-xs text-rose-300">{t("voice.micDenied")}</div>
        )}

        {/* Big tap-to-talk mic button (only when browser supports it) */}
        {showMicUI && !reply && (
          <div className="flex flex-col items-center mb-5">
            <button
              onClick={toggleMic}
              aria-label={speech.isListening ? t("voice.finish") : t("voice.tapToSpeak")}
              className={`relative flex items-center justify-center h-20 w-20 rounded-full transition-all ${speech.isListening ? "bg-rose-600 shadow-lg shadow-rose-600/40" : "bg-emerald-600 shadow-lg shadow-emerald-600/40 hover:scale-105"}`}
            >
              {speech.isListening && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-30" />}
              {speech.isListening ? <MicOff size={28} className="text-white relative" /> : <Mic size={28} className="text-white relative" />}
            </button>
            {displayedText && <p className="mt-4 text-center text-sm text-slate-200 max-w-xs">{displayedText}</p>}
          </div>
        )}

        <div onKeyDown={(e) => { if (e.key === "Enter") submit(text); }} className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 mb-4">
          <Volume2 size={16} className="text-slate-500 flex-shrink-0" />
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("voice.placeholder")} className="bg-transparent flex-1 outline-none text-sm placeholder:text-slate-500" />
        </div>

        {reply && <div className="rounded-2xl rounded-tl-md border border-lime-400/25 px-5 py-4 text-sm text-emerald-50 mb-4" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(3,105,161,0.16))" }}>{reply}</div>}
        {!reply && (
          <div className="mb-4">
            <div className="text-xs text-slate-500 mb-2.5">{t("voice.examplesTitle")}</div>
            <div className="flex flex-wrap gap-2">{VOICE_EXAMPLES_FR.map((ex) => <button key={ex} onClick={() => { setText(ex); submit(ex); }} className="text-xs rounded-full border border-white/15 px-3 py-1.5 text-slate-300 hover:border-lime-400/50 hover:text-white transition-colors">{ex}</button>)}</div>
          </div>
        )}
        <div className="flex gap-3">
          {reply ? (
            <>
              <button onClick={() => { setReply(null); setText(""); if (!showMicUI) setTimeout(() => inputRef.current?.focus(), 100); }} className="flex-1 rounded-full border border-white/15 py-2.5 text-sm font-medium hover:border-white/40">{t("voice.newCommand")}</button>
              <button onClick={onClose} className="flex-1 rounded-full bg-emerald-600 py-2.5 text-sm font-semibold hover:bg-emerald-500">{t("voice.finish")}</button>
            </>
          ) : (
            <button onClick={() => submit(text)} className="flex-1 rounded-full bg-emerald-600 py-2.5 text-sm font-semibold hover:bg-emerald-500">{t("voice.send")}</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MESSAGING (shared by merchants and suppliers)
========================================================================= */

/* Unified identity: Remote-mode accounts have a real uuid `id`; local-demo
   accounts don't, so we fall back to `username`. Used anywhere two accounts
   need to reference each other (messaging, directory). */
function accountKey(account) { return account?.id || account?.username; }

function MessagingView({ currentUsername, accounts, messages, sendMessage, initialContact }) {
  const { t } = useLang();
  const [active, setActive] = useState(initialContact || null);
  const [text, setText] = useState("");
  const listRef = useRef(null);
  const [query, setQuery] = useState("");

  useEffect(() => { if (initialContact) setActive(initialContact); }, [initialContact]);
  useEffect(() => { listRef.current?.scrollTo({ top: 999999 }); }, [messages, active]);

  const contacts = accounts.filter((a) => accountKey(a) !== currentUsername);
  const filtered = contacts.filter((c) => {
    const name = c.role === "merchant" ? c.boutique : c.company;
    return `${name} ${c.city || ""}`.toLowerCase().includes(query.toLowerCase());
  });

  const thread = messages.filter((m) => (m.from === currentUsername && m.to === active) || (m.from === active && m.to === currentUsername));
  const activeAccount = accounts.find((a) => accountKey(a) === active);
  const activeName = activeAccount ? (activeAccount.role === "merchant" ? activeAccount.boutique : activeAccount.company) : "";

  const send = () => { if (!text.trim() || !active) return; sendMessage(currentUsername, active, text.trim()); setText(""); };

  return (
    <div>
      <PageHeader title={t("messaging.title")} subtitle={t("messaging.sessionNote")} />
      <div className="rounded-2xl border border-slate-900/10 bg-white overflow-hidden" style={{ height: "min(70vh, 560px)" }}>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] h-full">
          {/* Contact list */}
          <div className={`border-r border-slate-900/10 flex flex-col ${active ? "hidden md:flex" : "flex"}`}>
            <div className="p-3 border-b border-slate-900/10">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("messaging.searchPlaceholder")} className="w-full rounded-lg border border-slate-900/10 pl-8 pr-3 py-2 text-xs outline-none focus:border-emerald-600" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && <div className="p-4 text-xs text-slate-400 text-center">{t("messaging.noContacts")}</div>}
              {filtered.map((c) => {
                const name = c.role === "merchant" ? c.boutique : c.company;
                return (
                  <button key={accountKey(c)} onClick={() => setActive(accountKey(c))} className={`w-full flex items-center gap-3 px-3.5 py-3 text-left border-b border-slate-50 hover:bg-slate-50 ${active === accountKey(c) ? "bg-emerald-50" : ""}`}>
                    <span className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-sky-800 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">{c.avatar}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{name}</div>
                      <div className="text-[11px] text-slate-400">{c.role === "merchant" ? t("messaging.merchantTag") : t("messaging.supplierTag")}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Thread */}
          <div className={`flex flex-col ${active ? "flex" : "hidden md:flex"}`}>
            {active ? (
              <>
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-900/10">
                  <button onClick={() => setActive(null)} className="md:hidden text-slate-500"><ArrowLeft size={18} /></button>
                  <span className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-sky-800 flex items-center justify-center text-white text-xs font-semibold">{activeAccount?.avatar}</span>
                  <span className="text-sm font-semibold text-slate-900">{activeName}</span>
                </div>
                <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/50">
                  {thread.length === 0 && <div className="text-center text-xs text-slate-400 mt-6">{t("messaging.noMessages")}</div>}
                  {thread.map((m) => (
                    <div key={m.id} className={`flex ${m.from === currentUsername ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.from === currentUsername ? "bg-emerald-600 text-white rounded-br-md" : "bg-white border border-slate-900/10 text-slate-800 rounded-bl-md"}`}>{m.text}</div>
                    </div>
                  ))}
                </div>
                <div onKeyDown={(e) => { if (e.key === "Enter") send(); }} className="flex items-center gap-2 p-3 border-t border-slate-900/10">
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("messaging.typeMessage")} className="flex-1 rounded-full border border-slate-900/15 px-4 py-2.5 text-sm outline-none focus:border-emerald-600" />
                  <button onClick={send} className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 hover:bg-emerald-500"><Send size={16} /></button>
                </div>
              </>
            ) : (
              <div className="flex-1 hidden md:flex items-center justify-center text-sm text-slate-400">{t("messaging.chooseContact")}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   SUPPLIER DIRECTORY
========================================================================= */

function DirectoryView({ accounts, onContact }) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const merchants = accounts.filter((a) => a.role === "merchant");
  const filtered = merchants.filter((m) => `${m.boutique} ${m.city || ""}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <PageHeader title={t("directory.title")} subtitle={t("directory.subtitle")} />
      <div className="relative mb-6 max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("directory.searchPlaceholder")} className={`${inputCls} pl-10`} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((m) => (
          <div key={accountKey(m)} className="rounded-2xl border border-slate-900/10 bg-white p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="h-11 w-11 rounded-full bg-gradient-to-br from-emerald-500 to-sky-800 flex items-center justify-center text-white font-semibold flex-shrink-0">{m.avatar}</span>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-slate-900 truncate">{m.boutique}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={11} /> {m.city || "—"}</div>
              </div>
            </div>
            <PrimaryButton onClick={() => onContact(accountKey(m))} icon={MessageCircle} className="w-full justify-center">{t("directory.contact")}</PrimaryButton>
          </div>
        ))}
      </div>
      {!filtered.length && <EmptyState text={t("directory.noResults")} />}
    </div>
  );
}

/* =========================================================================
   TOP-LEVEL APP
========================================================================= */

export default function MarketProApp() {
  return (
    <LangProvider>
      <AuthGate />
    </LangProvider>
  );
}

function AuthGate() {
  return isRemoteConfigured ? <RemoteAuthGate /> : <LocalAuthGate />;
}

/* ---- Local demo mode: built-in accounts, localStorage only ---- */
function LocalAuthGate() {
  const { t } = useLang();
  const [accounts, setAccounts] = usePersistentState("marketpro:accounts", INITIAL_ACCOUNTS);
  const [messages, setMessages] = usePersistentState("marketpro:messages", [
    { id: uid(), from: "sahel", to: "awa", text: "Bonjour Awa, nous avons du sucre et de l'huile en promotion ce mois-ci." },
  ]);
  const [currentUsername, setCurrentUsername] = usePersistentState("marketpro:session", null);
  const currentUser = accounts.find((a) => a.username === currentUsername) || null;

  const sendMessage = (from, to, text) => setMessages((m) => [...m, { id: uid(), from, to, text }]);

  const handleLogin = async ({ username, password }) => {
    const match = accounts.find((a) => a.username.toLowerCase() === username.toLowerCase() && a.password === password);
    if (!match) return { error: t("login.errorCredentials") };
    setCurrentUsername(match.username);
    return {};
  };

  const handleRegister = async ({ role, name, city, username, password }) => {
    if (accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) return { error: t("login.errorUsernameTaken") };
    const base = { username, password, city, avatar: (name[0] || "M").toUpperCase(), trialEndsAt: trialEndDate().toISOString(), paidUntil: null };
    const account = role === "merchant"
      ? { ...base, role: "merchant", boutique: name || "Ma boutique", seed: "empty" }
      : { ...base, role: "supplier", company: name || "Mon entreprise", categories: [], phone: "" };
    setAccounts((a) => [...a, account]);
    setCurrentUsername(account.username);
    return {};
  };

  const handlePay = async (method) => {
    const now = new Date();
    setAccounts((accs) => accs.map((a) => {
      if (a.username !== currentUsername) return a;
      const base = a.paidUntil && new Date(a.paidUntil) > now ? new Date(a.paidUntil) : now;
      return { ...a, paidUntil: subscriptionEndDate(base).toISOString() };
    }));
    return { ok: true, method };
  };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} />;

  const userWithBilling = { ...currentUser, billing: computeBillingStatus(currentUser) };
  const shared = { accounts, messages, sendMessage, onLogout: () => setCurrentUsername(null), onPay: handlePay };
  if (currentUser.role === "supplier") return <SupplierWorkspace key={currentUser.username} user={userWithBilling} {...shared} />;
  return <Workspace key={currentUser.username} user={userWithBilling} {...shared} />;
}

/* ---- Remote mode: real accounts + real Postgres data, via the Express backend ---- */
function RemoteAuthGate() {
  const { t } = useLang();
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);

  // Restore a session from a previously stored JWT, if any.
  useEffect(() => {
    (async () => {
      if (!getToken()) { setAuthLoading(false); return; }
      try {
        const { user: me } = await api.me();
        setUser(me);
      } catch (e) {
        setToken(null);
      }
      setAuthLoading(false);
    })();
  }, []);

  // Directory of all registered accounts (for the supplier directory and
  // for showing the other participant's name in messages).
  useEffect(() => {
    if (!user) { setAccounts([]); return; }
    let cancelled = false;
    api.profiles().then((rows) => { if (!cancelled) setAccounts(rows); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  // Poll for messages while logged in. Simpler and more resilient than a
  // persistent WebSocket on a free-tier host that can spin down when idle.
  // Paused once the subscription is expired (the server would 402 anyway),
  // and resumes automatically once billing status flips back to trial/active.
  useEffect(() => {
    if (!user || user.billing?.status === "expired") { setMessages([]); return; }
    let cancelled = false;
    const load = () => api.messages().then((rows) => { if (!cancelled) setMessages(rows); }).catch(() => {});
    load();
    const interval = setInterval(load, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  const sendMessage = async (from, to, text) => {
    setMessages((m) => [...m, { id: newId(), from, to, text }]); // optimistic
    try { await api.sendMessage(to, text); } catch (e) { /* will reconcile on next poll */ }
  };

  // Refresh billing status periodically so a trial that expires mid-session
  // (or a payment made in another tab) is reflected without needing to log
  // out and back in.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = () => api.billingStatus().then((billing) => { if (!cancelled) setUser((u) => (u ? { ...u, billing } : u)); }).catch(() => {});
    const interval = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePay = async (method) => {
    const billing = await api.pay(method);
    setUser((u) => (u ? { ...u, billing } : u));
    return { ok: true, method };
  };

  const handleLogin = async ({ username, password }) => {
    try {
      const { token, user: me } = await api.login({ username, password });
      setToken(token);
      setUser(me);
      return {};
    } catch (e) {
      return { error: t("login.errorCredentials") };
    }
  };

  const handleRegister = async ({ role, name, city, username, password }) => {
    try {
      const { token, user: me } = await api.register({ role, name, city, username, password });
      setToken(token);
      setUser(me);
      return {};
    } catch (e) {
      return { error: e.message || t("login.errorUsernameTaken") };
    }
  };

  const onLogout = () => { setToken(null); setUser(null); };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-9 w-9 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} />;

  const shared = { accounts, messages, sendMessage, onLogout, onPay: handlePay };
  if (user.role === "supplier") return <SupplierWorkspace key={user.id} user={user} {...shared} />;
  return <Workspace key={user.id} user={user} {...shared} />;
}

/* =========================================================================
   SHELL (shared chrome for both workspace types)
========================================================================= */

function AppShell({ navItems, activeKey, onNavigate, title, headerActions, avatar, entityName, entitySub, onLogout, sidebarOpen, setSidebarOpen, moreOpen, setMoreOpen, moreItems, mobileExtraNav, children }) {
  const { t } = useLang();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Mobile drawer (phones only) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[90] md:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white p-5 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5 font-bold text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Market<span className="text-emerald-700">Pro</span></div>
              <button onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu"><X size={22} /></button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {navItems.map(({ key, label, Icon }) => (
                <button key={key} onClick={() => onNavigate(key)} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium ${activeKey === key ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}><Icon size={18} /> {label}</button>
              ))}
            </nav>
            <button onClick={onLogout} className="flex items-center justify-center gap-2 text-sm font-semibold text-rose-600 py-3 border-t border-slate-100 mt-3"><LogOut size={15} /> {t("common.logout")}</button>
          </div>
        </div>
      )}

      {/* Mobile "more" sheet (phones only) */}
      {moreOpen && (
        <div className="fixed inset-0 z-[90] md:hidden flex items-end">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setMoreOpen(false)} />
          <div className="relative w-full bg-white rounded-t-3xl p-5 pb-8 max-h-[80vh] overflow-y-auto">
            <div className="h-1 w-10 bg-slate-200 rounded-full mx-auto mb-5" />
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {moreItems.map(({ key, label, Icon }) => (
                <button key={key} onClick={() => onNavigate(key)} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-50 text-slate-700">
                  <Icon size={20} className="text-emerald-700" /><span className="text-xs font-medium text-center">{label}</span>
                </button>
              ))}
              <button onClick={onLogout} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-rose-50 text-rose-600"><LogOut size={20} /> <span className="text-xs font-medium">{t("common.logout")}</span></button>
            </div>
          </div>
        </div>
      )}

      {/* Header: logo/actions row + horizontal nav row (desktop/tablet only) */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-900/10">
        <div className="px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-slate-700 flex-shrink-0" aria-label="Menu"><Menu size={22} /></button>
            <div className="hidden md:flex items-center gap-2 font-bold text-lg flex-shrink-0" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-sky-800"><Mic size={16} className="text-white" /></span>
              Market<span className="text-emerald-700">Pro</span>
            </div>
            <h2 className="md:hidden font-semibold text-base truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h2>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <div className="hidden lg:block text-right mr-1">
              <div className="text-xs text-slate-400 leading-tight">{entitySub}</div>
              <div className="text-sm font-semibold text-slate-900 leading-tight truncate max-w-[160px]">{entityName}</div>
            </div>
            {headerActions}
            <span className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-emerald-500 to-sky-800 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">{avatar}</span>
            <button onClick={onLogout} title={t("common.logout")} className="hidden md:flex h-9 w-9 items-center justify-center rounded-full text-rose-600 hover:bg-rose-50 flex-shrink-0"><LogOut size={16} /></button>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-1.5 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-3 -mt-0.5" style={{ scrollbarWidth: "thin" }}>
          {navItems.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => onNavigate(key)} className={`flex-shrink-0 flex items-center gap-2 whitespace-nowrap px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${activeKey === key ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 pb-28 md:pb-10">
        <div className="max-w-[1600px] mx-auto">{children}</div>
      </main>

      {mobileExtraNav}
    </div>
  );
}

/* =========================================================================
   MERCHANT WORKSPACE
========================================================================= */

function Workspace({ user, onLogout, onPay, accounts, messages, sendMessage }) {
  const { t, lang, setLang, daysAgoLabel } = useLang();
  const NAV_ITEMS = useMerchantNav();
  const seed = useMemo(() => getSeed(user.seed), []); // eslint-disable-line
  const isOnline = useOnlineStatus();
  const nsKey = (name) => `marketpro:${user.username}:${name}`;

  const [view, setView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [reminderOffsetDays, setReminderOffsetDays] = useState(2);
  const [messagingTarget, setMessagingTarget] = useState(null);

  const [products, setProducts] = usePersistentState(nsKey("products"), seed.products);
  const [clients, setClients] = usePersistentState(nsKey("clients"), seed.clients);
  const [suppliers, setSuppliers] = usePersistentState(nsKey("suppliers"), seed.suppliers);
  const [sales, setSales] = usePersistentState(nsKey("sales"), seed.sales);
  const [purchases, setPurchases] = usePersistentState(nsKey("purchases"), seed.purchases);
  const [expenses, setExpenses] = usePersistentState(nsKey("expenses"), seed.expenses);
  const [debts, setDebts] = usePersistentState(nsKey("debts"), seed.debts);

  // When a real backend is configured, hydrate from it on mount and whenever
  // connectivity returns, then flush anything queued while offline. In local
  // demo mode this effect is a no-op and the usePersistentState values above
  // (already restored from localStorage) are simply kept.
  useEffect(() => {
    if (!isRemoteConfigured || !user.id) return;
    let cancelled = false;

    async function hydrate() {
      await flushOutbox();
      const [p, c, sa, s, pu, ex, de] = await Promise.all([
        api.list("products"), api.list("clients"), api.list("suppliers"),
        api.list("sales"), api.list("purchases"), api.list("expenses"), api.list("debts"),
      ]);
      if (cancelled) return;
      setProducts(p);
      const hasComptant = c.some((cl) => cl.name === "Client comptant");
      setClients(hasComptant ? c : [...c, { id: newId(), name: "Client comptant", phone: "—" }]);
      setSuppliers(sa);
      setSales(s);
      setPurchases(pu);
      setExpenses(ex);
      setDebts(de);
    }
    hydrate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, isOnline]);

  const pushToast = (msg) => { const id = uid(); setToasts((t) => [...t, { id, msg }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500); };

  const revenueToday = useMemo(() => sales.filter((s) => daysAgoFromISO(s.createdAt) === 0).reduce((s, x) => s + x.amount, 0), [sales]);
  const expensesToday = useMemo(() => expenses.filter((e) => daysAgoFromISO(e.createdAt) === 0).reduce((s, x) => s + x.amount, 0), [expenses]);
  const profitToday = useMemo(() => Math.round(revenueToday * 0.32) - expensesToday, [revenueToday, expensesToday]);
  const transactionsToday = useMemo(() => sales.filter((s) => daysAgoFromISO(s.createdAt) === 0).length + purchases.filter((p) => daysAgoFromISO(p.createdAt) === 0).length, [sales, purchases]);
  const lowStock = useMemo(() => products.filter((p) => p.stock <= p.threshold), [products]);
  const weekHistory = useMemo(() => {
    const salesByDaysAgo = {};
    sales.forEach((s) => { const da = daysAgoFromISO(s.createdAt); salesByDaysAgo[da] = (salesByDaysAgo[da] || 0) + s.amount; });
    const past6 = seed.weekHistoryBase.map((base, i) => base + (salesByDaysAgo[6 - i] || 0));
    return [...past6, revenueToday];
  }, [seed, sales, revenueToday]);
  const maxWeek = Math.max(...weekHistory, 1);

  const categoryTotals = useMemo(() => { const t = {}; sales.forEach((s) => { t[s.category] = (t[s.category] || 0) + s.amount; }); return t; }, [sales]);
  const categoryTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0) || 1;

  const paymentTotals = useMemo(() => {
    const totals = {}; PAYMENT_METHODS.forEach((m) => { totals[m.key] = { amount: 0, count: 0 }; });
    sales.forEach((s) => { const key = s.paymentMethod || "especes"; if (!totals[key]) totals[key] = { amount: 0, count: 0 }; totals[key].amount += s.amount; totals[key].count += 1; });
    return totals;
  }, [sales]);
  const paymentGrandTotal = Object.values(paymentTotals).reduce((s, x) => s + x.amount, 0) || 1;

  const openDebts = useMemo(() => debts.filter((d) => d.status !== "reglé"), [debts]);
  const debtsWithStatus = useMemo(() => openDebts.map((d) => {
    const days = daysUntil(d.dueDate);
    const status = days < 0 ? "overdue" : days <= reminderOffsetDays ? "dueSoon" : "upcoming";
    return { ...d, days, computedStatus: status };
  }).sort((a, b) => a.days - b.days), [openDebts, reminderOffsetDays]);
  const totalToCollect = useMemo(() => openDebts.reduce((s, d) => s + d.amount, 0), [openDebts]);
  const overdueDebts = useMemo(() => debtsWithStatus.filter((d) => d.computedStatus === "overdue"), [debtsWithStatus]);
  const remindersNeeded = useMemo(() => debtsWithStatus.filter((d) => d.computedStatus === "overdue" || d.computedStatus === "dueSoon"), [debtsWithStatus]);
  const reminderHistory = useMemo(() => debts.flatMap((d) => (d.reminders || []).map((r) => ({ ...r, clientName: d.clientName }))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8), [debts]);

  const recentActivity = useMemo(() => {
    const items = [
      ...sales.map((s) => ({ id: `s${s.id}`, createdAt: s.createdAt, label: `${t("sales.title")} — ${s.qty} ${s.unit} ${s.product}`, amount: s.amount })),
      ...purchases.map((p) => ({ id: `p${p.id}`, createdAt: p.createdAt, label: `${t("purchases.title")} — ${p.qty} ${p.unit} ${p.product}`, amount: -p.amount })),
      ...expenses.map((e) => ({ id: `e${e.id}`, createdAt: e.createdAt, label: `${t("expenses.title")} — ${e.label}`, amount: -e.amount })),
    ];
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  }, [sales, purchases, expenses, t]);

  const bestSellers = useMemo(() => { const t = {}; sales.forEach((s) => { t[s.product] = (t[s.product] || 0) + s.amount; }); return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 5); }, [sales]);

  const findClientPhone = (name) => clients.find((c) => c.name === name)?.phone || "—";

  const applySale = ({ qty, unit, product, amount, client, paymentMethod, paymentStatus = "paid", amountPaid, amountDue = 0, dueDate }) => {
    const clientName = client || "Client comptant";
    const row = { id: newId(), createdAt: new Date().toISOString(), product, qty, unit: unit || "unités", amount, client: clientName, category: products.find((p) => p.name === product)?.category || "Autre", paymentMethod: paymentMethod || "especes", paymentStatus, amountPaid: amountPaid ?? amount, amountDue };
    setSales((s) => [row, ...s]);
    syncWrite({ type: "create", resource: "sales", body: row });

    const affected = products.find((p) => p.name.toLowerCase().includes(product.toLowerCase().split(" ")[0]));
    setProducts((ps) => ps.map((p) => (p.id === affected?.id ? { ...p, stock: Math.max(0, p.stock - qty) } : p)));
    if (affected) syncWrite({ type: "update", resource: "products", id: affected.id, body: { stock: Math.max(0, affected.stock - qty) } });

    if (amountDue > 0) {
      const debtRow = { id: newId(), clientName, amount: amountDue, dueDate: dueDate || isoDateOffset(7), status: "ouvert", reminders: [] };
      setDebts((d) => [debtRow, ...d]);
      syncWrite({ type: "create", resource: "debts", body: debtRow });
      if (!clients.some((c) => c.name === clientName)) {
        const clientRow = { id: newId(), name: clientName, phone: "—" };
        setClients((c) => [...c, clientRow]);
        syncWrite({ type: "create", resource: "clients", body: clientRow });
      }
    }
    pushToast(t("toasts.saleSaved"));
  };

  const applyPurchase = ({ qty, unit, product, amount, supplier }) => {
    const row = { id: newId(), createdAt: new Date().toISOString(), product, qty, unit: unit || "unités", amount, supplier: supplier || "Fournisseur" };
    setPurchases((s) => [row, ...s]);
    syncWrite({ type: "create", resource: "purchases", body: row });

    const affected = products.find((p) => p.name.toLowerCase().includes(product.toLowerCase().split(" ")[0]));
    setProducts((ps) => ps.map((p) => (p.id === affected?.id ? { ...p, stock: p.stock + qty } : p)));
    if (affected) syncWrite({ type: "update", resource: "products", id: affected.id, body: { stock: affected.stock + qty } });

    pushToast(t("toasts.purchaseSaved"));
  };

  const applyExpense = ({ amount, label, category }) => {
    const row = { id: newId(), createdAt: new Date().toISOString(), label, amount, category: category || "Autre" };
    setExpenses((e) => [row, ...e]);
    syncWrite({ type: "create", resource: "expenses", body: row });
    pushToast(t("toasts.expenseSaved"));
  };

  const applyProduct = ({ name, unit, stock, threshold, price, category }) => {
    const row = { id: newId(), name, unit, stock, threshold, price, category };
    setProducts((p) => [...p, row]);
    syncWrite({ type: "create", resource: "products", body: row });
    pushToast(t("toasts.productAdded"));
  };

  const importProducts = (rows) => {
    const withIds = rows.map((r) => ({ id: newId(), ...r }));
    setProducts((p) => [...p, ...withIds]);
    withIds.forEach((row) => syncWrite({ type: "create", resource: "products", body: row }));
    pushToast(t("stocks.importSuccess", withIds.length));
  };

  const applyClient = ({ name, phone }) => {
    const row = { id: newId(), name, phone };
    setClients((c) => [...c, row]);
    syncWrite({ type: "create", resource: "clients", body: row });
    pushToast(t("toasts.clientAdded"));
  };

  const applySupplier = ({ name, phone }) => {
    const row = { id: newId(), name, phone, balance: 0 };
    setSuppliers((s) => [...s, row]);
    syncWrite({ type: "create", resource: "suppliers", body: row });
    pushToast(t("toasts.supplierAdded"));
  };

  const applyDebt = ({ clientName, amount, dueDate }) => {
    const row = { id: newId(), clientName, amount, dueDate, status: "ouvert", reminders: [] };
    setDebts((d) => [row, ...d]);
    syncWrite({ type: "create", resource: "debts", body: row });
    if (!clients.some((c) => c.name === clientName)) {
      const clientRow = { id: newId(), name: clientName, phone: "—" };
      setClients((c) => [...c, clientRow]);
      syncWrite({ type: "create", resource: "clients", body: clientRow });
    }
    pushToast(t("credits.debtAdded"));
  };

  const settleDebt = (debtId) => {
    const debt = debts.find((d) => d.id === debtId);
    setDebts((d) => d.map((x) => (x.id === debtId ? { ...x, status: "reglé" } : x)));
    syncWrite({ type: "update", resource: "debts", id: debtId, body: { status: "reglé" } });
    if (debt) pushToast(t("credits.settledToast", debt.clientName));
  };

  const sendReminder = (debtId) => {
    const debt = debts.find((d) => d.id === debtId);
    if (!debt) return;
    const newReminders = [...(debt.reminders || []), { id: newId(), createdAt: new Date().toISOString(), phone: findClientPhone(debt.clientName) }];
    setDebts((d) => d.map((x) => (x.id === debtId ? { ...x, reminders: newReminders } : x)));
    syncWrite({ type: "update", resource: "debts", id: debtId, body: { reminders: newReminders } });
    pushToast(t("credits.reminderSent", debt.clientName));
  };
  const sendAllReminders = () => {
    const ids = remindersNeeded.map((d) => d.id);
    setDebts((d) => d.map((x) => {
      if (!ids.includes(x.id)) return x;
      const newReminders = [...(x.reminders || []), { id: newId(), createdAt: new Date().toISOString(), phone: findClientPhone(x.clientName) }];
      syncWrite({ type: "update", resource: "debts", id: x.id, body: { reminders: newReminders } });
      return { ...x, reminders: newReminders };
    }));
    pushToast(t("credits.allSent", ids.length));
  };

  const handleVoiceCommand = (rawText) => {
    const ctx = { products, profitToday, revenueToday, debts: openDebts, t };
    const result = parseVoiceCommand(rawText, ctx);
    if (result.type === "sale") applySale(result.payload);
    if (result.type === "purchase") applyPurchase(result.payload);
    if (result.type === "expense") applyExpense(result.payload);
    return result;
  };

  const goTo = (key) => { setView(key); setSidebarOpen(false); setMoreOpen(false); };
  const goToMessaging = (username) => { setMessagingTarget(username); setView("messagerie"); };
  const pageTitle = NAV_ITEMS.find((n) => n.key === view)?.label || "";
  const moreItems = NAV_ITEMS.filter((n) => !["dashboard", "ventes", "stocks"].includes(n.key));

  const BOTTOM_NAV = [
    { key: "dashboard", label: t("bottomNav.home"), Icon: LayoutDashboard },
    { key: "ventes", label: t("nav.ventes"), Icon: ShoppingCart },
    { key: "__mic__", label: t("bottomNav.talk"), Icon: Mic },
    { key: "stocks", label: t("nav.stocks"), Icon: Package },
    { key: "__more__", label: t("bottomNav.more"), Icon: MoreHorizontal },
  ];

  if (user.billing?.status === "expired") {
    return <SubscriptionLockedScreen user={user} onPay={onPay} onLogout={onLogout} />;
  }

  return (
    <AppShell
      navItems={NAV_ITEMS} activeKey={view} onNavigate={goTo} title={pageTitle}
      avatar={user.avatar} entityName={user.boutique} entitySub={t("common.shop")} onLogout={onLogout}
      sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} moreOpen={moreOpen} setMoreOpen={setMoreOpen} moreItems={moreItems}
      headerActions={
        <>
          {!isOnline && (
            <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 px-3 py-1.5 text-xs font-semibold flex-shrink-0" title={t("common.offlineHint")}>
              <WifiOff size={13} /> {t("common.offline")}
            </span>
          )}
          <button className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-200/60 text-slate-600" aria-label={t("common.search")}><Search size={17} /></button>
          <button className="relative h-9 w-9 flex items-center justify-center rounded-full hover:bg-slate-200/60 text-slate-600" aria-label={t("common.notifications")}><Bell size={17} /><span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-rose-500" /></button>
          <button onClick={() => setVoiceOpen(true)} className="hidden sm:inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-600 to-sky-800 text-white px-4 py-2 text-sm font-semibold shadow-md shadow-emerald-600/25 hover:-translate-y-0.5 transition-transform"><Mic size={15} /> {t("common.talk")}</button>
        </>
      }
      mobileExtraNav={
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-900/10 px-2 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5 items-end">
            {BOTTOM_NAV.map(({ key, label, Icon }) => {
              if (key === "__mic__") return (
                <button key={key} onClick={() => setVoiceOpen(true)} className="flex flex-col items-center -mt-6">
                  <span className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-600/40 ring-4 ring-slate-50"><Icon size={22} className="text-white" /></span>
                  <span className="text-[10px] mt-1 font-medium text-emerald-700">{label}</span>
                </button>
              );
              if (key === "__more__") return (
                <button key={key} onClick={() => setMoreOpen(true)} className="flex flex-col items-center py-3 gap-1 text-slate-500"><Icon size={20} /><span className="text-[10px] font-medium">{label}</span></button>
              );
              const active = view === key;
              return <button key={key} onClick={() => goTo(key)} className={`flex flex-col items-center py-3 gap-1 ${active ? "text-emerald-700" : "text-slate-500"}`}><Icon size={20} /><span className="text-[10px] font-medium">{label}</span></button>;
            })}
          </div>
        </nav>
      }
    >
      <TrialBanner billing={user.billing} onOpenBilling={() => goTo("abonnement")} />
      {view === "dashboard" && <DashboardView revenueToday={revenueToday} profitToday={profitToday} transactionsToday={transactionsToday} lowStock={lowStock} weekHistory={weekHistory} maxWeek={maxWeek} categoryTotals={categoryTotals} categoryTotal={categoryTotal} recentActivity={recentActivity} debtsWithStatus={debtsWithStatus} onVoice={() => setVoiceOpen(true)} userFirstName={user.boutique.split(" ").slice(-1)[0]} daysAgoLabel={daysAgoLabel} />}
      {view === "ventes" && <VentesView sales={sales} onAdd={() => setModal("sale")} daysAgoLabel={daysAgoLabel} />}
      {view === "stocks" && <StocksView products={products} onAdd={() => setModal("product")} onImport={importProducts} />}
      {view === "achats" && <AchatsView purchases={purchases} onAdd={() => setModal("purchase")} daysAgoLabel={daysAgoLabel} />}
      {view === "clients" && <ClientsView clients={clients} debts={openDebts} onAdd={() => setModal("client")} />}
      {view === "fournisseurs" && <FournisseursView suppliers={suppliers} onAdd={() => setModal("supplier")} />}
      {view === "depenses" && <DepensesView expenses={expenses} onAdd={() => setModal("expense")} daysAgoLabel={daysAgoLabel} />}
      {view === "paiements" && <PaiementsView paymentTotals={paymentTotals} paymentGrandTotal={paymentGrandTotal} />}
      {view === "credits" && (
        <CreditsView
          debtsWithStatus={debtsWithStatus} totalToCollect={totalToCollect} overdueCount={overdueDebts.length}
          reminderOffsetDays={reminderOffsetDays} setReminderOffsetDays={setReminderOffsetDays}
          remindersNeeded={remindersNeeded} onSendReminder={sendReminder} onSendAll={sendAllReminders}
          onSettle={settleDebt} onAdd={() => setModal("debt")} reminderHistory={reminderHistory} daysAgoLabel={daysAgoLabel}
        />
      )}
      {view === "messagerie" && <MessagingView currentUsername={accountKey(user)} accounts={accounts} messages={messages} sendMessage={sendMessage} initialContact={messagingTarget} />}
      {view === "rapports" && <RapportsView bestSellers={bestSellers} revenueToday={revenueToday} profitToday={profitToday} expensesToday={expensesToday} categoryTotals={categoryTotals} categoryTotal={categoryTotal} />}
      {view === "abonnement" && <BillingView user={user} onPay={onPay} />}
      {view === "parametres" && <ParametresView user={user} lang={lang} setLang={setLang} />}

      <VoiceOverlay open={voiceOpen} onClose={() => setVoiceOpen(false)} onCommand={handleVoiceCommand} />
      <SaleModal open={modal === "sale"} onClose={() => setModal(null)} products={products} clients={clients} onSubmit={applySale} />
      <PurchaseModal open={modal === "purchase"} onClose={() => setModal(null)} products={products} suppliers={suppliers} onSubmit={applyPurchase} />
      <ProductModal open={modal === "product"} onClose={() => setModal(null)} onSubmit={applyProduct} />
      <ContactModal open={modal === "client"} onClose={() => setModal(null)} title={t("common.newClient")} onSubmit={applyClient} />
      <ContactModal open={modal === "supplier"} onClose={() => setModal(null)} title={t("common.newSupplier")} onSubmit={applySupplier} />
      <ExpenseModal open={modal === "expense"} onClose={() => setModal(null)} onSubmit={applyExpense} />
      <DebtModal open={modal === "debt"} onClose={() => setModal(null)} clients={clients} onSubmit={applyDebt} />

      <div className="fixed bottom-24 md:bottom-6 right-4 sm:right-6 z-[110] space-y-2">
        {toasts.map((toast) => <div key={toast.id} className="flex items-center gap-2.5 rounded-xl bg-slate-950 text-white text-sm px-4 py-3 shadow-xl"><CheckCircle2 size={16} className="text-lime-400" /> {toast.msg}</div>)}
      </div>
    </AppShell>
  );
}

/* =========================================================================
   SUPPLIER WORKSPACE
========================================================================= */

function SupplierWorkspace({ user, onLogout, onPay, accounts, messages, sendMessage }) {
  const { t } = useLang();
  const NAV_ITEMS = useSupplierNav();
  const isOnline = useOnlineStatus();
  const [view, setView] = useState("annuaire");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [messagingTarget, setMessagingTarget] = useState(null);

  const goTo = (key) => { setView(key); setSidebarOpen(false); setMoreOpen(false); };
  const goToMessaging = (username) => { setMessagingTarget(username); setView("messagerie"); };
  const pageTitle = NAV_ITEMS.find((n) => n.key === view)?.label || "";

  if (user.billing?.status === "expired") {
    return <SubscriptionLockedScreen user={user} onPay={onPay} onLogout={onLogout} />;
  }

  return (
    <AppShell
      navItems={NAV_ITEMS} activeKey={view} onNavigate={goTo} title={pageTitle}
      avatar={user.avatar} entityName={user.company} entitySub="Fournisseur" onLogout={onLogout}
      sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} moreOpen={moreOpen} setMoreOpen={setMoreOpen} moreItems={NAV_ITEMS}
      headerActions={
        <>
          {!isOnline && (
            <span className="hidden sm:flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 px-3 py-1.5 text-xs font-semibold flex-shrink-0" title={t("common.offlineHint")}>
              <WifiOff size={13} /> {t("common.offline")}
            </span>
          )}
          <button className="relative h-9 w-9 flex items-center justify-center rounded-full hover:bg-slate-200/60 text-slate-600" aria-label={t("common.notifications")}><Bell size={17} /></button>
        </>
      }
      mobileExtraNav={
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-900/10 px-2 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-3 items-end">
            {NAV_ITEMS.map(({ key, label, Icon }) => {
              const active = view === key;
              return <button key={key} onClick={() => goTo(key)} className={`flex flex-col items-center py-3 gap-1 ${active ? "text-emerald-700" : "text-slate-500"}`}><Icon size={20} /><span className="text-[10px] font-medium">{label}</span></button>;
            })}
          </div>
        </nav>
      }
    >
      <TrialBanner billing={user.billing} onOpenBilling={() => goTo("abonnement")} />
      {view === "annuaire" && <DirectoryView accounts={accounts} onContact={goToMessaging} />}
      {view === "messagerie" && <MessagingView currentUsername={accountKey(user)} accounts={accounts} messages={messages} sendMessage={sendMessage} initialContact={messagingTarget} />}
      {view === "abonnement" && <BillingView user={user} onPay={onPay} />}
      {view === "parametres" && <SupplierSettingsView user={user} />}
    </AppShell>
  );
}

function SupplierSettingsView({ user }) {
  const { t, lang, setLang } = useLang();
  const langs = [{ code: "fr", label: "Français" }, { code: "en", label: "English" }, { code: "wo", label: "Wolof" }, { code: "bm", label: "Bambara" }, { code: "dy", label: "Dioula" }];
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
        <h4 className="font-semibold text-sm text-slate-900 mb-4">{t("login.companyName")}</h4>
        <Field label={t("login.companyName")}><input defaultValue={user.company} className={inputCls} /></Field>
        <Field label={t("settings.city")}><input defaultValue={user.city} className={inputCls} /></Field>
        <Field label={t("settings.phone")}><input defaultValue={user.phone || ""} className={inputCls} /></Field>
      </div>
      <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
        <h4 className="font-semibold text-sm text-slate-900 mb-1">{t("settings.voiceLanguage")}</h4>
        <p className="text-xs text-slate-500 mb-4">{t("settings.voiceLanguageHint")}</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {langs.map((l) => (
            <button key={l.code} onClick={() => setLang(l.code)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border transition-colors ${lang === l.code ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-900/15 text-slate-600 hover:border-slate-900/40"}`}><Globe2 size={14} /> {l.label} {BETA_LANGS.includes(l.code) && <span className="text-[10px] opacity-75">· Bêta</span>}</button>
          ))}
        </div>
        {BETA_LANGS.includes(lang) && <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{t("settings.betaNote")}</p>}
      </div>
      <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
        <h4 className="font-semibold text-sm text-slate-900 mb-1">{t("settings.account")}</h4>
        <p className="text-xs text-slate-500">{t("settings.loggedInAs")} <span className="font-medium text-slate-700">{user.username}</span></p>
      </div>
    </div>
  );
}

/* =========================================================================
   VIEWS — dashboard / sales / stocks / purchases / clients / suppliers / expenses / payments / reports / settings
========================================================================= */

function DashboardView({ revenueToday, profitToday, transactionsToday, lowStock, weekHistory, maxWeek, categoryTotals, categoryTotal, recentActivity, debtsWithStatus, onVoice, userFirstName, daysAgoLabel }) {
  const { t } = useLang();
  const alertDebts = debtsWithStatus.filter((d) => d.computedStatus === "overdue" || d.computedStatus === "dueSoon").slice(0, 4);
  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-gradient-to-br from-slate-950 to-emerald-950 text-white p-6 sm:p-7 flex flex-wrap items-center justify-between gap-5">
        <div>
          <div className="text-sm text-white/60 mb-1">{t("dashboard.greetingWord")}, {userFirstName} 👋</div>
          <h3 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{t("dashboard.subtitle")}</h3>
        </div>
        <button onClick={onVoice} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold hover:bg-emerald-500"><Mic size={16} /> {t("common.talkToMarketPro")}</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("dashboard.revenueToday")} value={fmt(revenueToday)} delta={t("dashboard.updatedLive")} icon={TrendingUp} />
        <StatCard label={t("dashboard.profitToday")} value={fmt(profitToday)} delta={t("dashboard.marginEstimate")} icon={Sparkles} />
        <StatCard label={t("dashboard.transactionsToday")} value={fmtNum(transactionsToday)} delta={t("dashboard.salesPlusPurchases")} icon={Receipt} />
        <StatCard label={t("dashboard.lowStockCard")} value={fmtNum(lowStock.length)} delta={lowStock.length ? lowStock.map((p) => p.name).join(", ") : t("dashboard.allGood")} deltaTone={lowStock.length ? "warn" : "up"} icon={AlertTriangle} />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
        <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
          <h4 className="text-sm font-semibold text-slate-500 mb-5">{t("dashboard.salesEvolution")}</h4>
          <div className="flex items-end gap-3 h-40">
            {weekHistory.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full rounded-t-md bg-gradient-to-b from-emerald-500 to-emerald-700" style={{ height: `${Math.max(6, (v / maxWeek) * 130)}px` }} />
                <span className="text-[10px] text-slate-400">{i === weekHistory.length - 1 ? "•" : `J-${weekHistory.length - 1 - i}`}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
          <h4 className="text-sm font-semibold text-slate-500 mb-5">{t("dashboard.salesByCategory")}</h4>
          <div className="flex items-center gap-5">
            <div className="h-24 w-24 rounded-full flex-shrink-0 relative" style={{ background: donutGradient(categoryTotals, categoryTotal) }}><div className="absolute inset-5 rounded-full bg-white" /></div>
            <div className="text-xs text-slate-600 flex flex-col gap-2">
              {Object.entries(categoryTotals).map(([cat, val]) => <span key={cat} className="flex items-center gap-2"><i className="inline-block w-2 h-2 rounded-sm" style={{ background: CATEGORY_COLORS[cat] || CATEGORY_COLORS.Autre }} />{cat} — {Math.round((val / categoryTotal) * 100)}%</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
          <h4 className="text-sm font-semibold text-slate-500 mb-4">{t("dashboard.recentActivity")}</h4>
          <ul className="divide-y divide-slate-100">
            {recentActivity.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                <div><div className="text-slate-800">{a.label}</div><div className="text-xs text-slate-400">{daysAgoLabel(daysAgoFromISO(a.createdAt))}</div></div>
                <span className={`font-mono text-sm ${a.amount >= 0 ? "text-emerald-700" : "text-slate-500"}`}>{a.amount >= 0 ? "+" : ""}{fmtNum(a.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
          <h4 className="text-sm font-semibold text-slate-500 mb-4">{t("dashboard.alerts")}</h4>
          <div className="space-y-3">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3">
                <div className="flex items-center gap-2.5 text-sm text-amber-800"><AlertTriangle size={16} /> {t("dashboard.lowStockAlert")} : {p.name}</div>
                <Badge tone="amber">{p.stock} {p.unit}</Badge>
              </div>
            ))}
            {alertDebts.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-sky-50 px-4 py-3">
                <div className="flex items-center gap-2.5 text-sm text-sky-800"><Users size={16} /> {d.clientName} {t("dashboard.debtorAlert")} {fmt(d.amount)}</div>
                <Badge tone={d.computedStatus === "overdue" ? "red" : "amber"}>{d.computedStatus === "overdue" ? t("dashboard.overdueAlert") : formatDate(d.dueDate)}</Badge>
              </div>
            ))}
            {!lowStock.length && !alertDebts.length && <EmptyState text={t("dashboard.noAlerts")} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function donutGradient(totals, total) {
  let acc = 0;
  const parts = Object.entries(totals).map(([cat, val]) => { const start = (acc / total) * 100; acc += val; const end = (acc / total) * 100; return `${CATEGORY_COLORS[cat] || CATEGORY_COLORS.Autre} ${start}% ${end}%`; });
  return `conic-gradient(${parts.join(", ")})`;
}

function VentesView({ sales, onAdd, daysAgoLabel }) {
  const { t } = useLang();
  return (
    <div>
      <PageHeader title={t("sales.title")} subtitle={t("sales.subtitleCount", sales.length)} action={<PrimaryButton onClick={onAdd}>{t("common.newSale")}</PrimaryButton>} />
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-900/10 bg-white">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-900/10"><th className="px-5 py-3.5 font-medium">{t("sales.product")}</th><th className="px-5 py-3.5 font-medium">{t("sales.quantity")}</th><th className="px-5 py-3.5 font-medium">{t("sales.client")}</th><th className="px-5 py-3.5 font-medium">{t("sales.payment")}</th><th className="px-5 py-3.5 font-medium">{t("sales.amount")}</th><th className="px-5 py-3.5 font-medium">{t("sales.when")}</th></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{s.product}</td>
                <td className="px-5 py-3.5 text-slate-600">{s.qty} {s.unit}</td>
                <td className="px-5 py-3.5 text-slate-600">{s.client}</td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-col gap-1 items-start">
                    <PaymentBadge methodKey={s.paymentMethod} />
                    {s.paymentStatus === "credit" && <Badge tone="amber">{t("sales.creditBadge")}</Badge>}
                    {s.paymentStatus === "partial" && <Badge tone="amber">{t("sales.partialBadge", fmt(s.amountDue))}</Badge>}
                  </div>
                </td>
                <td className="px-5 py-3.5 font-mono text-emerald-700">{fmt(s.amount)}</td>
                <td className="px-5 py-3.5 text-slate-400">{daysAgoLabel(daysAgoFromISO(s.createdAt))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-3">
        {sales.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-900/10 bg-white p-4">
            <div className="flex justify-between items-start mb-1.5"><span className="font-semibold text-sm text-slate-900">{s.product}</span><span className="font-mono text-sm text-emerald-700">{fmt(s.amount)}</span></div>
            <div className="text-xs text-slate-500 mb-2">{s.qty} {s.unit} · {s.client}</div>
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <PaymentBadge methodKey={s.paymentMethod} />
                {s.paymentStatus === "credit" && <Badge tone="amber">{t("sales.creditBadge")}</Badge>}
                {s.paymentStatus === "partial" && <Badge tone="amber">{t("sales.partialBadge", fmt(s.amountDue))}</Badge>}
              </div>
              <span className="text-xs text-slate-400">{daysAgoLabel(daysAgoFromISO(s.createdAt))}</span>
            </div>
          </div>
        ))}
      </div>
      {!sales.length && <EmptyState text={t("sales.empty")} />}
    </div>
  );
}

/* =========================================================================
   STOCK IMPORT / EXPORT — plain CSV, no external library needed
========================================================================= */
const STOCK_CSV_HEADERS = ["nom", "unité", "stock", "seuil", "prix", "catégorie"];

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip, \n follows */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toCSVField(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function rowsToCSV(rows) { return rows.map((r) => r.map(toCSVField).join(",")).join("\n"); }

function downloadCSV(filename, rows) {
  const blob = new Blob([rowsToCSV(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function productsToCSVRows(products) {
  return [STOCK_CSV_HEADERS, ...products.map((p) => [p.name, p.unit, p.stock, p.threshold, p.price, p.category])];
}

function csvTextToProducts(text) {
  const rows = parseCSV(text);
  const dataRows = rows.length && rows[0].some((c) => /nom|name/i.test(c)) ? rows.slice(1) : rows;
  return dataRows
    .map((cols) => ({
      name: (cols[0] || "").trim(),
      unit: (cols[1] || "unités").trim(),
      stock: Number(cols[2]) || 0,
      threshold: Number(cols[3]) || 0,
      price: Number(cols[4]) || 0,
      category: (cols[5] || "Autre").trim(),
    }))
    .filter((p) => p.name);
}

function ImportStockModal({ open, onClose, onImport }) {
  const { t } = useLang();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => { if (open) { setFileName(""); setRows([]); setError(""); } }, [open]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = csvTextToProducts(String(reader.result || ""));
        if (!parsed.length) { setError(t("stocks.importError")); setRows([]); return; }
        setRows(parsed);
      } catch (e) {
        setError(t("stocks.importError")); setRows([]);
      }
    };
    reader.onerror = () => setError(t("stocks.importError"));
    reader.readAsText(file);
  };

  const confirm = () => { if (!rows.length) return; onImport(rows); onClose(); };

  return (
    <Modal open={open} onClose={onClose} title={t("stocks.importTitle")}>
      <p className="text-xs text-slate-500 mb-4">{t("stocks.importInstructions")}</p>
      <button
        type="button"
        onClick={() => downloadCSV("modele-stock-marketpro.csv", [STOCK_CSV_HEADERS, ["Riz 50kg", "sacs", "20", "10", "25000", "Alimentation"]])}
        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 mb-5"
      >
        <Download size={13} /> {t("stocks.downloadTemplate")}
      </button>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-900/15 hover:border-emerald-600 py-8 text-slate-500 hover:text-emerald-700 transition-colors"
      >
        <Upload size={22} />
        <span className="text-sm font-medium">{fileName || t("stocks.chooseFile")}</span>
      </button>
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />

      {error && <p className="text-xs text-rose-600 mt-4">{error}</p>}
      {rows.length > 0 && <p className="text-xs text-emerald-700 mt-4 flex items-center gap-1.5"><CheckCircle2 size={14} /> {t("stocks.importPreview", rows.length)}</p>}

      <button
        type="button" disabled={!rows.length} onClick={confirm}
        className="w-full mt-5 rounded-full bg-emerald-600 text-white py-3 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
      >
        {t("stocks.confirmImport")}
      </button>
    </Modal>
  );
}

function StocksView({ products, onAdd, onImport }) {
  const { t } = useLang();
  const [importOpen, setImportOpen] = useState(false);
  return (
    <div>
      <PageHeader
        title={t("stocks.title")} subtitle={t("stocks.subtitleCount", products.length)}
        action={
          <div className="flex flex-wrap gap-2.5">
            <button onClick={() => downloadCSV(`stock-marketpro-${new Date().toISOString().slice(0, 10)}.csv`, productsToCSVRows(products))} className="inline-flex items-center gap-2 rounded-full border border-slate-900/15 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-900/30">
              <Download size={15} /> {t("stocks.exportButton")}
            </button>
            <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-slate-900/15 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-900/30">
              <Upload size={15} /> {t("stocks.importButton")}
            </button>
            <PrimaryButton onClick={onAdd}>{t("common.addProduct")}</PrimaryButton>
          </div>
        }
      />
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-900/10 bg-white">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-900/10"><th className="px-5 py-3.5 font-medium">{t("stocks.product")}</th><th className="px-5 py-3.5 font-medium">{t("stocks.category")}</th><th className="px-5 py-3.5 font-medium">{t("stocks.stock")}</th><th className="px-5 py-3.5 font-medium">{t("stocks.unitPrice")}</th><th className="px-5 py-3.5 font-medium">{t("stocks.status")}</th></tr></thead>
          <tbody>
            {products.map((p) => {
              const low = p.stock <= p.threshold;
              const pct = Math.min(100, Math.round((p.stock / (p.threshold * 3)) * 100));
              return (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3.5 font-medium text-slate-800">{p.name}</td>
                  <td className="px-5 py-3.5 text-slate-600">{p.category}</td>
                  <td className="px-5 py-3.5 text-slate-600 w-40"><div className="flex items-center gap-2"><div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${low ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${pct}%` }} /></div><span className="text-xs">{p.stock} {p.unit}</span></div></td>
                  <td className="px-5 py-3.5 font-mono text-slate-700">{fmt(p.price)}</td>
                  <td className="px-5 py-3.5">{low ? <Badge tone="amber">{t("common.lowStock")}</Badge> : <Badge tone="green">{t("common.ok")}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-3">
        {products.map((p) => { const low = p.stock <= p.threshold; return (
          <div key={p.id} className="rounded-2xl border border-slate-900/10 bg-white p-4">
            <div className="flex justify-between items-start mb-1.5"><span className="font-semibold text-sm text-slate-900">{p.name}</span>{low ? <Badge tone="amber">{t("common.lowStock")}</Badge> : <Badge tone="green">{t("common.ok")}</Badge>}</div>
            <div className="text-xs text-slate-500">{p.category} · {p.stock} {p.unit} · {fmt(p.price)}</div>
          </div>
        ); })}
      </div>
      {!products.length && <EmptyState text="—" />}
      <ImportStockModal open={importOpen} onClose={() => setImportOpen(false)} onImport={onImport} />
    </div>
  );
}

function AchatsView({ purchases, onAdd, daysAgoLabel }) {
  const { t } = useLang();
  return (
    <div>
      <PageHeader title={t("purchases.title")} subtitle={t("purchases.subtitleCount", purchases.length)} action={<PrimaryButton onClick={onAdd}>{t("common.newPurchase")}</PrimaryButton>} />
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-900/10 bg-white">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-900/10"><th className="px-5 py-3.5 font-medium">{t("purchases.product")}</th><th className="px-5 py-3.5 font-medium">{t("purchases.quantity")}</th><th className="px-5 py-3.5 font-medium">{t("purchases.supplier")}</th><th className="px-5 py-3.5 font-medium">{t("purchases.amount")}</th><th className="px-5 py-3.5 font-medium">{t("purchases.when")}</th></tr></thead>
          <tbody>{purchases.map((p) => (
            <tr key={p.id} className="border-b border-slate-50 last:border-0">
              <td className="px-5 py-3.5 font-medium text-slate-800">{p.product}</td><td className="px-5 py-3.5 text-slate-600">{p.qty} {p.unit}</td><td className="px-5 py-3.5 text-slate-600">{p.supplier}</td><td className="px-5 py-3.5 font-mono text-sky-800">{fmt(p.amount)}</td><td className="px-5 py-3.5 text-slate-400">{daysAgoLabel(daysAgoFromISO(p.createdAt))}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="md:hidden space-y-3">{purchases.map((p) => (
        <div key={p.id} className="rounded-2xl border border-slate-900/10 bg-white p-4">
          <div className="flex justify-between items-start mb-1.5"><span className="font-semibold text-sm text-slate-900">{p.product}</span><span className="font-mono text-sm text-sky-800">{fmt(p.amount)}</span></div>
          <div className="text-xs text-slate-500">{p.qty} {p.unit} · {p.supplier}</div>
        </div>
      ))}</div>
      {!purchases.length && <EmptyState text={t("purchases.empty")} />}
    </div>
  );
}

function ClientsView({ clients, debts, onAdd }) {
  const { t } = useLang();
  const balanceFor = (name) => debts.filter((d) => d.clientName === name).reduce((s, d) => s + d.amount, 0);
  return (
    <div>
      <PageHeader title={t("clients.title")} subtitle={t("clients.subtitleCount", clients.length)} action={<PrimaryButton onClick={onAdd}>{t("common.newClient")}</PrimaryButton>} />
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-900/10 bg-white">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-900/10"><th className="px-5 py-3.5 font-medium">{t("clients.name")}</th><th className="px-5 py-3.5 font-medium">{t("clients.phone")}</th><th className="px-5 py-3.5 font-medium">{t("clients.balance")}</th></tr></thead>
          <tbody>{clients.map((c) => { const bal = balanceFor(c.name); return (
            <tr key={c.id} className="border-b border-slate-50 last:border-0">
              <td className="px-5 py-3.5 font-medium text-slate-800">{c.name}</td><td className="px-5 py-3.5 text-slate-600">{c.phone}</td>
              <td className="px-5 py-3.5">{bal > 0 ? <Badge tone="amber">{fmt(bal)} {t("common.due")}</Badge> : <Badge tone="green">{t("common.upToDate")}</Badge>}</td>
            </tr>
          ); })}</tbody>
        </table>
      </div>
      <div className="md:hidden space-y-3">{clients.map((c) => { const bal = balanceFor(c.name); return (
        <div key={c.id} className="rounded-2xl border border-slate-900/10 bg-white p-4">
          <div className="flex justify-between items-start mb-1.5"><span className="font-semibold text-sm text-slate-900">{c.name}</span>{bal > 0 ? <Badge tone="amber">{fmt(bal)}</Badge> : <Badge tone="green">{t("common.upToDate")}</Badge>}</div>
          <div className="text-xs text-slate-500">{c.phone}</div>
        </div>
      ); })}</div>
    </div>
  );
}

function FournisseursView({ suppliers, onAdd }) {
  const { t } = useLang();
  return (
    <div>
      <PageHeader title={t("suppliers.title")} subtitle={t("suppliers.subtitleCount", suppliers.length)} action={<PrimaryButton onClick={onAdd}>{t("common.newSupplier")}</PrimaryButton>} />
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-900/10 bg-white">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-900/10"><th className="px-5 py-3.5 font-medium">{t("suppliers.name")}</th><th className="px-5 py-3.5 font-medium">{t("suppliers.phone")}</th><th className="px-5 py-3.5 font-medium">{t("suppliers.balanceDue")}</th></tr></thead>
          <tbody>{suppliers.map((s) => (
            <tr key={s.id} className="border-b border-slate-50 last:border-0"><td className="px-5 py-3.5 font-medium text-slate-800">{s.name}</td><td className="px-5 py-3.5 text-slate-600">{s.phone}</td><td className="px-5 py-3.5">{s.balance > 0 ? <Badge tone="red">{fmt(s.balance)}</Badge> : <Badge tone="green">{t("common.settled")}</Badge>}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <div className="md:hidden space-y-3">{suppliers.map((s) => (
        <div key={s.id} className="rounded-2xl border border-slate-900/10 bg-white p-4"><div className="flex justify-between items-start mb-1.5"><span className="font-semibold text-sm text-slate-900">{s.name}</span>{s.balance > 0 ? <Badge tone="red">{fmt(s.balance)}</Badge> : <Badge tone="green">{t("common.settled")}</Badge>}</div><div className="text-xs text-slate-500">{s.phone}</div></div>
      ))}</div>
    </div>
  );
}

function DepensesView({ expenses, onAdd, daysAgoLabel }) {
  const { t } = useLang();
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  return (
    <div>
      <PageHeader title={t("expenses.title")} subtitle={t("expenses.total", fmt(total))} action={<PrimaryButton onClick={onAdd}>{t("common.newExpense")}</PrimaryButton>} />
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-900/10 bg-white">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-900/10"><th className="px-5 py-3.5 font-medium">{t("expenses.label")}</th><th className="px-5 py-3.5 font-medium">{t("expenses.category")}</th><th className="px-5 py-3.5 font-medium">{t("expenses.amount")}</th><th className="px-5 py-3.5 font-medium">{t("expenses.when")}</th></tr></thead>
          <tbody>{expenses.map((e) => (
            <tr key={e.id} className="border-b border-slate-50 last:border-0"><td className="px-5 py-3.5 font-medium text-slate-800">{e.label}</td><td className="px-5 py-3.5 text-slate-600">{e.category}</td><td className="px-5 py-3.5 font-mono text-rose-600">{fmt(e.amount)}</td><td className="px-5 py-3.5 text-slate-400">{daysAgoLabel(daysAgoFromISO(e.createdAt))}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <div className="md:hidden space-y-3">{expenses.map((e) => (
        <div key={e.id} className="rounded-2xl border border-slate-900/10 bg-white p-4"><div className="flex justify-between items-start mb-1.5"><span className="font-semibold text-sm text-slate-900">{e.label}</span><span className="font-mono text-sm text-rose-600">{fmt(e.amount)}</span></div><div className="text-xs text-slate-500">{e.category} · {daysAgoLabel(daysAgoFromISO(e.createdAt))}</div></div>
      ))}</div>
    </div>
  );
}

function PaiementsView({ paymentTotals, paymentGrandTotal }) {
  const { t } = useLang();
  return (
    <div className="space-y-8">
      <PageHeader title={t("payments.title")} subtitle={t("payments.subtitle")} />
      <div>
        <h4 className="text-sm font-semibold text-slate-500 mb-4">{t("payments.connected")}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {PAYMENT_METHODS.map((m) => (
            <div key={m.key} className="rounded-2xl border border-slate-900/10 bg-white p-5 flex flex-col items-center text-center gap-3">
              <span className="h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-sm" style={{ background: m.color, color: m.text }}>{m.mark}</span>
              <span className="text-sm font-semibold text-slate-900">{t(`paymentMethods.${m.key}`)}</span>
              <Badge tone="green">{t("payments.connectedTag")}</Badge>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
        <h4 className="text-sm font-semibold text-slate-500 mb-5">{t("payments.breakdown")}</h4>
        <div className="space-y-4">
          {PAYMENT_METHODS.map((m) => {
            const stats = paymentTotals[m.key] || { amount: 0, count: 0 };
            const pct = Math.round((stats.amount / paymentGrandTotal) * 100);
            return (
              <div key={m.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <PaymentBadge methodKey={m.key} size="lg" />
                  <div className="text-right"><div className="font-mono text-sm font-semibold text-slate-900">{fmt(stats.amount)}</div><div className="text-xs text-slate-400">{t("payments.transactionsCount", stats.count)} · {pct}%</div></div>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.color }} /></div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100"><span className="text-sm font-semibold text-slate-700">{t("payments.total")}</span><span className="font-mono text-lg font-bold text-slate-900">{fmt(paymentGrandTotal)}</span></div>
      </div>
    </div>
  );
}

function CreditsView({ debtsWithStatus, totalToCollect, overdueCount, reminderOffsetDays, setReminderOffsetDays, remindersNeeded, onSendReminder, onSendAll, onSettle, onAdd, reminderHistory, daysAgoLabel }) {
  const { t } = useLang();
  const clientsConcerned = new Set(debtsWithStatus.map((d) => d.clientName)).size;

  const statusBadge = (d) => {
    if (d.computedStatus === "overdue") return <Badge tone="red">{t("credits.statusOverdue", Math.abs(d.days))}</Badge>;
    if (d.computedStatus === "dueSoon") return <Badge tone="amber">{t("credits.statusDueSoon")}</Badge>;
    return <Badge tone="slate">{t("credits.statusUpcoming")}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("credits.title")} subtitle={t("credits.subtitle")} action={<PrimaryButton onClick={onAdd}>{t("credits.newDebt")}</PrimaryButton>} />

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label={t("credits.totalToCollect")} value={fmt(totalToCollect)} icon={Coins} />
        <StatCard label={t("credits.clientsConcerned")} value={fmtNum(clientsConcerned)} icon={Users} />
        <StatCard label={t("credits.overdueCount")} value={fmtNum(overdueCount)} icon={AlertTriangle} deltaTone={overdueCount ? "warn" : "up"} />
      </div>

      <div className="rounded-2xl border border-slate-900/10 bg-white p-5 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <Clock size={16} className="text-emerald-700" /> {t("credits.reminderSettingsLabel")}
          <input type="number" min="0" max="30" value={reminderOffsetDays} onChange={(e) => setReminderOffsetDays(Number(e.target.value) || 0)} className="w-16 rounded-lg border border-slate-900/15 px-2 py-1.5 text-sm outline-none focus:border-emerald-600" />
        </label>
        <span className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">{t("credits.simulatedNote")}</span>
      </div>

      {remindersNeeded.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-amber-800">{t("credits.remindersToday")} ({remindersNeeded.length})</h4>
            <button onClick={onSendAll} className="text-xs font-semibold rounded-full bg-amber-600 text-white px-4 py-1.5 hover:bg-amber-500">{t("credits.sendAll")}</button>
          </div>
          <div className="space-y-2">
            {remindersNeeded.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5 text-sm">
                <span className="text-slate-800">{d.clientName} — {fmt(d.amount)}</span>
                <button onClick={() => onSendReminder(d.id)} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"><Send size={12} /> {t("credits.send")}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-900/10 bg-white">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-900/10"><th className="px-5 py-3.5 font-medium">{t("credits.client")}</th><th className="px-5 py-3.5 font-medium">{t("credits.amount")}</th><th className="px-5 py-3.5 font-medium">{t("credits.dueDate")}</th><th className="px-5 py-3.5 font-medium">{t("credits.status")}</th><th className="px-5 py-3.5 font-medium"></th></tr></thead>
          <tbody>
            {debtsWithStatus.map((d) => (
              <tr key={d.id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-800">{d.clientName}</td>
                <td className="px-5 py-3.5 font-mono text-slate-700">{fmt(d.amount)}</td>
                <td className="px-5 py-3.5 text-slate-600">{formatDate(d.dueDate)}</td>
                <td className="px-5 py-3.5">{statusBadge(d)}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <button onClick={() => onSendReminder(d.id)} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">{t("credits.send")}</button>
                    <button onClick={() => onSettle(d.id)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">{t("credits.markSettled")}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-3">
        {debtsWithStatus.map((d) => (
          <div key={d.id} className="rounded-2xl border border-slate-900/10 bg-white p-4">
            <div className="flex justify-between items-start mb-1.5"><span className="font-semibold text-sm text-slate-900">{d.clientName}</span><span className="font-mono text-sm text-slate-700">{fmt(d.amount)}</span></div>
            <div className="flex items-center justify-between mb-2.5"><span className="text-xs text-slate-500">{formatDate(d.dueDate)}</span>{statusBadge(d)}</div>
            <div className="flex items-center gap-4">
              <button onClick={() => onSendReminder(d.id)} className="text-xs font-semibold text-emerald-700">{t("credits.send")}</button>
              <button onClick={() => onSettle(d.id)} className="text-xs font-semibold text-slate-500">{t("credits.markSettled")}</button>
            </div>
          </div>
        ))}
      </div>
      {!debtsWithStatus.length && <EmptyState text={t("credits.noDebts")} />}

      {reminderHistory.length > 0 && (
        <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
          <h4 className="text-sm font-semibold text-slate-500 mb-4">{t("credits.history")}</h4>
          <ul className="divide-y divide-slate-100">
            {reminderHistory.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-700">{t("credits.reminderSent", r.clientName)}</span>
                <span className="text-xs text-slate-400">{daysAgoLabel(daysAgoFromISO(r.createdAt))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RapportsView({ bestSellers, revenueToday, profitToday, expensesToday, categoryTotals, categoryTotal }) {
  const { t } = useLang();
  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label={t("reports.revenue")} value={fmt(revenueToday)} icon={TrendingUp} />
        <StatCard label={t("reports.profit")} value={fmt(profitToday)} icon={Sparkles} />
        <StatCard label={t("reports.expenses")} value={fmt(expensesToday)} icon={TrendingDown} deltaTone="warn" />
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
          <h4 className="text-sm font-semibold text-slate-500 mb-4">{t("reports.bestSellers")}</h4>
          <ul className="space-y-3">{bestSellers.map(([name, val], i) => <li key={name} className="flex items-center justify-between text-sm"><span className="text-slate-700">{i + 1}. {name}</span><span className="font-mono text-emerald-700">{fmt(val)}</span></li>)}{!bestSellers.length && <EmptyState text={t("reports.noSalesYet")} />}</ul>
        </div>
        <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
          <h4 className="text-sm font-semibold text-slate-500 mb-4">{t("reports.categoryBreakdown")}</h4>
          <div className="space-y-3">{Object.entries(categoryTotals).map(([cat, val]) => (
            <div key={cat}><div className="flex justify-between text-xs text-slate-600 mb-1"><span>{cat}</span><span>{Math.round((val / categoryTotal) * 100)}%</span></div><div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(val / categoryTotal) * 100}%`, background: CATEGORY_COLORS[cat] || CATEGORY_COLORS.Autre }} /></div></div>
          ))}</div>
        </div>
      </div>
    </div>
  );
}

function ParametresView({ user, lang, setLang }) {
  const { t } = useLang();
  const langs = [{ code: "fr", label: "Français" }, { code: "en", label: "English" }, { code: "wo", label: "Wolof" }, { code: "bm", label: "Bambara" }, { code: "dy", label: "Dioula" }];
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
        <h4 className="font-semibold text-sm text-slate-900 mb-4">{t("settings.shopProfile")}</h4>
        <Field label={t("settings.shopName")}><input defaultValue={user.boutique} className={inputCls} /></Field>
        <Field label={t("settings.phone")}><input defaultValue="+221 77 123 45 67" className={inputCls} /></Field>
        <Field label={t("settings.city")}><input defaultValue={user.city} className={inputCls} /></Field>
      </div>
      <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
        <h4 className="font-semibold text-sm text-slate-900 mb-1">{t("settings.voiceLanguage")}</h4>
        <p className="text-xs text-slate-500 mb-4">{t("settings.voiceLanguageHint")}</p>
        <div className="flex flex-wrap gap-2 mb-3">{langs.map((l) => <button key={l.code} onClick={() => setLang(l.code)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border transition-colors ${lang === l.code ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-900/15 text-slate-600 hover:border-slate-900/40"}`}><Globe2 size={14} /> {l.label} {BETA_LANGS.includes(l.code) && <span className="text-[10px] opacity-75">· Bêta</span>}</button>)}</div>
        {BETA_LANGS.includes(lang) && <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{t("settings.betaNote")}</p>}
      </div>
      <div className="rounded-2xl border border-slate-900/10 bg-white p-6">
        <h4 className="font-semibold text-sm text-slate-900 mb-1">{t("settings.account")}</h4>
        <p className="text-xs text-slate-500">{t("settings.loggedInAs")} <span className="font-medium text-slate-700">{user.username}</span></p>
      </div>
    </div>
  );
}

/* =========================================================================
   FORM MODALS
========================================================================= */

function SaleModal({ open, onClose, products, clients, onSubmit }) {
  const { t } = useLang();
  const [product, setProduct] = useState(products[0]?.name || "");
  const [qty, setQty] = useState(1);
  const [amount, setAmount] = useState("");
  const [client, setClient] = useState(clients[0]?.name || "Client comptant");
  const [paymentMethod, setPaymentMethod] = useState("especes");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [deposit, setDeposit] = useState("");
  const [dueDate, setDueDate] = useState(isoDateOffset(7));

  useEffect(() => { if (open) { setProduct(products[0]?.name || ""); setQty(1); setAmount(""); setClient(clients[0]?.name || "Client comptant"); setPaymentMethod("especes"); setPaymentStatus("paid"); setDeposit(""); setDueDate(isoDateOffset(7)); } }, [open]); // eslint-disable-line

  const total = Number(amount) || 0;
  const depositNum = Number(deposit) || 0;
  const remaining = Math.max(0, total - depositNum);

  const handleSave = () => {
    let amountPaid = total, amountDue = 0;
    if (paymentStatus === "credit") { amountPaid = 0; amountDue = total; }
    if (paymentStatus === "partial") { amountPaid = depositNum; amountDue = remaining; }
    onSubmit({ product, qty: Number(qty), unit: products.find((p) => p.name === product)?.unit || "unités", amount: total, client, paymentMethod, paymentStatus, amountPaid, amountDue, dueDate: paymentStatus === "paid" ? null : dueDate });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t("common.newSale")}>
      <div onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}>
        <Field label={t("sales.product")}><select value={product} onChange={(e) => setProduct(e.target.value)} className={inputCls}>{products.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("sales.quantity")}><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} required /></Field>
          <Field label={t("sales.amount")}><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} required /></Field>
        </div>
        <Field label={t("sales.client")}><select value={client} onChange={(e) => setClient(e.target.value)} className={inputCls}>{clients.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></Field>
        <Field label={t("sales.payment")}>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button type="button" key={m.key} onClick={() => setPaymentMethod(m.key)} className={`flex flex-col items-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-colors ${paymentMethod === m.key ? "border-emerald-600 bg-emerald-50" : "border-slate-900/10 hover:border-slate-900/30"}`}>
                <span className="h-6 w-6 rounded-full flex items-center justify-center font-bold text-[9px]" style={{ background: m.color, color: m.text }}>{m.mark}</span>
                {t(`paymentMethods.${m.key}`)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("sales.paymentStatus")}>
          <div className="grid grid-cols-3 gap-2">
            {[["paid", t("sales.statusPaid")], ["credit", t("sales.statusCredit")], ["partial", t("sales.statusPartial")]].map(([key, label]) => (
              <button type="button" key={key} onClick={() => setPaymentStatus(key)} className={`rounded-xl border py-2.5 text-xs font-semibold ${paymentStatus === key ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-900/10 text-slate-600"}`}>{label}</button>
            ))}
          </div>
        </Field>
        {paymentStatus === "partial" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("sales.depositLabel")}><input type="number" min="0" max={total} value={deposit} onChange={(e) => setDeposit(e.target.value)} className={inputCls} /></Field>
            <Field label={t("sales.remainingLabel")}><input disabled value={fmt(remaining)} className={`${inputCls} bg-slate-50 text-slate-500`} /></Field>
          </div>
        )}
        {(paymentStatus === "credit" || paymentStatus === "partial") && (
          <Field label={t("sales.dueDateLabel")}><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} /></Field>
        )}
        <button type="button" onClick={handleSave} className="w-full rounded-full bg-emerald-600 text-white py-3 text-sm font-semibold mt-2 hover:bg-emerald-500">{t("common.save")}</button>
      </div>
    </Modal>
  );
}

function PurchaseModal({ open, onClose, products, suppliers, onSubmit }) {
  const { t } = useLang();
  const [product, setProduct] = useState(products[0]?.name || "");
  const [qty, setQty] = useState(1);
  const [amount, setAmount] = useState("");
  const [supplier, setSupplier] = useState(suppliers[0]?.name || "");
  useEffect(() => { if (open) { setProduct(products[0]?.name || ""); setQty(1); setAmount(""); setSupplier(suppliers[0]?.name || ""); } }, [open]); // eslint-disable-line
  const handleSave = () => { onSubmit({ product, qty: Number(qty), unit: products.find((p) => p.name === product)?.unit || "unités", amount: Number(amount), supplier }); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title={t("common.newPurchase")}>
      <div onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}>
        <Field label={t("purchases.product")}><select value={product} onChange={(e) => setProduct(e.target.value)} className={inputCls}>{products.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("purchases.quantity")}><input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} required /></Field>
          <Field label={t("purchases.amount")}><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} required /></Field>
        </div>
        <Field label={t("purchases.supplier")}><select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls}>{suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</select></Field>
        <button type="button" onClick={handleSave} className="w-full rounded-full bg-emerald-600 text-white py-3 text-sm font-semibold mt-2 hover:bg-emerald-500">{t("common.save")}</button>
      </div>
    </Modal>
  );
}

function ProductModal({ open, onClose, onSubmit }) {
  const { t } = useLang();
  const [name, setName] = useState(""); const [unit, setUnit] = useState("unités"); const [stock, setStock] = useState(0); const [threshold, setThreshold] = useState(5); const [price, setPrice] = useState(""); const [category, setCategory] = useState("Alimentation");
  useEffect(() => { if (open) { setName(""); setUnit("unités"); setStock(0); setThreshold(5); setPrice(""); setCategory("Alimentation"); } }, [open]);
  const handleSave = () => { onSubmit({ name, unit, stock: Number(stock), threshold: Number(threshold), price: Number(price), category }); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title={t("common.addProduct")}>
      <div onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}>
        <Field label={t("stocks.product")}><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Unité"><input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} /></Field><Field label={t("stocks.stock")}><input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className={inputCls} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Seuil d'alerte"><input type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={inputCls} /></Field><Field label={t("stocks.unitPrice")}><input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} required /></Field></div>
        <Field label={t("stocks.category")}><select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}><option>Alimentation</option><option>Boissons</option><option>Hygiène</option><option>Autre</option></select></Field>
        <button type="button" onClick={handleSave} className="w-full rounded-full bg-emerald-600 text-white py-3 text-sm font-semibold mt-2 hover:bg-emerald-500">{t("common.save")}</button>
      </div>
    </Modal>
  );
}

function ContactModal({ open, onClose, title, onSubmit }) {
  const { t } = useLang();
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  useEffect(() => { if (open) { setName(""); setPhone(""); } }, [open]);
  const handleSave = () => { onSubmit({ name, phone }); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}>
        <Field label="Nom"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required /></Field>
        <Field label="Téléphone"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+221 ..." /></Field>
        <button type="button" onClick={handleSave} className="w-full rounded-full bg-emerald-600 text-white py-3 text-sm font-semibold mt-2 hover:bg-emerald-500">{t("common.save")}</button>
      </div>
    </Modal>
  );
}

function ExpenseModal({ open, onClose, onSubmit }) {
  const { t } = useLang();
  const [label, setLabel] = useState(""); const [amount, setAmount] = useState(""); const [category, setCategory] = useState("Charges");
  useEffect(() => { if (open) { setLabel(""); setAmount(""); setCategory("Charges"); } }, [open]);
  const handleSave = () => { onSubmit({ label, amount: Number(amount), category }); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title={t("common.newExpense")}>
      <div onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}>
        <Field label={t("expenses.label")}><input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} required /></Field>
        <Field label={t("expenses.amount")}><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} required /></Field>
        <Field label={t("expenses.category")}><select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}><option>Charges</option><option>Logistique</option><option>Fournitures</option><option>Autre</option></select></Field>
        <button type="button" onClick={handleSave} className="w-full rounded-full bg-emerald-600 text-white py-3 text-sm font-semibold mt-2 hover:bg-emerald-500">{t("common.save")}</button>
      </div>
    </Modal>
  );
}

function DebtModal({ open, onClose, clients, onSubmit }) {
  const { t } = useLang();
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(isoDateOffset(7));
  useEffect(() => { if (open) { setClientName(clients[0]?.name || ""); setAmount(""); setDueDate(isoDateOffset(7)); } }, [open]); // eslint-disable-line
  const handleSave = () => { if (!clientName.trim() || !Number(amount)) return; onSubmit({ clientName: clientName.trim(), amount: Number(amount), dueDate }); onClose(); };
  return (
    <Modal open={open} onClose={onClose} title={t("credits.newDebt")}>
      <div onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}>
        <Field label={t("credits.client")}>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputCls} list="client-names" required />
          <datalist id="client-names">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </Field>
        <Field label={t("credits.amount")}><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} required /></Field>
        <Field label={t("credits.dueDate")}><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} /></Field>
        <button type="button" onClick={handleSave} className="w-full rounded-full bg-emerald-600 text-white py-3 text-sm font-semibold mt-2 hover:bg-emerald-500">{t("common.save")}</button>
      </div>
    </Modal>
  );
}
