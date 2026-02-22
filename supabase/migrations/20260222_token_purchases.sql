create table if not exists public.token_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usuario_id text not null,
  user_email text not null,
  role text not null,
  plan_id text not null,
  plan_name text not null,
  tokens_amount integer not null check (tokens_amount > 0),
  amount numeric(10,2) not null check (amount > 0),
  rs_per_coin numeric(10,2) not null check (rs_per_coin > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'cancelled', 'expired', 'failed')),
  tokens_credited boolean not null default false,
  tokens_credited_at timestamptz,
  mp_payment_id text,
  mp_status text,
  mp_status_detail text,
  pix_qr_code text,
  pix_qr_code_base64 text,
  pix_ticket_url text,
  pix_expires_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_token_purchases_user_created on public.token_purchases(user_id, created_at desc);
create index if not exists idx_token_purchases_status on public.token_purchases(status);

alter table public.token_purchases enable row level security;