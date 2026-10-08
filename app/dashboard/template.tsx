"use client";

import { format, startOfDay } from "date-fns";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

import { mealDateUrl, parseMealDateRange } from "@/lib/meal-date";

function subscribeToLocalDate(onChange: () => void) {
  window.addEventListener("focus", onChange);
  return () => window.removeEventListener("focus", onChange);
}

function getLocalDate() {
  return startOfDay(new Date()).getTime();
}

function getInitialDate() {
  return null;
}

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isDashboard = usePathname() === "/dashboard";
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Resolve today in the browser to avoid a stale build date or timezone mismatch.
  const todayTimestamp = useSyncExternalStore(
    subscribeToLocalDate,
    getLocalDate,
    getInitialDate,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const today = todayTimestamp === null ? undefined : new Date(todayTimestamp);
  const range = parseMealDateRange(
    searchParams.get("start"), searchParams.get("end"), searchParams.get("timeZone"),
  );
  const dateParts = range && new Intl.DateTimeFormat("en-US", {
    timeZone: range.timeZone, year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(range.start);
  const datePart = (part: "year" | "month" | "day") =>
    Number(dateParts && dateParts.find((value) => value.type === part)?.value);
  const date = today
    ? range ? new Date(datePart("year"), datePart("month") - 1, datePart("day")) : today
    : undefined;
  const hasRange = range !== null;

  useEffect(() => {
    if (isDashboard && !hasRange && todayTimestamp !== null) {
      router.replace(mealDateUrl(new Date(todayTimestamp)), { scroll: false });
    }
  }, [isDashboard, hasRange, router, todayTimestamp]);

  function selectDate(nextDate: Date) {
    setPickerOpen(false);
    startTransition(() => router.push(mealDateUrl(nextDate), { scroll: false }));
  }

  if (!isDashboard) return children;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-8 sm:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">View your meals, one day at a time.</p>
        <Button className="w-fit" render={<Link href="/dashboard/meals/new" />} nativeButton={false}>New meal</Button>
      </header>

      <section aria-label="Choose a meal date" className="flex flex-col gap-3">
        <Label htmlFor="meal-date">Date</Label>
        {date && today ? (
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger
                disabled={pending}
                aria-label={`Meal date: ${format(date, "PPP")}`}
                render={<Button id="meal-date" variant="outline" size="lg" />}
              >
                <CalendarIcon aria-hidden="true" />
                {format(date, "PPP")}
                <ChevronDownIcon aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <PopoverTitle className="sr-only">Choose a meal date</PopoverTitle>
                <Calendar
                  mode="single"
                  required
                  selected={date}
                  defaultMonth={date}
                  today={today}
                  autoFocus
                  onSelect={(nextDate) => {
                    selectDate(nextDate);
                  }}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="lg" disabled={pending || format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")} onClick={() => selectDate(today)}>
              Today
            </Button>
          </div>
        ) : (
          <Skeleton className="h-9 w-60" aria-label="Preparing date picker" />
        )}
      </section>

      <section aria-label="Daily meals" aria-live="polite" aria-busy={pending}>
        {pending ? <Skeleton className="h-64 w-full" aria-label="Loading meals" /> : children}
      </section>
    </main>
  );
}
