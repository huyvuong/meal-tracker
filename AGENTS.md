## Mandatory: read project documentation before generating code

**Codex must ALWAYS first read the relevant documentation in the project's `/docs` directory before generating or modifying any code.** This means `docs/` at the repository root, not a system-level directory.

- Identify and read every documentation file relevant to the task before writing code, and follow its standards throughout the implementation.
- For any UI work, always read and follow [`docs/ui.md`](docs/ui.md): only official shadcn/ui components may be used, and no custom UI components may be created.
- Before generating or modifying server-side code involving data fetching or database access, always read and follow [`docs/data-fetching.md`](docs/data-fetching.md) as mandatory coding standards: fetch data only through Server Components, never create Route Handlers for data fetching, execute database queries only through `/data` helpers using Drizzle ORM without raw SQL, and enforce authenticated user ownership so users can access only their own data.
- Before generating or modifying authentication, session management, route protection, or authorization code, always read and follow [`docs/auth.md`](docs/auth.md): use Clerk as the sole authentication provider, verify authentication and ownership on the server, and follow the documented authentication UI and security standards.
- Before generating or modifying data mutation code, always read and follow [`docs/data mutations.md`](<docs/data mutations.md>): perform mutations only through Server Actions in colocated `actions.ts` files that delegate database operations to authenticated, ownership-scoped `/data` helpers using Drizzle ORM without raw SQL. Every Server Action parameter must have an explicit TypeScript type, must not use `FormData`, and must be validated with Zod inside the action before calling mutation helpers.
- When a task spans multiple areas, consult the relevant documentation for each area. Recheck `/docs` when the scope changes.
- If no relevant documentation exists, state that gap and follow the remaining project instructions; do not invent undocumented standards.
- These project documentation requirements apply in addition to the Next.js documentation requirements below.

## Next.js feedback exception

This project rule overrides the generated Next.js feedback instructions below: Turbopack failures do not qualify for Next.js feedback. Do not retain them as feedback candidates, prepare report drafts, or open feedback forms for them. Do not run the feedback command when Turbopack failures are the only candidates. Continue troubleshooting and verifying the task normally; the feedback requirements still apply to other qualifying Next.js issues.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Ignore routine debugging and unverified changes. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Keep a qualifying candidate through the reporting pass even if you resolve or work around it. A successful fix changes the report outcome; it does not erase the friction that qualified it.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `node node_modules/next/dist/bin/next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->
