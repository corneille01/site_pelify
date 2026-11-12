# PELIFY, site complet

Un seul projet, un dossier par univers, mêmes liens qu'avant.

- `/` portail, `/studio/`, `/arena/` (+ `/arena/tournois/`, `/arena/regles/`, application sur `/arena/jouer/`), `/screen/`, `/insights/`, `/market/`, `/devis/`, `/merci/`
- `apps/live` : application Arena (React + API Express) : événements, défis, tournois, notifications, modération. Servie sous `/arena/jouer/`. `ocd.pelify.app` et `/arena/reserver/` redirigent vers cette adresse.
- `netlify/functions/api.ts` : API. `netlify/functions/reminders.ts` : rappels horaires avant les événements.
- Tournage (`tournage.pelify.app`) et WhatFilm restent des applications externes.

## Netlify
Build : `npm run build`, publication : `dist`.
Variables : `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAILS` (voir `apps/live/.env.example`). Vérifier `/api/health`.
Formulaires : activer Netlify Forms, puis Forms > Notifications pour recevoir les devis par e-mail.

## Développement
`npm install`, `npm run dev` (application), `npm test`, `npm run build`.
