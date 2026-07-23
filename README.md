# MarketPro

L'ERP vocal intelligent pour le commerce africain — plateforme de gestion (ventes, stocks, achats, clients, fournisseurs, dépenses, paiements mobiles, crédits/dettes, messagerie) pilotable à la voix, avec comptes commerçants et fournisseurs.

Ce dépôt contient **deux projets** :

```
marketpro-app/
├── src/, index.html, package.json, ...   ← Frontend (Vite + React)
└── server/                                ← Backend (Express + Prisma)
```

- Le **frontend** est une application statique (build Vite) qui ne parle jamais directement à la base de données.
- Le **backend** (`server/`) est une API REST (Express + Prisma) qui est la seule pièce à détenir les identifiants de connexion à Postgres.
- La **base de données** (Postgres) est hébergée sur [Supabase](https://supabase.com), mais Supabase n'est utilisé ici que comme hébergeur de base de données — ni son Auth ni son client JavaScript ne sont utilisés. Le backend s'y connecte directement via Prisma.

---

## 🚀 Comment lancer le projet

### Option A — Démarrage immédiat (mode démo, sans backend ni base de données)

```bash
cd marketpro-app
npm install
npm run dev
```

Ouvrez `http://localhost:5173`. Le frontend seul tourne en **mode démo local** : comptes intégrés (voir tableau ci-dessous), toutes les données sont sauvegardées dans le navigateur. Aucun backend requis.

### Option B — Avec le backend réel (Postgres sur Supabase + Express sur Render)

#### 1. Préparer la base de données (Supabase)

1. Créez un projet sur [supabase.com](https://supabase.com) (gratuit).
2. *Project Settings → Database → Connection string* : notez les deux chaînes de connexion :
   - **Transaction pooler** (port 6543) → ce sera `DATABASE_URL`
   - **Session / Direct connection** (port 5432) → ce sera `DIRECT_URL`

   > Supabase n'est utilisé ici que pour héberger Postgres — vous n'avez besoin d'activer ni configurer l'Authentication Supabase.

#### 2. Lancer le backend en local

```bash
cd marketpro-app/server
npm install
cp .env.example .env
```

Remplissez `.env` :
```
DATABASE_URL=...       # depuis l'étape précédente
DIRECT_URL=...         # depuis l'étape précédente
JWT_SECRET=...         # une longue chaîne aléatoire, ex: openssl rand -base64 32
CORS_ORIGIN=http://localhost:5173
PORT=4000
```

Créez les tables puis démarrez le serveur :
```bash
npm run db:push
npm run dev
```

Le backend tourne sur `http://localhost:4000`. Testez-le : `curl http://localhost:4000/health` doit répondre `{"ok":true}`.

#### 3. Lancer le frontend en local, connecté au backend

```bash
cd marketpro-app
cp .env.example .env.local
```
Dans `.env.local` :
```
VITE_API_URL=http://localhost:4000
```

```bash
npm install
npm run dev
```

Ouvrez `http://localhost:5173` : l'écran de connexion crée maintenant de vrais comptes via le backend, stockés dans Postgres.

---

## Comptes de démonstration (mode local uniquement, sans backend)

| Identifiant | Mot de passe | Type        |
|-------------|--------------|-------------|
| `awa`       | `1234`       | Commerçant  |
| `moussa`    | `1234`       | Commerçant  |
| `sahel`     | `1234`       | Fournisseur |

En mode backend réel, créez vos propres comptes depuis l'écran « Créer un compte ».

## Fonctionnalités

- **Logo officiel** sur les écrans de connexion / création de compte.
- **Reconnaissance vocale réelle** (Web Speech API) : le bouton micro écoute et transcrit en direct ; les réponses de MarketPro sont aussi lues à voix haute. Bascule automatique vers la saisie clavier sur les navigateurs non compatibles (ex. Firefox).
- **Fonctionne hors-ligne** : les données sont mises en cache localement et les écritures faites hors connexion sont mises en file d'attente puis synchronisées automatiquement au retour du réseau (voir `src/lib/offlineSync.js`).
- **PWA installable** : `manifest.json` + `sw.js` mettent en cache l'interface.
- **Backend réel optionnel** : comptes sécurisés (mot de passe haché, session par JWT), données Postgres scopées par utilisateur, messagerie entre commerçants et fournisseurs (rafraîchie automatiquement), annuaire des commerçants pour les fournisseurs.

---

## Mettre le projet sur Git

```bash
cd marketpro-app
git init
git add .
git commit -m "Initial commit — MarketPro"
git remote add origin https://github.com/<votre-compte>/<votre-repo>.git
git branch -M main
git push -u origin main
```

> `.env`, `.env.local` (vos vraies clés) sont déjà exclus par les `.gitignore` du frontend et du backend — seuls les `.env.example` (vides) partent sur Git. Ne committez jamais vos identifiants de base de données ni votre `JWT_SECRET`.

---

## Déploiement sur Render (frontend + backend)

Le fichier [`render.yaml`](./render.yaml) à la racine décrit les **deux services** en un seul Blueprint : inutile de tout configurer à la main.

### Via Blueprint (recommandé)

1. Poussez ce dépôt sur GitHub/GitLab.
2. Sur [dashboard.render.com](https://dashboard.render.com), **New → Blueprint** → sélectionnez votre dépôt. Render détecte `render.yaml` et propose de créer les deux services : `marketpro-backend` et `marketpro-frontend`.
3. Render vous demandera de renseigner les variables marquées `sync: false` :
   - Pour **marketpro-backend** : `DATABASE_URL`, `DIRECT_URL` (depuis Supabase), `CORS_ORIGIN` (mettez-y l'URL Render du frontend une fois connue, ex. `https://marketpro-frontend.onrender.com` — vous pourrez la corriger après le premier déploiement). `JWT_SECRET` est généré automatiquement par Render.
   - Pour **marketpro-frontend** : `VITE_API_URL` = l'URL Render du backend (ex. `https://marketpro-backend.onrender.com`).
4. **Apply**. Les deux services se construisent et se déploient.
5. Une fois les deux URLs connues, retournez dans les *Environment* de chaque service pour vous assurer que `CORS_ORIGIN` (backend) et `VITE_API_URL` (frontend) pointent bien l'un vers l'autre, puis redéployez si besoin.
6. Depuis le service backend sur Render, ouvrez le *Shell* et exécutez une fois :
   ```bash
   npm run db:push
   ```
   (ou lancez cette commande depuis votre machine locale avec les mêmes `DATABASE_URL`/`DIRECT_URL` — le résultat est identique, c'est la même base.)

### Manuellement (sans Blueprint)

**Backend** — *New → Web Service* :
- Root Directory : `server`
- Build Command : `npm install && npx prisma generate`
- Start Command : `npm start`
- Variables d'environnement : `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN`

**Frontend** — *New → Static Site* :
- Root Directory : `.` (racine du dépôt)
- Build Command : `npm install && npm run build`
- Publish Directory : `dist`
- Ajoutez une règle de réécriture `/* → /index.html` (SPA)
- Variables d'environnement : `VITE_API_URL`

> Le service gratuit de Render se met en veille après 15 minutes d'inactivité et met quelques secondes à se réveiller au prochain appel — normal sur le plan gratuit, sans impact sur les données (tout est dans Postgres).

### Autres plateformes pour le frontend seul

Le frontend restant une simple application statique, `vercel.json` et `netlify.toml` sont aussi inclus si vous préférez héberger uniquement le frontend sur Vercel ou Netlify (en pointant `VITE_API_URL` vers votre backend Render). Le backend, lui, doit rester sur une plateforme qui exécute du code Node en continu (Render, Railway, Fly.io…) — pas sur Vercel/Netlify qui sont pensés pour du statique ou des fonctions serverless de courte durée.

---

## Scripts disponibles

**Frontend** (`marketpro-app/`)

| Commande          | Description                                    |
|-------------------|-------------------------------------------------|
| `npm run dev`     | Serveur de développement (`localhost:5173`)     |
| `npm run build`   | Build de production dans `dist/`                |
| `npm run preview` | Sert le build de production localement          |

**Backend** (`marketpro-app/server/`)

| Commande               | Description                                              |
|-------------------------|-----------------------------------------------------------|
| `npm run dev`           | Démarre l'API avec rechargement automatique (`localhost:4000`) |
| `npm start`             | Démarre l'API (production)                                |
| `npm run db:push`       | Crée/synchronise les tables Postgres depuis `prisma/schema.prisma` |
| `npm run db:migrate`    | Applique les migrations Prisma existantes (production/CI) |
| `npm run db:migrate:dev`| Crée une nouvelle migration versionnée (développement)   |
| `npm run db:studio`     | Ouvre [Prisma Studio](https://www.prisma.io/studio) pour parcourir les données |

---

## Structure du projet

```
marketpro-app/
├── index.html
├── package.json            # dépendances du frontend
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── render.yaml              # Blueprint Render : backend + frontend
├── vercel.json               # config alternative (frontend seul)
├── netlify.toml               # config alternative (frontend seul)
├── .env.example              # VITE_API_URL, à copier vers .env.local
├── public/
│   ├── manifest.json        # PWA
│   ├── sw.js                  # service worker (cache hors-ligne)
│   └── icons/                  # icônes d'app générées depuis le logo
├── src/
│   ├── main.jsx               # point d'entrée React + enregistrement du service worker
│   ├── index.css              # Tailwind + styles globaux
│   ├── assets/
│   │   └── logo.png            # logo officiel MarketPro
│   ├── lib/
│   │   ├── apiClient.js          # client REST vers le backend + gestion du JWT
│   │   └── offlineSync.js        # file d'attente d'écritures hors-ligne
│   └── App.jsx                 # toute l'application (composants, i18n, logique métier)
│
└── server/                    # ---- Backend (projet Node séparé) ----
    ├── package.json
    ├── .env.example           # DATABASE_URL, DIRECT_URL, JWT_SECRET, CORS_ORIGIN
    ├── prisma/
    │   └── schema.prisma       # schéma de base de données (source de vérité)
    └── src/
        ├── index.js             # point d'entrée Express (CORS, routes)
        ├── lib/
        │   ├── prisma.js          # client Prisma partagé
        │   ├── jwt.js             # signature/vérification des jetons
        │   └── serialize.js       # conversion Decimal/Date de Prisma → JSON simple
        ├── middleware/
        │   └── auth.js            # vérification du JWT
        └── routes/
            ├── auth.js             # inscription / connexion / session
            ├── profiles.js         # annuaire des comptes
            ├── messages.js         # messagerie
            └── resource.js         # CRUD générique (products, clients, suppliers, sales, purchases, expenses, debts)
```

### Comment les trois pièces s'articulent

- **Le frontend** (`src/`) ne connaît que `VITE_API_URL`. Il ne détient aucun secret et peut être servi depuis n'importe quel hébergeur statique.
- **Le backend** (`server/`) est la seule pièce qui connaît `DATABASE_URL`/`DIRECT_URL` (les identifiants Postgres) et `JWT_SECRET`. Il expose une API REST classique (JSON + JWT dans l'en-tête `Authorization`), et applique lui-même les règles d'accès (chaque commerçant ne voit que ses propres données) dans son code plutôt que via des policies Postgres.
- **Supabase** héberge uniquement la base Postgres — aucune fonctionnalité Supabase (Auth, Realtime, RLS, client JS) n'est utilisée dans cette architecture.

## Ce qu'il reste pour passer en production

- **Intégrations de paiement réelles** : les badges Wave/Orange Money/MTN/Moov sont visuels ; brancher les vraies API (Wave for Business, Orange Money API, MTN MoMo API) pour encaisser réellement.
- **SMS réels pour les rappels de dette** : actuellement simulés ; une intégration Africa's Talking ou Twilio enverrait de vrais SMS.
- **Réinitialisation de mot de passe** : le backend n'a pas de champ e-mail aujourd'hui (identifiant + mot de passe uniquement) ; en ajouter un serait nécessaire pour ce flux.
- **Messagerie en temps réel** : actuellement en polling (vérification toutes les 4 secondes) plutôt qu'avec des WebSockets, pour rester simple et robuste sur un hébergement gratuit qui peut se mettre en veille.
- Les traductions Wolof/Bambara/Dioula restent partielles (marquées « Bêta »).
