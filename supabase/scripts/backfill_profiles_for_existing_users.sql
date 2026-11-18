-- Gives every sign-in account that existed BEFORE the schema was installed a profile.
--
-- The on_auth_user_created trigger only fires for NEW accounts. If people signed up while the database was still empty (or the
-- project was paused and restored), their auth.users rows have no profile and cannot use the marketplace. Run this once, right
-- after setup-all.sql. It is idempotent and never changes an existing profile.
--
-- Every account becomes a plain traveller. Nobody is made a host or an administrator here
-- (see create_first_admin.sql for the administrator).
insert into public.profiles (id, email, full_name, phone, role)
select u.id, u.email,
       left(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), 120),
       left(nullif(u.raw_user_meta_data ->> 'phone', ''), 20),
       'traveller'
  from auth.users u
on conflict (id) do nothing;

select (select count(*) from auth.users) as auth_users,
       (select count(*) from public.profiles) as profiles,
       (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)) as still_without_profile;
