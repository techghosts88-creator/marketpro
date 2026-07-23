-- ============================================================================
-- MarketPro — Supabase schema
-- Paste this entire file into the Supabase SQL editor (Database > SQL Editor)
-- and run it once on a fresh project. Safe to re-run: uses IF NOT EXISTS /
-- DROP POLICY IF EXISTS guards where practical.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- PROFILES — one row per Supabase Auth user, with MarketPro-specific fields.
-- Readable by any signed-in user (needed for the supplier directory and for
-- showing the other person's name in messages); only the owner can edit it.
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null check (role in ('merchant', 'supplier')),
  boutique text,
  company text,
  city text,
  phone text,
  avatar text,
  categories text[] default '{}',
  created_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles are readable by any signed-in user" on profiles;
create policy "profiles are readable by any signed-in user"
  on profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can insert their own profile" on profiles;
create policy "users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on profiles;
create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- Generic helper: every business table below follows the same shape
-- (id uuid, owner_id uuid, created_at, ...fields) and the same RLS policy
-- (an owner can only see and change their own rows).
-- ----------------------------------------------------------------------------

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  unit text,
  stock numeric not null default 0,
  threshold numeric not null default 0,
  price numeric not null default 0,
  category text,
  created_at timestamptz default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  created_at timestamptz default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  balance numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  product text not null,
  qty numeric not null default 1,
  unit text,
  amount numeric not null default 0,
  client text,
  category text,
  payment_method text default 'especes',
  payment_status text default 'paid' check (payment_status in ('paid', 'credit', 'partial')),
  amount_paid numeric not null default 0,
  amount_due numeric not null default 0,
  due_date date,
  created_at timestamptz default now()
);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  product text not null,
  qty numeric not null default 1,
  unit text,
  amount numeric not null default 0,
  supplier text,
  created_at timestamptz default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount numeric not null default 0,
  category text,
  created_at timestamptz default now()
);

create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  amount numeric not null default 0,
  due_date date not null,
  status text not null default 'ouvert' check (status in ('ouvert', 'reglé')),
  reminders jsonb not null default '[]',
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- MESSAGES — direct messages between two profiles (merchant <-> supplier).
-- Either participant can read the thread; only the sender can insert.
-- ----------------------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

alter table messages enable row level security;

drop policy if exists "participants can read their messages" on messages;
create policy "participants can read their messages"
  on messages for select
  using (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "users can send messages as themselves" on messages;
create policy "users can send messages as themselves"
  on messages for insert
  with check (auth.uid() = from_user);

-- ----------------------------------------------------------------------------
-- Apply the same "owner only" RLS policy to every business table.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['products', 'clients', 'suppliers', 'sales', 'purchases', 'expenses', 'debts']
  loop
    execute format('alter table %I enable row level security;', t);

    execute format('drop policy if exists "owner can select" on %I;', t);
    execute format(
      'create policy "owner can select" on %I for select using (auth.uid() = owner_id);', t
    );

    execute format('drop policy if exists "owner can insert" on %I;', t);
    execute format(
      'create policy "owner can insert" on %I for insert with check (auth.uid() = owner_id);', t
    );

    execute format('drop policy if exists "owner can update" on %I;', t);
    execute format(
      'create policy "owner can update" on %I for update using (auth.uid() = owner_id);', t
    );

    execute format('drop policy if exists "owner can delete" on %I;', t);
    execute format(
      'create policy "owner can delete" on %I for delete using (auth.uid() = owner_id);', t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Realtime — lets merchants and suppliers see new messages live.
-- (Safe to ignore the error if already added on re-run.)
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table messages;
