# Project Idea — Fantasy Liga BetPlay

---

## Problem

En Colombia no existe una plataforma de Fantasy Football dedicada a la Liga BetPlay Dimayor. Los aficionados colombianos que quieren una experiencia tipo Fantasy Premier League deben recurrir a plataformas genéricas internacionales que no cubren el fútbol local, o simplemente no tienen opción. Esto deja sin atender a millones de seguidores de equipos como Nacional, Millonarios, América, Junior, Santa Fe, etc., que quieren competir entre amigos prediciendo el rendimiento real de los jugadores de su liga.

## Target Users

- **Aficionados casuales del fútbol colombiano** (18-45 años) que siguen la Liga BetPlay semanalmente y quieren una capa de gamificación social sobre los partidos reales.
- **Grupos de amigos / compañeros de trabajo** que crean ligas privadas para competir entre ellos durante el torneo (Apertura y Finalización).
- Usuarios cómodos con apps web móviles, redes sociales, y WhatsApp como canal de comunicación principal.

## Current Pain / Baseline

- No existe un producto de Fantasy dedicado a la Liga BetPlay con datos en tiempo real.
- Algunos aficionados improvisan con hojas de cálculo o grupos de WhatsApp con reglas manuales — alto esfuerzo, sin automatización de puntajes.
- Las plataformas internacionales (Fantasy Premier League, LaLiga Fantasy) no cubren el fútbol colombiano.

## Business Rules

The system must allow users to register and create an account (email + password, or Google OAuth).
The system must present the full roster of Liga BetPlay players organized by team and position (POR, DEF, MED, DEL).
The system must let each user draft a fantasy squad of 11 starters + 4 substitutes within a salary cap budget.
The system must assign a market value to each player based on historical performance and popularity.
The system must calculate fantasy points per player per matchday based on a defined scoring system (goals, assists, clean sheets, cards, minutes played, bonus).
The system must update player stats and scores automatically after each Liga BetPlay matchday using a third-party sports data API (e.g., API-Football).
The system must allow users to create private leagues and invite friends via a shareable code or link.
The system must display a league leaderboard ranked by total accumulated points.
The system must enforce a transfer window: users can make a limited number of free transfers between matchdays (e.g., 2 free transfers per matchday, additional transfers cost penalty points).
The system must lock team selections before the first match of each matchday (deadline).
The system must allow the user to designate a captain (2x points) and vice-captain (1.5x points if captain doesn't play).
The system must support both Liga BetPlay tournament formats: Apertura and Finalización, with independent scoring per tournament.
The system must show a global leaderboard across all users (not just within a league).

## Success Criteria

Given a new user, when they complete registration, then they can immediately access the full player catalog and start building their squad.
Given a user building a squad, when they select 15 players (11 + 4 subs), then the system validates formation rules (min/max per position) and salary cap compliance before confirming.
Given a Liga BetPlay matchday has concluded, when the data API reports final stats, then all fantasy scores are calculated and leaderboards updated within 2 hours.
Given a user in a private league, when they share the invite code with a friend, then the friend can join the league and see the leaderboard.
Given the transfer deadline has passed, when a user tries to modify their squad, then the system blocks the change until the next transfer window opens.
Given a captain scores, when points are calculated, then that player's points are doubled in the user's total.

## Hard Constraints

- Zero costo de licenciamiento de datos en MVP: usar API-Football tier gratuito o freemium (cubre Liga BetPlay con límite de requests).
- No app nativa para MVP — solo web app responsive (mobile-first).
- Hosting económico: debe poder correr en un VPS básico o tier gratuito de servicios cloud.
- El sistema NO realiza apuestas con dinero real — es puramente recreativo/social.
- Cumplir con la Ley 1581 de 2012 (protección de datos personales en Colombia).

## Out of Scope

- No app móvil nativa (iOS/Android) — solo web responsive.
- No integración con apuestas deportivas ni dinero real.
- No chat en vivo dentro de la plataforma (se asume WhatsApp como canal externo).
- No soporte multi-liga (solo Liga BetPlay Dimayor para MVP).
- No draft en vivo estilo NFL — el modelo es salary cap con mercado abierto.
- No contenido editorial (noticias, análisis) — solo datos y mecánica de juego.
- No sistema de logros/badges en MVP.
- No notificaciones push (solo email básico para deadlines).

## Tech Stack

- **Frontend:** Next.js (React) — mobile-first responsive
- **Backend:** Node.js (API REST)
- **Database:** PostgreSQL
- **Data provider:** API-Football (via RapidAPI) — cubre Liga BetPlay
- **Auth:** NextAuth.js (email + Google OAuth)
- **Hosting:** Vercel (frontend) + Railway/Render (backend + DB)
- **Cron jobs:** Node-cron o servicio del hosting para polling de datos post-partido

## Assets

- API-Football docs: https://www.api-football.com/documentation-v3
- Liga BetPlay en API-Football: league ID 239 (Colombia Primera A)
- Scoring reference: Fantasy Premier League scoring system (adapted for Colombian league context)
