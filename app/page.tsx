import { ArrowRightIcon, CalendarDaysIcon, NotebookPenIcon, UtensilsIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemHeader, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Meal Tracker | Make room for a daily habit",
  description: "Keep a personal meal diary, save your favorite foods, and track calories and macros with Meal Tracker. Start with your next meal.",
};

const exampleMeals = [
  { type: "Breakfast", time: "8:30 AM", foods: "Oatmeal, banana, and yogurt" },
  { type: "Lunch", time: "12:45 PM", foods: "Chicken, rice, and roasted vegetables" },
  { type: "Dinner", time: "7:00 PM", foods: "Salmon, potatoes, and a side salad" },
];

const features = [
  {
    icon: NotebookPenIcon,
    title: "Log a meal",
    description: "Record breakfast, lunch, dinner, or a snack with the date and time that work for you.",
  },
  {
    icon: UtensilsIcon,
    title: "Make it yours",
    description: "Add foods and quantities, reuse your saved favorites, and see meal calories and macros when you enter nutrition values.",
  },
  {
    icon: CalendarDaysIcon,
    title: "Look back at your day",
    description: "Browse your diary by date and update your entries as you go. Your meals stay in your own account.",
  },
];

export default function Home() {
  return (
    <>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 font-sans">
        <section
          aria-labelledby="hero-title"
          className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16"
        >
          <div className="flex flex-col items-start gap-6">
            <Badge variant="secondary">
              <UtensilsIcon aria-hidden="true" />
              A little more mindful, one meal at a time
            </Badge>
            <h1 id="hero-title" className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Your meals.<br />
              Your daily rhythm.
            </h1>
            <p className="max-w-md text-lg leading-8 text-muted-foreground">
              A simple place to keep track of what you eat. Log your meals, save
              your favorite foods, and build a diary you can come back to.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" render={<Link href="/sign-up" />} nativeButton={false}>
                Start your meal diary
                <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
              </Button>
              <Button variant="outline" size="lg" render={<Link href="#how-it-works" />} nativeButton={false}>
                See how it works
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Start with your next meal. Keep going at your own pace.
            </p>
          </div>

          <Card aria-labelledby="diary-title">
            <CardHeader>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline">Your meal diary</Badge>
                <Badge variant="secondary">Example day</Badge>
              </div>
              <CardTitle><h2 id="diary-title">A day at a glance</h2></CardTitle>
              <CardDescription>Small moments, all in one place.</CardDescription>
            </CardHeader>
            <CardContent>
              <ItemGroup aria-label="Example meals">
                {exampleMeals.map((meal) => (
                  <Item key={meal.type} variant="outline" role="listitem">
                    <ItemHeader>
                      <ItemTitle>{meal.type}</ItemTitle>
                      <span className="text-xs text-muted-foreground">{meal.time}</span>
                    </ItemHeader>
                    <ItemContent>
                      <ItemDescription>{meal.foods}</ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                An example diary. Your own story starts with one entry.
              </p>
            </CardFooter>
          </Card>
        </section>

        <Separator />

        <section id="how-it-works" aria-labelledby="how-it-works-title" className="scroll-mt-8 py-16 sm:py-20">
          <div className="mb-8 max-w-xl space-y-3">
            <p className="text-sm font-medium text-muted-foreground">HOW IT WORKS</p>
            <h2 id="how-it-works-title" className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              A simple habit. A clearer picture.
            </h2>
            <p className="leading-7 text-muted-foreground">
              From your first entry to your everyday favorites, keep the details
              that matter to you.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <feature.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                    <Badge variant="outline">Step {index + 1}</Badge>
                  </div>
                  <CardTitle><h3>{feature.title}</h3></CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-7 text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        <section aria-labelledby="get-started-title" className="flex flex-col items-start justify-between gap-6 py-12 sm:flex-row sm:items-center sm:py-16">
          <div className="space-y-2">
            <h2 id="get-started-title" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Make room for your next meal.
            </h2>
            <p className="text-muted-foreground">Create your account and start a diary of your own.</p>
          </div>
          <Button size="lg" render={<Link href="/sign-up" />} nativeButton={false}>
            Get started
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </Button>
        </section>
      </main>
      <footer className="border-t border-border font-sans">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <p className="text-sm text-muted-foreground">Meal Tracker · Your personal meal diary.</p>
          <Button variant="link" render={<Link href="/sign-in" />} nativeButton={false}>
            Already have an account? Sign in
          </Button>
        </div>
      </footer>
    </>
  );
}
