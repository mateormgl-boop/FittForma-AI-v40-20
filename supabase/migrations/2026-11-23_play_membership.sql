begin;
alter table public.monetization_play_purchases add column if not exists status text;
alter table public.monetization_play_purchases add column if not exists period_end timestamptz;

-- La versión anterior guardaba un único estado por persona. Se conserva en su recibo más reciente.
with latest as (
  select distinct on (user_id) user_id, purchase_token
  from public.monetization_play_purchases order by user_id, updated_at desc, purchase_token
)
update public.monetization_play_purchases p set status = m.status, period_end = m.current_period_end
from latest l join public.community_memberships m on m.user_id = l.user_id and m.source = 'google_play'
where p.purchase_token = l.purchase_token and p.status is null;

create or replace function public.monetization_set_membership(p_user_id uuid, p_status text, p_period_end timestamptz, p_source text, p_purchase_token text default null, p_product_id text default null)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  active_receipt public.monetization_play_purchases%rowtype;
begin
  if p_status not in ('active','inactive','past_due','cancelled') then raise exception 'invalid_status'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if p_purchase_token is not null then
    insert into public.monetization_play_purchases as p (purchase_token,user_id,product_id,status,period_end)
    values (p_purchase_token,p_user_id,p_product_id,p_status,p_period_end)
    on conflict (purchase_token) do update set product_id = coalesce(excluded.product_id,p.product_id),
      status = excluded.status, period_end = excluded.period_end, updated_at = now()
    where p.user_id = excluded.user_id;
    if not found then return false; end if;

    -- Un recibo vencido puede llegar después de una renovación con otro token.
    select * into active_receipt from public.monetization_play_purchases
    where user_id = p_user_id and status = 'active' and period_end > now()
    order by period_end desc, updated_at desc limit 1;
    if found then
      p_status := 'active';
      p_period_end := active_receipt.period_end;
      p_product_id := active_receipt.product_id;
    end if;
  end if;
  insert into public.community_memberships as m (user_id,tier,status,current_period_end,source,product_id,updated_at)
  values (p_user_id,'pro',p_status,p_period_end,p_source,p_product_id,now())
  on conflict (user_id) do update set tier = 'pro', status = excluded.status, current_period_end = excluded.current_period_end,
    source = excluded.source, product_id = coalesce(excluded.product_id,m.product_id), updated_at = now();
  return true;
end $$;
commit;
