-- FittForma AI v57 — Insignias de 15 niveles: se suma el rango «Legendario» (niveles 13 a 15) arriba de Diamante.
-- ADITIVA y re-ejecutable: solo reemplaza dos funciones de validación para aceptar también los niveles 13–15 con
-- rango 'legend'. Todo lo que ya era válido sigue siéndolo (niveles 1–12 con los mismos rangos). No borra tablas,
-- datos ni políticas; RLS sigue activo.

begin;

create or replace function public.community_valid_achievement(a jsonb)
returns boolean language sql immutable set search_path=public as $$
  select a is not null and jsonb_typeof(a)='object'
    and (select count(*) from jsonb_object_keys(a) k where k not in ('exerciseId','exerciseName','category','rank','level','threshold','measure','evidence','earnedAt')) = 0
    and jsonb_typeof(a->'exerciseName')='string' and char_length(a->>'exerciseName') between 1 and 72
    and jsonb_typeof(a->'exerciseId')='string' and (a->>'exerciseId') ~ '^[a-z0-9-]{1,80}$'
    and coalesce(a->>'category','') ~ '^[a-z]{0,20}$'
    and a->>'rank' in ('bronze','silver','gold','diamond','legend')
    and jsonb_typeof(a->'level')='number' and (a->>'level')::numeric in (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15)
    and a->>'rank' = (array['bronze','silver','gold','diamond','legend'])[ceil((a->>'level')::numeric/3)::int]
    and jsonb_typeof(a->'threshold')='number' and (a->>'threshold')::numeric > 0 and (a->>'threshold')::numeric <= 100000
    and a->>'measure' in ('reps','seconds','minutes','km','days','bw','sessions','streak')
    and (a->>'measure' <> 'bw' or (a->>'threshold')::numeric <= 5)
    and a->>'evidence' in ('declared','gps_device','session')
    and (a->>'evidence' <> 'gps_device' or a->>'measure'='km')
    and (a->>'earnedAt') ~ '^\d{4}-\d{2}-\d{2}$';
$$;

create or replace function public.community_valid_featured(f jsonb)
returns boolean language sql immutable set search_path = public as $$
  select f is not null and jsonb_typeof(f) = 'array' and jsonb_array_length(f) <= 3
    and not exists (
      select 1 from jsonb_array_elements(f) e
      where jsonb_typeof(e) <> 'object'
        or (select count(*) from jsonb_object_keys(e) k where k not in ('exerciseId','exerciseName','category','rank','level','measure')) > 0
        or coalesce(e->>'exerciseId','') !~ '^[a-z0-9-]{1,80}$'
        or char_length(coalesce(e->>'exerciseName','')) not between 1 and 72
        or coalesce(e->>'category','') !~ '^[a-z]{0,20}$'
        or coalesce(e->>'rank','') not in ('bronze','silver','gold','diamond','legend')
        or jsonb_typeof(e->'level') <> 'number' or (e->>'level')::numeric not in (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15)
        or e->>'rank' <> (array['bronze','silver','gold','diamond','legend'])[ceil((e->>'level')::numeric/3)::int]
        or coalesce(e->>'measure','reps') not in ('reps','seconds','minutes','km','days','bw','sessions','streak'))
    and (select count(distinct e->>'exerciseId') from jsonb_array_elements(f) e) = jsonb_array_length(f);
$$;

commit;
