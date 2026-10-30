-- Hasiru Nidhi — the account role is decided by the SERVER, never by what a browser puts in sign-up metadata.
-- Apply AFTER 20261021000200_*.
--
-- Anyone can call the public Auth API directly with arbitrary user metadata, so a client-supplied
-- "account_type" must not decide a role. Every new account (email/password or Google) starts as a traveller.
-- Host accounts are created by trusted server code (the host sign-up action and the OAuth callback), which uses the
-- service role or the audited become_host() function; administrators can only be created from the SQL editor.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 120),
    left(nullif(new.raw_user_meta_data ->> 'phone', ''), 20),
    'traveller'
  )
  on conflict (id) do nothing;   -- a second identity (e.g. Google) for the same user never creates a second profile
  return new;
end $$;
