# MarketPro

L'ERP vocal intelligent pour le commerce africain — plateforme de gestion (ventes, stocks, achats, clients, fournisseurs, dépenses, paiements mobiles, crédits/dettes, messagerie) pilotable à la voix, avec comptes commerçants et fournisseurs.

## Stack

- [Vite](https://vitejs.dev/) + React 18
- [Tailwind CSS](https://tailwindcss.com/)
- [lucide-react](https://lucide.dev/) pour les icônes
- Web Speech API (reconnaissance vocale + synthèse vocale, natives au navigateur)
- Progressive Web App (installable, fonctionne hors-ligne)
- [Supabase](https://supabase.com) (Postgres + Auth + Realtime) pour le backend réel
- [Prisma](https://www.prisma.io) pour le schéma de base de données et les migrations

---

## 🚀 Comment lancer le projet

Deux façons de démarrer, du plus simple au plus complet.

### Option A — Démarrage immédiat (mode démo, sans base de données)

```bash
npm install
npm run dev
```

Ouvrez `http://localhost:5173`. L'app tourne en **mode démo local** : comptes intégrés (voir tableau ci-dessous), toutes les données sont sauvegardées dans le navigateur (`localStorage`). Aucune configuration requise.

### Option B — Avec un vrai backend Postgres (Supabase + Prisma)

1. **Installer les dépendances**
   ```bash
   npm install
   ```

2. **Créer un projet Supabase** sur [supabase.com](https://supabase.com) (gratuit).

3. **Désactiver la confirmation d'e-mail** : *Authentication → Providers → Email* → décochez *Confirm email*.
   (MarketPro utilise des identifiants, pas des e-mails ; sans cette étape un nouveau compte devrait confirmer une adresse qu'il ne peut pas recevoir.)

4. **Copier les variables d'environnement**
   ```bash
   cp .env.example .env.local
   ```
   Remplissez `.env.local` avec les valeurs de votre projet Supabase :
   - `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` → *Project Settings → API*
   - `DATABASE_URL` et `DIRECT_URL` → *Project Settings → Database → Connection string*
     (`DATABASE_URL` = connexion "Transaction pooler" port 6543 ; `DIRECT_URL` = connexion "Session"/directe port 5432)

5. **Activer l'extension pgcrypto** (nécessaire pour générer les identifiants uuid) : dans *SQL Editor* sur Supabase, exécutez simplement :
   ```sql
   create extension if not exists "pgcrypto";
   ```

6. **Créer les tables avec Prisma**
   ```bash
   npm run db:push
   ```
   Cela lit `prisma/schema.prisma` et crée toutes les tables (`profiles`, `products`, `clients`, `suppliers`, `sales`, `purchases`, `expenses`, `debts`, `messages`) dans votre base Postgres Supabase.

7. **Sécuriser les données** : Prisma ne gère pas les clés étrangères vers le schéma `auth` de Supabase, ni les contraintes CHECK, ni la sécurité par ligne (RLS). Collez donc le contenu de [`supabase/rls.sql`](./supabase/rls.sql) dans *SQL Editor* et exécutez-le. Cela ajoute :
   - les clés étrangères de chaque table vers `auth.users`
   - les contraintes CHECK (rôles, statuts)
   - les policies RLS (chaque commerçant ne voit que ses propres données ; les messages ne sont visibles que par leurs deux participants)
   - la publication temps réel pour la messagerie

8. **Lancer l'app**
   ```bash
   npm run dev
   ```

Ouvrez `http://localhost:5173` : l'écran de connexion crée maintenant de vrais comptes, les données sont dans Postgres, et la messagerie est en temps réel.

> **Alternative sans Prisma** : si vous préférez tout faire en une seule fois sans installer Prisma, ignorez les étapes 5-7 et collez plutôt tout le contenu de [`supabase/schema.sql`](./supabase/schema.sql) dans *SQL Editor* — ce fichier crée les tables **et** la sécurité en un seul script. Dans ce cas, laissez `DATABASE_URL`/`DIRECT_URL` vides ; ils ne sont utilisés que par Prisma.

---

## Comptes de démonstration (mode local uniquement)

| Identifiant | Mot de passe | Type        |
|-------------|--------------|-------------|
| `awa`       | `1234`       | Commerçant  |
| `moussa`    | `1234`       | Commerçant  |
| `sahel`     | `1234`       | Fournisseur |

## Fonctionnalités

- **Logo officiel** sur les écrans de connexion / création de compte.
- **Reconnaissance vocale réelle** (Web Speech API) : le bouton micro écoute et transcrit en direct ; les réponses de MarketPro sont aussi lues à voix haute. Bascule automatique vers la saisie clavier sur les navigateurs non compatibles (ex. Firefox).
- **Fonctionne hors-ligne** : les données sont mises en cache localement et les écritures faites hors connexion sont mises en file d'attente puis synchronisées automatiquement au retour du réseau (voir `src/lib/offlineSync.js`).
- **PWA installable** : `manifest.json` + `sw.js` mettent en cache l'interface.
- **Backend réel optionnel** : comptes Supabase Auth, données Postgres avec sécurité par ligne, messagerie et annuaire fournisseurs en temps réel.

## Scripts disponibles

| Commande             | Description                                              |
|----------------------|-----------------------------------------------------------|
| `npm run dev`        | Démarre le serveur de développement (`localhost:5173`)   |
| `npm run build`      | Build de production dans `dist/`                          |
| `npm run preview`    | Sert le build de production localement                    |
| `npm run db:push`    | Crée/synchronise les tables Postgres depuis `prisma/schema.prisma` |
| `npm run db:migrate` | Crée une migration Prisma versionnée (recommandé en équipe) |
| `npm run db:studio`  | Ouvre [Prisma Studio](https://www.prisma.io/studio) pour parcourir les données |

## Mettre le projet sur Git

Si ce n'est pas déjà fait :

```bash
cd marketpro-app
git init
git add .
git commit -m "Initial commit — MarketPro"
```

Puis créez un dépôt vide sur GitHub (ou GitLab/Bitbucket) et poussez :

```bash
git remote add origin https://github.com/<votre-compte>/<votre-repo>.git
git branch -M main
git push -u origin main
```

> `.env.local` (vos vraies clés Supabase) est déjà exclu par `.gitignore` — seul `.env.example` (vide) part sur Git. Ne committez jamais vos clés.

Les trois plateformes ci-dessous se connectent directement à ce dépôt et redéploient automatiquement à chaque `git push`.

## Déploiement

Ce projet est une application statique (Vite build → dossier `dist/`), déployable telle quelle sur Vercel, Netlify ou Render. Les fichiers de configuration (`vercel.json`, `netlify.toml`, `render.yaml`) sont déjà inclus.

Sur les trois plateformes, pensez à renseigner les mêmes variables d'environnement que dans `.env.local` (au minimum `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` si vous utilisez Supabase) dans les paramètres du projet — elles ne sont jamais lues depuis votre dépôt Git.

### Vercel

**Via l'interface :**
1. Sur [vercel.com](https://vercel.com), **New Project** → importez votre dépôt.
2. Vercel détecte Vite automatiquement (build et dossier `dist` déjà définis dans `vercel.json`).
3. *Project Settings → Environment Variables* → ajoutez vos clés.
4. **Deploy**.

**Via la CLI :**
```bash
npm i -g vercel
vercel        # déploiement de preview
vercel --prod # déploiement en production
```

### Netlify

**Via l'interface :**
1. Sur [app.netlify.com](https://app.netlify.com), **Add new site → Import an existing project** → connectez votre dépôt.
2. Netlify lit `netlify.toml` : build `npm run build`, publication du dossier `dist`, redirection SPA déjà configurée.
3. *Site configuration → Environment variables* → ajoutez vos clés.
4. **Deploy site**.

**Via la CLI :**
```bash
npm i -g netlify-cli
netlify init     # relie le dossier au site Netlify (ou en crée un)
netlify deploy    # déploiement de preview
netlify deploy --prod
```

### Render

**Via l'interface :**
1. Sur [dashboard.render.com](https://dashboard.render.com), **New → Static Site** → connectez votre dépôt.
2. Render détecte `render.yaml` (build `npm run build`, dossier `dist`, réécriture SPA déjà configurée) — ou saisissez ces valeurs manuellement si vous préférez ne pas utiliser le Blueprint.
3. Dans *Environment*, ajoutez vos clés (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. **Create Static Site**.

> Sur les trois plateformes, `DATABASE_URL`/`DIRECT_URL` (Prisma) n'ont pas besoin d'être définies pour que le site se construise et fonctionne — Prisma n'est utilisé que localement/en CI pour gérer le schéma de la base, jamais par l'app dans le navigateur.

## Structure du projet

```
marketpro-app/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json
├── netlify.toml
├── render.yaml
├── .env.example            # variables Supabase + Prisma à copier vers .env.local
├── prisma/
│   └── schema.prisma       # schéma de base de données (source de vérité pour Prisma)
├── supabase/
│   ├── rls.sql              # à exécuter après `npm run db:push` (FKs, RLS, realtime)
│   └── schema.sql           # alternative tout-en-un, sans Prisma
├── public/
│   ├── manifest.json       # PWA
│   ├── sw.js                # service worker (cache hors-ligne)
│   └── icons/               # icônes d'app générées depuis le logo
└── src/
    ├── main.jsx             # point d'entrée React + enregistrement du service worker
    ├── index.css            # Tailwind + styles globaux
    ├── assets/
    │   └── logo.png          # logo officiel MarketPro
    ├── lib/
    │   ├── supabaseClient.js   # client Supabase (navigateur) + détection du mode démo/réel
    │   └── offlineSync.js      # file d'attente d'écritures hors-ligne
    └── App.jsx              # toute l'application (composants, i18n, logique métier)
```

### Pourquoi Prisma *et* Supabase-js ?

Ce sont deux outils avec des rôles différents, pas redondants :

- **Prisma** (`prisma/schema.prisma`) tourne côté serveur/machine de développement uniquement. Il sert à créer et faire évoluer les tables Postgres (`npm run db:push`, `db:migrate`) et à les explorer (`db:studio`). Il n'est jamais exécuté dans le navigateur.
- **`@supabase/supabase-js`** (`src/lib/supabaseClient.js`) est ce que l'application React utilise réellement en production, dans le navigateur. Il est conçu pour ça : la clé publique (`anon key`) est sans danger à exposer côté client car chaque requête est filtrée par la sécurité par ligne (RLS) selon l'utilisateur connecté — une base Prisma classique (avec ses identifiants de connexion directs à Postgres) ne doit elle jamais être exposée au navigateur.

## Ce qu'il reste pour passer en production

- **Intégrations de paiement réelles** : les badges Wave/Orange Money/MTN/Moov sont visuels ; brancher les vraies API (Wave for Business, Orange Money API, MTN MoMo API) pour encaisser réellement.
- **SMS réels pour les rappels de dette** : actuellement simulés ; une intégration Africa's Talking ou Twilio enverrait de vrais SMS.
- **Réinitialisation de mot de passe** : nécessite d'ajouter un vrai champ e-mail (le flux actuel utilise une adresse technique générée à partir de l'identifiant, qui ne reçoit pas de courrier réel).
- Les traductions Wolof/Bambara/Dioula restent partielles (marquées « Bêta »).
