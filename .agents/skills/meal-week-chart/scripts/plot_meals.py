#!/usr/bin/env python3
"""Read logged meal snapshots through Drizzle and export a weekly PNG."""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal, localcontext
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from zoneinfo import ZoneInfo


class ReportError(Exception):
    """A diagnostic that is safe to display."""


def report_window(tz, as_of=None):
    end = datetime.fromisoformat(as_of.replace("Z", "+00:00")) if as_of else datetime.now(timezone.utc)
    if end.tzinfo is None or end.utcoffset() is None:
        raise ReportError("--as-of must include a UTC offset")
    end = end.astimezone(tz)
    first = end.date() - timedelta(days=6)
    return datetime.combine(first, time.min, tzinfo=tz), end, [first + timedelta(days=i) for i in range(7)]


def meal_calories(items):
    if not items:
        return None, "draft"
    if any(item["caloriesPerUnitSnapshot"] is None for item in items):
        return None, "unknown"
    with localcontext() as context:
        context.prec = 50
        total = Decimal(0)
        for item in items:
            quantity = Decimal(item["quantity"])
            calories = Decimal(item["caloriesPerUnitSnapshot"])
            if not quantity.is_finite() or quantity <= 0 or not calories.is_finite() or calories < 0:
                raise ReportError("Invalid logged nutrition")
            total += quantity * calories
    return total, "known"


def fetch_meals(project, env_file, start, end, owner):
    if env_file is None:
        env_file = next((name for name in (".env.local", ".env") if (project / name).is_file()), None)
    if env_file is None:
        raise ReportError("No env file found; provide --env-file")
    loader = subprocess.run(
        ["node", "-e", "const {createRequire}=require('node:module'); console.log(createRequire(process.argv[1]).resolve('tsx/esm'))", str(project / "package.json")],
        capture_output=True, text=True, timeout=15,
    )
    if loader.returncode:
        raise ReportError("Project dependencies unavailable")
    result = subprocess.run(
        ["node", "--import", Path(loader.stdout.strip()).as_uri(), str(Path(__file__).with_name("export_meals.ts")),
         str(project), env_file, start.isoformat(), end.isoformat(), "owner" if owner else "all", *([owner] if owner else [])],
        cwd=project, capture_output=True, text=True, timeout=60,
    )
    if result.returncode:
        raise ReportError("Could not read meals; check the env file, database availability, and network permissions")
    return json.loads(result.stdout)


def plot_meals(rows, start, end, dates, output, scope):
    with tempfile.TemporaryDirectory(prefix="meal-chart-mpl-") as cache:
        os.environ.setdefault("MPLCONFIGDIR", cache)
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.patches import Patch
        from matplotlib.lines import Line2D
        from matplotlib.ticker import MaxNLocator

        colors = {"breakfast": "#0072B2", "lunch": "#009E73", "dinner": "#D55E00", "snack": "#CC79A7", "other": "#757575"}
        groups = defaultdict(list)
        for row in rows:
            eaten = datetime.fromisoformat(row["eatenAt"].replace("Z", "+00:00")).astimezone(start.tzinfo)
            if start.astimezone(timezone.utc) <= eaten.astimezone(timezone.utc) < end.astimezone(timezone.utc):
                groups[eaten.date()].append((eaten, row))
        counts = {"known": 0, "unknown": 0, "draft": 0}
        fig, ax = plt.subplots(figsize=(14, 7.5))
        fig.patch.set_facecolor("#FAFBFD")
        ax.set_facecolor("#FAFBFD")
        seen_types = set()
        maximum = 0.0
        max_day_count = max((len(group) for group in groups.values()), default=0)
        for day_index, day in enumerate(dates):
            meals = sorted(groups[day], key=lambda entry: entry[0])
            count = len(meals)
            step = min(0.18, 0.8 / max(1, count))
            for i, (_, row) in enumerate(meals):
                x = day_index + (i - (count - 1) / 2) * step
                value, status = meal_calories(row["items"])
                counts[status] += 1
                if value is None:
                    ax.annotate("?" if status == "unknown" else "D", (x, 0), xytext=(0, 7), textcoords="offset points", ha="center", fontsize=10, color="#555555", weight="bold")
                    continue
                kind = row["mealType"]
                seen_types.add(kind)
                y = float(value)
                maximum = max(maximum, y)
                ax.bar(x, y, width=step * 0.8, color=colors.get(kind, colors["other"]), zorder=3)
                if max_day_count <= 8 or y == 0:
                    label = "0" if y == 0 else f"{y:,.1f}".removesuffix(".0")
                    ax.annotate(label, (x, y), xytext=(0, 6), textcoords="offset points", ha="center", fontsize=9, rotation=90 if max_day_count > 5 else 0)
        ax.set_xticks(range(7), [day.strftime("%a\n%b %d") for day in dates])
        ax.set_xlim(-0.55, 6.55)
        ax.set_ylim(0, max(100, maximum * 1.22))
        ax.set_xlabel("Past week", labelpad=14)
        ax.set_ylabel("Calories per meal (kcal)", labelpad=12)
        ax.yaxis.set_major_locator(MaxNLocator(nbins=6))
        ax.grid(axis="y", color="#DCE2EA", linewidth=0.7, zorder=0)
        for edge in ("top", "right"):
            ax.spines[edge].set_visible(False)
        for edge in ("bottom", "left"):
            ax.spines[edge].set_color("#C1C9D5")
        ax.tick_params(axis="both", length=0, pad=8)
        fig.suptitle("Calories per meal · past week", x=0.07, y=0.97, ha="left", fontsize=21, weight="bold")
        fig.text(0.07, 0.91, f"{start:%b %d, %Y} – {end:%b %d, %Y}  |  {sum(counts.values())} meals  |  {scope}", fontsize=11, color="#555555")
        handles = [Patch(color=colors[kind], label=kind.title()) for kind in colors if kind in seen_types]
        if counts["unknown"]:
            handles.append(Line2D([], [], marker="$?$", linestyle="none", color="#555555", label="Unknown calories"))
        if counts["draft"]:
            handles.append(Line2D([], [], marker="$D$", linestyle="none", color="#555555", label="Empty draft"))
        if handles:
            fig.legend(handles=handles, loc="lower center", bbox_to_anchor=(0.5, 0.09), ncol=min(len(handles), 5), frameon=False)
        if not sum(counts.values()):
            ax.text(0.5, 0.5, "No meals recorded in this period", transform=ax.transAxes, ha="center", fontsize=15, color="#555555")
        elif counts["known"] == 0:
            ax.text(0.5, 0.5, "No meals with complete calorie values", transform=ax.transAxes, ha="center", fontsize=14, color="#555555")
        fig.text(0.07, 0.055, f"Timezone: {start.tzinfo} · Window: {start:%Y-%m-%d %H:%M} to {end:%Y-%m-%d %H:%M %z} (end excluded)", fontsize=9, color="#555555")
        fig.text(0.07, 0.025, "Each bar is one meal. ? = missing calorie value; D = empty draft; 0 = known zero. Dates without meals are blank.", fontsize=9, color="#555555")
        fig.subplots_adjust(left=0.08, right=0.98, bottom=0.25, top=0.83)
        output.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(output, dpi=180, facecolor=fig.get_facecolor())
        plt.close(fig)
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, required=True)
    scope = parser.add_mutually_exclusive_group(required=True)
    scope.add_argument("--all-meals", action="store_true")
    scope.add_argument("--user-id")
    parser.add_argument("--env-file")
    parser.add_argument("--timezone", default="America/Los_Angeles")
    parser.add_argument("--as-of", help="Offset-aware ISO timestamp; defaults to now")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.suffix.lower() != ".png":
        parser.error("--output must be a .png image")
    if args.user_id is not None and not args.user_id.strip():
        parser.error("--user-id must not be blank")
    try:
        start, end, dates = report_window(ZoneInfo(args.timezone), args.as_of)
        rows = fetch_meals(args.project.resolve(), args.env_file, start, end, args.user_id)
        counts = plot_meals(rows, start, end, dates, args.output.resolve(), "All database meals" if args.all_meals else "Selected owner's meals")
    except subprocess.TimeoutExpired:
        print("Meal report timed out; no chart generated.", file=sys.stderr)
        return 1
    except Exception as error:
        safe = str(error) if isinstance(error, ReportError) else "Check the project, timezone, Python dependencies, and output location"
        print(f"Meal report failed: {safe}.", file=sys.stderr)
        return 1
    print(json.dumps({"image": str(args.output.resolve()), "meals": sum(counts.values()), **counts}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
