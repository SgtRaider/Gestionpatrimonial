CREATE TYPE "public"."account_type" AS ENUM('checking', 'savings', 'brokerage', 'pension', 'crypto', 'real_estate', 'vehicle', 'other');--> statement-breakpoint
CREATE TYPE "public"."amortization_system" AS ENUM('french', 'german', 'american', 'bullet');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('expense', 'income', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."certainty" AS ENUM('low', 'medium', 'high', 'certain');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'achieved', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."holding_transaction_kind" AS ENUM('buy', 'sell', 'transfer_in', 'transfer_out', 'dividend', 'split', 'fee', 'tax');--> statement-breakpoint
CREATE TYPE "public"."insight_kind" AS ENUM('unused_subscription', 'idle_liquidity', 'mortgage_vs_invest', 'high_fees', 'modelo_720_alert', 'category_spike', 'low_savings_rate', 'rebalance_suggestion', 'other');--> statement-breakpoint
CREATE TYPE "public"."insight_severity" AS ENUM('info', 'warning', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."institution_type" AS ENUM('bank', 'broker', 'insurer', 'crypto_exchange', 'real_estate', 'manual');--> statement-breakpoint
CREATE TYPE "public"."loan_kind" AS ENUM('mortgage', 'personal', 'car', 'student', 'other');--> statement-breakpoint
CREATE TYPE "public"."planned_event_kind" AS ENUM('expense', 'income', 'transfer', 'asset_purchase', 'asset_sale', 'loan_origination', 'loan_payoff', 'life_event');--> statement-breakpoint
CREATE TYPE "public"."planned_event_status" AS ENUM('planned', 'confirmed', 'executed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."prepayment_mode" AS ENUM('reduce_term', 'reduce_payment');--> statement-breakpoint
CREATE TYPE "public"."rate_source" AS ENUM('contract', 'review', 'novation');--> statement-breakpoint
CREATE TYPE "public"."rate_type" AS ENUM('fixed', 'variable', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."recurring_frequency" AS ENUM('weekly', 'monthly', 'quarterly', 'biannual', 'yearly', 'custom');--> statement-breakpoint
CREATE TYPE "public"."recurring_kind" AS ENUM('subscription', 'bill', 'salary', 'rent', 'transfer', 'other');--> statement-breakpoint
CREATE TYPE "public"."recurring_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_source" AS ENUM('psd2', 'csv', 'scrape', 'manual', 'derived');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('booked', 'pending');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"institution_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "account_type" NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"iban_last4" varchar(4),
	"external_account_id" varchar(100),
	"opened_at" date,
	"closed_at" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entity" varchar(50) NOT NULL,
	"entity_id" uuid,
	"action" varchar(50) NOT NULL,
	"diff" jsonb,
	"actor" varchar(100),
	"ip_address" varchar(45),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "balances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"snapshot_at" timestamp with time zone NOT NULL,
	"available" numeric(15, 2) NOT NULL,
	"booked" numeric(15, 2) NOT NULL,
	"source" "transaction_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(100) NOT NULL,
	"kind" "category_kind" NOT NULL,
	"color" varchar(9),
	"icon_key" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "categorization_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"pattern_regex" text NOT NULL,
	"account_id" uuid,
	"amount_min" numeric(15, 2),
	"amount_max" numeric(15, 2),
	"category_id" uuid NOT NULL,
	"suggested_from_transaction_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "forecast_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"scenario_id" uuid,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"horizon_months" integer NOT NULL,
	"parameters" jsonb,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"from_currency" varchar(3) NOT NULL,
	"to_currency" varchar(3) NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"valuation_date" date NOT NULL,
	"source" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"target_amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"target_date" date,
	"current_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"monthly_contribution_target" numeric(15, 2),
	"linked_account_id" uuid,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "holding_transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"holding_id" uuid NOT NULL,
	"kind" "holding_transaction_kind" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"fees" numeric(15, 2) DEFAULT '0' NOT NULL,
	"taxes" numeric(15, 2) DEFAULT '0' NOT NULL,
	"fiscal_event_group_id" uuid,
	"transaction_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "holding_valuations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"holding_id" uuid NOT NULL,
	"valuation_at" date NOT NULL,
	"nav" numeric(20, 8) NOT NULL,
	"total_value" numeric(15, 2) NOT NULL,
	"source" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"isin" varchar(12),
	"ticker" varchar(20),
	"name" varchar(200) NOT NULL,
	"asset_class" varchar(50),
	"currency" varchar(3) NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"avg_cost" numeric(20, 8) NOT NULL,
	"opened_at" date,
	"closed_at" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "insight_kind" NOT NULL,
	"severity" "insight_severity" DEFAULT 'info' NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"estimated_savings" numeric(15, 2),
	"action_payload" jsonb,
	"payload" jsonb,
	"dismissed_at" timestamp with time zone,
	"acted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "institution_type" NOT NULL,
	"country" varchar(2) DEFAULT 'ES' NOT NULL,
	"psd2_institution_id" varchar(100),
	"bic" varchar(11),
	"color" varchar(9),
	"icon_key" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "loan_amortization_schedule" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"period" integer NOT NULL,
	"due_at" date NOT NULL,
	"payment" numeric(15, 2) NOT NULL,
	"principal" numeric(15, 2) NOT NULL,
	"interest" numeric(15, 2) NOT NULL,
	"outstanding_after" numeric(15, 2) NOT NULL,
	"is_projection" boolean DEFAULT true NOT NULL,
	"is_grace_period" boolean DEFAULT false NOT NULL,
	"rate_applied" numeric(8, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"transaction_id" uuid,
	"occurred_at" date NOT NULL,
	"period" integer,
	"principal_paid" numeric(15, 2) NOT NULL,
	"interest_paid" numeric(15, 2) NOT NULL,
	"fees_paid" numeric(15, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "loan_prepayments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"occurred_at" date NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"mode" "prepayment_mode" NOT NULL,
	"fee_amount" numeric(15, 2) DEFAULT '0',
	"transaction_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "loan_rate_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"loan_id" uuid NOT NULL,
	"effective_at" date NOT NULL,
	"rate" numeric(8, 4) NOT NULL,
	"index_value_at_review" numeric(8, 4),
	"spread" numeric(8, 4),
	"source" "rate_source" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"linked_asset_account_id" uuid,
	"kind" "loan_kind" NOT NULL,
	"alias" varchar(100),
	"lender" varchar(100) NOT NULL,
	"principal_initial" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"started_at" date NOT NULL,
	"term_months" integer NOT NULL,
	"amortization_system" "amortization_system" DEFAULT 'french' NOT NULL,
	"rate_type" "rate_type" NOT NULL,
	"rate_fixed" numeric(8, 4),
	"rate_index" varchar(50),
	"rate_spread" numeric(8, 4),
	"review_frequency_months" integer,
	"next_review_at" date,
	"prepayment_fee_pct" numeric(8, 4) DEFAULT '0',
	"fiscal_deductible" boolean DEFAULT false NOT NULL,
	"linked_products" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "net_worth_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"snapshot_at" date NOT NULL,
	"assets_liquid" numeric(15, 2) NOT NULL,
	"assets_invested" numeric(15, 2) NOT NULL,
	"assets_real_estate" numeric(15, 2) NOT NULL,
	"assets_other" numeric(15, 2) NOT NULL,
	"liabilities_total" numeric(15, 2) NOT NULL,
	"net_worth" numeric(15, 2) NOT NULL,
	"breakdown" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planned_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"kind" "planned_event_kind" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"scheduled_at" date NOT NULL,
	"recurrence_frequency" "recurring_frequency",
	"recurrence_until" date,
	"certainty" "certainty" DEFAULT 'medium' NOT NULL,
	"category_id" uuid,
	"account_id" uuid,
	"goal_id" uuid,
	"notes" text,
	"status" "planned_event_status" DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recurring_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"kind" "recurring_kind" NOT NULL,
	"expected_amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"frequency" "recurring_frequency" NOT NULL,
	"cron_expr" varchar(100),
	"next_expected_at" date,
	"category_id" uuid,
	"account_id" uuid,
	"status" "recurring_status" DEFAULT 'active' NOT NULL,
	"detected_automatically" boolean DEFAULT false NOT NULL,
	"confidence" numeric(8, 4),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"base_scenario_id" uuid,
	"modifications" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transaction_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" varchar(100),
	"size_bytes" integer,
	"kind" varchar(50) DEFAULT 'receipt' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transaction_tags" (
	"transaction_id" uuid NOT NULL,
	"tag" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_tags_transaction_id_tag_pk" PRIMARY KEY("transaction_id","tag")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"booked_at" timestamp with time zone NOT NULL,
	"value_at" timestamp with time zone,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"fx_rate_used" numeric(20, 10),
	"amount_base_currency" numeric(15, 2),
	"description_raw" text NOT NULL,
	"counterparty" varchar(200),
	"normalized_merchant" varchar(200),
	"merchant_alias_user" varchar(200),
	"category_id" uuid,
	"status" "transaction_status" DEFAULT 'booked' NOT NULL,
	"source" "transaction_source" NOT NULL,
	"external_id" varchar(200),
	"transfer_pair_id" uuid,
	"parent_transaction_id" uuid,
	"recurring_rule_id" uuid,
	"notes" text,
	"is_projection" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "unidentified_expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"description" text,
	"category_id" uuid,
	"location" varchar(200),
	"geo_lat" numeric(9, 6),
	"geo_lon" numeric(9, 6),
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"base_currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"fiscal_year_start_month" integer DEFAULT 1 NOT NULL,
	"locale" varchar(10) DEFAULT 'es-ES' NOT NULL,
	"timezone" varchar(50) DEFAULT 'Europe/Madrid' NOT NULL,
	"expected_portfolio_return_default" numeric(8, 4) DEFAULT '6.5' NOT NULL,
	"large_expense_threshold" numeric(15, 2) DEFAULT '200' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"display_name" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balances" ADD CONSTRAINT "balances_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_runs" ADD CONSTRAINT "forecast_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_runs" ADD CONSTRAINT "forecast_runs_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_linked_account_id_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_transactions" ADD CONSTRAINT "holding_transactions_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_transactions" ADD CONSTRAINT "holding_transactions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_valuations" ADD CONSTRAINT "holding_valuations_holding_id_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."holdings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_amortization_schedule" ADD CONSTRAINT "loan_amortization_schedule_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_prepayments" ADD CONSTRAINT "loan_prepayments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_prepayments" ADD CONSTRAINT "loan_prepayments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_rate_history" ADD CONSTRAINT "loan_rate_history_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_linked_asset_account_id_accounts_id_fk" FOREIGN KEY ("linked_asset_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_events" ADD CONSTRAINT "planned_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_events" ADD CONSTRAINT "planned_events_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_events" ADD CONSTRAINT "planned_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_events" ADD CONSTRAINT "planned_events_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_base_scenario_id_scenarios_id_fk" FOREIGN KEY ("base_scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_parent_transaction_id_transactions_id_fk" FOREIGN KEY ("parent_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_rule_id_recurring_rules_id_fk" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unidentified_expenses" ADD CONSTRAINT "unidentified_expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unidentified_expenses" ADD CONSTRAINT "unidentified_expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unidentified_expenses" ADD CONSTRAINT "unidentified_expenses_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_external_unique" ON "accounts" USING btree ("institution_id","external_account_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_user_occurred_idx" ON "audit_log" USING btree ("user_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "balances_account_idx" ON "balances" USING btree ("account_id","snapshot_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "balances_unique" ON "balances" USING btree ("account_id","snapshot_at");--> statement-breakpoint
CREATE INDEX "categories_user_idx" ON "categories" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categorization_rules_user_priority_idx" ON "categorization_rules" USING btree ("user_id","priority");--> statement-breakpoint
CREATE INDEX "forecast_user_run_idx" ON "forecast_runs" USING btree ("user_id","run_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_unique" ON "fx_rates" USING btree ("from_currency","to_currency","valuation_date");--> statement-breakpoint
CREATE INDEX "fx_rates_date_idx" ON "fx_rates" USING btree ("valuation_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "goals_user_status_idx" ON "goals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "holding_tx_holding_idx" ON "holding_transactions" USING btree ("holding_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "holding_tx_fiscal_group_idx" ON "holding_transactions" USING btree ("fiscal_event_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "holding_valuations_unique" ON "holding_valuations" USING btree ("holding_id","valuation_at");--> statement-breakpoint
CREATE INDEX "holdings_account_idx" ON "holdings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "holdings_isin_idx" ON "holdings" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "insights_user_active_idx" ON "insights" USING btree ("user_id","dismissed_at","acted_at");--> statement-breakpoint
CREATE INDEX "insights_kind_idx" ON "insights" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_loan_period_unique" ON "loan_amortization_schedule" USING btree ("loan_id","period");--> statement-breakpoint
CREATE INDEX "schedule_loan_due_idx" ON "loan_amortization_schedule" USING btree ("loan_id","due_at");--> statement-breakpoint
CREATE INDEX "payments_loan_idx" ON "loan_payments" USING btree ("loan_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "prepayments_loan_idx" ON "loan_prepayments" USING btree ("loan_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "loan_rate_history_loan_idx" ON "loan_rate_history" USING btree ("loan_id","effective_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "loans_user_idx" ON "loans" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "net_worth_unique" ON "net_worth_snapshots" USING btree ("user_id","snapshot_at");--> statement-breakpoint
CREATE INDEX "net_worth_date_idx" ON "net_worth_snapshots" USING btree ("snapshot_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "planned_user_scheduled_idx" ON "planned_events" USING btree ("user_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "planned_status_idx" ON "planned_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recurring_user_status_idx" ON "recurring_rules" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "recurring_next_idx" ON "recurring_rules" USING btree ("next_expected_at");--> statement-breakpoint
CREATE INDEX "scenarios_user_idx" ON "scenarios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_tags_tag_idx" ON "transaction_tags" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "transactions_user_booked_idx" ON "transactions" USING btree ("user_id","booked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_account_booked_idx" ON "transactions" USING btree ("account_id","booked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_category_idx" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "transactions_transfer_pair_idx" ON "transactions" USING btree ("transfer_pair_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_external_unique" ON "transactions" USING btree ("account_id","external_id");--> statement-breakpoint
CREATE INDEX "unidentified_user_occurred_idx" ON "unidentified_expenses" USING btree ("user_id","occurred_at" DESC NULLS LAST);