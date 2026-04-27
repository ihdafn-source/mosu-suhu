create extension if not exists pgcrypto;

create table if not exists public.admin_config (
	id bigint primary key,
	pin_code text not null
);

create table if not exists public.telegram_alert_config (
	id bigint primary key,
	chat_id text,
	bot_token text,
	threshold integer not null default 25,
	cooldown_seconds integer not null default 60,
	enabled boolean not null default true,
	last_alert_at timestamptz,
	updated_at timestamptz not null default now()
);

create table if not exists public.server_locations (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	api_url text,
	api_key text,
	floors jsonb not null default '[]'::jsonb,
	address text,
	maps_link text,
	created_at timestamptz not null default now(),
	updated_at timestamptz,
	deleted_at timestamptz
);

create table if not exists public.visitor_logs (
	id uuid primary key default gen_random_uuid(),
	ip_address text,
	device text,
	browser text,
	visited_at timestamptz not null default now()
);

create table if not exists public.temperature_logs (
	id uuid primary key default gen_random_uuid(),
	timestamp timestamptz not null,
	temperature double precision not null,
	humidity double precision not null,
	location_id uuid not null references public.server_locations(id) on delete cascade,
	floor_id text not null,
	created_at timestamptz not null default now()
);

create index if not exists temperature_logs_location_timestamp_idx
	on public.temperature_logs (location_id, timestamp desc);

create index if not exists visitor_logs_visited_at_idx
	on public.visitor_logs (visited_at desc);
