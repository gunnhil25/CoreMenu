CREATE TABLE "cook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"user_id" uuid,
	"cooked_at" timestamp DEFAULT now() NOT NULL,
	"servings_made" integer DEFAULT 4 NOT NULL,
	"rating" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "grocery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"normalized_name" varchar(180) NOT NULL,
	"quantity" numeric(10, 2),
	"unit" varchar(40) DEFAULT '' NOT NULL,
	"aisle" varchar(60) DEFAULT 'Pantry & Dry Goods' NOT NULL,
	"store" varchar(80),
	"is_checked" boolean DEFAULT false NOT NULL,
	"in_pantry_flag" varchar(20) DEFAULT 'none' NOT NULL,
	"pantry_note" varchar(180),
	"is_manual" boolean DEFAULT false NOT NULL,
	"estimated_cost" numeric(8, 2),
	"source_recipes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"start_date" varchar(10),
	"end_date" varchar(10),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"estimated_total" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"actual_total" numeric(10, 2),
	"completed_at" timestamp,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_name" varchar(150) DEFAULT 'CoreMenu Kitchen' NOT NULL,
	"currency" varchar(3) DEFAULT 'AUD' NOT NULL,
	"weekly_grocery_budget" numeric(10, 2) DEFAULT '220.00' NOT NULL,
	"default_stores" jsonb DEFAULT '["Woolworths","Coles","Aldi","Butcher","Asian Grocer"]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leftover_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid,
	"title" varchar(200) NOT NULL,
	"storage_location" varchar(20) DEFAULT 'fridge' NOT NULL,
	"total_portions" integer DEFAULT 4 NOT NULL,
	"remaining_portions" integer DEFAULT 4 NOT NULL,
	"prepared_date" varchar(10) NOT NULL,
	"use_by_date" varchar(10),
	"calories_per_portion" integer,
	"protein_per_portion" numeric(6, 1),
	"carbs_per_portion" numeric(6, 1),
	"fat_per_portion" numeric(6, 1),
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_date" varchar(10) NOT NULL,
	"meal_slot" varchar(20) DEFAULT 'dinner' NOT NULL,
	"recipe_id" uuid,
	"leftover_id" uuid,
	"custom_title" varchar(200),
	"servings" integer DEFAULT 2 NOT NULL,
	"is_batch_prep" boolean DEFAULT false NOT NULL,
	"is_leftover" boolean DEFAULT false NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pantry_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(180) NOT NULL,
	"normalized_name" varchar(180) NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1.00' NOT NULL,
	"unit" varchar(40) DEFAULT 'unit' NOT NULL,
	"location" varchar(20) DEFAULT 'pantry' NOT NULL,
	"aisle" varchar(60) DEFAULT 'Pantry & Dry Goods' NOT NULL,
	"is_always_stocked" boolean DEFAULT false NOT NULL,
	"expires_at" varchar(10),
	"low_stock_threshold" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quick_staples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(180) NOT NULL,
	"default_quantity" numeric(10, 2) DEFAULT '1.00' NOT NULL,
	"default_unit" varchar(40) DEFAULT 'unit' NOT NULL,
	"aisle" varchar(60) DEFAULT 'Pantry & Dry Goods' NOT NULL,
	"store" varchar(80),
	"estimated_cost" numeric(8, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_user_id" uuid,
	"title" varchar(200) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"description" text,
	"image_url" text,
	"source_url" text,
	"meal_type" varchar(40) DEFAULT 'dinner' NOT NULL,
	"cuisine" varchar(80),
	"difficulty" varchar(20) DEFAULT 'easy' NOT NULL,
	"prep_time_min" integer DEFAULT 15 NOT NULL,
	"cook_time_min" integer DEFAULT 20 NOT NULL,
	"servings" integer DEFAULT 4 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calories_per_serving" integer,
	"protein_per_serving" numeric(6, 1),
	"carbs_per_serving" numeric(6, 1),
	"fat_per_serving" numeric(6, 1),
	"estimated_cost_per_serving" numeric(8, 2),
	"rating" integer DEFAULT 0 NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"cook_count" integer DEFAULT 0 NOT NULL,
	"last_cooked_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(120) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"preferred_units" varchar(16) DEFAULT 'metric' NOT NULL,
	"currency" varchar(3) DEFAULT 'AUD' NOT NULL,
	"daily_calorie_goal" integer DEFAULT 2200 NOT NULL,
	"daily_protein_goal" integer DEFAULT 150 NOT NULL,
	"daily_carbs_goal" integer DEFAULT 220 NOT NULL,
	"daily_fat_goal" integer DEFAULT 70 NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "cook_logs" ADD CONSTRAINT "cook_logs_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_logs" ADD CONSTRAINT "cook_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_items" ADD CONSTRAINT "grocery_items_list_id_grocery_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."grocery_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_lists" ADD CONSTRAINT "grocery_lists_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leftover_batches" ADD CONSTRAINT "leftover_batches_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leftover_batches" ADD CONSTRAINT "leftover_batches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_leftover_id_leftover_batches_id_fk" FOREIGN KEY ("leftover_id") REFERENCES "public"."leftover_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_templates" ADD CONSTRAINT "meal_plan_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;