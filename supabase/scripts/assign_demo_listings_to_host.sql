-- OPTIONAL, for TESTING ONLY: lets YOUR OWN test host account own the six demonstration listings, so you can test the host side of the
-- booking flow (see requests, accept, reject) without waiting for a real owner.
--
-- Demo listings are created with no owner (platform-managed), so booking requests on them go to the admin inbox. After you
-- assign them, requests go to this host's dashboard instead. The demo listings stay flagged is_sample (badge, noindex), and
-- remove_sample_data.sql still deletes them.
--
-- Steps: 1) sign up a host account with an e-mail you control (Create host account) and verify the e-mail.
--        2) replace the e-mail below and run this script in the Supabase SQL editor.
-- To undo:  update public.properties set host_id = null where is_sample;

do $$
declare
  v_email text := lower('REPLACE_WITH_YOUR_TEST_HOST_EMAIL@example.com');
  v_id uuid;
  v_count int;
begin
  if v_email like 'replace_with%' then
    raise exception 'Edit v_email first: put the e-mail of YOUR test host account.';
  end if;

  select p.id into v_id
    from public.profiles p join auth.users u on u.id = p.id
   where lower(u.email) = v_email and u.email_confirmed_at is not null and p.role = 'host' and not p.is_suspended;
  if v_id is null then
    raise exception 'No verified, active HOST account found for %. Register through "Create host account" and verify the e-mail first.', v_email;
  end if;

  update public.properties set host_id = v_id where is_sample and host_id is null;
  get diagnostics v_count = row_count;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (null, 'assign_demo_listings', 'profile', v_id::text, jsonb_build_object('listings', v_count, 'via', 'sql-editor'));
end $$;

select slug, name, host_id is not null as has_host from public.properties where is_sample order by slug;
