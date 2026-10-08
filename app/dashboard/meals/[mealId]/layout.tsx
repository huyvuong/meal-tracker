import "server-only";

import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { getMealById } from "@/data/meals";

import { MealProvider } from "./meal-context";

export default async function EditMealLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ mealId: string }>;
}) {
  const { mealId } = await params;
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: `/dashboard/meals/${encodeURIComponent(mealId)}` });
  const meal = await getMealById(mealId);
  if (!meal) notFound();

  return <MealProvider meal={{ id: meal.id, mealType: meal.mealType, eatenAt: meal.eatenAt.toISOString() }}>{children}</MealProvider>;
}
