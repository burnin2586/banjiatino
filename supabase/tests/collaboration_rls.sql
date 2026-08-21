begin;

select plan(34);

select has_table('public', 'profiles');
select has_table('public', 'moving_projects');
select has_table('public', 'project_members');
select has_table('public', 'invitations');
select has_table('public', 'rooms');
select has_table('public', 'moving_tasks');
select has_table('public', 'moving_boxes');
select has_table('public', 'moving_items');
select has_table('public', 'applied_operations');
select has_table('public', 'project_changes');

select has_function('public', 'is_project_member', array['uuid']);
select has_function('public', 'bootstrap_moving_project', array['text', 'text', 'date']);

select policies_are('public', 'moving_boxes', array[
  'project members can read boxes'
]);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'member-a@example.test', '', now()),
  ('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', 'member-b@example.test', '', now());

insert into public.profiles (user_id, display_name)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Member A'),
  ('00000000-0000-0000-0000-0000000000b2', 'Member B');

insert into public.moving_projects (id, name, created_by)
values
  ('10000000-0000-0000-0000-000000000001', 'Project A', '00000000-0000-0000-0000-0000000000a1'),
  ('20000000-0000-0000-0000-000000000002', 'Project B', '00000000-0000-0000-0000-0000000000b2');

insert into public.project_members (project_id, user_id)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b2');

insert into public.moving_boxes (id, project_id, label, created_by, updated_by)
values
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'A box', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'B box', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b2');

select throws_like(
  $$insert into public.moving_tasks (id, project_id, title, assignee_id, created_by, updated_by)
    values ('70000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Cross-project assignee', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1')$$,
  'violates foreign key constraint',
  'a task cannot assign a member from another project'
);

select throws_like(
  $$insert into public.moving_boxes (id, project_id, label, assignee_id, created_by, updated_by)
    values ('80000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'Cross-project assignee', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1')$$,
  'violates foreign key constraint',
  'a box cannot assign a member from another project'
);

select throws_like(
  $$insert into public.rooms (id, project_id, name, created_by, updated_by)
    values ('90000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'Cross-project creator', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b2')$$,
  'violates foreign key constraint',
  'a room cannot record a creator from another project'
);

select throws_like(
  $$insert into public.applied_operations (operation_id, project_id, actor_id, entity_type, entity_id, result)
    values ('a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 'box', '30000000-0000-0000-0000-000000000003', '{}'::jsonb)$$,
  'violates foreign key constraint',
  'an applied operation cannot record an actor from another project'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select is(
  (select count(*) from public.moving_boxes),
  1::bigint,
  'a project member can read boxes in their own project'
);

select is(
  (select count(*) from public.moving_projects),
  1::bigint,
  'a project member can read their own project'
);

select is(
  (select count(*) from public.project_members),
  1::bigint,
  'a project member can read membership for their own project'
);

select is(
  (select count(*) from public.moving_boxes where project_id = '20000000-0000-0000-0000-000000000002'),
  0::bigint,
  'a project member cannot read boxes in another project'
);

select throws_like(
  $$update public.moving_boxes
    set label = 'cross-project write'
    where id = '40000000-0000-0000-0000-000000000004'$$,
  'permission denied',
  'a project member cannot update another project\'s box'
);

select throws_like(
  $$insert into public.moving_boxes (id, project_id, label, created_by, updated_by)
    values ('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'direct write', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1')$$,
  'permission denied',
  'members cannot directly insert shared boxes'
);

select throws_like(
  $$update public.moving_boxes set label = 'direct write' where id = '30000000-0000-0000-0000-000000000003'$$,
  'permission denied',
  'members cannot directly update shared boxes'
);

select throws_like(
  $$delete from public.moving_boxes where id = '30000000-0000-0000-0000-000000000003'$$,
  'permission denied',
  'members cannot directly delete shared boxes'
);

select throws_like(
  $$insert into public.moving_projects (id, name, created_by)
    values ('60000000-0000-0000-0000-000000000006', 'direct project', '00000000-0000-0000-0000-0000000000a1')$$,
  'permission denied',
  'members cannot directly create projects outside bootstrap'
);

select throws_like(
  $$select * from public.invitations$$,
  'permission denied',
  'members cannot directly read invitation token hashes'
);

select throws_like(
  $$select * from public.applied_operations$$,
  'permission denied',
  'members cannot directly read idempotency internals'
);

select throws_like(
  $$select * from public.project_changes$$,
  'permission denied',
  'members cannot directly read change cursors'
);

select ok(
  public.bootstrap_moving_project('Bootstrap project', 'Bootstrap A', date '2026-10-01') is not null,
  'an authenticated user can atomically bootstrap a project'
);

select is(
  (select count(*) from public.moving_projects where name = 'Bootstrap project'),
  1::bigint,
  'bootstrap creates a project visible to its creator'
);

select is(
  (select count(*) from public.project_members pm join public.moving_projects mp on mp.id = pm.project_id
    where mp.name = 'Bootstrap project' and pm.user_id = '00000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'bootstrap creates creator membership'
);

select is(
  (select display_name from public.profiles where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'Bootstrap A',
  'bootstrap upserts the caller profile'
);

reset role;

set constraints moving_projects_created_by_member_fkey immediate;

select throws_like(
  $$insert into public.moving_projects (id, name, created_by)
    values ('b0000000-0000-0000-0000-00000000000b', 'Missing creator membership', '00000000-0000-0000-0000-0000000000a1')$$,
  'moving_projects_created_by_member_fkey',
  'a project creator must have a matching creator membership'
);

set constraints moving_projects_created_by_member_fkey deferred;

select * from finish();
rollback;
