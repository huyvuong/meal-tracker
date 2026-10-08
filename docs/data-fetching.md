# Data fetching standards

## Server Components only

**All data fetching in this app must be performed via Server Components. Under absolutely no circumstances may Route Handlers be created to fetch data. There are no exceptions.**

- Fetch application data from Server Components, calling database helpers in the repository-root `/data` directory directly.
- Do not create `app/**/route.ts`, `route.js`, Pages Router API routes, or any equivalent endpoint to fetch or expose application data. Server Components must not fetch an internal API endpoint as an intermediary.
- Do not fetch data in Client Components, client hooks, effects, event handlers, or browser-side libraries such as SWR or React Query. Rendering a Client Component on the server does not make it a Server Component.
- Do not use Server Actions as an alternative data fetching endpoint. Application reads belong in Server Components.
- Client Components may receive the minimum necessary, authorized data as serializable props from Server Components and handle local interaction with that data.
- When navigation, filters, pagination, or refreshes require new data, render the relevant Server Component again and fetch through the same authorized server path.

## Database access through `/data`

**Every application database query must be performed by a helper function inside the repository-root `/data` directory, using Drizzle ORM. Raw SQL is prohibited.**

- Organize helpers by the data they access, for example `data/meals.ts` and `data/foods.ts`.
- Mark database helper modules with `import "server-only"` so they cannot be imported into the client module graph. Do not mark read helpers with `"use server"`, which would expose them as Server Functions.
- Use the existing database connection from `@/db` and schema definitions from `@/db/schema` inside these helpers. Keep connection setup and schema definitions in `/db`; keep application query execution in `/data`.
- Server Components call helpers; they must not execute database queries directly. Client Components must not import database helpers or the database connection.
- Use Drizzle's typed query builder, relational query APIs, operators, and aggregate helpers. Do not write SQL strings, SQL template fragments, `sql` tagged templates, `sql.raw`, raw execution calls, or direct database-driver queries.
- This helper requirement covers application reads and writes. Mutations must also use authenticated, ownership-scoped Drizzle helpers in `/data`; they must not become an alternative mechanism for fetching application data.
- Return only the fields needed by the caller. Keep database credentials, internal authorization details, and unnecessary private fields on the server.

## Authentication and user isolation

**A logged-in user may access only their own data. They must never be able to read, modify, delete, or infer another user's private data.**

- Derive the current user ID from the verified server-side Clerk session. Never trust a user ID supplied through props, URL parameters, search parameters, form fields, request bodies, or other client-controlled input as proof of ownership.
- Authenticate inside the data access layer before executing a query. Every externally callable helper must enforce authentication and ownership, directly or through a shared server-only authentication helper. An unauthenticated request must stop before querying user data.
- Scope every query against user-owned data to the authenticated user's ID using Drizzle predicates. For individual records, combine the requested record ID with the ownership predicate in the query itself.
- Apply the same ownership restrictions to lists, searches, counts, aggregates, pagination, joins, nested relations, and related records. Do not fetch unscoped records and filter them afterward in application code or the browser.
- Verify that referenced meals, foods, and meal items belong to the authenticated user when creating or changing relationships. Database foreign keys support integrity but do not replace authentication or ownership checks.
- Never allow caller-provided filters to override or remove the ownership predicate. Never provide an unscoped fallback when a scoped query returns no results.
- For a nonexistent or inaccessible record, return the same safe empty or not-found result without exposing whether another user owns that record.
- Route protection, layout checks, and hidden UI controls are additional safeguards; they do not replace authorization in `/data`.
- Do not share user-specific results through global variables, shared static output, or caches that can serve one user's data to another. Any caching must preserve authenticated user isolation and authorization.

## Review requirements

Before completing a data access change, verify that:

- All application data fetching originates in Server Components, with no fetching Route Handlers, API routes, client fetches, or Server Action read endpoints.
- Every application database query executes inside `/data` through Drizzle ORM, with no raw SQL or direct driver queries.
- Authentication occurs before querying, and every user-owned query enforces the authenticated user's ownership.
- Relevant authorization tests cover unauthenticated access, access to the user's own data, and attempted access to another user's data, including manipulated record IDs and filters.
- Returned props, errors, related records, and cached results do not disclose another user's data.

These requirements apply to new work and changes to existing data access. Framework examples, convenience, and existing noncompliant code do not create exceptions. Follow [the UI standards](ui.md) when rendering fetched data, and read the relevant installed Next.js documentation as required by `AGENTS.md` before changing code.
