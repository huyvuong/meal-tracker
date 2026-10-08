# Data mutation coding standards

## Required mutation path

**All application data mutations must be performed through Next.js Server Actions defined in colocated files named `actions.ts`. Every database operation used by a mutation must be wrapped in a helper function inside the repository-root `/data` directory and executed using Drizzle ORM.**

The required flow is: user interaction → colocated Server Action → authenticated `/data` helper → Drizzle database call.

- Apply this flow to creates, updates, deletes, archives, bulk changes, and changes to relationships between records.
- Do not perform mutations through Route Handlers, Pages Router API routes, custom HTTP endpoints, browser database clients, or direct database calls in UI code.
- Do not mutate data while rendering a Server Component, page, layout, or template. Server Components may render forms wired to actions; rendering itself must remain free of writes.
- Server Actions are mutation entry points, not data fetching endpoints. Application reads remain in Server Components through authorized `/data` helpers, as required by [the data fetching standards](data-fetching.md).

Follow [the authentication standards](auth.md) and [the UI standards](ui.md) alongside this document. Before changing code, read the relevant installed Next.js guides in `node_modules/next/dist/docs/`, including the mutation, Server Action, and data security guides, as required by `AGENTS.md`.

## Colocated Server Action files

- Define actions in a dedicated `actions.ts` next to the page or route feature that uses them, such as `app/dashboard/actions.ts` or `app/dashboard/meals/[id]/actions.ts` beside that route's `page.tsx`.
- When related routes share an action, place its `actions.ts` at their nearest appropriate shared route directory. Reuse the `/data` helper for shared database behavior rather than duplicating queries across action files.
- Put `"use server"` at the top of each action file. Export only async Server Action functions from it; keep constants, schemas, types, and other utilities in appropriate non-action modules.
- Do not define inline actions inside pages, layouts, or components. Although Next.js supports them, this project's standard requires dedicated colocated `actions.ts` files.
- Use descriptive operation names such as `createMealAction`, `updateFoodAction`, and `deleteMealAction`.
- Keep actions focused on input parsing, runtime validation, authenticated delegation, safe result handling, and post-mutation revalidation or navigation.
- Actions must call `/data` mutation helpers. They must not import the database connection or execute database queries themselves, including reads needed to validate a write.
- Client route code may import Server Actions from the colocated file or receive action references from a Server Component. It must never import `/data` helpers, the database connection, or server credentials.

## Server Action parameter types

**Every Server Action parameter must have an explicit TypeScript type annotation. Server Actions must not accept `FormData`.**

- Use explicitly typed primitives or narrowly defined input types and interfaces. Annotate every parameter, including optional parameters, parameters with default values, and previous-state parameters used with `useActionState`; do not rely on inferred parameter types or use `any`.
- Do not use `FormData` directly, through a type alias, in a union, or nested inside an input object. Pass typed, serializable values or objects to the action instead.
- Convert form input into the action's typed input before invoking it. Do not wire a typed-input action directly to a form mechanism that passes `FormData`; adapt the submission in route interaction logic.
- Explicit types do not replace runtime validation. Every Server Action must validate its arguments with Zod on the server before delegating to a mutation helper.

## Mutation helpers in `/data`

**The `/data` layer owns database execution, authentication, record authorization, and mutation integrity.**

- Organize helpers by domain, for example `data/meals.ts` and `data/foods.ts`. Use clear operation-specific helpers rather than exposing a generic caller-controlled query executor.
- Mark helper modules with `import "server-only"`. Do not mark them with `"use server"`: the public mutation entry points belong in colocated `actions.ts` files.
- Use the existing connection from `@/db` and schema definitions from `@/db/schema`. Keep connection setup and schema definitions in `/db`; keep query execution in `/data`.
- Wrap every insert, update, delete, upsert, authorization lookup, and other query required by the operation in these helpers using Drizzle's typed APIs and operators.
- Raw SQL is prohibited: do not use SQL strings, SQL template fragments, `sql` tagged templates, `sql.raw`, raw execution calls, or direct database-driver queries.
- Accept narrowly defined, validated inputs. Explicitly select allowed fields for inserts and updates; do not spread arbitrary request objects or complete client-supplied records into database calls.
- Return only the minimum mutation outcome needed by the action, such as a created ID or an affected-record result. Do not return complete private records or use a mutation helper as a general read endpoint.
- In application runtime code, invoke these write helpers only through the required Server Action path. Internal helper composition may support an action's operation; it must not create another mutation entry point.

## Clerk authentication and ownership

- Treat every Server Action as externally callable, including through a direct POST request. Page checks, hidden controls, action IDs, and framework protections do not establish authorization.
- Ensure every action authenticates and authorizes the operation, directly or through the authenticated `/data` helper it calls. Every externally callable data helper must independently enforce these guarantees, directly or through a shared server-only helper.
- Obtain the current user from the verified server-side Clerk session using `await auth()` from `@clerk/nextjs/server`. Reject signed-out or invalid-session requests before querying or changing user data.
- Never trust a caller-provided `userId`, ownership field, hidden form field, bound argument, URL parameter, or prior action state as proof of identity or ownership.
- Set ownership on new records from the verified Clerk user ID. Prevent updates from changing ownership through caller input.
- Scope updates and deletes to both the requested record ID and authenticated user's ID in the database predicate. Apply ownership predicates to bulk operations, upserts, and supporting reads as well.
- Verify ownership of every referenced meal, food, and meal item before creating or changing relationships. Database foreign keys support integrity but do not replace authorization.
- Use the same safe result for nonexistent and inaccessible records. Never retry an unsuccessful scoped operation without its ownership predicate or disclose another user's record existence.

## Validation and mutation integrity

**All Server Actions must validate every argument using Zod before calling mutation helpers or performing any mutation.**

- Define Zod schemas for all action arguments, including optional values, bound arguments, and previous-state arguments. Keep reusable schemas in non-action modules and import them into `actions.ts`.
- Run Zod validation inside each Server Action on every invocation. Client-side validation, TypeScript annotations, and validation performed only in a helper do not replace this requirement.
- Pass only successfully parsed Zod output to mutation helpers. If validation fails, stop the operation and return safe validation errors without executing a mutation.
- Validate inputs on the server before attempting a write. TypeScript types and client-side validation do not validate incoming requests at runtime.
- Check IDs, required values, enums, text lengths, dates, quantities, decimal precision, and collection sizes as appropriate. Reject malformed or unsupported values with safe validation errors.
- Extract permitted fields explicitly from the Zod-validated input. Do not use unchecked casts or generic object spreading as a replacement for validation.
- Enforce business rules in the helper so they cannot be bypassed by another action. Reads needed for validation or ownership checks must also use authorized Drizzle queries inside `/data`.
- Preserve the database contract in `db/README.md`: quantities represent food units, nutrition uses decimal strings, logged items copy trusted food values into snapshots, and later catalog edits do not overwrite historical snapshots.
- Create a completed meal with at least one item atomically. Use a transaction mechanism supported by the configured Drizzle driver for related writes that must succeed or fail together; do not assume an interactive transaction API is available on the current Neon HTTP connection.
- Keep transaction execution inside `/data`. Do not use independent writes or `Promise.all` as a substitute for atomicity, and do not report success after a partial failure.
- Archive referenced foods instead of deleting them, and respect database uniqueness, relationship, and cascade constraints. Handle constraint failures without leaking internal database details.
- Account for concurrent requests and repeated submissions where they can corrupt data or create duplicates. Disabled buttons and client action ordering do not provide database-level guarantees.

## Results, errors, and refreshing the UI

- Return small, typed, serializable results suitable for the UI. Expected validation and business-rule failures should have useful field errors or safe messages; never return raw database errors, credentials, or internal records.
- Await the helper's successful completion before reporting success, invalidating caches, or redirecting. Do not catch a write failure and return a success result.
- Keep Next.js revalidation and navigation in `actions.ts`, leaving database helpers independent of route-specific UI behavior.
- After a successful mutation, revalidate affected paths or user-scoped cache tags when cached data must change. Use the installed Next.js API appropriate to the required freshness; a router refresh alone does not invalidate cached data.
- Re-render Server Components to read updated application data through `/data`. Do not add a browser fetch or a Server Action read endpoint to reload the affected list.
- Preserve user isolation in cache keys, tags, results, and refreshed output. Invalidation does not replace authorization on the next read.
- Revalidate before calling `redirect()`, and keep redirects outside catch blocks that would swallow Next.js control-flow exceptions. Validate any client-supplied destination before navigation.
- Use official shadcn/ui controls for submission, pending, success, and error states. Prevent duplicate submissions while pending, preserve useful form input on failure, and roll back any optimistic UI when the mutation fails.

## Review requirements

Before completing a mutation-related code change, verify that:

- Every application write enters through a Server Action in a colocated `actions.ts` file with a top-level `"use server"` directive.
- Every Server Action parameter has an explicit TypeScript type annotation, and no action accepts `FormData` directly or indirectly.
- Every Server Action validates all arguments using Zod on each invocation and passes only successfully parsed values to mutation helpers; invalid arguments cannot trigger a mutation.
- All database operations, including supporting reads and transactions, execute through server-only `/data` helpers using Drizzle ORM, with no raw SQL or direct driver queries.
- Server-side validation rejects invalid inputs, and authentication and ownership checks prevent signed-out access and changes to another user's records or relationships.
- Relevant tests cover successful writes, invalid input, manipulated IDs and ownership fields, inaccessible records, and atomic rollback or duplicate handling where applicable.
- Failed operations produce safe errors and no false success; successful operations update the relevant Server Component output without introducing fetching endpoints.
- Returned values, errors, caches, and UI states preserve private data and follow the existing authentication and UI standards.
- Relevant existing tests, `npm run lint`, and `npm run typecheck` pass for code changes. Run a production build when the change affects Server Action integration or rendering.

These standards are mandatory for new work and changes to existing mutations. Framework examples that query databases directly in actions, define inline actions, or use alternative mutation endpoints do not override this project's required structure.

## Framework references

- [Next.js mutating data](https://nextjs.org/docs/app/getting-started/mutating-data) explains Server Action creation and invocation.
- [Next.js data security](https://nextjs.org/docs/app/guides/data-security) explains authenticated data access layers, untrusted inputs, and safe return values.
- For version-specific behavior, consult the installed guides in `node_modules/next/dist/docs/` before implementing these standards.
