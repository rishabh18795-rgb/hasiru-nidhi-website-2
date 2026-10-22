-- Creating the FIRST administrator (run once, by the project owner, in the Supabase SQL editor).
--
-- There is deliberately NO application endpoint that can create or promote an admin: profiles_guard() and
-- admin_update_user() refuse role = 'admin' for every browser/API caller. Only the database owner can do this.
--
-- Steps
--  1. Sign up on the website with an e-mail address YOU control and click the verification link.
--     (No password is ever written into this file, GitHub or chat. Use "Forgot password" if you lose it.)
--  2. Replace the e-mail below and run this script. It refuses to continue unless that account exists AND
--     its e-mail is verified, and it records the action in the audit log.
--  3. Sign out and back in; the account menu now shows "Admin".

do $$
declare
  v_email text := lower('REPLACE_WITH_YOUR_EMAIL@example.com');
  v_id uuid;
begin
  if v_email like 'replace_with%' then
    raise exception 'Edit v_email first: put the e-mail of the account that should become the administrator.';
  end if;

  select u.id into v_id
    from auth.users u
   where lower(u.email) = v_email and u.email_confirmed_at is not null;
  if v_id is null then
    raise exception 'No VERIFIED account found for %. Sign up on the website and confirm the e-mail first.', v_email;
  end if;

  update public.profiles set role = 'admin' where id = v_id;
  if not found then
    raise exception 'The account has no profile row yet; sign in once and retry.';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (null, 'bootstrap_admin', 'profile', v_id::text, jsonb_build_object('via', 'sql-editor'));
end $$;

-- Verify: should list exactly the account you intended.
select id, email, role from public.profiles where role = 'admin';
