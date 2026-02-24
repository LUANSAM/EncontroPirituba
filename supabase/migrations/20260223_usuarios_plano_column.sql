do $$
begin
  if to_regclass('public.usuarios') is null then
    raise notice 'Tabela public.usuarios não encontrada. Migração de plano ignorada.';
    return;
  end if;

  alter table public.usuarios
    add column if not exists plano text;

  update public.usuarios
  set plano = coalesce(
    nullif(trim(plano), ''),
    nullif(trim(coalesce(indicadores ->> 'plano', '')), ''),
    case when role = 'cliente' then 'cliente' else null end
  )
  where coalesce(nullif(trim(plano), ''), '') = '';

  update public.usuarios
  set indicadores = coalesce(indicadores, '{}'::jsonb) - 'plano'
  where coalesce(indicadores, '{}'::jsonb) ? 'plano';
end;
$$;