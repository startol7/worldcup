-- WORLD CUP KNOCKOUT online ranking schema
-- Run this once in Supabase SQL Editor.

create table if not exists public.rankings (
  name text primary key,
  champions integer not null default 0 check (champions >= 0),
  countries integer[] not null default '{}',
  last_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.rankings enable row level security;

create or replace function public.register_champion(
  p_name text,
  p_team_index integer
)
returns table (
  name text,
  champions integer,
  countries integer[],
  last_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text;
begin
  clean_name := left(trim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), 10);
  if clean_name = '' then
    clean_name := 'プレイヤー';
  end if;

  if p_team_index < 0 or p_team_index >= 16 then
    raise exception 'invalid team index';
  end if;

  insert into public.rankings as r (name, champions, countries, last_at)
  values (clean_name, 1, array[p_team_index], now())
  on conflict (name) do update
    set champions = r.champions + 1,
        countries = (
          select array_agg(distinct country order by country)
          from unnest(r.countries || excluded.countries) as country
        ),
        last_at = now()
  returning r.name, r.champions, r.countries, r.last_at
  into name, champions, countries, last_at;

  return next;
end;
$$;

revoke all on public.rankings from public, anon, authenticated;
revoke all on function public.register_champion(text, integer) from public, anon, authenticated;

grant select, insert, update on public.rankings to service_role;
grant execute on function public.register_champion(text, integer) to service_role;
