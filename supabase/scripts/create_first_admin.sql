-- Creating the FIRST administrator (run once, by you, in the Supabase SQL editor).
--
-- There is deliberately NO application endpoint that can create or promote an admin.
-- The browser, the anon key and even a host account cannot do it: profiles_guard() and
-- admin_update_user() both refuse role = 'admin'. Only the database owner can.
--
-- Steps
--  1. In the Supabase dashboard open Authentication > Users > "Add user" (or sign up
--     normally on the website with the e-mail you want to use) and confirm the e-mail.
--  2. Replace the e-mail below with that address and run this script in the SQL editor.
--     (The SQL editor runs as the database owner, which the guard trigger allows.)

update public.profiles
   set role = 'admin'
 where email = 'REPLACE_WITH_ADMIN_EMAIL@example.com';

-- Verify: should return exactly one row with role = admin
select id, email, role from public.profiles where role = 'admin';
