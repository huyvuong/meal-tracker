CREATE TYPE "meal_type" AS ENUM('breakfast', 'lunch', 'dinner', 'snack', 'other');--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"calories_per_unit" numeric(10,2),
	"protein_g_per_unit" numeric(10,2),
	"carbs_g_per_unit" numeric(10,2),
	"fat_g_per_unit" numeric(10,2),
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foods_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "foods_name_nonblank" CHECK ("name" ~ '[^[:space:]]'),
	CONSTRAINT "foods_calories_nonnegative" CHECK ("calories_per_unit" >= 0 and "calories_per_unit" <> 'NaN'::numeric),
	CONSTRAINT "foods_protein_nonnegative" CHECK ("protein_g_per_unit" >= 0 and "protein_g_per_unit" <> 'NaN'::numeric),
	CONSTRAINT "foods_carbs_nonnegative" CHECK ("carbs_g_per_unit" >= 0 and "carbs_g_per_unit" <> 'NaN'::numeric),
	CONSTRAINT "foods_fat_nonnegative" CHECK ("fat_g_per_unit" >= 0 and "fat_g_per_unit" <> 'NaN'::numeric)
);
--> statement-breakpoint
CREATE TABLE "meal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"meal_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"quantity" numeric(10,3) DEFAULT '1' NOT NULL,
	"food_name_snapshot" text NOT NULL,
	"calories_per_unit_snapshot" numeric(10,2),
	"protein_g_per_unit_snapshot" numeric(10,2),
	"carbs_g_per_unit_snapshot" numeric(10,2),
	"fat_g_per_unit_snapshot" numeric(10,2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_items_meal_id_food_id_unique" UNIQUE("meal_id","food_id"),
	CONSTRAINT "meal_items_quantity_positive" CHECK ("quantity" > 0 and "quantity" <> 'NaN'::numeric),
	CONSTRAINT "meal_items_food_name_nonblank" CHECK ("food_name_snapshot" ~ '[^[:space:]]'),
	CONSTRAINT "meal_items_calories_nonnegative" CHECK ("calories_per_unit_snapshot" >= 0 and "calories_per_unit_snapshot" <> 'NaN'::numeric),
	CONSTRAINT "meal_items_protein_nonnegative" CHECK ("protein_g_per_unit_snapshot" >= 0 and "protein_g_per_unit_snapshot" <> 'NaN'::numeric),
	CONSTRAINT "meal_items_carbs_nonnegative" CHECK ("carbs_g_per_unit_snapshot" >= 0 and "carbs_g_per_unit_snapshot" <> 'NaN'::numeric),
	CONSTRAINT "meal_items_fat_nonnegative" CHECK ("fat_g_per_unit_snapshot" >= 0 and "fat_g_per_unit_snapshot" <> 'NaN'::numeric)
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"meal_type" "meal_type" NOT NULL,
	"eaten_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meals_id_user_id_unique" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "foods_user_id_normalized_name_unique" ON "foods" ("user_id",lower(btrim("name")));--> statement-breakpoint
CREATE INDEX "meal_items_meal_id_user_id_idx" ON "meal_items" ("meal_id","user_id");--> statement-breakpoint
CREATE INDEX "meal_items_food_id_user_id_idx" ON "meal_items" ("food_id","user_id");--> statement-breakpoint
CREATE INDEX "meals_user_id_eaten_at_idx" ON "meals" ("user_id","eaten_at");--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_meal_owner_fk" FOREIGN KEY ("meal_id","user_id") REFERENCES "meals"("id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_food_owner_fk" FOREIGN KEY ("food_id","user_id") REFERENCES "foods"("id","user_id") ON DELETE RESTRICT;