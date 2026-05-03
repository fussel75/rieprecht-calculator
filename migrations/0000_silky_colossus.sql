CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_number" text NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT 't' NOT NULL,
	"category" text DEFAULT 'entsorgung' NOT NULL,
	"avv_number" text,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "articles_article_number_unique" UNIQUE("article_number")
);
--> statement-breakpoint
CREATE TABLE "bwa_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"revenue" text,
	"material_costs" text,
	"personnel_costs" text,
	"vehicle_costs" text,
	"operating_costs" text,
	"depreciation" text,
	"interest_costs" text,
	"other_costs" text,
	"total_costs" text,
	"operating_result" text,
	"cumulative_result" text,
	"raw_data" jsonb,
	"source_file_name" text,
	"imported_at" timestamp DEFAULT now(),
	"imported_by" integer
);
--> statement-breakpoint
CREATE TABLE "containers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size_m3" integer NOT NULL,
	"quantity" integer DEFAULT 1,
	"purchase_date" text,
	"purchase_cost" numeric DEFAULT '0',
	"depreciation_years" integer DEFAULT 10,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "cost_variables" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"value" numeric NOT NULL,
	"unit" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_number" text,
	"customer_type" text DEFAULT 'privat' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"company_name" text,
	"street" text NOT NULL,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"phone" text,
	"mobile" text,
	"email1" text,
	"email2" text,
	"skonto_percent" integer DEFAULT 0,
	"discount_percent" integer DEFAULT 0,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"hire_date" text,
	"monthly_salary" numeric NOT NULL,
	"tax_free_allowance" numeric DEFAULT '0',
	"work_hours_per_week" numeric DEFAULT '40',
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "forecast_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"params" jsonb NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_id" integer NOT NULL,
	"payment_date" text NOT NULL,
	"payment_type" text NOT NULL,
	"amount" numeric NOT NULL,
	"year" integer,
	"is_paid" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"amount" numeric NOT NULL,
	"start_date" text,
	"end_date" text,
	"interest_percent" numeric NOT NULL,
	"repayment_percent" numeric DEFAULT '0',
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "market_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"provider_url" text,
	"material_category" text NOT NULL,
	"container_size_m3" integer NOT NULL,
	"price_gross" numeric NOT NULL,
	"price_net" numeric,
	"includes_transport" boolean DEFAULT true,
	"includes_disposal" boolean DEFAULT true,
	"notes" text,
	"source_date" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"avv_number" text,
	"density" numeric NOT NULL,
	"disposal_cost_per_tonne" numeric NOT NULL,
	"surcharge_amount" numeric DEFAULT '0',
	"surcharge_unit" text DEFAULT 'tonne',
	"purchase_surcharge_ids" integer[],
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "offer_counters" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "offer_counters_year_unique" UNIQUE("year")
);
--> statement-breakpoint
CREATE TABLE "partner_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"api_key" text NOT NULL,
	"permissions" text[] NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp,
	CONSTRAINT "partner_api_keys_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "partner_calendar" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"type" text DEFAULT 'DELIVERY' NOT NULL,
	"order_id" integer,
	"title" text,
	"description" text,
	"time_slot" text,
	"max_capacity" integer,
	"current_bookings" integer DEFAULT 0,
	"is_blocked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_geo_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"zip_from" text NOT NULL,
	"zip_to" text NOT NULL,
	"zone_name" text,
	"delivery_surcharge" numeric DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"variant_id" integer NOT NULL,
	"product_name" text,
	"variant_label" text,
	"quantity" integer DEFAULT 1,
	"price_net" numeric,
	"price_gross" numeric,
	"tax_rate" integer DEFAULT 19,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"delivery_date" text,
	"delivery_street" text,
	"delivery_house_nr" text,
	"delivery_zip" text,
	"delivery_city" text,
	"delivery_notes" text,
	"guest_name" text,
	"guest_email" text,
	"guest_phone" text,
	"customer_id" integer,
	"payment_method" text DEFAULT 'RECHNUNG',
	"payment_status" text DEFAULT 'PENDING',
	"internal_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "partner_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "partner_plz_exceptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"zip" text NOT NULL,
	"rule" text NOT NULL,
	"surcharge" numeric DEFAULT '0',
	"min_order_value" numeric,
	"note" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"image_url" text,
	"material_id" integer,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "partner_products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "partner_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_name" text DEFAULT 'Rieprecht GmbH',
	"shop_email" text,
	"shop_phone" text,
	"shop_address" text,
	"currency" text DEFAULT 'EUR',
	"tax_rate" integer DEFAULT 19,
	"min_order_value" numeric DEFAULT '0',
	"max_delivery_radius_km" integer DEFAULT 50,
	"order_confirmation_email" boolean DEFAULT true,
	"default_payment_method" text DEFAULT 'RECHNUNG',
	"maintenance_mode" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"label" text NOT NULL,
	"volume" numeric,
	"weight" numeric,
	"unit" text DEFAULT 'm3',
	"price_net" numeric NOT NULL,
	"price_gross" numeric NOT NULL,
	"tax_rate" integer DEFAULT 19,
	"container_size" text,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "planning_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"containers_per_day" integer DEFAULT 5,
	"work_days_per_month" integer DEFAULT 20,
	"target_margin_percent" numeric DEFAULT '15',
	"active_trucks" integer DEFAULT 1,
	"planned_trucks_date" timestamp,
	"monthly_rent" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "purchase_surcharges" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"amount" numeric NOT NULL,
	"unit" text DEFAULT 'tonne' NOT NULL,
	"applies_to_dangerous" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_name" text,
	"material_id" integer,
	"container_size" integer NOT NULL,
	"distance_km" numeric NOT NULL,
	"estimated_weight_t" numeric NOT NULL,
	"calculated_cost" numeric NOT NULL,
	"final_price" numeric NOT NULL,
	"margin" numeric NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_fixed_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price" numeric NOT NULL,
	"unit" text NOT NULL,
	"applies_to_dangerous" boolean DEFAULT false,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"avv_code" text NOT NULL,
	"material_name" text NOT NULL,
	"price_per_tonne" numeric,
	"price_per_cubic_meter" numeric,
	"behg_surcharge" numeric DEFAULT '0',
	"sales_surcharge_ids" integer[],
	"is_dangerous" boolean DEFAULT false,
	"valid_from" text,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_surcharges" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"amount" numeric NOT NULL,
	"unit" text DEFAULT 'tonne' NOT NULL,
	"applies_to_dangerous" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "saved_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"scenario" text NOT NULL,
	"year" integer NOT NULL,
	"monthly_data" jsonb NOT NULL,
	"params" jsonb,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_date" text NOT NULL,
	"material_id" integer,
	"container_size" integer NOT NULL,
	"distance_km" numeric NOT NULL,
	"actual_price" numeric NOT NULL,
	"notes" text,
	"vehicle_id" integer,
	"vehicle_plate" text,
	"customer_id" integer,
	"customer_number" text,
	"customer_name" text,
	"construction_site" text,
	"order_type" text,
	"a_typ" text,
	"a_art" text,
	"article_id" integer,
	"article_number" text,
	"article_name" text,
	"avv_number" text,
	"quantity" numeric,
	"unit" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'mitarbeiter' NOT NULL,
	"email_verified" boolean DEFAULT false,
	"verification_token" text,
	"verification_token_expiry" timestamp,
	"reset_token" text,
	"reset_token_expiry" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"license_plate" text,
	"purchase_date" text,
	"purchase_cost" numeric DEFAULT '0',
	"depreciation_years" integer DEFAULT 10,
	"monthly_lease_cost" numeric DEFAULT '0',
	"monthly_insurance" numeric DEFAULT '0',
	"monthly_maintenance" numeric DEFAULT '0',
	"fuel_consumption" numeric DEFAULT '30',
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;