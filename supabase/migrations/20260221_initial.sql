create extension if not exists "pgcrypto";

do $$ begin
  create type app_role as enum ('client','professional','establishment','admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type booking_status as enum ('reserved','accepted','cancelled','completed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type discount_type as enum ('percent','fixed','gift');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type target_type as enum ('professional','establishment');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  phone text,
  avatar_url text,
  role app_role not null default 'client',
  role_specific_id uuid,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  cnpj_cpf text not null,
  document_urls jsonb not null default '[]'::jsonb,
  categories text[] not null default '{}',
  bio text,
  cep text not null,
  address text,
  city text,
  state text,
  lat double precision,
  lng double precision,
  approved boolean not null default false,
  approval_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.establishment_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  cnpj text not null,
  website text,
  categories text[] not null default '{}',
  description text,
  cep text not null,
  address text,
  city text,
  state text,
  lat double precision,
  lng double precision,
  images text[] not null default '{}',
  approved boolean not null default false,
  approval_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.allowed_ceps (
  id uuid primary key default gen_random_uuid(),
  cep_start text not null,
  cep_end text,
  neighborhood text,
  subprefecture text,
  purpose text not null default 'pirituba_allowlist',
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  description text,
  price numeric(10,2) not null,
  duration integer not null,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishment_profiles(id) on delete cascade,
  title text not null,
  description text,
  discount_type discount_type not null,
  amount numeric(10,2) not null,
  valid_from timestamptz not null,
  valid_to timestamptz not null,
  qty_total integer not null,
  qty_left integer not null,
  conditions text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voucher_id uuid references public.vouchers(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  establishment_id uuid references public.establishment_profiles(id) on delete set null,
  status booking_status not null default 'reserved',
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  target_type target_type not null,
  target_id uuid not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create index if not exists idx_professional_profiles_lat_lng on public.professional_profiles(lat, lng);
create index if not exists idx_establishment_profiles_lat_lng on public.establishment_profiles(lat, lng);
create index if not exists idx_professional_profiles_cep on public.professional_profiles(cep);
create index if not exists idx_establishment_profiles_cep on public.establishment_profiles(cep);
create index if not exists idx_allowed_ceps_start_end on public.allowed_ceps(cep_start, cep_end);
create index if not exists idx_vouchers_active_valid on public.vouchers(active, valid_to);
create index if not exists idx_bookings_created_at on public.bookings(created_at);
create index if not exists idx_reviews_created_at on public.reviews(created_at);
create index if not exists idx_profiles_approved on public.profiles(approved);

alter table public.profiles enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.establishment_profiles enable row level security;
alter table public.allowed_ceps enable row level security;
alter table public.services enable row level security;
alter table public.vouchers enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.favorites enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
  );
$$;

create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_owner" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_insert_owner" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_admin_all" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy "professional_select_all" on public.professional_profiles for select using (true);
create policy "professional_insert_owner" on public.professional_profiles for insert with check (auth.uid() = user_id);
create policy "professional_update_owner" on public.professional_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "professional_admin_all" on public.professional_profiles for all using (public.is_admin()) with check (public.is_admin());

create policy "establishment_select_all" on public.establishment_profiles for select using (true);
create policy "establishment_insert_owner" on public.establishment_profiles for insert with check (auth.uid() = user_id);
create policy "establishment_update_owner" on public.establishment_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "establishment_admin_all" on public.establishment_profiles for all using (public.is_admin()) with check (public.is_admin());

create policy "allowed_ceps_select_authenticated" on public.allowed_ceps for select using (auth.role() = 'authenticated');
create policy "allowed_ceps_admin_all" on public.allowed_ceps for all using (public.is_admin()) with check (public.is_admin());

create policy "services_select_all" on public.services for select using (true);
create policy "services_write_owner" on public.services for all
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role in ('professional', 'establishment')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role in ('professional', 'establishment')
  )
);

create policy "vouchers_select_all" on public.vouchers for select using (true);
create policy "vouchers_write_establishment_owner" on public.vouchers for all
using (
  exists (
    select 1
    from public.establishment_profiles ep
    where ep.id = vouchers.establishment_id
      and ep.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.establishment_profiles ep
    where ep.id = vouchers.establishment_id
      and ep.user_id = auth.uid()
  )
);

create policy "bookings_select_related" on public.bookings for select
using (
  auth.uid() = user_id
  or exists (select 1 from public.professional_profiles pp where pp.id = bookings.professional_id and pp.user_id = auth.uid())
  or exists (select 1 from public.establishment_profiles ep where ep.id = bookings.establishment_id and ep.user_id = auth.uid())
);

create policy "bookings_create_client" on public.bookings for insert
with check (auth.uid() = user_id);

create policy "bookings_update_related" on public.bookings for update
using (
  auth.uid() = user_id
  or exists (select 1 from public.professional_profiles pp where pp.id = bookings.professional_id and pp.user_id = auth.uid())
  or exists (select 1 from public.establishment_profiles ep where ep.id = bookings.establishment_id and ep.user_id = auth.uid())
)
with check (
  auth.uid() = user_id
  or exists (select 1 from public.professional_profiles pp where pp.id = bookings.professional_id and pp.user_id = auth.uid())
  or exists (select 1 from public.establishment_profiles ep where ep.id = bookings.establishment_id and ep.user_id = auth.uid())
);

create policy "bookings_admin_all" on public.bookings for all using (public.is_admin()) with check (public.is_admin());

create policy "reviews_select_all" on public.reviews for select using (true);
create policy "reviews_insert_author" on public.reviews for insert with check (auth.uid() = author_id);
create policy "reviews_admin_all" on public.reviews for all using (public.is_admin()) with check (public.is_admin());

create policy "favorites_select_owner" on public.favorites for select using (auth.uid() = user_id);
create policy "favorites_insert_owner" on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites_delete_owner" on public.favorites for delete using (auth.uid() = user_id);

create or replace function public.prevent_non_admin_approval_change()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    if new.approved is distinct from old.approved then
      raise exception 'Only admin can change approval status';
    end if;

    if
      to_jsonb(new) ? 'approval_note'
      and to_jsonb(old) ? 'approval_note'
      and (to_jsonb(new)->>'approval_note') is distinct from (to_jsonb(old)->>'approval_note')
    then
      raise exception 'Only admin can change approval note';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_approval_guard on public.profiles;
create trigger trg_profiles_approval_guard
before update on public.profiles
for each row
execute function public.prevent_non_admin_approval_change();

drop trigger if exists trg_professional_approval_guard on public.professional_profiles;
create trigger trg_professional_approval_guard
before update on public.professional_profiles
for each row
execute function public.prevent_non_admin_approval_change();

drop trigger if exists trg_establishment_approval_guard on public.establishment_profiles;
create trigger trg_establishment_approval_guard
before update on public.establishment_profiles
for each row
execute function public.prevent_non_admin_approval_change();

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_upload_authenticated" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'documents'
  and (lower(storage.extension(name)) in ('pdf', 'png', 'jpg', 'jpeg'))
);

create policy "documents_select_authenticated" on storage.objects
for select to authenticated
using (bucket_id = 'documents');

create or replace function public.reserve_voucher_atomic(
  p_voucher_id uuid,
  p_service_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_establishment_id uuid;
begin
  update public.vouchers
  set qty_left = qty_left - 1
  where id = p_voucher_id
    and active = true
    and valid_to >= now()
    and qty_left > 0
  returning establishment_id into v_establishment_id;

  if v_establishment_id is null then
    raise exception 'Voucher indisponível';
  end if;

  insert into public.bookings (
    user_id,
    voucher_id,
    service_id,
    establishment_id,
    status
  ) values (
    auth.uid(),
    p_voucher_id,
    p_service_id,
    v_establishment_id,
    'reserved'
  ) returning id into v_booking_id;

  return v_booking_id;
end;
$$;

grant execute on function public.reserve_voucher_atomic(uuid, uuid) to authenticated;
