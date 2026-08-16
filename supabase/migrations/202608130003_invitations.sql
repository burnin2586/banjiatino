-- Family collaboration invitations: server-generated tokens, hash-only storage,
-- 7-day expiry, revocation, and transactional member acceptance.

create or replace function private.create_project_invitation(
  p_project_id uuid,
  p_expires_after interval default interval '7 days'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_token text;
  v_token_hash text;
  v_expires_at timestamptz;
begin
  if v_actor_id is null then
    raise exception 'authenticated user required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = v_actor_id and deleted_at is null
  ) then
    raise exception 'project membership required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.moving_projects
    where id = p_project_id and status = 'archived'
  ) then
    raise exception 'archived projects cannot send invitations' using errcode = '55006';
  end if;

  v_token := encode(gen_random_bytes(32), 'base64');
  v_token := replace(replace(v_token, '+', '-'), '/', '_');
  v_token := rtrim(v_token, '=');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + p_expires_after;

  insert into public.invitations (id, project_id, token_hash, expires_at, created_by)
  values (gen_random_uuid(), p_project_id, v_token_hash, v_expires_at, v_actor_id);

  return v_token;
end;
$$;

create or replace function public.create_project_invitation(project_id uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.create_project_invitation(project_id, interval '7 days');
$$;

create or replace function private.revoke_project_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_invitation_project uuid;
begin
  if v_actor_id is null then
    raise exception 'authenticated user required' using errcode = '28000';
  end if;

  select project_id into v_invitation_project
  from public.invitations where id = p_invitation_id;
  if v_invitation_project is null then
    raise exception 'invitation not found' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.project_members
    where project_id = v_invitation_project and user_id = v_actor_id and deleted_at is null
  ) then
    raise exception 'project membership required' using errcode = '42501';
  end if;

  update public.invitations
  set revoked_at = now(), updated_at = now(), version = version + 1
  where id = p_invitation_id and revoked_at is null;
end;
$$;

create or replace function public.revoke_project_invitation(invitation_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.revoke_project_invitation(invitation_id);
$$;

create or replace function private.accept_project_invitation(
  p_token text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_token_hash text;
  v_invitation record;
  v_project_id uuid;
begin
  if v_actor_id is null then
    raise exception 'authenticated user required' using errcode = '28000';
  end if;
  if p_token is null or char_length(btrim(p_token)) = 0 then
    raise exception 'token is required' using errcode = '22023';
  end if;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_invitation
  from public.invitations
  where token_hash = v_token_hash;

  if v_invitation is null then
    raise exception 'invitation not found' using errcode = '22023';
  end if;
  if v_invitation.revoked_at is not null then
    raise exception 'invitation revoked' using errcode = '23001';
  end if;
  if v_invitation.expires_at < now() then
    raise exception 'invitation expired' using errcode = '22023';
  end if;

  select id, status into v_project_id from public.moving_projects
  where id = v_invitation.project_id;
  if v_project_id is null then
    raise exception 'project not found' using errcode = '22023';
  end if;
  if exists (select 1 from public.moving_projects where id = v_invitation.project_id and status = 'archived') then
    raise exception 'project archived' using errcode = '55006';
  end if;

  if exists (
    select 1 from public.project_members
    where project_id = v_invitation.project_id and user_id = v_actor_id
  ) then
    return v_invitation.project_id;
  end if;

  insert into public.project_members (project_id, user_id)
  values (v_invitation.project_id, v_actor_id);

  if p_display_name is not null and char_length(btrim(p_display_name)) between 1 and 80 then
    insert into public.profiles (user_id, display_name)
    values (v_actor_id, btrim(p_display_name))
    on conflict (user_id) do update set
      display_name = excluded.display_name,
      updated_at = now();
  end if;

  return v_invitation.project_id;
end;
$$;

create or replace function public.accept_project_invitation(token text, display_name text default null)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.accept_project_invitation(token, display_name);
$$;

revoke execute on function private.create_project_invitation(uuid, interval) from public, anon;
revoke execute on function public.create_project_invitation(uuid) from public, anon;
revoke execute on function private.revoke_project_invitation(uuid) from public, anon;
revoke execute on function public.revoke_project_invitation(uuid) from public, anon;
revoke execute on function private.accept_project_invitation(text, text) from public, anon;
revoke execute on function public.accept_project_invitation(text, text) from public, anon;

grant execute on function private.create_project_invitation(uuid, interval) to authenticated;
grant execute on function public.create_project_invitation(uuid) to authenticated;
grant execute on function private.revoke_project_invitation(uuid) to authenticated;
grant execute on function public.revoke_project_invitation(uuid) to authenticated;
grant execute on function private.accept_project_invitation(text, text) to authenticated;
grant execute on function public.accept_project_invitation(text, text) to authenticated;
