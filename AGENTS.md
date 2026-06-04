# AGENTS.md — apartment-manager

## Project Status

This is a **greenfield project** — implementation in progress.

## Project Intent

Apartment management application for tracking Airbnb income, expenses, and profitability.

## Bootstrapping Checklist

When setting up this project, an AI agent should:

1. ~~Confirm tech stack with the user before generating scaffolding~~ ✅ Option A chosen
2. ~~Initialize version control (`git init`) and create a `.gitignore`~~ ✅
3. ~~Set up `package.json` with pnpm~~ ✅
4. ~~Scaffold React + Vite project with TypeScript~~ ✅
5. ~~Update this file with architecture decisions, conventions, and key commands~~ ✅

## Conventions

- **Language/Framework:** TypeScript / React 19 + Vite
- **Package Manager:** pnpm
- **UI:** shadcn/ui + Tailwind CSS 4
- **Database:** PostgreSQL (Supabase) — accessed via Supabase JS client
- **Routing:** React Router v7
- **State Management:** TanStack Query (server state) + Zustand (client state if needed)
- **Testing:** TBD (Vitest + Testing Library planned)
- **Linting/Formatting:** ESLint + Prettier
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)

## Key Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Run dev server
pnpm build            # Production build
pnpm lint             # Lint
pnpm preview          # Preview production build
```

## Architecture Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-04 | Option A: React + Vite SPA | Simpler, familiar (user has React+Vite experience), fast DX |
| 2026-06-04 | Supabase (hosted PostgreSQL + API) | No backend needed, auto-generated REST/realtime, free tier |
| 2026-06-04 | React Router v7 | Standard SPA routing, file-based optional |
| 2026-06-04 | TanStack Query | Caching, refetching, optimistic updates for Supabase data |
| 2026-06-04 | pnpm | Fast, disk-efficient, strict |
| 2026-06-04 | shadcn/ui + Tailwind | Full control, no runtime overhead |
