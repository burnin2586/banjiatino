create extension if not exists pgcrypto;

create schema if not exists private;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.moving_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  moving_date date,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  deleted_at timestamptz
);

create table public.project_members (
  project_id uuid not null references public.moving_projects(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  deleted_at timestamptz,
  primary key (project_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.moving_projects(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  deleted_at timestamptz,
  foreign key (project_id, created_by) references public.project_members(project_id, user_id)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.moving_projects(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  room_kind text,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  deleted_at timestamptz,
  unique (project_id, id),
  foreign key (project_id, created_by) references public.project_members(project_id, user_id),
  foreign key (project_id, updated_by) references public.project_members(project_id, user_id)
);

create table public.moving_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.moving_projects(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  notes text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  due_at timestamptz,
  assignee_id uuid,
  completed_at timestamptz,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  deleted_at timestamptz,
  unique (project_id, id),
  foreign key (project_id, assignee_id) references public.project_members(project_id, user_id),
  foreign key (project_id, created_by) references public.project_members(project_id, user_id),
  foreign key (project_id, updated_by) references public.project_members(project_id, user_id)
);

create table public.moving_boxes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.moving_projects(id) on delete cascade,
  display_number integer check (display_number is null or display_number > 0),
  label text not null default '' check (char_length(label) <= 240),
  notes text,
  status text not null default 'draft' check (status in ('draft', 'packed', 'moved', 'arrived', 'unpacked')),
  source_room_id uuid,
  destination_room_id uuid,
  assignee_id uuid,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  deleted_at timestamptz,
  unique (project_id, id),
  unique (project_id, display_number),
  foreign key (project_id, source_room_id) references public.rooms(project_id, id),
  foreign key (project_id, destination_room_id) references public.rooms(project_id, id),
  foreign key (project_id, assignee_id) references public.project_members(project_id, user_id),
  foreign key (project_id, created_by) references public.project_members(project_id, user_id),
  foreign key (project_id, updated_by) references public.project_members(project_id, user_id)
);

create table public.moving_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.moving_projects(id) on delete cascade,
  box_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 240),
  notes text,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  deleted_at timestamptz,
  unique (project_id, id),
  foreign key (project_id, box_id) references public.moving_boxes(project_id, id),
  foreign key (project_id, created_by) references public.project_members(project_id, user_id),
  foreign key (project_id, updated_by) references public.project_members(project_id, user_id)
);

create table public.applied_operations (
  operation_id uuid primary key,
  project_id uuid not null references public.moving_projects(id) on delete cascade,
  actor_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  result jsonb not null,
  applied_at timestamptz not null default now(),
  foreign key (project_id, actor_id) references public.project_members(project_id, user_id)
);

alter table public.moving_projects
  add constraint moving_projects_created_by_member_fkey
  foreign key (id, created_by)
  references public.project_members(project_id, user_id)
  deferrable initially deferred;

create table public.project_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.moving_projects(id) on delete cascade,
  cursor bigint not null,
  entity_type text not null,
  entity_id uuid not null,
  change_type text not null check (change_type in ('upsert', 'delete')),
  entity_version bigint not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, cursor)
);

create index profiles_updated_at_idx on public.profiles (updated_at);
create index moving_projects_updated_at_idx on public.moving_projects (updated_at);
create index moving_projects_deleted_at_idx on public.moving_projects (deleted_at) where deleted_at is not null;
create index project_members_project_id_idx on public.project_members (project_id) where deleted_at is null;
create index project_members_user_id_project_id_idx on public.project_members (user_id, project_id) where deleted_at is null;
create index project_members_updated_at_idx on public.project_members (updated_at);
create index project_members_deleted_at_idx on public.project_members (deleted_at) where deleted_at is not null;
create index invitations_project_id_idx on public.invitations (project_id) where deleted_at is null;
create index invitations_updated_at_idx on public.invitations (updated_at);
create index invitations_deleted_at_idx on public.invitations (deleted_at) where deleted_at is not null;
create index rooms_project_id_idx on public.rooms (project_id);
create index rooms_updated_at_idx on public.rooms (updated_at);
create index rooms_deleted_at_idx on public.rooms (deleted_at) where deleted_at is not null;
create index moving_tasks_project_id_idx on public.moving_tasks (project_id);
create index moving_tasks_updated_at_idx on public.moving_tasks (updated_at);
create index moving_tasks_deleted_at_idx on public.moving_tasks (deleted_at) where deleted_at is not null;
create index moving_boxes_project_id_idx on public.moving_boxes (project_id);
create index moving_boxes_updated_at_idx on public.moving_boxes (updated_at);
create index moving_boxes_deleted_at_idx on public.moving_boxes (deleted_at) where deleted_at is not null;
create index moving_items_project_id_idx on public.moving_items (project_id);
create index moving_items_updated_at_idx on public.moving_items (updated_at);
create index moving_items_deleted_at_idx on public.moving_items (deleted_at) where deleted_at is not null;
create index applied_operations_project_id_idx on public.applied_operations (project_id);
create index project_changes_project_cursor_idx on public.project_changes (project_id, cursor);

create function private.is_project_member(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.project_members as pm
      where pm.project_id = target_project_id
        and pm.user_id = (select auth.uid())
        and pm.deleted_at is null
    );
$$;

create function public.is_project_member(target_project_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_project_member(target_project_id);
$$;

create function private.bootstrap_moving_project(
  project_name text,
  profile_display_name text,
  project_moving_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  new_project_id uuid;
begin
  if caller_id is null then
    raise exception 'authenticated user required' using errcode = '28000';
  end if;

  if char_length(btrim(project_name)) not between 1 and 160 then
    raise exception 'project_name must contain between 1 and 160 characters' using errcode = '22023';
  end if;

  if char_length(btrim(profile_display_name)) not between 1 and 80 then
    raise exception 'profile_display_name must contain between 1 and 80 characters' using errcode = '22023';
  end if;

  insert into public.profiles (user_id, display_name)
  values (caller_id, btrim(profile_display_name))
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        updated_at = now();

  insert into public.moving_projects (name, moving_date, created_by)
  values (btrim(project_name), project_moving_date, caller_id)
  returning id into new_project_id;

  insert into public.project_members (project_id, user_id)
  values (new_project_id, caller_id);

  return new_project_id;
end;
$$;

create function public.bootstrap_moving_project(
  project_name text,
  profile_display_name text,
  project_moving_date date default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authenticated user required' using errcode = '28000';
  end if;

  return private.bootstrap_moving_project(project_name, profile_display_name, project_moving_date);
end;
$$;

alter table public.profiles enable row level security;
alter table public.moving_projects enable row level security;
alter table public.project_members enable row level security;
alter table public.invitations enable row level security;
alter table public.rooms enable row level security;
alter table public.moving_tasks enable row level security;
alter table public.moving_boxes enable row level security;
alter table public.moving_items enable row level security;
alter table public.applied_operations enable row level security;
alter table public.project_changes enable row level security;

create policy "users can read their own or shared profiles"
on public.profiles for select to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.project_members as pm
    where pm.user_id = profiles.user_id
      and (select public.is_project_member(pm.project_id))
  )
);

create policy "users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "project members can read projects"
on public.moving_projects for select to authenticated
using ((select public.is_project_member(id)));

create policy "project members can read members"
on public.project_members for select to authenticated
using ((select public.is_project_member(project_id)));

create policy "project members can read rooms"
on public.rooms for select to authenticated
using ((select public.is_project_member(project_id)));

create policy "project members can read tasks"
on public.moving_tasks for select to authenticated
using ((select public.is_project_member(project_id)));

create policy "project members can read boxes"
on public.moving_boxes for select to authenticated
using ((select public.is_project_member(project_id)));

create policy "project members can read items"
on public.moving_items for select to authenticated
using ((select public.is_project_member(project_id)));

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

revoke all on table public.profiles,
  public.moving_projects,
  public.project_members,
  public.invitations,
  public.rooms,
  public.moving_tasks,
  public.moving_boxes,
  public.moving_items,
  public.applied_operations,
  public.project_changes
from anon, authenticated;

grant select on table public.profiles,
  public.moving_projects,
  public.project_members,
  public.rooms,
  public.moving_tasks,
  public.moving_boxes,
  public.moving_items
to authenticated;

grant update on table public.profiles to authenticated;

revoke execute on function private.is_project_member(uuid) from public, anon;
revoke execute on function public.is_project_member(uuid) from public, anon;
revoke execute on function private.bootstrap_moving_project(text, text, date) from public, anon;
revoke execute on function public.bootstrap_moving_project(text, text, date) from public, anon;

grant execute on function private.is_project_member(uuid) to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function private.bootstrap_moving_project(text, text, date) to authenticated;
grant execute on function public.bootstrap_moving_project(text, text, date) to authenticated;
