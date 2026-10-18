-- FittForma AI v49 — insignias: nuevas medidas y fuente «registrada en sesión» en los logros compartidos.
-- ADITIVA y re-ejecutable: solo amplía la validación del logro (no cambia filas ni políticas).
--   measure: + 'bw' (múltiplo del peso corporal en la mejor serie), 'sessions' (entrenamientos completos),
--            'streak' (días seguidos con actividad).
--   evidence: + 'session' (dato tomado de una sesión registrada en la app; no es una verificación independiente).
-- El resto de las reglas de v41 se mantienen igual (claves permitidas, rango acorde al nivel, GPS solo en km).

begin;

create or replace function public.community_valid_achievement(a jsonb)
returns boolean language sql immutable set search_path=public as $$
  select a is not null and jsonb_typeof(a)='object'
    and (select count(*) from jsonb_object_keys(a) k where k not in ('exerciseId','exerciseName','category','rank','level','threshold','measure','evidence','earnedAt')) = 0
    and jsonb_typeof(a->'exerciseName')='string' and char_length(a->>'exerciseName') between 1 and 72
    and jsonb_typeof(a->'exerciseId')='string' and (a->>'exerciseId') ~ '^[a-z0-9-]{1,80}$'
    and coalesce(a->>'category','') ~ '^[a-z]{0,20}$'
    and a->>'rank' in ('bronze','silver','gold','diamond')
    and jsonb_typeof(a->'level')='number' and (a->>'level')::numeric in (1,2,3,4,5,6,7,8,9,10,11,12)
    and a->>'rank' = (array['bronze','silver','gold','diamond'])[ceil((a->>'level')::numeric/3)::int]
    and jsonb_typeof(a->'threshold')='number' and (a->>'threshold')::numeric > 0 and (a->>'threshold')::numeric <= 100000
    and a->>'measure' in ('reps','seconds','minutes','km','days','bw','sessions','streak')
    and (a->>'measure' <> 'bw' or (a->>'threshold')::numeric <= 5)
    and a->>'evidence' in ('declared','gps_device','session')
    and (a->>'evidence' <> 'gps_device' or a->>'measure'='km')
    and (a->>'earnedAt') ~ '^\d{4}-\d{2}-\d{2}$';
$$;

commit;
