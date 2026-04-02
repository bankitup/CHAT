# Deployment

## Deployment Target

The current CHAT product shell is deployed as a Next.js application on Vercel.

This is the active delivery path for the mobile-first PWA. Supabase remains the backend source of truth for authentication, persisted data, and authorization behavior.

## Required Environment Variables

Set these in Vercel for Production, Preview, and Development as needed.
Use the same values in local `.env.local`.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Notes:

- These are the only required public environment variables for the current shell.
- Do not expose a Supabase service role key in the browser or in public Vercel environment variables.
- Keep local and Vercel values aligned to the same Supabase project when validating production behavior.

## Deploying to Vercel

1. Push the repository to a Git provider supported by Vercel.
2. Import the repository into Vercel.
3. Keep the framework preset as `Next.js`.
4. Add the required environment variables in the Vercel project settings.
5. Deploy once to get the production Vercel domain.
6. Add that domain to the matching Supabase Auth settings.
7. Trigger a fresh production deployment after Auth URLs are confirmed.

The default Vercel flow is sufficient for the current project. No extra deployment plugins or custom infrastructure are required at this stage.

## Supabase Settings That Must Match Production

Before or immediately after the first deployment, verify the following in Supabase:

- `Project Settings` → `API`
  Use the correct project URL and publishable key.

- `Authentication` → `URL Configuration`
  Set the site URL to the production Vercel domain.

- `Authentication` → `URL Configuration`
  Add the production Vercel URL to the allowed redirect URLs.

- `Authentication` → `URL Configuration`
  If you use a preview domain for real auth testing, add that preview URL as well.

- `Authentication` → `Providers`
  Ensure Email auth is enabled if the current login and signup flow depends on email/password.

- `Authentication` → email confirmation behavior
  Make sure this matches the intended product behavior. If email confirmation is required, production testing should include that flow.

- Database schema and RLS
  Confirm the production Supabase project includes the expected messaging tables, policies, and auth assumptions used by the current shell.

## What to Verify After Deployment

Run a short production smoke test on the deployed Vercel URL:

1. Open the app on a mobile browser.
2. Confirm the manifest loads and the app presents as an installable PWA shell.
3. Confirm login works with the production Supabase project.
4. Confirm protected routes redirect signed-out users to `/login`.
5. Confirm `/inbox` loads conversations and lets you start a DM or group.
6. Confirm `/chat/[conversationId]` loads messages, sends a text message, and toggles reactions.
7. Confirm logout clears the session correctly.

Also verify:

- app icons appear correctly when installed
- theme color and standalone behavior look correct on mobile
- raw internal identifiers are not exposed in the core UI
- there are no production environment mismatches between Vercel and Supabase

## Current Scope of Deployment

What is covered now:

- Vercel deployment path for the active Next.js product shell
- public Supabase environment configuration
- mobile-first PWA metadata and manifest support
- SSR auth integration with Supabase
- first-pass messaging flows for inbox, chat, DM/group creation, sending, and reactions

What is not part of deployment yet:

- advanced offline support
- service worker caching strategy
- end-to-end push notification delivery
- realtime delivery infrastructure
- native app distribution

Offline and service worker behavior should be added later only when the product clearly benefits from it.

## Push Readiness Notes

The current app now includes a minimal service worker file and a notification
readiness surface in settings. This prepares the PWA shell for future browser
push work, but it does not yet include:

- persisted push subscriptions
- backend-triggered push delivery
- production notification routing logic

Vercel already serves the app over HTTPS, which is required for browser
notifications and service workers outside localhost.

## Recommended Pre-Deploy Check

Before each production deployment, run:

```bash
npm run typecheck
npm run lint
```

If those pass and the environment variables are correct, the current app is in a reasonable state for Vercel deployment.
