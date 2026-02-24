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
  v_professional_lookup_email text;
  v_existing_request_id uuid;
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
  end if;

  if v_client_user_id = v_professional_user_id then
    raise exception 'Cliente e profissional não podem ser iguais';
  end if;

  select email into v_client_email from auth.users where id = v_client_user_id;

  select au.email
  into v_professional_email
  from auth.users au
  where au.id = v_professional_user_id
  limit 1;

  if v_professional_email is null then
    select u.email
    into v_professional_lookup_email
    from public.usuarios u
    where u.id = v_professional_user_id
      and u.role = 'profissional'
    order by u.created_at desc
    limit 1;

    if v_professional_lookup_email is not null then
      select au.id, au.email
      into v_professional_user_id, v_professional_email
      from auth.users au
      where au.email = v_professional_lookup_email
      order by au.created_at desc
      limit 1;
    end if;
  end if;

  if p_requested_by_role = 'profissional' and v_actor_id <> v_professional_user_id then
    raise exception 'Somente o profissional pode criar pedido com requested_by_role = profissional';
  end if;

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

  select car.id
  into v_existing_request_id
  from public.contact_access_requests car
  where car.client_user_id = v_client_user_id
    and car.professional_user_id = v_professional_user_id
    and car.status = 'pending'
  order by car.requested_at desc
  limit 1;

  if v_existing_request_id is not null then
    update public.contact_access_requests
    set
      request_note = coalesce(nullif(trim(coalesce(p_request_note, '')), ''), request_note),
      updated_at = now()
    where id = v_existing_request_id;

    return v_existing_request_id;
  end if;

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

grant execute on function public.create_contact_access_request(uuid, text, uuid, text) to authenticated;
