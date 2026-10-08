---
name: meal-week-chart
description: Query meal-tracker's PostgreSQL database using its local env connection string and export a Python bar chart of calories per meal for the past week. Use for local database reports, rather than application UI or CRUD changes.
---

# Weekly meal calories

Export a PNG with seven local dates on the x-axis and calories (kcal) per meal on the y-axis. Every meal gets its own bar, including multiple meals of the same type on a day.

Read the target repository's `AGENTS.md`, relevant `docs/`, and `db/README.md` before adapting the scripts. This is an operator-run report outside the web application. It uses database connection privileges, without authenticating a Clerk session. The original workflow requests all entries. Keep scope explicit: `--all-meals` selects all owners; `--user-id` selects one owner for an operator report. Never use the CLI as a web endpoint or a substitute for authenticated application `/data` helpers.

## Run

Requires the project's installed `tsx`, `dotenv`, `drizzle-orm`, and Neon dependencies, Python 3.10+, and `matplotlib`. If matplotlib is missing, install it in a temporary virtual environment, respecting execution and network permissions.

```sh
python3 <skill-directory>/scripts/plot_meals.py \
  --project /Users/vuong/VScode/meal-tracker \
  --all-meals --timezone America/Los_Angeles \
  --output /private/tmp/meal-calories-past-week.png
```

Use the current checkout when its path differs. The exporter reads `DATABASE_URL` from `.env.local`, falling back to `.env`. Use `--env-file` for another file. Never print secrets or pass the connection string as an argument. Errors are deliberately sanitized. Respect network permissions; do not switch databases or run migrations to repair a failed report.

## Semantics

- The window includes today and the preceding six dates in the chosen IANA timezone, from midnight six days ago up to the captured current instant. Future meals are excluded. `--as-of` accepts an offset-aware ISO timestamp for reproducibility.
- Filter by meal `eaten_at`, not creation time. Retrieve all matching meals and related items using one Drizzle query against the project's actual schema, without writes or raw SQL.
- Calories are the exact decimal sum of `quantity × calories_per_unit_snapshot`. Never use current food catalog nutrition, daily totals, or averages as meal calories.
- If any item has null calories, mark the meal **unknown**, without plotting a partial sum or zero. An empty meal is a **draft**. Known zero stays zero. Empty dates stay visible, and a no-data report still exports an explanatory image.
- Colors identify meal types; bars within each date follow meal time. The footer states timezone, scope, window, and missing-data conventions.

Run the report, inspect the exported image, and return a clickable image-file link plus counts of meals and unknown/draft entries. Do not retain raw query results unless requested. Do not automatically commit or upload private output.
