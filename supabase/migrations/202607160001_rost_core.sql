create extension if not exists pgcrypto;

create type public.habit_status as enum ('draft','active','paused','completed','ended_early','archived','deleted');
create type public.schedule_type as enum ('daily','weekdays','weekly');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Садовник', timezone text not null default 'UTC', stars integer not null default 0 check (stars >= 0),
  garden_private boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.habits (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), name text not null check (char_length(name) between 1 and 80),
  icon text not null, color text not null, status public.habit_status not null default 'active', deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.habit_seasons (
  id uuid primary key default gen_random_uuid(), habit_id uuid not null references public.habits(id), user_id uuid not null references public.profiles(id), season_number integer not null check (season_number > 0),
  starts_on date not null, ends_on date not null check (ends_on >= starts_on), status public.habit_status not null default 'active', created_at timestamptz not null default now(), unique(habit_id, season_number)
);
create table public.schedule_versions (
  id uuid primary key default gen_random_uuid(), habit_id uuid not null references public.habits(id), season_id uuid not null references public.habit_seasons(id), user_id uuid not null references public.profiles(id),
  effective_from date not null, effective_to date, schedule_type public.schedule_type not null, weekdays smallint[] not null default '{}', times_per_week smallint,
  created_at timestamptz not null default now(), check (effective_to is null or effective_to >= effective_from), check (times_per_week is null or times_per_week between 1 and 7)
);
create table public.plants (
  id uuid primary key default gen_random_uuid(), habit_id uuid not null unique references public.habits(id), user_id uuid not null references public.profiles(id), kind text not null,
  garden_slot integer not null check (garden_slot between 0 and 255), health smallint not null default 100 check (health between 0 and 100), fertilizer_until timestamptz,
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, garden_slot)
);
create table public.completions (
  id uuid primary key default gen_random_uuid(), habit_id uuid not null references public.habits(id), season_id uuid not null references public.habit_seasons(id), user_id uuid not null references public.profiles(id),
  local_date date not null, timezone text not null, operation_id uuid not null unique, created_at timestamptz not null default now(), deleted_at timestamptz, unique(habit_id, season_id, local_date)
);
create table public.achievements (code text primary key, title text not null, description text not null, reward integer not null check (reward >= 0), is_secret boolean not null default false);
create table public.user_achievements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), achievement_code text not null references public.achievements(code), operation_id uuid not null unique,
  earned_at timestamptz not null default now(), unique(user_id, achievement_code)
);
create table public.star_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), operation_id uuid not null unique, code text not null, amount integer not null,
  reference_id uuid, created_at timestamptz not null default now()
);
create table public.shop_items (code text primary key, title text not null, price integer not null check (price >= 0), category text not null, active boolean not null default true);
create table public.inventory (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), item_code text not null references public.shop_items(code), quantity integer not null default 1 check (quantity >= 0),
  operation_id uuid not null unique, effect_starts_at timestamptz, effect_ends_at timestamptz, created_at timestamptz not null default now()
);
create table public.notification_devices (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), endpoint text not null, p256dh text, auth_secret text, enabled boolean not null default true,
  timezone text not null, created_at timestamptz not null default now(), unique(user_id, endpoint)
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), token_hash text not null unique, expires_at timestamptz not null,
  used_by uuid references public.profiles(id), used_at timestamptz, revoked_at timestamptz, operation_id uuid not null unique, created_at timestamptz not null default now()
);
create table public.garden_view_permissions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), viewer_id uuid not null references public.profiles(id), invitation_id uuid references public.invitations(id),
  revoked_at timestamptz, created_at timestamptz not null default now(), unique(owner_id, viewer_id)
);
create table public.sync_operations (
  operation_id uuid primary key, user_id uuid not null references public.profiles(id), kind text not null, payload jsonb not null default '{}', result jsonb,
  created_at timestamptz not null default now()
);
create table public.migration_state (
  user_id uuid primary key references public.profiles(id), version integer not null, status text not null, source_hash text, result jsonb, updated_at timestamptz not null default now()
);
create table public.message_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), message_code text not null, shown_on date not null, unique(user_id, message_code, shown_on)
);

create index completions_user_date_idx on public.completions(user_id, local_date);
create index habits_user_status_idx on public.habits(user_id, status) where deleted_at is null;
create index permissions_viewer_idx on public.garden_view_permissions(viewer_id) where revoked_at is null;

alter table public.profiles enable row level security;
alter table public.habits enable row level security; alter table public.habit_seasons enable row level security; alter table public.schedule_versions enable row level security;
alter table public.plants enable row level security; alter table public.completions enable row level security; alter table public.user_achievements enable row level security;
alter table public.star_transactions enable row level security; alter table public.inventory enable row level security; alter table public.notification_devices enable row level security;
alter table public.invitations enable row level security; alter table public.garden_view_permissions enable row level security; alter table public.sync_operations enable row level security;
alter table public.migration_state enable row level security; alter table public.message_history enable row level security;

create policy own_profile_read on public.profiles for select using (id = auth.uid());
create policy own_profile_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy own_habits on public.habits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_seasons on public.habit_seasons for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_schedules on public.schedule_versions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_plants on public.plants for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_completions_read on public.completions for select using (user_id = auth.uid());
create policy own_achievements_read on public.user_achievements for select using (user_id = auth.uid());
create policy own_stars_read on public.star_transactions for select using (user_id = auth.uid());
create policy own_inventory_read on public.inventory for select using (user_id = auth.uid());
create policy own_devices on public.notification_devices for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_invites on public.invitations for select using (owner_id = auth.uid());
create policy own_permissions on public.garden_view_permissions for select using (owner_id = auth.uid() or viewer_id = auth.uid());
create policy own_sync_read on public.sync_operations for select using (user_id = auth.uid());
create policy own_migration on public.migration_state for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_messages on public.message_history for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.create_profile_for_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles(id, display_name, timezone) values(new.id, coalesce(new.raw_user_meta_data->>'name','Садовник'), coalesce(new.raw_user_meta_data->>'timezone','UTC')) on conflict do nothing; return new; end $$;
create trigger auth_user_profile after insert on auth.users for each row execute function public.create_profile_for_user();

create or replace function public.apply_completion(p_habit_id uuid, p_season_id uuid, p_local_date date, p_timezone text, p_operation_id uuid, p_remove boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_result jsonb; v_completion uuid;
begin
  if v_user is null or not exists(select 1 from public.habits where id=p_habit_id and user_id=v_user and deleted_at is null) then raise exception 'not_allowed'; end if;
  select result into v_result from public.sync_operations where operation_id=p_operation_id and user_id=v_user;
  if found then return v_result; end if;
  if p_remove then
    update public.completions set deleted_at=now() where habit_id=p_habit_id and season_id=p_season_id and local_date=p_local_date and user_id=v_user and deleted_at is null returning id into v_completion;
    if v_completion is not null then insert into public.star_transactions(user_id,operation_id,code,amount,reference_id) values(v_user,p_operation_id,'completion_undo',-1,v_completion); update public.profiles set stars=greatest(0,stars-1) where id=v_user; end if;
  else
    insert into public.completions(habit_id,season_id,user_id,local_date,timezone,operation_id) values(p_habit_id,p_season_id,v_user,p_local_date,p_timezone,p_operation_id)
      on conflict(habit_id,season_id,local_date) do update set deleted_at=null returning id into v_completion;
    insert into public.star_transactions(user_id,operation_id,code,amount,reference_id) values(v_user,p_operation_id,'completion',1,v_completion) on conflict(operation_id) do nothing;
    if found then update public.profiles set stars=stars+1 where id=v_user; end if;
  end if;
  v_result=jsonb_build_object('completion_id',v_completion,'balance',(select stars from public.profiles where id=v_user));
  insert into public.sync_operations(operation_id,user_id,kind,payload,result) values(p_operation_id,v_user,case when p_remove then 'completion.remove' else 'completion.add' end,jsonb_build_object('habit_id',p_habit_id,'local_date',p_local_date),v_result);
  return v_result;
end $$;

revoke all on function public.apply_completion(uuid,uuid,date,text,uuid,boolean) from public;
grant execute on function public.apply_completion(uuid,uuid,date,text,uuid,boolean) to authenticated;

insert into public.achievements(code,title,description,reward,is_secret) values
('first_seed','Первое семечко','Создана первая привычка',5,false),('streak_3','Три шага','Серия из трёх действий',5,false),('streak_7','Неделя ритма','Серия из семи действий',10,false),
('streak_14','Две недели','Серия из четырнадцати действий',15,false),('streak_30','Месяц заботы','Серия из тридцати действий',30,false),('perfect_day','Идеальный день','Все запланированные действия выполнены',5,false),
('perfect_week','Идеальная неделя','Выполнен весь недельный план',20,false),('return','Возвращение','Возвращение после паузы',10,false),('adult_plant','Взрослое растение','Первое растение полностью выросло',20,false),
('five_adults','Роща','Пять взрослых растений',50,false),('variety','Разнообразный сад','Выращены разные виды растений',25,false),('secret_dawn','Тихий рассвет','Секретное достижение',15,true)
on conflict do nothing;
insert into public.shop_items(code,title,price,category) values ('fertilizer','Удобрение',20,'effect'),('decor_flower','Декоративный цветок',25,'decor'),('lantern','Фонарь',40,'decor'),('feeder','Кормушка',60,'decor'),('bench','Скамейка',80,'decor'),('fountain','Фонтан',150,'decor') on conflict do nothing;

