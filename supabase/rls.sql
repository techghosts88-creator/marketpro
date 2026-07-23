-- ============================================================================
-- MarketPro — run this in the Supabase SQL Editor AFTER `npx prisma db push`
-- (or `npx prisma migrate dev`) has created the tables from prisma/schema.prisma.
--
-- Prisma doesn't know about Supabase's `auth` schema and doesn't support
-- CHECK constraints in this version of the schema, so those pieces — plus
-- row level security and realtime — are added here instead.
--
-- Safe to re-run: guarded with IF NOT EXISTS / DROP ... IF EXISTS where possible.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Foreign keys into auth.users (Prisma can't manage a schema it doesn't own)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_id_fkey') then
    alter table profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
declare
  t text;
  fk_name text;
begin
  foreach t in array array['products', 'clients', 'suppliers', 'sales', 'purchases', 'expenses', 'debts']
  loop
    fk_name := t || '_owner_id_fkey';
    if not exists (select 1 from pg_constraint where conname = fk_name) then
      execute format('alter table %I add constraint %I foreign key (owner_id) references auth.users(id) on delete cascade;', t, fk_name);
    end if;
  end loop;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'messages_from_user_fkey') then
    alter table messages add constraint messages_from_user_fkey foreign key (from_user) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_to_user_fkey') then
    alter table messages add constraint messages_to_user_fkey foreign key (to_user) references auth.users(id) on delete cascade;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- CHECK constraints (enum-like fields)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table profiles add constraint profiles_role_check check (role in ('merchant', 'supplier'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sales_payment_status_check') then
    alter table sales add constraint sales_payment_status_check check (payment_status in ('paid', 'credit', 'partial'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'debts_status_check') then
    alter table debts add constraint debts_status_check check (status in ('ouvert', 'reglé'));
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
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

alter table messages enable row level security;

drop policy if exists "participants can read their messages" on messages;
create policy "participants can read their messages"
  on messages for select
  using (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "users can send messages as themselves" on messages;
create policy "users can send messages as themselves"
  on messages for insert
  with check (auth.uid() = from_user);

do $$
declare
  t text;
begin
  foreach t in array array['products', 'clients', 'suppliers', 'sales', 'purchases', 'expenses', 'debts']
  loop
    execute format('alter table %I enable row level security;', t);

    execute format('drop policy if exists "owner can select" on %I;', t);
    execute format('create policy "owner can select" on %I for select using (auth.uid() = owner_id);', t);

    execute format('drop policy if exists "owner can insert" on %I;', t);
    execute format('create policy "owner can insert" on %I for insert with check (auth.uid() = owner_id);', t);

    execute format('drop policy if exists "owner can update" on %I;', t);
    execute format('create policy "owner can update" on %I for update using (auth.uid() = owner_id);', t);

    execute format('drop policy if exists "owner can delete" on %I;', t);
    execute format('create policy "owner can delete" on %I for delete using (auth.uid() = owner_id);', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Realtime — lets merchants and suppliers see new messages live
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;
