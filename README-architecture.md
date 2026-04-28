# Architecture et Normes de Développement : ExtracteurIA

Ce document rassemble les principes d'architecture mis en place lors de la refonte du projet pour assurer sa sécurité, sa robustesse et sa maintenabilité en vue de sa commercialisation en tant que SaaS.

## 1. Sécurité (Règle d'or)
**Les clés d'API (notamment Gemini) ne doivent jamais transiter ou être instanciées côté client.**
- Toute logique nécessitant une clé secrète doit être placée dans `server.ts`.
- Le frontend communique avec le backend via des appels API REST `/api/...`.
- Les clés sont stockées de manière sécurisée (Firestore ou variables d'environnement backend) et non téléchargées sur le navigateur.

## 2. Structure du Frontend (React)
Le fichier monolithique `App.tsx` a été fragmenté selon l'arborescence suivante :
- `src/types/` : Contient toutes les interfaces TypeScript (`PageData`, `AIAnalysis`, etc.).
- `src/hooks/` : Contient la logique métier et la gestion d'état (ex: `useAuth`, `useAnalysis`).
- `src/components/` : Composants UI réutilisables.
  - `/layout` : Éléments de structure (Sidebar, Header).
  - `/dashboard` : Composants spécifiques à l'utilisateur connecté (Vues, Stats).
  - `/landing` : Composants de la page d'accueil pour les utilisateurs anonymes.
- `src/App.tsx` : Point d'entrée allégé, servant uniquement au routage conditionnel et à l'assemblage des composants majeurs.

## 3. Robustesse du Backend
- **Gestion de Puppeteer :** Chaque exécution de scraping doit impérativement avoir un timeout, intercepter les requêtes inutiles (images, polices) pour économiser la RAM, et s'assurer que le navigateur est fermé (`browser.close()`) même en cas d'erreur (`try/finally`).
- **Validation des entrées :** Chaque route backend doit valider l'URL reçue pour prévenir les abus.

## 4. Stratégie de Branches
- `main` : Branche de production, toujours stable.
- `refonte-architecture-securite` : Branche actuelle dédiée à la mise en place de la base technique sécurisée.
- Les futures intégrations (ex: Singpay) feront l'objet de nouvelles branches spécifiques.
