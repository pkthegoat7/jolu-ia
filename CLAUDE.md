# Jolu AI — Skin Frontend

Next.js 16 app for AI-powered skin analysis. Two distinct user flows: (1) unauthenticated leads via campaign tokens that capture contact info and run a skin analysis; (2) authenticated admin panel for managing leads, campaigns, and settings.

## Stack

- **Framework**: Next.js 16.2.4 (App Router, `--webpack` flag required)
- **Language**: TypeScript + React 19
- **Database**: PostgreSQL via Prisma 7 + `@prisma/adapter-pg`
- **Auth**: JWT in HttpOnly cookie (`admin_token`, 7d expiry) — `lib/jwt.ts`
- **AI**: `@anthropic-ai/sdk` + `openai` SDK + `@mediapipe/tasks-vision`
- **Email**: Resend + Nodemailer
- **Styling**: Tailwind CSS v4
- **Mobile**: Capacitor (Android) — `npm run mobile:sync`
- **PWA**: `@ducanh2912/next-pwa`

## Commands

```bash
npm run dev          # dev server (webpack mode)
npm run build        # prisma generate + next build
npm run lint         # eslint
npm run mobile:sync  # sync to Android via Capacitor
```

## Project Structure

```
app/
  page.tsx              # Public landing / campaign entry (lead capture)
  layout.tsx
  globals.css
  ClientWrapper.tsx
  login/                # Admin login page
  obrigado/             # Post-analysis thank-you page
  analise/page.tsx      # Skin analysis flow (public, token-gated)
  dashboard/            # Redirect target after admin login
  admin/
    page.tsx            # Admin login form
    dashboard/page.tsx  # Admin dashboard
    leads/page.tsx      # Lead management

  api/
    auth/login/         # POST — bcrypt verify, issue JWT cookie
    auth/logout/        # POST — clear cookie
    auth/register/      # POST — create admin user
    auth/profile/       # GET — current user from JWT
    analise/upload/     # POST — upload image, run skin analysis, save SkinAnalysis
    leads/              # GET list, GET [id], PATCH [id]
    leads/validate-token/ # POST — validate campaign token slug
    admin/leads/        # GET — paginated leads with analysis data
    admin/tokens/       # GET/POST — campaign token CRUD
    admin/stats/        # GET — dashboard stats
    admin/settings/     # GET/PUT — webhook URL

lib/
  jwt.ts       # signJwt, verifyJwt, getAuthUser, cookieOptions
  prisma.ts    # Prisma client singleton
  api.ts       # Client-side fetch helpers
  analise.ts   # Skin analysis logic
  ssrf.ts      # SSRF protection for image URL validation

middleware.ts  # Protects /admin/dashboard/* and /admin/leads/* — redirects to /admin if no cookie
prisma/schema.prisma
```

## Database Models

| Model | Purpose |
|---|---|
| `User` | Admin users (role: ADMIN/VIEWER), linked to Clinic |
| `Clinic` | Groups users and products |
| `Lead` | Contact captured via campaign token (nome, email, telefone) |
| `CampaignToken` | Slug-based tokens linking leads to campaigns |
| `SkinAnalysis` | AI analysis result for a Lead (1:1 with Lead) |
| `Analise` | Legacy — authenticated-user analyses (keep, do not remove) |
| `Analysis` | Legacy — old model, keep for existing data |
| `Product` | Legacy — not in active code paths |
| `Settings` | Singleton row (`id = "default"`) — stores webhookUrl |

## Auth Flow

- Admin routes protected by `middleware.ts` (cookie presence check only)
- Full JWT verification in each API handler via `getAuthUser(request)`
- Cookie name: `admin_token` | HttpOnly, SameSite=Strict, Secure in prod
- `JWT_SECRET` env var required in production

## Key Conventions

- Always run dev with `npm run dev` (uses `--webpack`; Turbopack not supported)
- Prisma migrations: run `npx prisma migrate dev` locally; `prisma generate` runs automatically on build
- New analyses go through `SkinAnalysis` model, not legacy `Analysis`/`Analise`
- API routes validate JWT via `getAuthUser` from `lib/jwt.ts` — do not bypass
- SSRF guard in `lib/ssrf.ts` must wrap any user-supplied image URLs before fetching

## Env Vars Required

```
DATABASE_URL        # PostgreSQL connection string
JWT_SECRET          # Required in production
ANTHROPIC_API_KEY   # Skin analysis AI
RESEND_API_KEY      # Email sending
```
