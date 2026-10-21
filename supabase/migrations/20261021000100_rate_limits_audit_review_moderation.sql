-- Hasiru Nidhi marketplace — abuse protection, review moderation, complete admin audit trail.
-- Apply AFTER the three 20261017* migrations.

-- ---------------------------------------------------------------- rate limiting
-- Fixed-window counters kept in Postgres so the limit holds across every serverless instance.
-- Only the server (service_role) may call it: if browsers could, anyone could burn another visitor's bucket.
create table public.rate_limits (
  bucket text primary key check (char_length(bucket) <= 200),
  window_start timestamptz not null default now(),
  hits int not null default 0
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create function public.rate_limit_hit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_hits int;
begin
  if p_bucket is null or char_length(p_bucket) > 200 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit' using errcode = '22023';
  end if;

  insert into public.rate_limits as r (bucket, window_start, hits)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end,
        hits         = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end
  returning hits into v_hits;

  -- Opportunistic housekeeping so the table cannot grow without bound.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end $$;

revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- ---------------------------------------------------------------- review moderation
-- Admins may hide or restore a review but never edit its rating or text; every decision is audited.
drop policy reviews_admin_update on public.reviews;
revoke update on public.reviews from anon, authenticated;

create function public.moderate_review(p_review uuid, p_hidden boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.reviews set is_hidden = p_hidden where id = p_review;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.write_audit(case when p_hidden then 'review_hide' else 'review_restore' end,
    'review', p_review::text, jsonb_build_object('reason', nullif(left(p_reason, 500), '')));
end $$;

revoke all on function public.moderate_review(uuid, boolean, text) from public, anon;
grant execute on function public.moderate_review(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------- audit trail for admin changes
-- Catalogue, settings, featuring and enquiry/report triage are changed with plain updates, so a trigger records them.
-- Only actions performed by an administrator are logged; the columns that changed are recorded by NAME, never value,
-- so private settings or personal data never leak into the log.
create function public.audit_admin_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  j_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  j_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  j jsonb := coalesce(j_new, j_old);
  v_changed text[];
begin
  if auth.uid() is null or not public.is_admin() then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changed
      from jsonb_object_keys(j_new) k
     where j_new -> k is distinct from j_old -> k and k not in ('updated_at', 'updated_by');
    if v_changed is null then
      return new;
    end if;
  end if;
  perform public.write_audit(lower(tg_op) || '_' || tg_table_name, tg_table_name, coalesce(j ->> 'id', j ->> 'key'),
    jsonb_build_object('columns', to_jsonb(v_changed), 'status', j ->> 'status'));
  return coalesce(new, old);
end $$;

revoke all on function public.audit_admin_change() from public, anon, authenticated;

create trigger audit_platform_settings after insert or update or delete on public.platform_settings
  for each row execute function public.audit_admin_change();
create trigger audit_property_categories after insert or update or delete on public.property_categories
  for each row execute function public.audit_admin_change();
create trigger audit_amenities after insert or update or delete on public.amenities
  for each row execute function public.audit_admin_change();
create trigger audit_experiences after insert or update or delete on public.experiences
  for each row execute function public.audit_admin_change();
create trigger audit_reports after update on public.reports
  for each row execute function public.audit_admin_change();
create trigger audit_contact_enquiries after update on public.contact_enquiries
  for each row execute function public.audit_admin_change();
create trigger audit_partner_applications after update on public.partner_applications
  for each row execute function public.audit_admin_change();
create trigger audit_gardening_enquiries after update on public.gardening_enquiries
  for each row execute function public.audit_admin_change();
create trigger audit_property_featured after update on public.properties
  for each row when (old.is_featured is distinct from new.is_featured)
  execute function public.audit_admin_change();
