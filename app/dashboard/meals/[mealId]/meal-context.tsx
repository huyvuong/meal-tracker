"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { MealType } from "@/lib/meal-input";
import type { LoggedMealItem, SavedFood } from "@/lib/meal-item-input";

type EditableMeal = { id: string; mealType: MealType; eatenAt: string; items: LoggedMealItem[]; foods: SavedFood[] };
const MealContext = createContext<EditableMeal | null>(null);

export function MealProvider({ meal, children }: { meal: EditableMeal; children: ReactNode }) {
  return <MealContext value={meal}>{children}</MealContext>;
}

export function useEditableMeal() {
  const meal = useContext(MealContext);
  if (!meal) throw new Error("Meal provider required");
  return meal;
}
