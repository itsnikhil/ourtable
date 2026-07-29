CREATE TYPE "public"."dine_type" AS ENUM('DINE_IN', 'DELIVERY', 'TAKEOUT');--> statement-breakpoint
CREATE TYPE "public"."list_type" AS ENUM('MANUAL', 'SMART');--> statement-breakpoint
CREATE TYPE "public"."meal" AS ENUM('BREAKFAST', 'LUNCH', 'DINNER');--> statement-breakpoint
CREATE TYPE "public"."opinion_tag" AS ENUM('FAVORITE', 'LIKE_IT', 'SOK', 'HAVENT_TRIED', 'DISLIKE');--> statement-breakpoint
CREATE TYPE "public"."payment_split" AS ENUM('EQUAL', 'INDIVIDUAL', 'ONE_PAID');--> statement-breakpoint
CREATE TYPE "public"."price_range" AS ENUM('LOW', 'MID', 'HIGH', 'LUXE');--> statement-breakpoint
CREATE TYPE "public"."restaurant_status" AS ENUM('WISHLIST', 'VISITED', 'PLANNED');--> statement-breakpoint
CREATE TYPE "public"."tag_category" AS ENUM('VIBE', 'FOOD_TYPE', 'METHOD');--> statement-breakpoint
CREATE TYPE "public"."visit_status" AS ENUM('PLANNED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."would_return" AS ENUM('YES', 'MAYBE', 'NO');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "household_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "household_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list_items" (
	"list_id" text NOT NULL,
	"restaurant_id" text NOT NULL,
	CONSTRAINT "list_items_list_id_restaurant_id_pk" PRIMARY KEY("list_id","restaurant_id")
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "list_type" NOT NULL,
	"smart_rule" jsonb,
	"icon" text
);
--> statement-breakpoint
CREATE TABLE "ordered_items" (
	"id" text PRIMARY KEY NOT NULL,
	"visit_id" text NOT NULL,
	"dish_name" text NOT NULL,
	"price" numeric,
	"shared" boolean DEFAULT true NOT NULL,
	"ordered_by_id" text,
	"would_order_again" boolean
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"visit_id" text,
	"restaurant_id" text,
	"url" text NOT NULL,
	"uploaded_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_opinions" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"tag" "opinion_tag" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_tags" (
	"restaurant_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "restaurant_tags_restaurant_id_tag_id_pk" PRIMARY KEY("restaurant_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"price_range" "price_range",
	"website" text,
	"phone" text,
	"address" text,
	"lat" numeric,
	"lng" numeric,
	"neighborhood" text,
	"area" text,
	"supports_delivery" boolean DEFAULT false NOT NULL,
	"supports_dine_in" boolean DEFAULT false NOT NULL,
	"supports_takeout" boolean DEFAULT false NOT NULL,
	"menu_url" text,
	"status" "restaurant_status" DEFAULT 'WISHLIST' NOT NULL,
	"notes" text,
	"to_revisit" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"category" "tag_category" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text,
	"display_name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"avatar_url" text,
	"color" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "visit_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"visit_id" text NOT NULL,
	"user_id" text NOT NULL,
	"overall_rating" numeric NOT NULL,
	"food" integer,
	"service" integer,
	"atmosphere" integer,
	"value" integer,
	"drinks" integer,
	"presentation" integer,
	"waiting_time" integer,
	"cleanliness" integer,
	"would_return" "would_return",
	"favorite_dish_id" text,
	"review_text" text
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"household_id" text NOT NULL,
	"visit_date" timestamp NOT NULL,
	"visit_time" text,
	"meal" "meal",
	"dine_type" "dine_type",
	"occasion" text,
	"party_size" integer,
	"status" "visit_status" DEFAULT 'COMPLETED' NOT NULL,
	"seating" text,
	"subtotal" numeric,
	"tip" numeric,
	"total_paid" numeric,
	"payment_split" "payment_split",
	"payment_method" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordered_items" ADD CONSTRAINT "ordered_items_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_opinions" ADD CONSTRAINT "restaurant_opinions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_opinions" ADD CONSTRAINT "restaurant_opinions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tags" ADD CONSTRAINT "restaurant_tags_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_tags" ADD CONSTRAINT "restaurant_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_ratings" ADD CONSTRAINT "visit_ratings_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_ratings" ADD CONSTRAINT "visit_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opinion_restaurant_user_idx" ON "restaurant_opinions" USING btree ("restaurant_id","user_id");--> statement-breakpoint
CREATE INDEX "restaurants_household_idx" ON "restaurants" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_household_name_category_idx" ON "tags" USING btree ("household_id","name","category");--> statement-breakpoint
CREATE UNIQUE INDEX "rating_visit_user_idx" ON "visit_ratings" USING btree ("visit_id","user_id");--> statement-breakpoint
CREATE INDEX "visits_household_date_idx" ON "visits" USING btree ("household_id","visit_date");--> statement-breakpoint
CREATE INDEX "visits_restaurant_idx" ON "visits" USING btree ("restaurant_id");