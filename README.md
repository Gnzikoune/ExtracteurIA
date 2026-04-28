# ExtracteurIA 🚀

ExtracteurIA est une plateforme SaaS intelligente conçue pour extraire, analyser et diagnostiquer la structure des sites web en quelques secondes. Utilisant la puissance de l'Intelligence Artificielle (Gemini), l'outil identifie les opportunités, repère les problèmes de conversion et évalue le maillage de n'importe quelle page web publique.

---

## 🌟 Fonctionnalités Principales

### 1. 🕷️ Moteur d'Extraction Haute Performance
- **Scan Simple** : Scanne la page d'atterrissage principale instantanément.
- **Deep Scan (Scan Profond)** : Navigue sur les pages internes d'un domaine de façon asynchrone pour extraire jusqu'à 15 pages de liens profonds.

### 2. 🧠 Intelligence Artificielle (Gemini 3 Flash)
- **Score Global (0-100)** : Évalue la performance, la structure, et la puissance de conversion de la cible.
- **Catégorisation Automatique** : Organise intelligemment les liens par thématiques (Navigation, Légal, Produits, etc.).
- **Détection des failles** : Pointe du doigt les lacunes bloquantes dans le tunnel de vente.

### 3. 💾 Historique & Cloud
- **Stockage Persistant** : Sauvegarde sécurisée des rapports d'analyse (Base de données Firestore) pour chaque utilisateur.
- **Vue Historique** : Interface premium pour revenir sur vos précédentes sessions de scraping.

### 4. 📊 Exportation de Données
- Export au format **JSON** et **CSV** pour intégration dans des CRM et ERP (Excel/Sheets).

### 5. 🔐 Système de Quotas & Authentification
- Connexion via Google Auth pour synchroniser son travail.
- Gestion des quotas dynamiques configurables via le panneau d'administration pour garantir la stabilité du service (par défaut : 2 analyses pour les anonymes, 50 pour les connectés).

---

## 🛠️ Stack Technique

- **Frontend** : React 19, Vite, TailwindCSS 4, Framer Motion
- **Icônes & UI** : Lucide-React, UI Premium Glassmorphism
- **Backend / Scraper** : Node.js, Express, Puppeteer, Cheerio
- **Intelligence Artificielle** : API `@google/genai` (Gemini)
- **Base de données & Auth** : Firebase (Auth, Firestore)

---

## 🚀 Installation & Démarrage Rapide

### Prérequis
- Node.js (v22+)
- Un compte Firebase avec Firestore & Auth activés
- Une clé API Google Gemini

### 1. Cloner le projet
```bash
git clone https://github.com/votre-compte/extracteuria.git
cd extracteuria
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configuration de l'environnement
Configurez Firebase via Firestore, et importez vos configurations directement dans l'interface d'administration ou un fichier `.env`.

### 4. Lancer l'application
L'application utilise un serveur custom pour exécuter Puppeteer localement ou sur le cloud (selon configuration) afin de contourner les CORS de manière sécurisée.
```bash
# Lance simultanément le Frontend et le Backend API
npm run dev
```
Rendez-vous ensuite sur [http://localhost:5173](http://localhost:5173).

---

## 📚 Documentation
L'application intègre désormais une documentation claire, accessible directement via l'interface utilisateur. Vous pouvez y accéder via la barre de navigation latérale (ou mobile) en cliquant sur **"Documentation"**.

---

## 🛡️ Sécurité & Administration
- Déconnexion automatique après inactivité pour protéger les données.
- Accès administrateur sécurisé (Vue globale sur la plateforme).
- Protection Firestore via des règles `firestore.rules` strictes.

---

*Développé pour les Growth Hackers, référenceurs SEO, et stratèges digitaux.*
