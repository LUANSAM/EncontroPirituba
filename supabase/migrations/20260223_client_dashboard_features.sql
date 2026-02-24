create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  title text not null,
  description text not null,
  urgency text not null default 'normal' check (urgency in ('baixa', 'normal', 'alta', 'urgente')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_service_requests_client_created
on public.service_requests (client_user_id, created_at desc);

create index if not exists idx_service_requests_category_status
on public.service_requests (category, status);

alter table public.service_requests enable row level security;

drop policy if exists "service_requests_select_related" on public.service_requests;
create policy "service_requests_select_related"
on public.service_requests
for select
using (
  auth.uid() = client_user_id
  or public.is_usuario_admin()
);

drop policy if exists "service_requests_insert_client" on public.service_requests;
create policy "service_requests_insert_client"
on public.service_requests
for insert
with check (auth.uid() = client_user_id);

drop policy if exists "service_requests_update_owner" on public.service_requests;
create policy "service_requests_update_owner"
on public.service_requests
for update
using (auth.uid() = client_user_id or public.is_usuario_admin())
with check (auth.uid() = client_user_id or public.is_usuario_admin());

create or replace function public.set_service_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_service_requests_updated_at on public.service_requests;
create trigger trg_service_requests_updated_at
before update on public.service_requests
for each row
execute function public.set_service_requests_updated_at();

create or replace function public.increment_usuario_profile_visits(
  p_usuario_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_visits integer;
begin
  update public.usuarios
  set indicadores = jsonb_set(
    coalesce(indicadores, '{}'::jsonb),
    '{nVisitas}',
    to_jsonb(coalesce((coalesce(indicadores, '{}'::jsonb)->>'nVisitas')::integer, 0) + 1),
    true
  )
  where id::text = p_usuario_id
  returning coalesce((coalesce(indicadores, '{}'::jsonb)->>'nVisitas')::integer, 0) into v_next_visits;

  if v_next_visits is null then
    raise exception 'Usuário não encontrado para incrementar visitas';
  end if;

  return v_next_visits;
end;
$$;

create or replace function public.create_service_request(
  p_category text,
  p_title text,
  p_description text,
  p_urgency text default 'normal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_user_id uuid := auth.uid();
  v_request_id uuid;
  v_urgency text := lower(trim(coalesce(p_urgency, 'normal')));
begin
  if v_client_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if nullif(trim(coalesce(p_category, '')), '') is null then
    raise exception 'Categoria é obrigatória';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Título é obrigatório';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'Descrição é obrigatória';
  end if;

  if v_urgency not in ('baixa', 'normal', 'alta', 'urgente') then
    raise exception 'Urgência inválida';
  end if;

  if not exists (
    select 1
    from public.usuarios u
    join auth.users au on au.email = u.email
    where au.id = v_client_user_id
      and u.role = 'cliente'
  ) then
    raise exception 'Apenas clientes podem abrir solicitação de serviço';
  end if;

  insert into public.service_requests (
    client_user_id,
    category,
    title,
    description,
    urgency,
    status
  ) values (
    v_client_user_id,
    trim(p_category),
    trim(p_title),
    trim(p_description),
    v_urgency,
    'open'
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function public.increment_usuario_profile_visits(text) to authenticated;
grant execute on function public.create_service_request(text, text, text, text) to authenticated;
