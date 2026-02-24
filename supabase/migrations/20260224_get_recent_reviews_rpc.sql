create or replace function public.get_recent_reviews(
  p_limit integer default 8
)
returns table (
  id uuid,
  rating integer,
  comment text,
  target_type text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 8), 50));
begin
  if to_regclass('public.reviews') is null then
    return;
  end if;

  return query execute format(
    'select r.id, r.rating, r.comment, r.target_type::text, r.created_at from public.reviews r order by r.created_at desc limit %s',
    v_limit
  );
end;
$$;

grant execute on function public.get_recent_reviews(integer) to anon, authenticated;