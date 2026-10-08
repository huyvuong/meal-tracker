"use server";

import { revalidatePath } from "next/cache";

import { updateMeal } from "@/data/meals";
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
