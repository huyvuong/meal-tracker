// Operator SELECT helper outside the application; never import into web routes.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function main(): Promise<void> {
  const [projectArg, envArg, startArg, endArg, scope, owner] = process.argv.slice(2);
  if (!projectArg || !envArg || !startArg || !endArg || !["all", "owner"].includes(scope) || (scope === "owner" && !owner)) {
    throw new Error("Invalid arguments");
  }
  const project = resolve(projectArg);
  const start = new Date(startArg);
  const end = new Date(endArg);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || end.getTime() - start.getTime() > 8 * 86400000) {
    throw new Error("Invalid window");
  }
  const require = createRequire(join(project, "package.json"));
  const { parse } = require("dotenv");
  const envPath = isAbsolute(envArg) ? envArg : join(project, envArg);
  const connection = parse(readFileSync(envPath)).DATABASE_URL;
  if (!connection || !["postgres:", "postgresql:"].includes(new URL(connection).protocol)) {
    throw new Error("Missing PostgreSQL connection");
  }
  const { drizzle } = require("drizzle-orm/neon-http");
  const schema = await import(pathToFileURL(join(project, "db/schema.ts")).href);
  const db = drizzle(connection, { relations: schema.relations });
  const rows = await db.query.meals.findMany({
    columns: { mealType: true, eatenAt: true },
    where: { eatenAt: { gte: start, lt: end }, ...(scope === "owner" ? { userId: owner } : {}) },
    orderBy: { eatenAt: "asc", id: "asc" },
    with: { items: {
      columns: { quantity: true, caloriesPerUnitSnapshot: true },
      ...(scope === "owner" ? { where: { userId: owner } } : {}),
    } },
  });
  process.stdout.write(JSON.stringify(rows));
}

main().catch(() => {
  // Database exceptions can contain private records or credentials.
  process.stderr.write("Could not read meals. Check the env file, dependencies, database availability, and network permissions.\n");
  process.exitCode = 1;
});
