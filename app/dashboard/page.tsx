"use client";

import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { CalendarIcon, ChevronDownIcon, UtensilsIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

// Relative dates keep the UI preview useful without an API or database.
const sampleMeals = [
  { id: "oats", dayOffset: 0, name: "Oatmeal with berries", type: "Breakfast", time: "8:00 AM", description: "Rolled oats, blueberries, banana, and almond milk." },
  { id: "salad", dayOffset: 0, name: "Grilled chicken salad", type: "Lunch", time: "12:30 PM", description: "Grilled chicken, mixed greens, avocado, and tomatoes." },
  { id: "salmon", dayOffset: 0, name: "Salmon and roasted vegetables", type: "Dinner", time: "6:30 PM", description: "Baked salmon, broccoli, carrots, and brown rice." },
  { id: "toast", dayOffset: -1, name: "Avocado toast", type: "Breakfast", time: "8:30 AM", description: "Whole grain toast, avocado, and a poached egg." },
  { id: "bowl", dayOffset: -1, name: "Vegetable rice bowl", type: "Lunch", time: "1:00 PM", description: "Brown rice, roasted vegetables, chickpeas, and tahini." },
];

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

export default function DashboardPage() {
  // Resolve today in the browser to avoid a stale build date or timezone mismatch.
  const todayTimestamp = useSyncExternalStore(
    subscribeToLocalDate,
    getLocalDate,
    getInitialDate,
  );
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const today = todayTimestamp === null ? undefined : new Date(todayTimestamp);
  const date = selectedDate ?? today;
  const dayOffset = date && today ? differenceInCalendarDays(date, today) : null;
  const meals = sampleMeals.filter((meal) => meal.dayOffset === dayOffset);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-8 sm:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">View your meals, one day at a time.</p>
      </header>

      <section aria-label="Choose a meal date" className="flex flex-col gap-3">
        <Label htmlFor="meal-date">Date</Label>
        {date && today ? (
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger
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
                    setSelectedDate(nextDate);
                    setPickerOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="lg" disabled={dayOffset === 0} onClick={() => setSelectedDate(today)}>
              Today
            </Button>
          </div>
        ) : (
          <Skeleton className="h-9 w-60" aria-label="Preparing date picker" />
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle><h2>Meals</h2></CardTitle>
          <CardDescription>
            {date ? format(date, "EEEE, MMMM d, yyyy") : "Preparing your daily view…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div aria-live="polite" aria-atomic="true">
            {!date ? (
              <Skeleton className="h-52 w-full" aria-label="Preparing meal list" />
            ) : meals.length > 0 ? (
              <ItemGroup aria-label={`Meals for ${format(date, "PPP")}`}>
                {meals.map((meal) => (
                  <Item key={meal.id} variant="outline" role="listitem">
                    <ItemHeader>
                      <Badge variant="secondary">{meal.type}</Badge>
                      <span className="text-xs text-muted-foreground">{meal.time}</span>
                    </ItemHeader>
                    <ItemContent>
                      <ItemTitle>{meal.name}</ItemTitle>
                      <ItemDescription>{meal.description}</ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><UtensilsIcon aria-hidden="true" /></EmptyMedia>
                  <EmptyTitle>No meals for this date</EmptyTitle>
                  <EmptyDescription>Choose another date to view its meals.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">Sample meals are shown for today and yesterday.</p>
    </main>
  );
}
