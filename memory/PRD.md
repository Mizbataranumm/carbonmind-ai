# CarbonMind AI — PRD

## Original Problem Statement
Build "CarbonMind AI" — a futuristic, demo/Phase-1 academic project showcasing a
Carbon Footprint Tracking & Reduction platform. Priority: stunning UI/UX,
smooth animations, futuristic dashboard, demo-ready interactions. Mock data is
acceptable. Theme: dark futuristic (#071014), neon green (#00FFB2), cyan (#00D9FF),
glassmorphism, Framer Motion animations. Inspired by CarbonTracker, EcoTrack, EcoLogic.

## Architecture
- **Frontend**: React 19, React Router DOM, Tailwind CSS, Framer Motion, Recharts, lucide-react, sonner.
- **Backend**: FastAPI + MongoDB (motor) — endpoints prefixed `/api`.
- **AI**: Gemini 3 Flash via Emergent Universal LLM Key (`emergentintegrations`).
- **Auth**: Demo-only (no JWT). Stores user in localStorage via `UserContext`.

## Pages Implemented (2026-02-13)
- `/` Landing — animated Earth orb, particle field, hero CTA, feature grid, research section.
- `/auth` Split-screen futuristic login with demo-login.
- `/dashboard` Carbon Score (circular SVG), weekly trend (area chart), breakdown (pie),
  prediction (line + risk meters), AI chat (Gemini), voice assistant (browser TTS),
  achievements, recommendations.
- `/tracker` Live emissions area chart, 4 category cards, activity feed, 56-cell heatmap.
- `/future` AI Future Simulator — lifestyle form → cinematic result with Earth visual,
  10-year trajectory chart, AI prescriptive actions.
- `/community` Sustainability feed, eco-challenges, leaderboard.

## Backend Endpoints
- `GET /api/` health
- `POST /api/auth/demo-login` — returns mock user profile
- `GET /api/carbon/stats` — dashboard mock data
- `GET /api/tracker/live` — tracker mock data
- `POST /api/future/simulate` — computed projection (real math, mock model)
- `GET /api/community/feed` — feed mock data
- `POST /api/chat/sustainability` — Gemini 3 Flash (graceful fallback)

## Implementation Notes
- Fonts: Outfit (display), Manrope (body), JetBrains Mono (data) — avoided Inter.
- CSS-based animated Earth (no heavy 3D dependency) — earth-orb + orbital rings.
- All interactive elements have unique `data-testid`s.
- 100% backend tests passing; frontend e2e flows verified by testing subagent.

## Prioritized Backlog (P0/P1/P2)
- **P1** — Add data-testids on Future result elements + Community list items.
- **P1** — Persist user emissions to MongoDB (currently mocked).
- **P2** — Real-time WebSocket emissions stream.
- **P2** — Carbon DNA generator page (animated SVG identity).
- **P2** — Mobile sidebar via Shadcn Sheet (currently hidden < lg).
- **P2** — Eco Rage Meter + Carbon Aura customization screen.

## Next Tasks
1. Validate visual experience with user feedback.
2. Iterate on Future Simulator with more lifestyle inputs.
3. Add MongoDB persistence + login flow if user wants beyond demo.
