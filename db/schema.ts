import { defineRelations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const mealType = pgEnum("meal_type", [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "other",
]);

export const meals = pgTable(
  "meals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    mealType: mealType("meal_type").notNull(),
    eatenAt: timestamp("eaten_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("meals_id_user_id_unique").on(table.id, table.userId),
    index("meals_user_id_eaten_at_idx").on(table.userId, table.eatenAt),
  ],
);

// Numeric columns intentionally retain Drizzle's exact decimal string mode.
export const foods = pgTable(
  "foods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    caloriesPerUnit: numeric("calories_per_unit", { precision: 10, scale: 2 }),
    proteinGPerUnit: numeric("protein_g_per_unit", { precision: 10, scale: 2 }),
    carbsGPerUnit: numeric("carbs_g_per_unit", { precision: 10, scale: 2 }),
    fatGPerUnit: numeric("fat_g_per_unit", { precision: 10, scale: 2 }),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("foods_id_user_id_unique").on(table.id, table.userId),
    uniqueIndex("foods_user_id_normalized_name_unique").on(
      table.userId,
      sql`lower(btrim(${table.name}))`,
    ),
    check("foods_name_nonblank", sql`${table.name} ~ '[^[:space:]]'`),
    check("foods_calories_nonnegative", sql`${table.caloriesPerUnit} >= 0 and ${table.caloriesPerUnit} <> 'NaN'::numeric`),
    check("foods_protein_nonnegative", sql`${table.proteinGPerUnit} >= 0 and ${table.proteinGPerUnit} <> 'NaN'::numeric`),
    check("foods_carbs_nonnegative", sql`${table.carbsGPerUnit} >= 0 and ${table.carbsGPerUnit} <> 'NaN'::numeric`),
    check("foods_fat_nonnegative", sql`${table.fatGPerUnit} >= 0 and ${table.fatGPerUnit} <> 'NaN'::numeric`),
  ],
);

export const mealItems = pgTable(
  "meal_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    mealId: uuid("meal_id").notNull(),
    foodId: uuid("food_id").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).default("1").notNull(),
    foodNameSnapshot: text("food_name_snapshot").notNull(),
    caloriesPerUnitSnapshot: numeric("calories_per_unit_snapshot", { precision: 10, scale: 2 }),
    proteinGPerUnitSnapshot: numeric("protein_g_per_unit_snapshot", { precision: 10, scale: 2 }),
    carbsGPerUnitSnapshot: numeric("carbs_g_per_unit_snapshot", { precision: 10, scale: 2 }),
    fatGPerUnitSnapshot: numeric("fat_g_per_unit_snapshot", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("meal_items_meal_id_food_id_unique").on(table.mealId, table.foodId),
    foreignKey({
      name: "meal_items_meal_owner_fk",
      columns: [table.mealId, table.userId],
      foreignColumns: [meals.id, meals.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "meal_items_food_owner_fk",
      columns: [table.foodId, table.userId],
      foreignColumns: [foods.id, foods.userId],
    }).onDelete("restrict"),
    index("meal_items_meal_id_user_id_idx").on(table.mealId, table.userId),
    index("meal_items_food_id_user_id_idx").on(table.foodId, table.userId),
    check("meal_items_quantity_positive", sql`${table.quantity} > 0 and ${table.quantity} <> 'NaN'::numeric`),
    check("meal_items_food_name_nonblank", sql`${table.foodNameSnapshot} ~ '[^[:space:]]'`),
    check("meal_items_calories_nonnegative", sql`${table.caloriesPerUnitSnapshot} >= 0 and ${table.caloriesPerUnitSnapshot} <> 'NaN'::numeric`),
    check("meal_items_protein_nonnegative", sql`${table.proteinGPerUnitSnapshot} >= 0 and ${table.proteinGPerUnitSnapshot} <> 'NaN'::numeric`),
    check("meal_items_carbs_nonnegative", sql`${table.carbsGPerUnitSnapshot} >= 0 and ${table.carbsGPerUnitSnapshot} <> 'NaN'::numeric`),
    check("meal_items_fat_nonnegative", sql`${table.fatGPerUnitSnapshot} >= 0 and ${table.fatGPerUnitSnapshot} <> 'NaN'::numeric`),
  ],
);

export const relations = defineRelations({ meals, foods, mealItems }, (r) => ({
  meals: {
    items: r.many.mealItems({
      from: [r.meals.id, r.meals.userId],
      to: [r.mealItems.mealId, r.mealItems.userId],
    }),
  },
  foods: {
    mealItems: r.many.mealItems({
      from: [r.foods.id, r.foods.userId],
      to: [r.mealItems.foodId, r.mealItems.userId],
    }),
  },
  mealItems: {
    meal: r.one.meals({
      from: [r.mealItems.mealId, r.mealItems.userId],
      to: [r.meals.id, r.meals.userId],
      optional: false,
    }),
    food: r.one.foods({
      from: [r.mealItems.foodId, r.mealItems.userId],
      to: [r.foods.id, r.foods.userId],
      optional: false,
    }),
  },
}));

export type Meal = typeof meals.$inferSelect;
export type NewMeal = typeof meals.$inferInsert;
export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type MealItem = typeof mealItems.$inferSelect;
export type NewMealItem = typeof mealItems.$inferInsert;
