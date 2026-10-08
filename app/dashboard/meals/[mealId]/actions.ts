"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { updateMeal } from "@/data/meals";
import { addMealItem, createAndLogFood, updateMealItemQuantity, removeMealItem, MealItemError } from "@/data/meal-items";
import { addMealItemSchema, createAndLogFoodSchema, updateMealItemQuantitySchema, removeMealItemSchema, type AddMealItemInput, type CreateAndLogFoodInput, type UpdateMealItemQuantityInput, type RemoveMealItemInput, type MealItemResult, type MealItemFieldErrors } from "@/lib/meal-item-input";
import { dashboardDateUrl } from "@/lib/meal-date";
import { updateMealSchema, type UpdateMealInput, type UpdateMealResult, type MealFieldErrors } from "@/lib/meal-input";

export async function updateMealAction(input: UpdateMealInput): Promise<UpdateMealResult> {
  const parsed = updateMealSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: MealFieldErrors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "mealType") fieldErrors.mealType ??= "Choose a meal type.";
      else if (issue.path[0] !== "mealId") fieldErrors.eatenAt ??= "Enter a valid local date and time.";
    }
    return { success: false, message: "Check the meal details and try again.", fieldErrors };
  }

  const { mealId, mealType, eatenAt, start, end, timeZone } = parsed.data;
  try {
    const updated = await updateMeal({ mealId, mealType, eatenAt: new Date(eatenAt) });
    if (!updated) return { success: false, message: "This meal is unavailable. Return to the dashboard to choose a meal." };
  } catch {
    return { success: false, message: "Unable to save the meal. Please check that you’re signed in and try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/meals/${mealId}`, "layout");
  return { success: true, destination: dashboardDateUrl(new Date(start), new Date(end), timeZone) };
}

async function mutateMealItem<T extends { mealId: string }>(
  input: T,
  schema: z.ZodType<T>,
  mutation: (input: T) => Promise<void>,
): Promise<MealItemResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: MealItemFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "foodId" || key === "name" || key === "quantity" || key === "caloriesPerUnit" || key === "proteinGPerUnit" || key === "carbsGPerUnit" || key === "fatGPerUnit") {
        fieldErrors[key] ??= issue.message;
      }
    }
    return { success: false, message: "Check the food details and try again.", fieldErrors };
  }
  try {
    await mutation(parsed.data);
  } catch (error) {
    return { success: false, message: error instanceof MealItemError ? error.message : "Unable to save this food entry. Please check that you’re signed in and try again." };
  }
  revalidatePath(`/dashboard/meals/${parsed.data.mealId}`, "layout");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function addMealItemAction(input: AddMealItemInput): Promise<MealItemResult> {
  return mutateMealItem(input, addMealItemSchema, addMealItem);
}

export async function createAndLogFoodAction(input: CreateAndLogFoodInput): Promise<MealItemResult> {
  return mutateMealItem(input, createAndLogFoodSchema, createAndLogFood);
}

export async function updateMealItemQuantityAction(input: UpdateMealItemQuantityInput): Promise<MealItemResult> {
  return mutateMealItem(input, updateMealItemQuantitySchema, updateMealItemQuantity);
}

export async function removeMealItemAction(input: RemoveMealItemInput): Promise<MealItemResult> {
  return mutateMealItem(input, removeMealItemSchema, removeMealItem);
}
