# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
```

No test or lint scripts are configured.

## Environment

`.env.local` requires:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Architecture

Real-time 1-on-1 terminal-styled chat app. Stack: Next.js 16 (App Router), React 19, Supabase (auth + db + realtime + storage), Tailwind CSS v4.

### Auth flow

`middleware.ts` gates all routes. Unauthenticated → `/login`. Authenticated without profile → `/setup`. Authenticated with profile → `/chat`.

Login auto-generates email from nickname (`nickname@terminal.chat`) and uses Supabase email/password auth.

### Data flow

1. `/app/chat/page.tsx` (server component) fetches current user, partner (first other user), and last 50 messages with nested profiles/reactions/reads.
2. `ChatRoom.tsx` (client component) receives initial data and subscribes to Supabase Realtime channel.
3. Realtime listens for `INSERT/DELETE` on `messages`, `reactions`, `message_reads`.
4. Message sends use optimistic UI — temp message added immediately, replaced on DB confirmation, removed on error.

### Supabase clients

- `src/lib/supabase/client.ts` — browser client (use in client components)
- `src/lib/supabase/server.ts` — server client using cookies (use in server components, middleware, route handlers)

### Database schema

See `supabase/schema.sql`. Key tables: `profiles`, `messages`, `reactions`, `message_reads`. RLS is enforced on all tables. Realtime is enabled on all four tables.

Image uploads go to the `messages` Storage bucket. Messages must have either `content` or `image_url` (DB constraint).

### Styling

Tailwind v4 (PostCSS-first, no `tailwind.config`). Custom terminal color palette defined in `src/app/globals.css` `@theme` block: `terminal-bg`, `terminal-green`, `terminal-text`, `terminal-border`, etc. Use these tokens, not raw colors.

### Path alias

`@/*` → `./src/*`
