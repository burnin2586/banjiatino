alter table public.applied_operations
  add column request_fingerprint jsonb not null default '{}'::jsonb;

create function private.apply_project_operation(
  p_operation_id uuid,
  p_project_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_base_version bigint,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_fingerprint jsonb;
  v_existing public.applied_operations%rowtype;
  v_entity jsonb;
  v_version bigint;
  v_deleted_at timestamptz;
  v_status text;
  v_cursor bigint;
  v_change_type text := 'upsert';
  v_change_payload jsonb;
  v_allowed_keys text[];
begin
  if v_actor_id is null then
    raise exception 'authenticated user required' using errcode = '28000';
  end if;

  if p_operation_id is null or p_project_id is null or p_entity_id is null then
    raise exception 'operation_id, project_id, and entity_id are required' using errcode = '22023';
  end if;
  if p_entity_type is null or p_entity_type not in ('room', 'task', 'box', 'item', 'memory_house', 'memory_room', 'memory_wall') then
    raise exception 'unsupported entity_type' using errcode = '22023';
  end if;
  if p_action is null or p_action not in ('create', 'update', 'set_status', 'complete', 'soft_delete', 'restore') then
    raise exception 'unsupported action' using errcode = '22023';
  end if;
  if p_base_version is null or p_base_version < 0 then
    raise exception 'base_version must be non-negative' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'payload must be an object' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.project_members as pm
    where pm.project_id = p_project_id and pm.user_id = v_actor_id and pm.deleted_at is null
  ) then
    raise exception 'project membership required' using errcode = '42501';
  end if;

  -- Serialise duplicate operation IDs before any project-level work.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_operation_id::text, 917));
  v_fingerprint := jsonb_build_object(
    'projectId', p_project_id, 'actorId', v_actor_id, 'entityType', p_entity_type,
    'entityId', p_entity_id, 'action', p_action, 'baseVersion', p_base_version,
    'payload', p_payload
  );
  select * into v_existing from public.applied_operations
  where operation_id = p_operation_id for update;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id was already used for a different request' using errcode = '22023';
    end if;
    return v_existing.result;
  end if;

  -- One row lock is the project-scoped transaction lock for cursors and box numbers.
  perform 1 from public.moving_projects
  where id = p_project_id and deleted_at is null for update;
  if not found then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  v_allowed_keys := case
    when p_action = 'create' and p_entity_type = 'room' then array['name', 'room_kind']
    when p_action = 'create' and p_entity_type = 'task' then array['title', 'notes', 'status', 'due_at', 'assignee_id']
    when p_action = 'create' and p_entity_type = 'box' then array['label', 'notes', 'status', 'source_room_id', 'destination_room_id', 'assignee_id']
    when p_action = 'create' and p_entity_type = 'item' then array['name', 'notes', 'box_id']
    when p_action = 'create' and p_entity_type = 'memory_house' then array['name', 'notes']
    when p_action = 'create' and p_entity_type = 'memory_room' then array['name', 'notes', 'house_id']
    when p_action = 'create' and p_entity_type = 'memory_wall' then array['name', 'notes', 'memory_room_id']
    when p_action = 'update' and p_entity_type = 'room' then array['name', 'room_kind']
    when p_action = 'update' and p_entity_type = 'task' then array['title', 'notes', 'due_at', 'assignee_id']
    when p_action = 'update' and p_entity_type = 'box' then array['label', 'notes', 'source_room_id', 'destination_room_id', 'assignee_id']
    when p_action = 'update' and p_entity_type = 'item' then array['name', 'notes', 'box_id']
    when p_action = 'update' and p_entity_type = 'memory_house' then array['name', 'notes']
    when p_action = 'update' and p_entity_type = 'memory_room' then array['name', 'notes', 'house_id']
    when p_action = 'update' and p_entity_type = 'memory_wall' then array['name', 'notes', 'memory_room_id']
    when p_action = 'set_status' and p_entity_type in ('task', 'box') then array['status']
    when p_action = 'complete' and p_entity_type = 'task' then array[]::text[]
    when p_action in ('soft_delete', 'restore') then array[]::text[]
    else null
  end;
  if v_allowed_keys is null then
    raise exception 'action is unsupported for entity_type' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_payload) as key_name where key_name <> all(v_allowed_keys)) then
    raise exception 'payload contains unsupported fields' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_payload) as key_name
    where (key_name in ('name', 'room_kind', 'title', 'label', 'status') and jsonb_typeof(p_payload -> key_name) <> 'string')
       or (key_name = 'notes' and jsonb_typeof(p_payload -> key_name) not in ('string', 'null'))
       or (key_name in ('assignee_id', 'source_room_id', 'destination_room_id', 'box_id', 'house_id', 'memory_room_id') and jsonb_typeof(p_payload -> key_name) not in ('string', 'null'))
       or (key_name = 'due_at' and jsonb_typeof(p_payload -> key_name) not in ('string', 'null'))
  ) then
    raise exception 'payload field has invalid type' using errcode = '22023';
  end if;

  if p_action = 'create' then
    if p_base_version is distinct from 0 then
      raise exception 'create requires base_version 0' using errcode = '22023';
    end if;
  else
    case p_entity_type
      when 'room' then select version, deleted_at, null::text into v_version, v_deleted_at, v_status from public.rooms where id = p_entity_id and project_id = p_project_id for update;
      when 'task' then select version, deleted_at, status into v_version, v_deleted_at, v_status from public.moving_tasks where id = p_entity_id and project_id = p_project_id for update;
      when 'box' then select version, deleted_at, status into v_version, v_deleted_at, v_status from public.moving_boxes where id = p_entity_id and project_id = p_project_id for update;
      when 'item' then select version, deleted_at, null::text into v_version, v_deleted_at, v_status from public.moving_items where id = p_entity_id and project_id = p_project_id for update;
      when 'memory_house' then select version, deleted_at, null::text into v_version, v_deleted_at, v_status from public.memory_houses where id = p_entity_id and project_id = p_project_id for update;
      when 'memory_room' then select version, deleted_at, null::text into v_version, v_deleted_at, v_status from public.memory_rooms where id = p_entity_id and project_id = p_project_id for update;
      when 'memory_wall' then select version, deleted_at, null::text into v_version, v_deleted_at, v_status from public.memory_walls where id = p_entity_id and project_id = p_project_id for update;
    end case;
    if not found then
      raise exception 'entity not found in project' using errcode = 'P0002';
    end if;
    if v_version <> p_base_version then
      raise exception 'base_version does not match entity version' using errcode = '40001';
    end if;
    if p_action in ('update', 'set_status', 'complete') and v_deleted_at is not null then
      raise exception 'entity is deleted' using errcode = '22023';
    end if;
    if p_action = 'soft_delete' and v_deleted_at is not null then
      raise exception 'entity is already deleted' using errcode = '22023';
    end if;
    if p_action = 'restore' and v_deleted_at is null then
      raise exception 'entity is not deleted' using errcode = '22023';
    end if;
  end if;

  case p_entity_type
    when 'room' then
      if p_action = 'create' then
        if not (p_payload ? 'name') then raise exception 'name is required' using errcode = '22023'; end if;
        insert into public.rooms (id, project_id, name, room_kind, created_by, updated_by)
        values (p_entity_id, p_project_id, p_payload->>'name', p_payload->>'room_kind', v_actor_id, v_actor_id)
        returning to_jsonb(rooms) into v_entity;
      elsif p_action = 'update' then
        update public.rooms set name = case when p_payload ? 'name' then p_payload->>'name' else name end,
          room_kind = case when p_payload ? 'room_kind' then p_payload->>'room_kind' else room_kind end,
          updated_by = v_actor_id, updated_at = now(), version = version + 1
        where id = p_entity_id and project_id = p_project_id returning to_jsonb(rooms) into v_entity;
      elsif p_action = 'soft_delete' then
        update public.rooms set deleted_at = now(), updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(rooms) into v_entity;
      elsif p_action = 'restore' then
        update public.rooms set deleted_at = null, updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(rooms) into v_entity;
      end if;
    when 'task' then
      if p_action = 'create' then
        if not (p_payload ? 'title') then raise exception 'title is required' using errcode = '22023'; end if;
        insert into public.moving_tasks (id, project_id, title, notes, status, due_at, assignee_id, created_by, updated_by)
        values (p_entity_id, p_project_id, p_payload->>'title', p_payload->>'notes', coalesce(p_payload->>'status', 'pending'), (p_payload->>'due_at')::timestamptz, (p_payload->>'assignee_id')::uuid, v_actor_id, v_actor_id)
        returning to_jsonb(moving_tasks) into v_entity;
      elsif p_action = 'update' then
        update public.moving_tasks set title = case when p_payload ? 'title' then p_payload->>'title' else title end,
          notes = case when p_payload ? 'notes' then p_payload->>'notes' else notes end, due_at = case when p_payload ? 'due_at' then (p_payload->>'due_at')::timestamptz else due_at end,
          assignee_id = case when p_payload ? 'assignee_id' then (p_payload->>'assignee_id')::uuid else assignee_id end, updated_by = v_actor_id, updated_at = now(), version = version + 1
        where id = p_entity_id and project_id = p_project_id returning to_jsonb(moving_tasks) into v_entity;
      elsif p_action = 'set_status' then
        if p_payload->>'status' not in ('pending', 'in_progress', 'completed') then raise exception 'invalid task status' using errcode = '22023'; end if;
        update public.moving_tasks set status = p_payload->>'status', completed_at = case when p_payload->>'status' = 'completed' then now() else completed_at end, updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(moving_tasks) into v_entity;
      elsif p_action = 'complete' then
        update public.moving_tasks set status = 'completed', completed_at = now(), updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(moving_tasks) into v_entity;
      elsif p_action = 'soft_delete' then
        update public.moving_tasks set deleted_at = now(), updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(moving_tasks) into v_entity;
      elsif p_action = 'restore' then
        update public.moving_tasks set deleted_at = null, updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(moving_tasks) into v_entity;
      end if;
    when 'box' then
      if p_action = 'create' then
        insert into public.moving_boxes (id, project_id, display_number, label, notes, status, source_room_id, destination_room_id, assignee_id, created_by, updated_by)
        values (p_entity_id, p_project_id, (select coalesce(max(display_number), 0) + 1 from public.moving_boxes where project_id = p_project_id), coalesce(p_payload->>'label', ''), p_payload->>'notes', coalesce(p_payload->>'status', 'draft'), (p_payload->>'source_room_id')::uuid, (p_payload->>'destination_room_id')::uuid, (p_payload->>'assignee_id')::uuid, v_actor_id, v_actor_id)
        returning to_jsonb(moving_boxes) into v_entity;
      elsif p_action = 'update' then
        update public.moving_boxes set label = case when p_payload ? 'label' then p_payload->>'label' else label end, notes = case when p_payload ? 'notes' then p_payload->>'notes' else notes end,
          source_room_id = case when p_payload ? 'source_room_id' then (p_payload->>'source_room_id')::uuid else source_room_id end, destination_room_id = case when p_payload ? 'destination_room_id' then (p_payload->>'destination_room_id')::uuid else destination_room_id end,
          assignee_id = case when p_payload ? 'assignee_id' then (p_payload->>'assignee_id')::uuid else assignee_id end, updated_by = v_actor_id, updated_at = now(), version = version + 1
        where id = p_entity_id and project_id = p_project_id returning to_jsonb(moving_boxes) into v_entity;
      elsif p_action = 'set_status' then
        if p_payload->>'status' not in ('draft', 'packed', 'moved', 'arrived', 'unpacked') then raise exception 'invalid box status' using errcode = '22023'; end if;
        if array_position(array['draft', 'packed', 'moved', 'arrived', 'unpacked']::text[], p_payload->>'status') < array_position(array['draft', 'packed', 'moved', 'arrived', 'unpacked']::text[], v_status) then raise exception 'status cannot move backwards' using errcode = '22023'; end if;
        update public.moving_boxes set status = p_payload->>'status', updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(moving_boxes) into v_entity;
      elsif p_action = 'soft_delete' then
        update public.moving_boxes set deleted_at = now(), updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(moving_boxes) into v_entity;
      elsif p_action = 'restore' then
        update public.moving_boxes set deleted_at = null, updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(moving_boxes) into v_entity;
      end if;
    when 'item' then
      if p_action = 'create' then
        if not (p_payload ? 'name') then raise exception 'name is required' using errcode = '22023'; end if;
        insert into public.moving_items (id, project_id, box_id, name, notes, created_by, updated_by) values (p_entity_id, p_project_id, (p_payload->>'box_id')::uuid, p_payload->>'name', p_payload->>'notes', v_actor_id, v_actor_id) returning to_jsonb(moving_items) into v_entity;
      elsif p_action = 'update' then
        update public.moving_items set name = case when p_payload ? 'name' then p_payload->>'name' else name end, notes = case when p_payload ? 'notes' then p_payload->>'notes' else notes end, box_id = case when p_payload ? 'box_id' then (p_payload->>'box_id')::uuid else box_id end, updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(moving_items) into v_entity;
      elsif p_action = 'soft_delete' then update public.moving_items set deleted_at = now(), updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(moving_items) into v_entity;
      elsif p_action = 'restore' then update public.moving_items set deleted_at = null, updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(moving_items) into v_entity; end if;
    when 'memory_house' then
      if p_action = 'create' then if not (p_payload ? 'name') then raise exception 'name is required' using errcode = '22023'; end if; insert into public.memory_houses (id, project_id, name, notes, created_by, updated_by) values (p_entity_id, p_project_id, p_payload->>'name', p_payload->>'notes', v_actor_id, v_actor_id) returning to_jsonb(memory_houses) into v_entity;
      elsif p_action = 'update' then update public.memory_houses set name = case when p_payload ? 'name' then p_payload->>'name' else name end, notes = case when p_payload ? 'notes' then p_payload->>'notes' else notes end, updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(memory_houses) into v_entity;
      elsif p_action = 'soft_delete' then update public.memory_houses set deleted_at = now(), updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(memory_houses) into v_entity;
      elsif p_action = 'restore' then update public.memory_houses set deleted_at = null, updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(memory_houses) into v_entity; end if;
    when 'memory_room' then
      if p_action = 'create' then if not (p_payload ? 'name') or not (p_payload ? 'house_id') then raise exception 'name and house_id are required' using errcode = '22023'; end if; insert into public.memory_rooms (id, project_id, house_id, name, notes, created_by, updated_by) values (p_entity_id, p_project_id, (p_payload->>'house_id')::uuid, p_payload->>'name', p_payload->>'notes', v_actor_id, v_actor_id) returning to_jsonb(memory_rooms) into v_entity;
      elsif p_action = 'update' then update public.memory_rooms set name = case when p_payload ? 'name' then p_payload->>'name' else name end, notes = case when p_payload ? 'notes' then p_payload->>'notes' else notes end, house_id = case when p_payload ? 'house_id' then (p_payload->>'house_id')::uuid else house_id end, updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(memory_rooms) into v_entity;
      elsif p_action = 'soft_delete' then update public.memory_rooms set deleted_at = now(), updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(memory_rooms) into v_entity;
      elsif p_action = 'restore' then update public.memory_rooms set deleted_at = null, updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(memory_rooms) into v_entity; end if;
    when 'memory_wall' then
      if p_action = 'create' then if not (p_payload ? 'name') or not (p_payload ? 'memory_room_id') then raise exception 'name and memory_room_id are required' using errcode = '22023'; end if; insert into public.memory_walls (id, project_id, memory_room_id, name, notes, created_by, updated_by) values (p_entity_id, p_project_id, (p_payload->>'memory_room_id')::uuid, p_payload->>'name', p_payload->>'notes', v_actor_id, v_actor_id) returning to_jsonb(memory_walls) into v_entity;
      elsif p_action = 'update' then update public.memory_walls set name = case when p_payload ? 'name' then p_payload->>'name' else name end, notes = case when p_payload ? 'notes' then p_payload->>'notes' else notes end, memory_room_id = case when p_payload ? 'memory_room_id' then (p_payload->>'memory_room_id')::uuid else memory_room_id end, updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(memory_walls) into v_entity;
      elsif p_action = 'soft_delete' then update public.memory_walls set deleted_at = now(), updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(memory_walls) into v_entity;
      elsif p_action = 'restore' then update public.memory_walls set deleted_at = null, updated_by = v_actor_id, updated_at = now(), version = version + 1 where id = p_entity_id and project_id = p_project_id returning to_jsonb(memory_walls) into v_entity; end if;
  end case;

  if p_action = 'soft_delete' then
    v_change_type := 'delete';
    v_change_payload := jsonb_build_object('id', p_entity_id, 'deletedAt', v_entity->'deleted_at', 'version', v_entity->'version');
  else
    v_change_payload := v_entity;
  end if;
  select coalesce(max(cursor), 0) + 1 into v_cursor from public.project_changes where project_id = p_project_id;
  insert into public.project_changes (project_id, cursor, entity_type, entity_id, change_type, entity_version, payload)
  values (p_project_id, v_cursor, p_entity_type, p_entity_id, v_change_type, (v_entity->>'version')::bigint, v_change_payload);

  v_entity := jsonb_build_object('entity', v_entity, 'cursor', v_cursor, 'operationId', p_operation_id);
  insert into public.applied_operations (operation_id, project_id, actor_id, entity_type, entity_id, request_fingerprint, result)
  values (p_operation_id, p_project_id, v_actor_id, p_entity_type, p_entity_id, v_fingerprint, v_entity);
  return v_entity;
end;
$$;

create function public.apply_project_operation(
  operation_id uuid, project_id uuid, entity_type text, entity_id uuid,
  action text, base_version bigint, payload jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.apply_project_operation(operation_id, project_id, entity_type, entity_id, action, base_version, payload);
$$;

create function private.pull_project_changes(p_project_id uuid, p_after_cursor bigint, p_page_size integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_page jsonb;
begin
  if v_actor_id is null then raise exception 'authenticated user required' using errcode = '28000'; end if;
  if p_after_cursor is null or p_after_cursor < 0 then raise exception 'after_cursor must be non-negative' using errcode = '22023'; end if;
  if p_page_size is null or p_page_size not between 1 and 200 then raise exception 'page_size must be between 1 and 200' using errcode = '22023'; end if;
  if not exists (select 1 from public.project_members as pm where pm.project_id = p_project_id and pm.user_id = v_actor_id and pm.deleted_at is null) then raise exception 'project membership required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'changes', coalesce(jsonb_agg(jsonb_build_object('cursor', cursor, 'projectId', project_id, 'entityType', entity_type, 'entityId', entity_id, 'changeType', change_type, 'entityVersion', entity_version, 'payload', payload, 'createdAt', created_at) order by cursor), '[]'::jsonb),
    'nextCursor', coalesce(max(cursor), p_after_cursor)
  ) into v_page
  from (
    select * from public.project_changes where project_id = p_project_id and cursor > p_after_cursor order by cursor limit p_page_size
  ) as page;
  return v_page;
end;
$$;

create function public.pull_project_changes(project_id uuid, after_cursor bigint, page_size integer)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.pull_project_changes(project_id, after_cursor, page_size);
$$;

revoke execute on function private.apply_project_operation(uuid, uuid, text, uuid, text, bigint, jsonb) from public, anon;
revoke execute on function public.apply_project_operation(uuid, uuid, text, uuid, text, bigint, jsonb) from public, anon;
revoke execute on function private.pull_project_changes(uuid, bigint, integer) from public, anon;
revoke execute on function public.pull_project_changes(uuid, bigint, integer) from public, anon;
grant execute on function private.apply_project_operation(uuid, uuid, text, uuid, text, bigint, jsonb) to authenticated;
grant execute on function public.apply_project_operation(uuid, uuid, text, uuid, text, bigint, jsonb) to authenticated;
grant execute on function private.pull_project_changes(uuid, bigint, integer) to authenticated;
grant execute on function public.pull_project_changes(uuid, bigint, integer) to authenticated;
