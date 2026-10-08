import { z } from "zod";
import type { Food, MealItem } from "@/db/schema";

export type SavedFood = Pick<Food, "id" | "name">;
export type LoggedMealItem = Pick<MealItem, "id" | "foodId" | "quantity" | "foodNameSnapshot" | "caloriesPerUnitSnapshot" | "proteinGPerUnitSnapshot" | "carbsGPerUnitSnapshot" | "fatGPerUnitSnapshot">;

const quantitySchema = z.string().regex(/^\d{1,7}(?:\.\d{1,3})?$/, "Use up to 7 whole digits and 3 decimal places.").refine((value) => /[1-9]/.test(value), "Quantity must be greater than zero.");
const nutritionSchema = z.string().regex(/^\d{1,8}(?:\.\d{1,2})?$/, "Use a nonnegative value with up to 8 whole digits and 2 decimal places.").nullable();
const mealId = z.uuid({ error: "This meal is unavailable." });
const itemId = z.uuid({ error: "This food entry is unavailable." });

export const addMealItemSchema = z.object({ mealId, foodId: z.uuid({ error: "Choose a saved food." }), quantity: quantitySchema }).strict();
export const createAndLogFoodSchema = z.object({
  mealId,
  name: z.string().trim().min(1, "Enter a food name.").max(120, "Use at most 120 characters.").refine((name) => !/^(?:\d|[+−\-.]\d|[¼½¾⅐-⅞]|(?:one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|a dozen)\s)/iu.test(name), "Use a food name without an amount, such as Apple; enter the amount as quantity."),
  quantity: quantitySchema,
  caloriesPerUnit: nutritionSchema,
  proteinGPerUnit: nutritionSchema,
  carbsGPerUnit: nutritionSchema,
  fatGPerUnit: nutritionSchema,
}).strict();
export const updateMealItemQuantitySchema = z.object({ mealId, itemId, quantity: quantitySchema }).strict();
export const removeMealItemSchema = z.object({ mealId, itemId }).strict();

export type AddMealItemInput = z.infer<typeof addMealItemSchema>;
export type CreateAndLogFoodInput = z.infer<typeof createAndLogFoodSchema>;
export type UpdateMealItemQuantityInput = z.infer<typeof updateMealItemQuantitySchema>;
export type RemoveMealItemInput = z.infer<typeof removeMealItemSchema>;
export type MealItemFieldErrors = Partial<Record<"foodId" | "name" | "quantity" | "caloriesPerUnit" | "proteinGPerUnit" | "carbsGPerUnit" | "fatGPerUnit", string>>;
export type MealItemResult = { success: true } | { success: false; message: string; fieldErrors?: MealItemFieldErrors };
