# Authentication coding standards

## Required authentication provider

**This app uses Clerk for all authentication and session management through `@clerk/nextjs`. All authentication-related code must use Clerk.**

- Use Clerk for sign-in, sign-up, sign-out, identity verification, password recovery, social sign-in, and any enabled multi-factor authentication flows.
- Do not introduce another authentication provider, a parallel authentication system, custom password storage, or application-managed session cookies or tokens.
- Treat the verified Clerk user ID as the identity used to associate application records with their owner. Email addresses, display names, and client-supplied IDs are not proof of identity.
- Use APIs supported by the installed `@clerk/nextjs` version. Consult the official Clerk documentation and installed SDK types before changing an authentication flow; do not copy deprecated APIs or examples for another SDK version.

These standards apply alongside [the data fetching standards](data-fetching.md) and [the UI standards](ui.md). Read the relevant installed Next.js guides in `node_modules/next/dist/docs/` before changing code, as required by `AGENTS.md`.

## Provider and request integration

- Keep `ClerkProvider` from `@clerk/nextjs` in `app/layout.tsx`, wrapping the routes that use Clerk. It is permitted provider infrastructure under the UI standards.
- Keep Clerk request integration in the repository-root `proxy.ts`, using `clerkMiddleware` from `@clerk/nextjs/server`. This app uses the Next.js Proxy convention; do not add a parallel `middleware.ts`.
- Ensure the Proxy matcher covers routes that call server-side Clerk APIs, authentication paths, and the existing `/__clerk/:path*` integration. Preserve exclusions for framework assets and static files.
- **Calling `clerkMiddleware()` alone does not protect routes.** Authentication and authorization must be explicitly enforced where protected content or data is accessed. Follow Clerk's current resource-based protection guidance rather than relying on URL matching alone.
- Keep sign-in, sign-up, and their required callback and verification paths reachable by signed-out users. Do not create redirect loops by requiring an authenticated session on these paths.
- Keep Proxy lightweight. Application database access and ownership checks belong in `/data`, not in Proxy.

## Server-side authentication and authorization

**Authenticate on the server before accessing private data or performing a protected operation. Client-side authentication state is never an authorization boundary.**

- Import server authentication helpers from `@clerk/nextjs/server`. Use `await auth()` to obtain the verified session and current `userId`; do not parse cookies or decode tokens yourself as a replacement for Clerk verification.
- Stop unauthenticated access before executing a user-data query or mutation. For page requests, use Clerk's `redirectToSignIn()` or the appropriate `auth.protect()` behavior. For mutations, reject unauthorized access without performing the operation.
- Keep server authentication and data helper modules out of the client bundle with `import "server-only"`. Do not expose read helpers as Server Functions with `"use server"`.
- Enforce authentication in every externally callable `/data` helper, directly or through a shared server-only helper. Page, layout, and Proxy checks are additional safeguards and do not replace this check.
- Authenticate and authorize every protected Server Action independently. Treat its arguments as untrusted input even when the UI hides the action from signed-out users.
- Use `auth()` when only session identity is needed. Fetch a Clerk user profile on the server only when its fields are required, and return only the minimum data needed by the interface.
- Do not depend on layout-only checks: layouts can persist across navigation, and hiding children does not prevent other route segments from executing or exposing data.
- Authentication establishes identity; authorization determines access. If a feature requires additional permissions, verify them on the server as well as record ownership. Client-controlled metadata must not grant access.

## User ownership and application data

**A signed-in user may read, create, update, or delete only their own application data.**

- Derive ownership from the verified server-side Clerk `userId`. Never accept a user ID from props, URLs, search parameters, form fields, or request bodies as the authenticated owner.
- Execute all application database queries through repository-root `/data` helpers using Drizzle ORM. Raw SQL and direct database-driver queries are prohibited.
- Scope every user-owned query to the authenticated user. For a specific record, combine its ID and the ownership predicate in the query itself; do not fetch it unscoped and check ownership afterward.
- Apply ownership checks to writes, lists, counts, searches, pagination, joins, nested relations, and related records. Set ownership on creation from the session, and prevent updates from transferring ownership through caller input.
- Verify ownership of referenced meals, foods, and meal items before creating or changing relationships. Foreign keys do not replace authorization.
- Return the same safe empty or not-found result for missing and inaccessible records. Do not disclose whether another user owns a requested record.
- Fetch application data only through Server Components. Do not create fetching Route Handlers, API routes, client fetches, or Server Action read endpoints under the guise of authentication.
- Clerk SDK operations needed to complete authentication flows do not permit browser-side fetching of meal, food, or other application data.
- Never share session state or private results through global variables, shared static output, or caches that can serve one user's data to another. Any caching must preserve authenticated user isolation and authorization.

## Authentication UI and flow behavior

- Follow `docs/ui.md` for every authentication screen and account control: use official shadcn/ui components from `@/components/ui/*`, composed directly in Next.js route files. Do not create custom UI components or wrappers.
- Use Clerk SDK hooks and methods for authentication behavior with shadcn/ui fields, buttons, alerts, dialogs, and menus. Do not introduce Clerk-rendered widgets such as `SignIn`, `SignUp`, `UserButton`, or modal sign-in/sign-up widgets.
- Existing Clerk-rendered widgets in the app are not an exception to the UI standards. Bring affected authentication UI into compliance when modifying it; this document does not claim that every existing screen already complies.
- Use Clerk client hooks only for authentication flow interaction and presentation. Wait for their loaded state before reading session information or enabling dependent controls, and distinguish loading from signed-out state.
- Handle every verification, recovery, or multi-factor step required by the configured Clerk instance. Do not treat submitted credentials or an incomplete sign-up as an authenticated session. Complete the SDK's supported session activation or finalization flow before navigating to protected content.
- Make pending, disabled, validation, and error states accessible, and prevent duplicate submissions. Display safe user-facing errors without exposing credentials, tokens, or internal details.
- Keep the existing `/sign-in` and `/sign-up` route conventions and Clerk redirect configuration consistent. Accept return destinations only when validated as permitted application destinations; never redirect blindly to an arbitrary client-supplied URL.
- Sign out through Clerk's SDK so the session is terminated correctly. Ensure protected content is rechecked after sign-out or an account change; clearing local UI state is insufficient.

## Configuration and sensitive information

- Configure Clerk through environment variables. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is the public client key; `CLERK_SECRET_KEY` must remain server-only and must never receive a `NEXT_PUBLIC_` prefix.
- Keep Clerk sign-in and sign-up URLs aligned with the app's routes, including `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL` when configured. Server-side redirects must use configuration supported by Clerk's server APIs.
- Use the appropriate Clerk instance and keys for each environment. Do not hardcode keys or commit populated environment files.
- Never log credentials, verification codes, session tokens, authorization headers, or secret keys. Do not pass server secrets, complete session objects, or unnecessary private user fields into Client Components or rendered output.
- Let Clerk manage session creation, verification, renewal, and termination. Do not persist authentication tokens or passwords in the application database or browser storage.

## Review requirements

Before completing an authentication-related code change, verify that:

- Clerk remains the sole authentication and session provider, with correct provider and Proxy integration.
- Signed-out and expired-session requests cannot access private data or perform protected operations, including direct Server Action calls.
- Each user can access their own records, while manipulated record IDs, ownership fields, filters, and related records cannot expose or modify another user's data.
- Relevant sign-in, sign-up, verification, recovery, sign-out, redirect, and account-switching flows behave correctly, including loading and error states.
- Authentication UI follows the shadcn/ui standards, and client state or hidden controls are never relied on for authorization.
- Secrets, props, errors, and cached output do not leak private information.
- Relevant existing tests, `npm run lint`, and `npm run typecheck` pass for code changes. Run a production build when rendering or Clerk integration changes.

These requirements are mandatory for new work and changes to existing authentication code. Framework examples and existing noncompliant code do not create exceptions.

## Official references

- [Clerk Next.js setup](https://clerk.com/docs/nextjs/getting-started/quickstart) for provider, environment, and Proxy integration.
- [Clerk server-side `auth()` reference](https://clerk.com/docs/reference/nextjs/app-router/auth) for session identity, protection, and redirects.
- [Clerk `clerkMiddleware()` reference](https://clerk.com/docs/reference/nextjs/clerk-middleware) for request integration and resource-based protection guidance.
