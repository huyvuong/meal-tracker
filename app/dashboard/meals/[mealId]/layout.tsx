import "server-only";

import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getMealById } from "@/data/meals";
import { getMealItems } from "@/data/meal-items";
import { listSavedFoods } from "@/data/foods";

import { MealProvider } from "./meal-context";

type EditMealLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ mealId: string }>;
};

export default function EditMealLayout(props: EditMealLayoutProps) {
  return <Suspense fallback={<Skeleton className="mx-auto my-12 h-80 w-full max-w-2xl" aria-label="Loading meal editor" />}>
    <AuthorizedMealLayout {...props} />
  </Suspense>;
}

// Provider infrastructure keeps authenticated reads within this route's boundary.
async function AuthorizedMealLayout({ children, params }: EditMealLayoutProps) {
  const { mealId } = await params;
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: `/dashboard/meals/${encodeURIComponent(mealId)}` });
  const meal = await getMealById(mealId);
  if (!meal) notFound();

  const [items, foods] = await Promise.all([getMealItems(mealId), listSavedFoods()]);
  return <MealProvider meal={{ id: meal.id, mealType: meal.mealType, eatenAt: meal.eatenAt.toISOString(), items, foods }}>{children}</MealProvider>;
}
