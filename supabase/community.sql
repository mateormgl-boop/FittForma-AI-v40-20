-- FittForma AI v40.0 — comunidad, seguridad y ranking orgánico.
-- Ejecutar en Supabase SQL Editor después del esquema base supabase/schema.sql.
-- Requiere un proyecto Supabase propio. No insertar claves privadas en el frontend.
create extension if not exists pgcrypto;

create table if not exists public.community_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.-]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 280),
  visibility text not null default 'private' check (visibility in ('public','private')),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  description text not null default '' check (char_length(description) <= 1200),
  exercises_text text not null default '' check (char_length(exercises_text) <= 800),
  nutrition_text text not null default '' check (char_length(nutrition_text) <= 800),
  running_text text not null default '' check (char_length(running_text) <= 600),
  start_date date not null,
  end_date date not null,
  before_path text not null,
  after_path text not null,
  visibility text not null default 'public' check (visibility in ('public','followers')),
  created_at timestamptz not null default now(),
  constraint community_post_date_order check (end_date >= start_date),
  constraint community_before_path_owner check (before_path like user_id::text || '/%'),
  constraint community_after_path_owner check (after_path like user_id::text || '/%')
);

create table if not exists public.community_follows (
  follower_id uuid not null references public.community_profiles(user_id) on delete cascade,
  following_id uuid not null references public.community_profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint community_no_self_follow check (follower_id <> following_id)
);

create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.community_profiles(user_id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.community_profiles(user_id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (reporter_id,post_id)
);

create index if not exists community_posts_created_idx on public.community_posts(created_at desc);
create index if not exists community_posts_user_idx on public.community_posts(user_id,created_at desc);
create index if not exists community_comments_post_idx on public.community_comments(post_id,created_at);
create index if not exists community_follows_target_idx on public.community_follows(following_id,status);
create index if not exists community_profiles_username_idx on public.community_profiles(username);

-- v40.0: blocking is enforced by RLS across feeds, follows, comments, storage and chat.
create table if not exists public.community_blocks (
  blocker_id uuid not null references public.community_profiles(user_id) on delete cascade,
  blocked_id uuid not null references public.community_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint community_block_no_self check (blocker_id <> blocked_id)
);
create index if not exists community_blocks_blocked_idx on public.community_blocks(blocked_id, blocker_id);
-- Display-only snapshots let the blocker recognize an account even while RLS hides the blocked profile.
alter table public.community_blocks add column if not exists blocked_username text not null default '';
alter table public.community_blocks add column if not exists blocked_display_name text not null default '';
create or replace function public.community_fill_block_snapshot()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  select p.username,p.display_name into new.blocked_username,new.blocked_display_name
  from public.community_profiles p where p.user_id=new.blocked_id;
  if new.blocked_username is null or new.blocked_username='' then raise exception 'Perfil a bloquear no encontrado.'; end if;
  return new;
end; $$;
revoke all on function public.community_fill_block_snapshot() from public,anon,authenticated;
drop trigger if exists community_fill_block_snapshot_trigger on public.community_blocks;
create trigger community_fill_block_snapshot_trigger before insert on public.community_blocks
for each row execute function public.community_fill_block_snapshot();
update public.community_blocks b set blocked_username=p.username,blocked_display_name=p.display_name
from public.community_profiles p where p.user_id=b.blocked_id and (b.blocked_username='' or b.blocked_display_name='');
alter table public.community_blocks enable row level security;

-- A client can only ask about block relationships involving its own account.
-- This function hides either side from each other without exposing the block graph.
create or replace function public.community_users_blocked(a uuid,b uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select case when auth.uid() is null or (auth.uid() <> a and auth.uid() <> b) then false
    else exists(select 1 from public.community_blocks x where (x.blocker_id=a and x.blocked_id=b) or (x.blocker_id=b and x.blocked_id=a)) end;
$$;
revoke all on function public.community_users_blocked(uuid,uuid) from public;
grant execute on function public.community_users_blocked(uuid,uuid) to anon,authenticated;

drop policy if exists community_blocks_read_own on public.community_blocks;
create policy community_blocks_read_own on public.community_blocks for select to authenticated using (blocker_id=auth.uid());
drop policy if exists community_blocks_insert_own on public.community_blocks;
create policy community_blocks_insert_own on public.community_blocks for insert to authenticated with check (blocker_id=auth.uid() and blocker_id<>blocked_id);
drop policy if exists community_blocks_delete_own on public.community_blocks;
create policy community_blocks_delete_own on public.community_blocks for delete to authenticated using (blocker_id=auth.uid());
grant select,insert,delete on public.community_blocks to authenticated;

create or replace function public.community_after_block_cleanup()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  delete from public.community_follows f
  where (f.follower_id=new.blocker_id and f.following_id=new.blocked_id)
     or (f.follower_id=new.blocked_id and f.following_id=new.blocker_id);
  return new;
end; $$;
revoke all on function public.community_after_block_cleanup() from public,anon,authenticated;
drop trigger if exists community_after_block_cleanup_trigger on public.community_blocks;
create trigger community_after_block_cleanup_trigger after insert on public.community_blocks
for each row execute function public.community_after_block_cleanup();

create or replace function public.search_community_profiles(search_term text)
returns table(user_id uuid,display_name text,username text,bio text,visibility text)
language sql stable security definer set search_path=public as $$
  select p.user_id,p.display_name,p.username,
    case when p.visibility='public' then p.bio else '' end as bio,
    p.visibility
  from public.community_profiles p
  where length(trim(coalesce(search_term,''))) >= 2
    and (p.visibility='public' or auth.uid() is not null)
    and (auth.uid() is null or not public.community_users_blocked(auth.uid(),p.user_id))
    and p.username ilike '%' || left(regexp_replace(lower(trim(search_term)), '[^a-z0-9_.-]', '', 'g'),24) || '%'
  order by (p.visibility='public') desc, p.username asc
  limit 10;
$$;
revoke all on function public.search_community_profiles(text) from public;
grant execute on function public.search_community_profiles(text) to anon,authenticated;

alter table public.community_profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_follows enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reports enable row level security;

-- El usuario ve su perfil; el resto solo perfiles públicos o perfiles privados seguidos/aceptados.
drop policy if exists community_profiles_read on public.community_profiles;
create policy community_profiles_read on public.community_profiles for select to anon, authenticated
using ((user_id=auth.uid() or auth.uid() is null or not public.community_users_blocked(auth.uid(),user_id)) and (visibility='public' or user_id=auth.uid() or exists (
  select 1 from public.community_follows f where f.follower_id=auth.uid() and f.following_id=community_profiles.user_id and f.status='accepted'
) or exists (
  select 1 from public.community_follows f where f.follower_id=community_profiles.user_id and f.following_id=auth.uid() and f.status='pending'
)));
drop policy if exists community_profiles_insert_own on public.community_profiles;
create policy community_profiles_insert_own on public.community_profiles for insert to authenticated with check (user_id=auth.uid());
drop policy if exists community_profiles_update_own on public.community_profiles;
create policy community_profiles_update_own on public.community_profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists community_posts_read on public.community_posts;
create policy community_posts_read on public.community_posts for select to anon, authenticated using (
  (auth.uid() is null or not public.community_users_blocked(auth.uid(),user_id)) and (user_id=auth.uid() or (visibility='public' and exists(select 1 from public.community_profiles p where p.user_id=community_posts.user_id and p.visibility='public')) or exists (
    select 1 from public.community_follows f where f.follower_id=auth.uid() and f.following_id=community_posts.user_id and f.status='accepted'
  ))
);
drop policy if exists community_posts_insert_own on public.community_posts;
create policy community_posts_insert_own on public.community_posts for insert to authenticated with check (user_id=auth.uid());
drop policy if exists community_posts_delete_own on public.community_posts;
create policy community_posts_delete_own on public.community_posts for delete to authenticated using (user_id=auth.uid());

-- Follow requests for private accounts start pending. A trigger decides status server-side.
create or replace function public.set_community_follow_status()
returns trigger language plpgsql security definer set search_path=public as $$
declare target_visibility text;
begin
  if new.follower_id = new.following_id then raise exception 'No podés seguirte a vos mismo.'; end if;
  select visibility into target_visibility from public.community_profiles where user_id=new.following_id;
  if target_visibility is null then raise exception 'Perfil no encontrado.'; end if;
  new.status := case when target_visibility='public' then 'accepted' else 'pending' end;
  return new;
end; $$;
revoke all on function public.set_community_follow_status() from public,anon,authenticated;
drop trigger if exists community_follow_status_trigger on public.community_follows;
create trigger community_follow_status_trigger before insert on public.community_follows for each row execute function public.set_community_follow_status();

drop policy if exists community_follows_read on public.community_follows;
create policy community_follows_read on public.community_follows for select to authenticated using ((follower_id=auth.uid() or following_id=auth.uid()) and not public.community_users_blocked(auth.uid(),case when follower_id=auth.uid() then following_id else follower_id end));
drop policy if exists community_follows_insert_own on public.community_follows;
create policy community_follows_insert_own on public.community_follows for insert to authenticated with check (follower_id=auth.uid() and follower_id<>following_id and not public.community_users_blocked(auth.uid(),following_id));
drop policy if exists community_follows_delete_own on public.community_follows;
create policy community_follows_delete_own on public.community_follows for delete to authenticated using (follower_id=auth.uid() or following_id=auth.uid());
drop policy if exists community_follows_accept_private on public.community_follows;
create policy community_follows_accept_private on public.community_follows for update to authenticated using (following_id=auth.uid() and status='pending' and not public.community_users_blocked(auth.uid(),follower_id)) with check (following_id=auth.uid() and status='accepted' and not public.community_users_blocked(auth.uid(),follower_id));

-- Like/comment permissions follow the post's read permissions.
drop policy if exists community_likes_read on public.community_likes;
create policy community_likes_read on public.community_likes for select to anon, authenticated using (exists(select 1 from public.community_posts p where p.id=post_id) and (auth.uid() is null or not public.community_users_blocked(auth.uid(),user_id)));
drop policy if exists community_likes_insert_own on public.community_likes;
create policy community_likes_insert_own on public.community_likes for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.community_posts p where p.id=post_id and not public.community_users_blocked(auth.uid(),p.user_id)));
drop policy if exists community_likes_delete_own on public.community_likes;
create policy community_likes_delete_own on public.community_likes for delete to authenticated using (user_id=auth.uid());

drop policy if exists community_comments_read on public.community_comments;
create policy community_comments_read on public.community_comments for select to anon, authenticated using (exists(select 1 from public.community_posts p where p.id=post_id) and (auth.uid() is null or not public.community_users_blocked(auth.uid(),user_id)));
drop policy if exists community_comments_insert_own on public.community_comments;
create policy community_comments_insert_own on public.community_comments for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.community_posts p where p.id=post_id and not public.community_users_blocked(auth.uid(),p.user_id)));
drop policy if exists community_comments_delete_own on public.community_comments;
create policy community_comments_delete_own on public.community_comments for delete to authenticated using (user_id=auth.uid());

drop policy if exists community_reports_insert_own on public.community_reports;
create policy community_reports_insert_own on public.community_reports for insert to authenticated with check (reporter_id=auth.uid() and exists(select 1 from public.community_posts p where p.id=post_id and p.user_id<>auth.uid()));
-- Reports are intentionally not readable by ordinary users.
revoke all on public.community_reports from anon, authenticated;
grant insert on public.community_reports to authenticated;

grant select on public.community_profiles,public.community_posts,public.community_likes,public.community_comments to anon,authenticated;
-- The grant is needed for policy subqueries; RLS still returns no follow rows to anonymous users.
grant select on public.community_follows to anon;
grant insert,update on public.community_profiles to authenticated;
grant insert,delete on public.community_posts to authenticated;
grant select,insert,delete on public.community_follows to authenticated;
grant update(status) on public.community_follows to authenticated;
grant select,insert,delete on public.community_likes to authenticated;
grant select,insert,delete on public.community_comments to authenticated;
grant select,insert,delete on public.community_blocks to authenticated;

-- Private storage bucket. Signed URLs are short-lived; RLS checks visibility for the owning post.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('community-media','community-media',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists community_media_upload_own on storage.objects;
create policy community_media_upload_own on storage.objects for insert to authenticated with check (
  bucket_id='community-media' and (storage.foldername(name))[1]=auth.uid()::text
);
drop policy if exists community_media_read_allowed on storage.objects;
create policy community_media_read_allowed on storage.objects for select to anon,authenticated using (
  bucket_id='community-media' and exists(
    select 1 from public.community_posts p where p.user_id::text=(storage.foldername(name))[1]
      and (p.before_path=name or p.after_path=name)
      and (auth.uid() is null or not public.community_users_blocked(auth.uid(),p.user_id))
      and (p.user_id=auth.uid() or (p.visibility='public' and exists(select 1 from public.community_profiles cp where cp.user_id=p.user_id and cp.visibility='public')) or exists(select 1 from public.community_follows f where f.follower_id=auth.uid() and f.following_id=p.user_id and f.status='accepted'))
  )
);
drop policy if exists community_media_delete_own on storage.objects;
create policy community_media_delete_own on storage.objects for delete to authenticated using (bucket_id='community-media' and (storage.foldername(name))[1]=auth.uid()::text);

-- Create a private community profile for new auth users. Username gets a unique suffix.
create or replace function public.create_community_profile_for_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare base_name text; candidate text;
begin
  base_name := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'preferred_username',split_part(coalesce(new.email,'usuario'),'@',1),'usuario'),'[^a-z0-9_.-]','','g'));
  base_name := left(base_name,15);
  if length(base_name)<3 then base_name := 'fituser'; end if;
  candidate := left(base_name || '_' || left(new.id::text,8),24);
  insert into public.community_profiles(user_id,username,display_name,visibility)
  values(new.id,candidate,left(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',split_part(coalesce(new.email,'Usuario'),'@',1),'Usuario'),60),'private')
  on conflict(user_id) do nothing;
  return new;
end; $$;
revoke all on function public.create_community_profile_for_new_user() from public,anon,authenticated;
drop trigger if exists on_auth_user_created_community_profile on auth.users;
create trigger on_auth_user_created_community_profile after insert on auth.users for each row execute function public.create_community_profile_for_new_user();

-- v38.0: private direct messages require an accepted mutual follow.
create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.community_profiles(user_id) on delete cascade,
  recipient_id uuid not null references public.community_profiles(user_id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint community_message_no_self check(sender_id <> recipient_id)
);
create index if not exists community_messages_pair_idx on public.community_messages(sender_id,recipient_id,created_at);
create index if not exists community_messages_recipient_idx on public.community_messages(recipient_id,created_at);
alter table public.community_messages enable row level security;

-- Server-enforced anti-spam ledger: clients cannot read, insert or delete these events.
create table if not exists public.community_message_events (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.community_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists community_message_events_sender_time_idx on public.community_message_events(sender_id,created_at desc);
alter table public.community_message_events enable row level security;
revoke all on public.community_message_events from public,anon,authenticated;
create or replace function public.community_limit_message_rate()
returns trigger language plpgsql security definer set search_path=public as $$
declare recent_count integer; day_count integer;
begin
  if auth.uid() is null or new.sender_id <> auth.uid() then raise exception 'Invalid message sender.'; end if;
  new.created_at := now();
  -- Serialize concurrent sends per account so parallel requests cannot race past the limits.
  perform pg_advisory_xact_lock(hashtext(new.sender_id::text), 19831014);
  select count(*) into recent_count from public.community_message_events e where e.sender_id=new.sender_id and e.created_at>now()-interval '1 minute';
  if recent_count >= 10 then raise exception 'Message rate limit exceeded. Wait before sending more messages.'; end if;
  select count(*) into day_count from public.community_message_events e where e.sender_id=new.sender_id and e.created_at>now()-interval '24 hours';
  if day_count >= 100 then raise exception 'Daily message limit exceeded.'; end if;
  insert into public.community_message_events(sender_id,created_at) values(new.sender_id,now());
  if random()<0.01 then delete from public.community_message_events where created_at<now()-interval '7 days'; end if;
  return new;
end; $$;
revoke all on function public.community_limit_message_rate() from public,anon,authenticated;
drop trigger if exists community_message_rate_limit_trigger on public.community_messages;
create trigger community_message_rate_limit_trigger before insert on public.community_messages
for each row execute function public.community_limit_message_rate();

create or replace function public.community_are_mutual_follows(a uuid,b uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select a <> b and auth.uid() is not null and (auth.uid()=a or auth.uid()=b)
    and exists(select 1 from public.community_follows f where f.follower_id=a and f.following_id=b and f.status='accepted')
    and exists(select 1 from public.community_follows f where f.follower_id=b and f.following_id=a and f.status='accepted');
$$;
revoke all on function public.community_are_mutual_follows(uuid,uuid) from public;
grant execute on function public.community_are_mutual_follows(uuid,uuid) to authenticated;

drop policy if exists community_messages_read_mutual on public.community_messages;
create policy community_messages_read_mutual on public.community_messages for select to authenticated
using ((sender_id=auth.uid() or recipient_id=auth.uid()) and public.community_are_mutual_follows(sender_id,recipient_id) and not public.community_users_blocked(sender_id,recipient_id));
drop policy if exists community_messages_insert_mutual on public.community_messages;
create policy community_messages_insert_mutual on public.community_messages for insert to authenticated
with check (sender_id=auth.uid() and public.community_are_mutual_follows(sender_id,recipient_id) and not public.community_users_blocked(sender_id,recipient_id));
drop policy if exists community_messages_delete_participant on public.community_messages;
create policy community_messages_delete_participant on public.community_messages for delete to authenticated
using (sender_id=auth.uid() or recipient_id=auth.uid());
grant select,insert,delete on public.community_messages to authenticated;

-- Paid status is controlled by a trusted payment webhook/admin, never by a normal client.
create table if not exists public.community_memberships (
  user_id uuid primary key references public.community_profiles(user_id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','pro')),
  status text not null default 'inactive' check (status in ('active','inactive','past_due','cancelled')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.community_memberships enable row level security;
drop policy if exists community_memberships_read_active on public.community_memberships;
create policy community_memberships_read_active on public.community_memberships for select to anon,authenticated using (status='active' and tier='pro' and (current_period_end is null or current_period_end>now()));
grant select on public.community_memberships to anon,authenticated;
revoke insert,update,delete on public.community_memberships from anon,authenticated;

-- v40.0: organic ranking rewards regular activity, recent engagement and discovery.
-- Pro is a badge only; per-author diversification avoids letting one account flood the top slots.
drop function if exists public.community_ranked_post_ids();
create function public.community_ranked_post_ids()
returns table(post_id uuid, follower_count bigint, is_pro boolean, created_at timestamptz, activity_score numeric)
language sql stable security definer set search_path=public as $$
  with eligible as (
    select p.id, p.user_id, p.created_at,
      (select count(*) from public.community_follows f where f.following_id=p.user_id and f.status='accepted') as followers,
      exists(select 1 from public.community_memberships m where m.user_id=p.user_id and m.tier='pro' and m.status='active' and (m.current_period_end is null or m.current_period_end>now())) as pro,
      (select count(*) from public.community_posts rp where rp.user_id=p.user_id and rp.created_at > now()-interval '30 days') as recent_posts,
      (select count(*) from public.community_likes rl join public.community_posts rp on rp.id=rl.post_id where rp.user_id=p.user_id and rl.created_at > now()-interval '30 days') as recent_likes,
      (select count(*) from public.community_comments rc join public.community_posts rp on rp.id=rc.post_id where rp.user_id=p.user_id and rc.created_at > now()-interval '30 days') as recent_comments,
      (select count(*) from public.community_likes pl where pl.post_id=p.id) as post_likes,
      (select count(*) from public.community_comments pc where pc.post_id=p.id) as post_comments,
      (select count(distinct activity_day) from (
        select rp.created_at::date as activity_day from public.community_posts rp where rp.user_id=p.user_id and rp.created_at > now()-interval '30 days'
        union select rl.created_at::date from public.community_likes rl join public.community_posts rp on rp.id=rl.post_id where rp.user_id=p.user_id and rl.created_at > now()-interval '30 days'
        union select rc.created_at::date from public.community_comments rc join public.community_posts rp on rp.id=rc.post_id where rp.user_id=p.user_id and rc.created_at > now()-interval '30 days'
      ) days_active) as active_days
    from public.community_posts p
    join public.community_profiles cp on cp.user_id=p.user_id
    where p.created_at > now()-interval '90 days'
      and (auth.uid() is null or not public.community_users_blocked(auth.uid(),p.user_id))
      and (p.user_id=auth.uid()
        or (p.visibility='public' and cp.visibility='public')
        or exists(select 1 from public.community_follows f where f.follower_id=auth.uid() and f.following_id=p.user_id and f.status='accepted'))
  ), scored as (
    select e.*,
      (least(e.recent_posts,5)*2.0
       + least(e.active_days,10)*1.5
       + least(e.recent_likes,20)*0.2
       + least(e.recent_comments,10)*0.4
       + least(e.post_likes,10)*0.35
       + least(e.post_comments,5)*0.75
       + least(e.followers,20)*0.025
       + case when e.followers < 10 then (10-e.followers)*0.2 else 0 end
       + greatest(0, 10 - extract(epoch from (now()-e.created_at))/21600.0)
      )::numeric as base_score
    from eligible e
  ), diversified as (
    select s.*, row_number() over(partition by s.user_id order by s.base_score desc,s.created_at desc) as author_post_rank
    from scored s
  )
  select d.id, d.followers, d.pro, d.created_at,
    (d.base_score - greatest(0,d.author_post_rank-1)*2.5)::numeric as activity_score
  from diversified d
  order by activity_score desc, d.created_at desc
  limit 100;
$$;
revoke all on function public.community_ranked_post_ids() from public;
grant execute on function public.community_ranked_post_ids() to anon,authenticated;
