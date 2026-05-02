# replit.md

## Overview

**راوي** (Rawi) — Arabic Creative Writing Platform. A full-stack web application for writing, managing, and publishing Arabic novels. Fully RTL, vanilla HTML/CSS/JS frontend served from `public/`, Express backend with PostgreSQL.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Stack
- **Backend**: Express (TypeScript), `server/` directory
- **Frontend**: Vanilla HTML + CSS + JS, served from `public/` directory (NO React/Vite anymore)
- **Database**: PostgreSQL via Drizzle ORM (`shared/schema.ts`)
- **Session**: express-session with SESSION_SECRET env var
- **AI**: OpenAI via Replit integration (`server/replit_integrations/image/client.ts`)
- **File Storage**: multer → `uploads/` directory (local disk)

### Frontend Pages (public/)
All pages share `public/css/style.css` and `public/js/common.js`.

| File | Route | Description |
|------|-------|-------------|
| `index.html` | `/` `/index.html` | My Novels (auth required) |
| `auth.html` | `/auth` `/login` `/signup` | Login + Signup tabs |
| `library.html` | `/library` `/novels` | Public novel library + PDF import |
| `novel.html` | `/novel?id=X` | Novel dashboard (chapters, characters, AI) |
| `editor.html` | `/editor?novelId=X&chapterId=Y` | Chapter editor with AI generation |
| `profile.html` | `/profile?username=X` | User profile |
| `settings.html` | `/settings` | Profile settings + avatar AI |
| `read.html` | `/read?id=X` | Novel reading view |
| `admin.html` | `/admin` | Admin panel (email-gated) |
| `about.html` | `/about` | About راوي |
| `contact.html` | `/contact` | Contact us |
| `privacy.html` | `/privacy` | Privacy policy |
| `terms.html` | `/terms` | Terms of service |

### Shared Utilities (public/js/common.js)
- `api` — fetch wrapper (GET/POST/PUT/PATCH/DELETE)
- `getUser()` / `requireAuth()` / `logout()` — auth helpers
- `toast(message, type)` — toast notifications
- `confirmDialog(msg)` — promise-based confirm dialog
- `openModal(id)` / `closeModal(id)` — modal helpers
- `renderSidebar(active)` / `renderMobileNav(active)` — nav rendering
- `uploadFile(file)` — file upload helper
- `escHtml`, `formatDate`, `avatarHtml`, `coverHtml`, `genreBadges`, `statusBadge`, `setLoading` — utilities

### Backend (server/)

| File | Purpose |
|------|---------|
| `index.ts` | Express app, sessions, static file serving from `public/` |
| `routes.ts` | All API routes |
| `storage.ts` | Database interface + Drizzle ORM implementation |
| `moderation.ts` | OpenAI content moderation (hidden, auto-applied) |
| `auth.ts` | bcrypt password hashing + login/signup |
| `ai_service.ts` | AI plot and chapter generation |
| `upload.ts` | multer configuration |

### Key API Endpoints

**Auth:** POST `/api/auth/signup` `/api/auth/login` `/api/auth/logout`, GET `/api/auth/me`, PATCH `/api/auth/profile`

**Novels:** GET/POST `/api/novels`, GET `/api/my-novels`, GET `/api/novels/published`, GET/PUT/DELETE `/api/novels/:id`, POST `/api/novels/import-pdf` (PDF upload)

**Chapters:** GET/POST `/api/novels/:novelId/chapters`, GET/PUT/DELETE `/api/chapters/:id`

**Characters:** GET/POST `/api/novels/:novelId/characters`, PUT/DELETE `/api/characters/:id`

**AI:** POST `/api/ai/generate-plot`, POST `/api/ai/generate-chapter`, POST `/api/ai/generate-cover`, POST `/api/ai/generate-avatar`

**Admin (email-gated):** GET `/api/admin/check`, GET `/api/admin/novels`, DELETE `/api/admin/novels/:id`, GET `/api/admin/users`, DELETE `/api/admin/users/:id`

**Users:** GET `/api/users/:username/profile`, POST/DELETE `/api/users/:username/follow`

### Features

1. **Content Moderation (Hidden)** — `server/moderation.ts` uses OpenAI moderation API on all novel/chapter content saves. Blocks pornographic/violent/hate content silently.

2. **Admin Panel** — `/admin.html` restricted to email `ahmad.meshaal.2040@gmail.com`. Can delete any novel or user account with cascading deletion.

3. **PDF Import** — POST `/api/novels/import-pdf` accepts PDF, parses text with `pdf-parse`, auto-splits into chapters by Arabic/English chapter markers or 4000-char chunks, publishes novel.

4. **AI Features** — Plot generation, chapter writing, cover image (DALL-E), avatar generation. All AI is behind `/api/ai/*` routes.

5. **Follow System** — Users can follow/unfollow authors.

6. **RTL Design** — Full Arabic RTL support. Primary color `#C87539` (terracotta). Fonts: Amiri (headings) + Noto Sans Arabic (body).

### Admin Account
- Email: `ahmad.meshaal.2040@gmail.com`
- Access via `/admin.html` or Settings page link

### Contact
- Email: `ahmad.meshaalp@gmail.com`
- Shown on `/contact.html` and `/about.html`

### Design Tokens
- Primary: `#C87539`
- Primary Dark: `#A85E28`
- Background: `#FAF9F6`
- Foreground: `#22262A`
- Border: `rgba(0,0,0,0.08)`
