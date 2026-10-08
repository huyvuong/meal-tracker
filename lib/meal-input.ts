import { z } from "zod";

import { parseMealDateRange } from "./meal-date";

export const mealTypes = ["breakfast", "lunch", "dinner", "snack", "other"] as const;
export type MealType = (typeof mealTypes)[number];

export type CreateMealInput = {
  mealType: string;
  eatenAt: string;
  start: string;
  end: string;
  timeZone: string;
};

export type MealFieldErrors = { mealType?: string; eatenAt?: string };
export type CreateMealResult =
  | { success: true; destination: `/dashboard?${string}` }
  | { success: false; message: string; fieldErrors?: MealFieldErrors };

export type UpdateMealInput = CreateMealInput & { mealId: string };
export type UpdateMealResult =
  | { success: true; destination: `/dashboard?${string}` }
  | { success: false; message: string; fieldErrors?: MealFieldErrors };

export const mealIdSchema = z.uuid();

export const createMealSchema = z.object({
  mealType: z.enum(mealTypes, { error: "Choose a meal type." }),
  eatenAt: z.iso.datetime({ error: "Enter a valid date and time." }),
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  timeZone: z.string().min(1).max(100),
}).strict().superRefine((input, context) => {
  const range = parseMealDateRange(input.start, input.end, input.timeZone);
  const timestamp = new Date(input.eatenAt).getTime();
  if (!range || timestamp < range.start.getTime() || timestamp >= range.end.getTime()) {
    context.addIssue({ code: "custom", path: ["eatenAt"], message: "Enter a date and time within the selected local day." });
  }
});

export const updateMealSchema = createMealSchema.safeExtend({ mealId: mealIdSchema });
