"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { MealType } from "@/lib/meal-input";

type EditableMeal = { id: string; mealType: MealType; eatenAt: string };
const MealContext = createContext<EditableMeal | null>(null);

export function MealProvider({ meal, children }: { meal: EditableMeal; children: ReactNode }) {
  return <MealContext value={meal}>{children}</MealContext>;
}

export function useEditableMeal() {
  const meal = useContext(MealContext);
  if (!meal) throw new Error("Meal provider required");
  return meal;
}
