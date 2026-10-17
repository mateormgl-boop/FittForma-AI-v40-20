# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who train: they go to the gym and/or run, from beginner to intermediate, and want to log workouts, meals, water and runs on their phone and see their progress over time. Spanish (Rioplatense) first; the app also ships in English, Portuguese, French, Italian and German.

## Product Purpose

FittForma AI keeps training, nutrition, running and progress in one place on the phone: plan or log a workout, record meals and water, track runs with GPS, earn badges from real records, share with an online community, and ask FittAI for guidance that is applied only with the person's approval. Success is a person opening the app daily and seeing their real progress.

## Positioning

One app instead of four: workouts, nutrition, GPS running and community are connected (a logged session updates Home, Progress and badges; FittAI can take you to any section). Records are never presented as verified when they are self-reported.

## Operating Context

Used on a phone, often at the gym or outdoors between sets or right after a run, sometimes in bright light; also on desktop. Installable PWA that works offline after the first visit. Data lives on the device, with optional cloud copy and community via Supabase.

## Capabilities and Constraints

- Six sections: Inicio, Entrenar (routines, exercises, running, plans), Nutrición (today, log, plan and recipes, history), Progreso (summary, badges, history, body), Comunidad (feed, explore, publish, messages, profile), Perfil; plus FittAI.
- Badges: 4 ranks × 3 levels (Bronce, Plata, Oro, Diamante, I–III); evidence is "Declarada" or "Con ruta GPS", never "verified".
- Single-file frontend (index.html), Node backend without dependencies, Supabase with RLS; deployed on Render.
- Light and dark themes; light is the default on first open, each person can switch.

## Brand Commitments

- Name: FittForma AI. Tagline: "Tu progreso, en un solo lugar."
- New logo: an "F" that forms a running figure, gradient sky blue → blue → violet, on a dark rounded app tile. The current vector is a provisional recreation; the owner will send the original file.
- Visual references supplied by the owner (light and dark mockups of all six sections and FittAI) are binding.
- Voice: Rioplatense Spanish, second person informal (vos), short and encouraging ("Tu cuerpo puede más.", "Comé bien, rendí mejor.").

## Evidence on Hand

- Exercise and section photos under `assets/` (real photos), original SVG illustrations, badge medals drawn in code.
- No real users, testimonials, follower counts or statistics: never fabricate them; demo values in mockups are illustrative only.

## Product Principles

1. Real data only: every number on screen comes from what the person logged.
2. Nothing applied without consent: FittAI proposes, the person approves.
3. Honest evidence: self-reported is labeled as such.
4. Fast to log mid-workout: primary actions reachable in one or two taps.
5. Privacy by default: private profile, data on device unless the person syncs.

## Accessibility & Inclusion

WCAG AA contrast in both themes (4.5:1 body, 3:1 large), 11 px minimum UI text, visible keyboard focus, reduced-motion respected, six languages.
