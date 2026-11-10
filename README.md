# PELIFY, site complet

Un seul projet, un dossier par univers, mêmes liens qu'avant.

- `/` portail, `/studio/`, `/arena/` (+ `/arena/tournois/`, `/arena/reserver/`), `/screen/`, `/insights/`, `/market/`, `/devis/`, `/merci/`
- `apps/live` : application de réservation (React + API Express). Servie sous `/arena/reserver/`. `ocd.pelify.app` redirige vers cette adresse.
- `netlify/functions/api.ts` : API de réservation et de connexion.
- Tournage (`tournage.pelify.app`) et WhatFilm restent des applications externes.

## Netlify
Build : `npm run build`, publication : `dist`.
Variables : `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAILS` (voir `apps/live/.env.example`). Vérifier `/api/health`.
Formulaires : activer Netlify Forms, puis Forms > Notifications pour recevoir les devis par e-mail.

## Développement
`npm install`, `npm run dev` (application), `npm test`, `npm run build`.
