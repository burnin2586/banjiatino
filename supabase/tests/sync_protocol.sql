begin;

select plan(68);

select has_function(
  'public',
  'apply_project_operation',
  array['uuid', 'uuid', 'text', 'uuid', 'text', 'bigint', 'jsonb']
);
select has_function(
  'public',
  'pull_project_changes',
  array['uuid', 'bigint', 'integer']
);
select has_function(
  'private',
  'apply_project_operation',
  array['uuid', 'uuid', 'text', 'uuid', 'text', 'bigint', 'jsonb']
);
select has_function(
  'private',
  'pull_project_changes',
  array['uuid', 'bigint', 'integer']
);
select is(
  (
    select p.proargnames
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apply_project_operation'
  ),
  array['operation_id', 'project_id', 'entity_type', 'entity_id', 'action', 'base_version', 'payload']::text[],
  'the public apply RPC keeps the specified named arguments'
);
select is(
  (
    select p.proargnames
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'pull_project_changes'
  ),
  array['project_id', 'after_cursor', 'page_size']::text[],
  'the public pull RPC keeps the specified named arguments'
);

select ok(
  not (
    select p.prosecdef
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apply_project_operation'
  ),
  'the public apply wrapper is SECURITY INVOKER'
);
select ok(
  not (
    select p.prosecdef
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'pull_project_changes'
  ),
  'the public pull wrapper is SECURITY INVOKER'
);
select ok(
  (
    select p.prosecdef
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'apply_project_operation'
  ),
  'the private apply implementation is SECURITY DEFINER'
);
select ok(
  (
    select p.prosecdef
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'pull_project_changes'
  ),
  'the private pull implementation is SECURITY DEFINER'
);
select is(
  (
    select p.proconfig
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'apply_project_operation'
  ),
  array['search_path=""']::text[],
  'the private apply implementation has an empty search_path'
);
select is(
  (
    select p.proconfig
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'pull_project_changes'
  ),
  array['search_path=""']::text[],
  'the private pull implementation has an empty search_path'
);
select is(
  (
    select count(*)
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apply_project_operation'
  ),
  1::bigint,
  'there is only one public apply overload'
);
select is(
  (
    select count(*)
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'pull_project_changes'
  ),
  1::bigint,
  'there is only one public pull overload'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.apply_project_operation(uuid,uuid,text,uuid,text,bigint,jsonb)',
    'EXECUTE'
  ),
  'authenticated can execute the public apply wrapper'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.pull_project_changes(uuid,bigint,integer)',
    'EXECUTE'
  ),
  'authenticated can execute the public pull wrapper'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.apply_project_operation(uuid,uuid,text,uuid,text,bigint,jsonb)',
    'EXECUTE'
  ),
  'anon cannot execute the public apply wrapper'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.pull_project_changes(uuid,bigint,integer)',
    'EXECUTE'
  ),
  'anon cannot execute the public pull wrapper'
);
select ok(
  not has_table_privilege('authenticated', 'public.rooms', 'INSERT'),
  'authenticated has no direct INSERT grant on rooms'
);
select ok(
  not has_table_privilege('authenticated', 'public.moving_boxes', 'UPDATE'),
  'authenticated has no direct UPDATE grant on boxes'
);
select ok(
  not has_table_privilege('authenticated', 'public.moving_items', 'DELETE'),
  'authenticated has no direct DELETE grant on items'
);
select ok(
  not has_table_privilege('authenticated', 'public.applied_operations', 'SELECT'),
  'authenticated cannot read applied operation internals'
);
select ok(
  not has_table_privilege('authenticated', 'public.project_changes', 'SELECT'),
  'authenticated cannot read the change log directly'
);
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon cannot access the private schema'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'sync-a@example.test', '', now()),
  ('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', 'sync-b@example.test', '', now());

insert into public.profiles (user_id, display_name)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Sync A'),
  ('00000000-0000-0000-0000-0000000000b2', 'Sync B');

insert into public.moving_projects (id, name, created_by)
values
  ('10000000-0000-0000-0000-000000000001', 'Idempotency', '00000000-0000-0000-0000-0000000000a1'),
  ('20000000-0000-0000-0000-000000000002', 'Other member', '00000000-0000-0000-0000-0000000000b2'),
  ('30000000-0000-0000-0000-000000000003', 'Offline boxes', '00000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-000000000004', 'Change feed', '00000000-0000-0000-0000-0000000000a1');

insert into public.project_members (project_id, user_id)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b2'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000a1');

insert into public.rooms (id, project_id, name, created_by, updated_by)
values (
  'a2000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  'Other project room',
  '00000000-0000-0000-0000-0000000000b2',
  '00000000-0000-0000-0000-0000000000b2'
);

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);

select throws_like(
  $$select public.apply_project_operation(
    'd0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'room',
    'a1000000-0000-0000-0000-000000000001',
    'create',
    0,
    '{"name":"Denied"}'::jsonb
  )$$,
  'permission denied%',
  'anon cannot call apply'
);
select throws_like(
  $$select public.pull_project_changes(
    '10000000-0000-0000-0000-000000000001',
    0,
    10
  )$$,
  'permission denied%',
  'anon cannot call pull'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select lives_ok(
  $$select public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'room',
    'a1000000-0000-0000-0000-000000000001',
    'create',
    0,
    '{"name":"Kitchen","room_kind":"source"}'::jsonb
  )$$,
  'a member can apply a room create operation'
);
select is(
  public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'room',
    'a1000000-0000-0000-0000-000000000001',
    'create',
    0,
    '{"name":"Kitchen","room_kind":"source"}'::jsonb
  ),
  public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'room',
    'a1000000-0000-0000-0000-000000000001',
    'create',
    0,
    '{"name":"Kitchen","room_kind":"source"}'::jsonb
  ),
  'the same operation id returns the same result'
);
select is(
  (select count(*) from public.rooms where id = 'a1000000-0000-0000-0000-000000000001'),
  1::bigint,
  'a duplicate operation creates one entity'
);
select is(
  jsonb_array_length(
    public.pull_project_changes('10000000-0000-0000-0000-000000000001', 0, 10) -> 'changes'
  ),
  1,
  'a duplicate operation creates one change envelope'
);
select throws_like(
  $$select public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'room',
    'a1000000-0000-0000-0000-000000000001',
    'create',
    0,
    '{"name":"Different"}'::jsonb
  )$$,
  'operation_id was already used for a different request',
  'an operation id cannot be reused for a different request'
);
select throws_like(
  $$select public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'room',
    'a1000000-0000-0000-0000-000000000002',
    'create',
    0,
    '{"name":"Unknown field","owner_id":"00000000-0000-0000-0000-0000000000a1"}'::jsonb
  )$$,
  'payload contains unsupported fields',
  'apply rejects payload fields outside the entity allow-list'
);
select throws_like(
  $$select public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'room',
    'a2000000-0000-0000-0000-000000000002',
    'update',
    1,
    '{"name":"Cross-project"}'::jsonb
  )$$,
  'entity not found in project',
  'apply cannot mutate an entity from another project'
);
select throws_like(
  $$select public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    'project',
    'a1000000-0000-0000-0000-000000000004',
    'create',
    0,
    '{}'::jsonb
  )$$,
  'unsupported entity_type',
  'apply rejects an unknown entity type'
);
select throws_like(
  $$select public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    'room',
    'a1000000-0000-0000-0000-000000000005',
    'hard_delete',
    0,
    '{}'::jsonb
  )$$,
  'unsupported action',
  'apply rejects an unknown action'
);
select throws_like(
  $$select public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    'room',
    'a1000000-0000-0000-0000-000000000001',
    'update',
    0,
    '{"name":"Stale"}'::jsonb
  )$$,
  'base_version does not match entity version',
  'apply rejects a stale base version'
);
select throws_like(
  $$select public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000001',
    'room',
    'a1000000-0000-0000-0000-000000000007',
    'create',
    null::bigint,
    '{"name":"Null version"}'::jsonb
  )$$,
  'base_version must be non-negative',
  'apply rejects a null base version'
);
select throws_like(
  $$select public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000001',
    'box',
    'a1000000-0000-0000-0000-000000000008',
    'create',
    0,
    null::jsonb
  )$$,
  'payload must be an object',
  'apply rejects a null payload'
);
select throws_like(
  $$select public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000001',
    'room',
    'a1000000-0000-0000-0000-000000000009',
    'create',
    0,
    '{"name":true}'::jsonb
  )$$,
  'payload field has invalid type',
  'apply rejects a non-string text field'
);
select throws_like(
  $$select public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000001',
    'task',
    'a1000000-0000-0000-0000-000000000010',
    'create',
    0,
    '{"title":"Bad UUID","assignee_id":7}'::jsonb
  )$$,
  'payload field has invalid type',
  'apply rejects a non-string UUID field'
);
select throws_like(
  $$select public.apply_project_operation(
    'd1000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000001',
    'task',
    'a1000000-0000-0000-0000-000000000011',
    'create',
    0,
    '{"title":"Bad time","due_at":7}'::jsonb
  )$$,
  'payload field has invalid type',
  'apply rejects a non-string timestamp field'
);

select lives_ok(
  $$select public.apply_project_operation(
    'd2000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003',
    'box',
    'b1000000-0000-0000-0000-000000000001',
    'create',
    0,
    '{"label":"Offline one"}'::jsonb
  )$$,
  'the first offline box can be created'
);
select lives_ok(
  $$select public.apply_project_operation(
    'd2000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    'box',
    'b2000000-0000-0000-0000-000000000002',
    'create',
    0,
    '{"label":"Offline two"}'::jsonb
  )$$,
  'the second offline box can be created'
);
select isnt(
  (select display_number from public.moving_boxes where id = 'b1000000-0000-0000-0000-000000000001'),
  (select display_number from public.moving_boxes where id = 'b2000000-0000-0000-0000-000000000002'),
  'offline boxes receive different display numbers'
);
select is(
  (select display_number from public.moving_boxes where id = 'b1000000-0000-0000-0000-000000000001'),
  1,
  'the first server-allocated box number is one'
);
select is(
  (select display_number from public.moving_boxes where id = 'b2000000-0000-0000-0000-000000000002'),
  2,
  'the second server-allocated box number is two'
);
select lives_ok(
  $$select public.apply_project_operation(
    'd2000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    'box',
    'b1000000-0000-0000-0000-000000000001',
    'set_status',
    1,
    '{"status":"arrived"}'::jsonb
  )$$,
  'box status can move forward'
);
select throws_like(
  $$select public.apply_project_operation(
    'd2000000-0000-0000-0000-000000000004',
    '30000000-0000-0000-0000-000000000003',
    'box',
    'b1000000-0000-0000-0000-000000000001',
    'set_status',
    2,
    '{"status":"packed"}'::jsonb
  )$$,
  'status cannot move backwards',
  'box status cannot move backwards'
);

select lives_ok(
  $$select public.apply_project_operation(
    'd3000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000004',
    'room',
    'c1000000-0000-0000-0000-000000000001',
    'create',
    0,
    '{"name":"Feed room"}'::jsonb
  )$$,
  'the feed room create succeeds'
);
select lives_ok(
  $$select public.apply_project_operation(
    'd3000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000004',
    'item',
    'c2000000-0000-0000-0000-000000000002',
    'create',
    0,
    '{"name":"Feed item"}'::jsonb
  )$$,
  'the feed item create succeeds'
);
select lives_ok(
  $$select public.apply_project_operation(
    'd3000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000004',
    'room',
    'c1000000-0000-0000-0000-000000000001',
    'update',
    1,
    '{"name":"Updated feed room"}'::jsonb
  )$$,
  'the feed room update succeeds'
);
select lives_ok(
  $$select public.apply_project_operation(
    'd3000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000004',
    'item',
    'c2000000-0000-0000-0000-000000000002',
    'soft_delete',
    1,
    '{}'::jsonb
  )$$,
  'the feed item soft delete succeeds'
);
select is(
  (
    select jsonb_agg((entry.value ->> 'cursor')::bigint order by entry.ordinality)
    from jsonb_array_elements(
      public.pull_project_changes('40000000-0000-0000-0000-000000000004', 1, 2) -> 'changes'
    ) with ordinality as entry(value, ordinality)
  ),
  '[2, 3]'::jsonb,
  'pull returns ordered changes strictly after the supplied cursor'
);
select is(
  public.pull_project_changes('40000000-0000-0000-0000-000000000004', 1, 2) ->> 'nextCursor',
  '3',
  'pull returns the last delivered cursor as nextCursor'
);
select is(
  jsonb_array_length(
    public.pull_project_changes('40000000-0000-0000-0000-000000000004', 1, 2) -> 'changes'
  ),
  2,
  'pull honors the requested page size'
);
select ok(
  (
    public.pull_project_changes('40000000-0000-0000-0000-000000000004', 2, 1)
      #> '{changes,0,payload}'
  ) @> '{"id":"c1000000-0000-0000-0000-000000000001","project_id":"40000000-0000-0000-0000-000000000004","name":"Updated feed room","version":2}'::jsonb,
  'an upsert envelope contains the complete latest entity row'
);
select is(
  (
    public.pull_project_changes('40000000-0000-0000-0000-000000000004', 3, 1)
      #>> '{changes,0,changeType}'
  ),
  'delete',
  'a soft delete produces a delete envelope'
);
select is(
  (
    public.pull_project_changes('40000000-0000-0000-0000-000000000004', 3, 1)
      #> '{changes,0,payload}'
  ) - 'deletedAt',
  '{"id":"c2000000-0000-0000-0000-000000000002","version":2}'::jsonb,
  'a deletion envelope contains only id, deletedAt, and version'
);
select ok(
  (
    public.pull_project_changes('40000000-0000-0000-0000-000000000004', 3, 1)
      #> '{changes,0,payload,deletedAt}'
  ) is not null,
  'a deletion envelope includes deletedAt'
);
select lives_ok(
  $$select public.apply_project_operation(
    'd3000000-0000-0000-0000-000000000005',
    '40000000-0000-0000-0000-000000000004',
    'item',
    'c2000000-0000-0000-0000-000000000002',
    'restore',
    2,
    '{}'::jsonb
  )$$,
  'a soft-deleted entity can be restored'
);
select is(
  (
    public.pull_project_changes('40000000-0000-0000-0000-000000000004', 4, 1)
      #>> '{changes,0,changeType}'
  ),
  'upsert',
  'restore emits an upsert envelope'
);
select is(
  public.pull_project_changes('40000000-0000-0000-0000-000000000004', 5, 10) ->> 'nextCursor',
  '5',
  'an empty page preserves the supplied cursor'
);
select throws_like(
  $$select public.pull_project_changes(
    '40000000-0000-0000-0000-000000000004',
    0,
    201
  )$$,
  'page_size must be between 1 and 200',
  'pull rejects page sizes above the protocol maximum'
);
select throws_like(
  $$select public.pull_project_changes(
    '40000000-0000-0000-0000-000000000004',
    -1,
    10
  )$$,
  'after_cursor must be non-negative',
  'pull rejects a negative cursor'
);
select throws_like(
  $$select public.pull_project_changes(
    '40000000-0000-0000-0000-000000000004',
    null::bigint,
    10
  )$$,
  'after_cursor must be non-negative',
  'pull rejects a null cursor'
);
select throws_like(
  $$select public.pull_project_changes(
    '40000000-0000-0000-0000-000000000004',
    0,
    null::integer
  )$$,
  'page_size must be between 1 and 200',
  'pull rejects a null page size'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);

select throws_like(
  $$select public.apply_project_operation(
    'd4000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'room',
    'e1000000-0000-0000-0000-000000000001',
    'create',
    0,
    '{"name":"Denied"}'::jsonb
  )$$,
  'project membership required',
  'a non-member cannot apply an operation'
);
select throws_like(
  $$select public.pull_project_changes(
    '10000000-0000-0000-0000-000000000001',
    0,
    10
  )$$,
  'project membership required',
  'a non-member cannot pull project changes'
);

reset role;

select * from finish();
rollback;
