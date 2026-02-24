do $$ begin
  create type contact_request_status as enum ('pending', 'authorized', 'denied', 'insufficient_tokens', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.contact_release_cost_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  coins_per_contact_request integer not null check (coins_per_contact_request >= 0),
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_contact_release_cost_plans_default
on public.contact_release_cost_plans (is_default)
where is_default = true;

create table if not exists public.professional_plan_subscriptions (
  id uuid primary key default gen_random_uuid(),
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.contact_release_cost_plans(id),
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_professional_subscription_active_unique
on public.professional_plan_subscriptions (professional_user_id)
where status = 'active';

create table if not exists public.contact_access_requests (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users(id) on delete cascade,
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  requested_by_role text not null check (requested_by_role in ('cliente', 'profissional')),
  status contact_request_status not null default 'pending',
  requester_email text not null,
  requester_name text,
  target_email text not null,
  target_name text,
  professional_email text not null,
  request_note text,
  response_note text,
  plan_id uuid references public.contact_release_cost_plans(id),
  plan_code text,
  debited_tokens integer,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  authorized_at timestamptz,
  client_can_view_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_user_id <> professional_user_id)
);

create table if not exists public.browser_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_contact_access_requests_professional_requested
on public.contact_access_requests (professional_user_id, requested_at desc);

create index if not exists idx_contact_access_requests_client_requested
on public.contact_access_requests (client_user_id, requested_at desc);

create index if not exists idx_contact_access_requests_status
on public.contact_access_requests (status);

create index if not exists idx_browser_push_subscriptions_user_active
on public.browser_push_subscriptions (user_id, is_active);

create unique index if not exists idx_contact_access_requests_pending_unique
on public.contact_access_requests (client_user_id, professional_user_id)
where status = 'pending';

alter table public.contact_release_cost_plans enable row level security;
alter table public.professional_plan_subscriptions enable row level security;
alter table public.contact_access_requests enable row level security;
alter table public.browser_push_subscriptions enable row level security;

create or replace function public.is_usuario_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.email = (select email from auth.users where id = auth.uid())
      and u.role = 'admin'
  );
$$;

drop policy if exists "contact_release_cost_plans_select_authenticated" on public.contact_release_cost_plans;
create policy "contact_release_cost_plans_select_authenticated"
on public.contact_release_cost_plans
for select
using (auth.role() = 'authenticated');

drop policy if exists "contact_release_cost_plans_admin_all" on public.contact_release_cost_plans;
create policy "contact_release_cost_plans_admin_all"
on public.contact_release_cost_plans
for all
using (public.is_usuario_admin())
with check (public.is_usuario_admin());

drop policy if exists "professional_plan_subscriptions_select_owner" on public.professional_plan_subscriptions;
create policy "professional_plan_subscriptions_select_owner"
on public.professional_plan_subscriptions
for select
using (auth.uid() = professional_user_id or public.is_usuario_admin());

drop policy if exists "professional_plan_subscriptions_admin_all" on public.professional_plan_subscriptions;
create policy "professional_plan_subscriptions_admin_all"
on public.professional_plan_subscriptions
for all
using (public.is_usuario_admin())
with check (public.is_usuario_admin());

drop policy if exists "contact_access_requests_select_related" on public.contact_access_requests;
create policy "contact_access_requests_select_related"
on public.contact_access_requests
for select
using (
  auth.uid() = client_user_id
  or auth.uid() = professional_user_id
  or public.is_usuario_admin()
);

drop policy if exists "contact_access_requests_insert_client" on public.contact_access_requests;
create policy "contact_access_requests_insert_client"
on public.contact_access_requests
for insert
with check (
  auth.uid() = client_user_id
  and requested_by_role = 'cliente'
);

drop policy if exists "contact_access_requests_insert_professional" on public.contact_access_requests;
create policy "contact_access_requests_insert_professional"
on public.contact_access_requests
for insert
with check (
  auth.uid() = professional_user_id
  and requested_by_role = 'profissional'
);

drop policy if exists "browser_push_subscriptions_select_owner" on public.browser_push_subscriptions;
create policy "browser_push_subscriptions_select_owner"
on public.browser_push_subscriptions
for select
using (auth.uid() = user_id or public.is_usuario_admin());

drop policy if exists "browser_push_subscriptions_insert_owner" on public.browser_push_subscriptions;
create policy "browser_push_subscriptions_insert_owner"
on public.browser_push_subscriptions
for insert
with check (auth.uid() = user_id or public.is_usuario_admin());

drop policy if exists "browser_push_subscriptions_update_owner" on public.browser_push_subscriptions;
create policy "browser_push_subscriptions_update_owner"
on public.browser_push_subscriptions
for update
using (auth.uid() = user_id or public.is_usuario_admin())
with check (auth.uid() = user_id or public.is_usuario_admin());

drop policy if exists "browser_push_subscriptions_delete_owner" on public.browser_push_subscriptions;
create policy "browser_push_subscriptions_delete_owner"
on public.browser_push_subscriptions
for delete
using (auth.uid() = user_id or public.is_usuario_admin());

create or replace function public.set_contact_access_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_browser_push_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_contact_access_requests_updated_at on public.contact_access_requests;
create trigger trg_contact_access_requests_updated_at
before update on public.contact_access_requests
for each row
execute function public.set_contact_access_requests_updated_at();

drop trigger if exists trg_browser_push_subscriptions_updated_at on public.browser_push_subscriptions;
create trigger trg_browser_push_subscriptions_updated_at
before update on public.browser_push_subscriptions
for each row
execute function public.set_browser_push_subscriptions_updated_at();

create or replace function public.upsert_browser_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_subscription_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if nullif(trim(coalesce(p_endpoint, '')), '') is null then
    raise exception 'Endpoint de push é obrigatório';
  end if;

  if nullif(trim(coalesce(p_p256dh, '')), '') is null then
    raise exception 'Chave p256dh é obrigatória';
  end if;

  if nullif(trim(coalesce(p_auth, '')), '') is null then
    raise exception 'Chave auth é obrigatória';
  end if;

  insert into public.browser_push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent,
    is_active
  ) values (
    v_user_id,
    trim(p_endpoint),
    trim(p_p256dh),
    trim(p_auth),
    nullif(trim(coalesce(p_user_agent, '')), ''),
    true
  )
  on conflict (user_id, endpoint)
  do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    is_active = true,
    updated_at = now()
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

create or replace function public.deactivate_browser_push_subscription(
  p_endpoint text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  update public.browser_push_subscriptions
  set is_active = false, updated_at = now()
  where user_id = v_user_id
    and endpoint = p_endpoint;

  return found;
end;
$$;

create or replace function public.create_contact_access_request(
  p_professional_user_id uuid,
  p_request_note text default null,
  p_client_user_id uuid default null,
  p_requested_by_role text default 'cliente'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_client_user_id uuid;
  v_professional_user_id uuid := p_professional_user_id;
  v_client_email text;
  v_professional_email text;
  v_client_name text;
  v_professional_name text;
  v_request_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_requested_by_role not in ('cliente', 'profissional') then
    raise exception 'Tipo de solicitante inválido';
  end if;

  if p_requested_by_role = 'cliente' then
    v_client_user_id := v_actor_id;
  else
    v_client_user_id := p_client_user_id;
    if v_client_user_id is null then
      raise exception 'client_user_id é obrigatório quando requested_by_role = profissional';
    end if;
    if v_actor_id <> v_professional_user_id then
      raise exception 'Somente o profissional pode criar pedido com requested_by_role = profissional';
    end if;
  end if;

  if v_client_user_id = v_professional_user_id then
    raise exception 'Cliente e profissional não podem ser iguais';
  end if;

  select email into v_client_email from auth.users where id = v_client_user_id;
  select email into v_professional_email from auth.users where id = v_professional_user_id;

  if v_client_email is null or v_professional_email is null then
    raise exception 'Usuário cliente/profissional inválido';
  end if;

  if not exists (
    select 1
    from public.usuarios u
    where u.email = v_professional_email
      and u.role = 'profissional'
  ) then
    raise exception 'Usuário de destino não é profissional';
  end if;

  select u.nome into v_client_name from public.usuarios u where u.email = v_client_email order by u.created_at desc limit 1;
  select u.nome into v_professional_name from public.usuarios u where u.email = v_professional_email order by u.created_at desc limit 1;

  insert into public.contact_access_requests (
    client_user_id,
    professional_user_id,
    requested_by_role,
    status,
    requester_email,
    requester_name,
    target_email,
    target_name,
    professional_email,
    request_note
  ) values (
    v_client_user_id,
    v_professional_user_id,
    p_requested_by_role,
    'pending',
    case when p_requested_by_role = 'cliente' then v_client_email else v_professional_email end,
    case when p_requested_by_role = 'cliente' then v_client_name else v_professional_name end,
    case when p_requested_by_role = 'cliente' then v_professional_email else v_client_email end,
    case when p_requested_by_role = 'cliente' then v_professional_name else v_client_name end,
    v_professional_email,
    nullif(trim(coalesce(p_request_note, '')), '')
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.authorize_contact_access_request(
  p_request_id uuid,
  p_authorize boolean,
  p_response_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_request public.contact_access_requests%rowtype;
  v_plan_id uuid;
  v_plan_code text;
  v_plan_name text;
  v_cost integer := 0;
  v_remaining_tokens integer;
begin
  if v_actor_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select *
  into v_request
  from public.contact_access_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Solicitação não encontrada';
  end if;

  if v_request.professional_user_id <> v_actor_id then
    raise exception 'Somente o profissional da solicitação pode responder';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Solicitação já respondida';
  end if;

  if not p_authorize then
    update public.contact_access_requests
    set
      status = 'denied',
      response_note = nullif(trim(coalesce(p_response_note, '')), ''),
      responded_at = now(),
      client_can_view_contact = false,
      debited_tokens = 0
    where id = p_request_id;

    return jsonb_build_object(
      'status', 'denied',
      'message', 'Solicitação recusada pelo profissional',
      'debited_tokens', 0
    );
  end if;

  select p.id, p.code, p.name, p.coins_per_contact_request
  into v_plan_id, v_plan_code, v_plan_name, v_cost
  from public.professional_plan_subscriptions s
  join public.contact_release_cost_plans p on p.id = s.plan_id
  where s.professional_user_id = v_request.professional_user_id
    and s.status = 'active'
    and p.active = true
    and (s.ends_at is null or s.ends_at >= now())
  order by s.started_at desc
  limit 1;

  if v_plan_id is null then
    select p.id, p.code, p.name, p.coins_per_contact_request
    into v_plan_id, v_plan_code, v_plan_name, v_cost
    from public.contact_release_cost_plans p
    where p.active = true
      and p.is_default = true
    limit 1;
  end if;

  if v_plan_id is null then
    raise exception 'Nenhum plano de custo ativo encontrado para débito de contato';
  end if;

  v_cost := greatest(0, coalesce(v_cost, 0));

  if v_cost > 0 then
    update public.usuarios
    set tokens = coalesce(tokens, 0) - v_cost
    where email = v_request.professional_email
      and role = 'profissional'
      and coalesce(tokens, 0) >= v_cost
    returning tokens into v_remaining_tokens;

    if v_remaining_tokens is null then
      update public.contact_access_requests
      set
        status = 'insufficient_tokens',
        plan_id = v_plan_id,
        plan_code = v_plan_code,
        response_note = coalesce(nullif(trim(coalesce(p_response_note, '')), ''), 'Saldo insuficiente para liberar contato.'),
        responded_at = now(),
        client_can_view_contact = false,
        debited_tokens = 0
      where id = p_request_id;

      return jsonb_build_object(
        'status', 'insufficient_tokens',
        'message', 'Saldo insuficiente para liberar contato. Recarregue moedas para continuar.',
        'plan_code', v_plan_code,
        'plan_name', v_plan_name,
        'debited_tokens', 0
      );
    end if;
  else
    select coalesce(tokens, 0)
    into v_remaining_tokens
    from public.usuarios
    where email = v_request.professional_email
      and role = 'profissional'
    order by created_at desc
    limit 1;
  end if;

  update public.contact_access_requests
  set
    status = 'authorized',
    plan_id = v_plan_id,
    plan_code = v_plan_code,
    response_note = nullif(trim(coalesce(p_response_note, '')), ''),
    responded_at = now(),
    authorized_at = now(),
    client_can_view_contact = true,
    debited_tokens = v_cost
  where id = p_request_id;

  return jsonb_build_object(
    'status', 'authorized',
    'message', 'Contato liberado com sucesso para o cliente',
    'plan_code', v_plan_code,
    'plan_name', v_plan_name,
    'debited_tokens', v_cost,
    'remaining_tokens', coalesce(v_remaining_tokens, 0)
  );
end;
$$;

grant execute on function public.create_contact_access_request(uuid, text, uuid, text) to authenticated;
grant execute on function public.authorize_contact_access_request(uuid, boolean, text) to authenticated;
grant execute on function public.upsert_browser_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.deactivate_browser_push_subscription(text) to authenticated;

insert into public.contact_release_cost_plans (code, name, coins_per_contact_request, is_default, active)
values
  ('profissional_basico', 'Profissional Básico', 4, true, true),
  ('profissional_plus', 'Profissional Plus', 3, false, true),
  ('profissional_prime', 'Profissional Prime', 2, false, true)
on conflict (code) do update
set
  name = excluded.name,
  coins_per_contact_request = excluded.coins_per_contact_request,
  active = excluded.active;

do $$ begin
  alter publication supabase_realtime add table public.contact_access_requests;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
