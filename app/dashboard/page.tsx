import { UtensilsIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemHeader, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { getMealsForDay } from "@/data/meals";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const { range, meals } = await getMealsForDay(
    typeof params.start === "string" ? params.start : undefined,
    typeof params.end === "string" ? params.end : undefined,
    typeof params.timeZone === "string" ? params.timeZone : undefined,
  );

  if (!range) {
    return <Skeleton className="h-64 w-full" aria-label="Preparing your daily view" />;
  }

  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: range.timeZone, weekday: "long", year: "numeric", month: "long", day: "numeric",
  }).format(range.start);
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: range.timeZone, hour: "numeric", minute: "2-digit",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Meals</h2></CardTitle>
        <CardDescription>{date}</CardDescription>
      </CardHeader>
      <CardContent>
        {meals.length > 0 ? (
          <ItemGroup aria-label={`Meals for ${date}`}>
            {meals.map((meal) => {
              const type = meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1);
              return (
                <Item key={meal.id} variant="outline" role="listitem">
                  <ItemHeader>
                    <Badge variant="secondary">{type}</Badge>
                    <span className="text-xs text-muted-foreground">{clock.format(meal.eatenAt)}</span>
                  </ItemHeader>
                  <ItemContent>
                    <ItemTitle>{type}</ItemTitle>
                    <ItemDescription>
                      {meal.items.length > 0
                        ? meal.items.map((item) => `${Number(item.quantity)} × ${item.foodNameSnapshot}`).join(", ")
                        : "No foods recorded for this meal."}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button variant="outline" size="sm" render={<Link href={`/dashboard/meals/${meal.id}`} />} nativeButton={false} aria-label={`Edit ${type.toLowerCase()} at ${clock.format(meal.eatenAt)}`}>Edit</Button>
                  </ItemActions>
                </Item>
              );
            })}
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
      </CardContent>
    </Card>
  );
}
