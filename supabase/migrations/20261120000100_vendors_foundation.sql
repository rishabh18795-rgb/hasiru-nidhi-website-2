-- Hasiru Nidhi marketplace - M1: vendor foundation (Phase 3 of the approved expansion).
-- Apply AFTER 20261117000100_*. ADDITIVE: no existing table is altered; one existing function (platform_settings_validate) is replaced
-- so the new feature-flag keys are validated. Nothing here touches Stays data, bookings or any financial record.
--
--  * One vendor identity per account (vendors), separate per-vertical capabilities (vendor_capabilities: products | services | stays),
--    each approved by an administrator on its own. Listing approval (Phase 4+) is a separate, later step.
--  * profiles.role / app_role are NOT changed. Existing hosts keep working; ensure_legacy_vendor() mirrors them into a vendor on demand (D1).
--  * Verification documents: configurable requirements (D13), private storage bucket, admin review. No legal compliance is claimed.
--  * Delivery / service coverage by PIN code (exact 6-digit or 3-digit prefix). Mandatory for delivery (D4).
--  * Feature flags (platform_settings), all OFF: nothing new is reachable until an administrator turns a module on.

-- ---------------------------------------------------------------- enums
create type public.vendor_status as enum ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'suspended');
create type public.vendor_capability as enum ('products', 'services', 'stays');
create type public.capability_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.document_status as enum ('submitted', 'accepted', 'rejected');

-- ---------------------------------------------------------------- vendors
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete restrict,
  slug text not null unique,
  business_name text not null,
  business_type text,
  description text,
  contact_name text,
  contact_email text,
  contact_phone text,
  address_line text,
  city text,
  state text,
  postal_code text,
  tax_identifier text,                        -- as declared by the vendor; never verified or interpreted by the platform
  status public.vendor_status not null default 'draft',
  rejection_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  is_legacy_host boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendors_name_len check (char_length(business_name) between 2 and 120),
  constraint vendors_type check (business_type is null or business_type in ('individual', 'proprietorship', 'partnership', 'company', 'farm', 'other')),
  constraint vendors_desc_len check (description is null or char_length(description) <= 2000),
  constraint vendors_contact_lens check (
    coalesce(char_length(contact_name), 0) <= 120 and coalesce(char_length(contact_email), 0) <= 254
    and coalesce(char_length(contact_phone), 0) <= 20 and coalesce(char_length(address_line), 0) <= 300
    and coalesce(char_length(city), 0) <= 120 and coalesce(char_length(state), 0) <= 120 and coalesce(char_length(tax_identifier), 0) <= 40),
  constraint vendors_pin check (postal_code is null or postal_code ~ '^[0-9]{6}$')
);
create index vendors_status_idx on public.vendors (status);
create trigger vendors_touch before update on public.vendors for each row execute function public.touch_updated_at();

create table public.vendor_capabilities (
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  capability public.vendor_capability not null,
  status public.capability_status not null default 'pending',
  reason text,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  primary key (vendor_id, capability),
  constraint vendor_capabilities_reason_len check (reason is null or char_length(reason) <= 1000)
);

-- ---------------------------------------------------------------- document requirements (configurable by capability and category, D13)
create table public.vendor_document_requirements (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  description text,
  capability public.vendor_capability not null,
  -- optional narrowing to one catalogue category (those tables arrive in later phases, so this is a soft reference for now)
  category_kind text check (category_kind in ('product_category', 'service_category')),
  category_id bigint,
  is_required boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  constraint vendor_doc_req_category check ((category_kind is null) = (category_id is null)),
  constraint vendor_doc_req_lens check (char_length(name) between 2 and 120 and coalesce(char_length(description), 0) <= 500)
);

create table public.vendor_documents (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  requirement_id bigint references public.vendor_document_requirements (id) on delete set null,
  label text not null,
  storage_path text not null unique,           -- "<vendor id>/<file>" in the private vendor-documents bucket
  original_name text,
  status public.document_status not null default 'submitted',
  reviewer_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint vendor_documents_lens check (char_length(label) between 1 and 120 and coalesce(char_length(original_name), 0) <= 200
    and coalesce(char_length(reviewer_note), 0) <= 1000 and storage_path like vendor_id::text || '/%')
);
create index vendor_documents_vendor_idx on public.vendor_documents (vendor_id);

-- ---------------------------------------------------------------- coverage
create table public.vendor_service_areas (
  id bigint generated always as identity primary key,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  scope text not null check (scope in ('delivery', 'service')),
  pin_code text check (pin_code ~ '^[0-9]{6}$'),
  pin_prefix text check (pin_prefix ~ '^[0-9]{3}$'),
  constraint vendor_areas_one check ((pin_code is null) <> (pin_prefix is null))
);
create unique index vendor_service_areas_unique on public.vendor_service_areas (vendor_id, scope, coalesce(pin_code, ''), coalesce(pin_prefix, ''));
create index vendor_service_areas_lookup on public.vendor_service_areas (scope, pin_code);
create index vendor_service_areas_prefix on public.vendor_service_areas (scope, pin_prefix);

-- ---------------------------------------------------------------- feature flags (all OFF) + settings validation
insert into public.platform_settings (key, value, is_public, description) values
  ('marketplace_vendor_registration_enabled', 'false'::jsonb, true, 'Turn ON to let customers apply as vendors and existing hosts open the vendor dashboard.'),
  ('marketplace_products_enabled', 'false'::jsonb, true, 'Turn ON only after the Products module has passed its launch checks.'),
  ('marketplace_services_enabled', 'false'::jsonb, true, 'Turn ON only after the Services module has passed its launch checks.')
on conflict (key) do nothing;

create or replace function public.platform_settings_validate() returns trigger
language plpgsql as $$
begin
  if new.key = 'commission_rate_percent' and not (jsonb_typeof(new.value) = 'number' and (new.value #>> '{}')::numeric between 0 and 50) then
    raise exception 'invalid_setting: commission_rate_percent must be a number between 0 and 50' using errcode = 'P0001';
  elsif new.key = 'commission_base' and not (jsonb_typeof(new.value) = 'string' and new.value #>> '{}' in ('accommodation', 'accommodation_and_cleaning')) then
    raise exception 'invalid_setting: commission_base' using errcode = 'P0001';
  elsif new.key in ('commission_reverse_on_cancellation', 'refund_reverses_commission', 'settlement_requires_payment',
                    'marketplace_vendor_registration_enabled', 'marketplace_products_enabled', 'marketplace_services_enabled')
        and jsonb_typeof(new.value) <> 'boolean' then
    raise exception 'invalid_setting: % must be true or false', new.key using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- helpers (used by policies and, later, by every vendor-owned table)
-- The caller owns this vendor and is not suspended.
create function public.is_vendor_member(p_vendor uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.vendors v join public.profiles p on p.id = v.owner_id
     where v.id = p_vendor and v.owner_id = auth.uid() and not p.is_suspended
  )
$$;

-- The vendor may act in a vertical right now: vendor approved, capability approved, owner not suspended.
create function public.vendor_can(p_vendor uuid, p_capability public.vendor_capability) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.vendors v
      join public.profiles p on p.id = v.owner_id
      join public.vendor_capabilities c on c.vendor_id = v.id and c.capability = p_capability
     where v.id = p_vendor and v.status = 'approved' and c.status = 'approved' and not p.is_suspended
  )
$$;

-- Ownership for writes: admin, or the vendor's own member while the capability is approved.
create function public.owns_vendor(p_vendor uuid, p_capability public.vendor_capability) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_admin() or (public.is_vendor_member(p_vendor) and public.vendor_can(p_vendor, p_capability))
$$;

-- Does a vendor cover a PIN code for deliveries or services? Exact PIN or 3-digit prefix. Public: it only answers a coverage question.
create function public.vendor_covers_pin(p_vendor uuid, p_scope text, p_pin text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(p_pin ~ '^[0-9]{6}$', false) and exists (
    select 1 from public.vendor_service_areas a
     where a.vendor_id = p_vendor and a.scope = p_scope
       and (a.pin_code = p_pin or a.pin_prefix = left(p_pin, 3))
  )
$$;

-- ---------------------------------------------------------------- row level security
alter table public.vendors enable row level security;
alter table public.vendor_capabilities enable row level security;
alter table public.vendor_document_requirements enable row level security;
alter table public.vendor_documents enable row level security;
alter table public.vendor_service_areas enable row level security;

create policy vendors_select on public.vendors for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy vendor_capabilities_select on public.vendor_capabilities for select to authenticated
  using (public.is_admin() or exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()));
create policy vendor_docs_select on public.vendor_documents for select to authenticated
  using (public.is_admin() or exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()));
create policy vendor_areas_select on public.vendor_service_areas for select to authenticated
  using (public.is_admin() or exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid()));
create policy vendor_doc_req_read on public.vendor_document_requirements for select to authenticated using (is_active or public.is_admin());
create policy vendor_doc_req_admin on public.vendor_document_requirements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Vendors never write these tables directly: every change is a function below (which re-checks who and what state).
revoke insert, update, delete on public.vendors, public.vendor_capabilities, public.vendor_documents, public.vendor_service_areas from anon, authenticated;
revoke all on public.vendors, public.vendor_capabilities, public.vendor_documents, public.vendor_service_areas, public.vendor_document_requirements from anon;
revoke insert, update, delete on public.vendor_document_requirements from anon;

create trigger audit_vendor_document_requirements after insert or update or delete on public.vendor_document_requirements
  for each row execute function public.audit_admin_change();

-- ---------------------------------------------------------------- functions: vendor profile and application
create function public.vendor_slug(p_name text) returns text
language plpgsql volatile set search_path = public, pg_temp as $$
declare
  v_base text := trim(both '-' from lower(regexp_replace(coalesce(p_name, ''), '[^a-zA-Z0-9]+', '-', 'g')));
  v_slug text;
begin
  if v_base = '' then v_base := 'vendor'; end if;
  v_base := left(v_base, 40);
  loop
    v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    exit when not exists (select 1 from public.vendors where slug = v_slug);
  end loop;
  return v_slug;
end $$;

create function public.vendor_text(p jsonb, p_key text, p_max int) returns text
language sql immutable as $$
  select nullif(left(btrim(coalesce(p ->> p_key, '')), p_max), '')
$$;

-- Creates or updates the caller's vendor profile. Rules: only while draft or rejected (business name and tax identifier lock once approved).
create function public.save_vendor_profile(p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v public.vendors%rowtype;
  v_name text := public.vendor_text(p, 'business_name', 120);
  v_type text := public.vendor_text(p, 'business_type', 30);
  v_pin text := public.vendor_text(p, 'postal_code', 6);
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_prof from public.profiles where id = v_uid;
  if not found or v_prof.is_suspended then raise exception 'account_suspended' using errcode = '42501'; end if;
  if v_prof.role = 'admin' then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_pin is not null and v_pin !~ '^[0-9]{6}$' then raise exception 'invalid_pin' using errcode = 'P0001'; end if;
  if v_type is not null and v_type not in ('individual', 'proprietorship', 'partnership', 'company', 'farm', 'other') then
    raise exception 'invalid_business_type' using errcode = 'P0001';
  end if;

  select * into v from public.vendors where owner_id = v_uid for update;
  if not found then
    if not public.setting_bool('marketplace_vendor_registration_enabled', false) then
      raise exception 'vendor_registration_closed' using errcode = 'P0001';
    end if;
    if v_name is null or char_length(v_name) < 2 then raise exception 'business_name_required' using errcode = 'P0001'; end if;
    insert into public.vendors (owner_id, slug, business_name, business_type, description, contact_name, contact_email, contact_phone,
                                address_line, city, state, postal_code, tax_identifier)
    values (v_uid, public.vendor_slug(v_name), v_name, v_type, public.vendor_text(p, 'description', 2000), public.vendor_text(p, 'contact_name', 120),
            lower(public.vendor_text(p, 'contact_email', 254)), public.vendor_text(p, 'contact_phone', 20), public.vendor_text(p, 'address_line', 300),
            public.vendor_text(p, 'city', 120), public.vendor_text(p, 'state', 120), v_pin, public.vendor_text(p, 'tax_identifier', 40))
    returning * into v;
    perform public.write_audit('vendor_created', 'vendor', v.id::text, '{}'::jsonb);
    return v.id;
  end if;

  if v.status in ('submitted', 'under_review') then raise exception 'vendor_locked_in_review' using errcode = 'P0001'; end if;
  if v.status = 'suspended' then raise exception 'account_suspended' using errcode = '42501'; end if;
  if v.status = 'approved' then
    -- Identity of the business cannot be changed by the vendor once verified.
    update public.vendors set
      description = coalesce(public.vendor_text(p, 'description', 2000), description),
      contact_name = coalesce(public.vendor_text(p, 'contact_name', 120), contact_name),
      contact_email = coalesce(lower(public.vendor_text(p, 'contact_email', 254)), contact_email),
      contact_phone = coalesce(public.vendor_text(p, 'contact_phone', 20), contact_phone),
      address_line = coalesce(public.vendor_text(p, 'address_line', 300), address_line),
      city = coalesce(public.vendor_text(p, 'city', 120), city),
      state = coalesce(public.vendor_text(p, 'state', 120), state),
      postal_code = coalesce(v_pin, postal_code)
    where id = v.id;
  else
    update public.vendors set
      business_name = coalesce(v_name, business_name), business_type = coalesce(v_type, business_type),
      description = public.vendor_text(p, 'description', 2000), contact_name = public.vendor_text(p, 'contact_name', 120),
      contact_email = lower(public.vendor_text(p, 'contact_email', 254)), contact_phone = public.vendor_text(p, 'contact_phone', 20),
      address_line = public.vendor_text(p, 'address_line', 300), city = public.vendor_text(p, 'city', 120),
      state = public.vendor_text(p, 'state', 120), postal_code = v_pin, tax_identifier = public.vendor_text(p, 'tax_identifier', 40)
    where id = v.id;
  end if;
  return v.id;
end $$;

-- Submits the application for the requested verticals. The vendor must have a complete profile and every always-required document uploaded.
create function public.submit_vendor_application(p_capabilities public.vendor_capability[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v public.vendors%rowtype;
  c public.vendor_capability;
  v_missing text[] := '{}';
  v_doc record;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v from public.vendors where owner_id = v_uid for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v.status not in ('draft', 'rejected') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if p_capabilities is null or cardinality(p_capabilities) = 0 then raise exception 'capability_required' using errcode = 'P0001'; end if;
  if v.contact_name is null then v_missing := array_append(v_missing, 'contact_name'); end if;
  if v.contact_phone is null then v_missing := array_append(v_missing, 'contact_phone'); end if;
  if v.contact_email is null then v_missing := array_append(v_missing, 'contact_email'); end if;
  if v.address_line is null then v_missing := array_append(v_missing, 'address_line'); end if;
  if v.city is null then v_missing := array_append(v_missing, 'city'); end if;
  if v.postal_code is null then v_missing := array_append(v_missing, 'postal_code'); end if;
  if v.business_type is null then v_missing := array_append(v_missing, 'business_type'); end if;
  -- Always-required documents (not tied to one category) for each requested vertical must have been uploaded.
  for v_doc in
    select r.id, r.name from public.vendor_document_requirements r
     where r.is_active and r.is_required and r.category_id is null and r.capability = any (p_capabilities)
       and not exists (select 1 from public.vendor_documents d where d.vendor_id = v.id and d.requirement_id = r.id and d.status <> 'rejected')
  loop
    v_missing := array_append(v_missing, 'document:' || v_doc.name);
  end loop;
  if cardinality(v_missing) > 0 then
    raise exception 'incomplete_vendor: %', array_to_string(v_missing, ',') using errcode = 'P0001';
  end if;
  foreach c in array p_capabilities loop
    insert into public.vendor_capabilities (vendor_id, capability, status, requested_at)
    values (v.id, c, 'pending', now())
    on conflict (vendor_id, capability) do update
      set status = 'pending', reason = null, requested_at = now(), reviewed_by = null, reviewed_at = null
      where public.vendor_capabilities.status = 'rejected';
  end loop;
  update public.vendors set status = 'submitted', submitted_at = now(), rejection_reason = null where id = v.id;
  perform public.write_audit('vendor_submitted', 'vendor', v.id::text, jsonb_build_object('capabilities', to_jsonb(p_capabilities)));
  perform public.notify_admins('vendor_submitted', 'New vendor application', v.business_name || ' has applied to sell on Hasiru Nidhi.', '/admin/vendors/' || v.id);
end $$;

-- An approved (or legacy) vendor asks for one more vertical. It starts pending and is approved separately, like the first one.
create function public.request_vendor_capability(p_capability public.vendor_capability) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v public.vendors%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v from public.vendors where owner_id = auth.uid() for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v.status <> 'approved' then raise exception 'vendor_not_approved' using errcode = 'P0001'; end if;
  insert into public.vendor_capabilities (vendor_id, capability, status, requested_at)
  values (v.id, p_capability, 'pending', now())
  on conflict (vendor_id, capability) do update
    set status = 'pending', reason = null, requested_at = now(), reviewed_by = null, reviewed_at = null
    where public.vendor_capabilities.status = 'rejected';
  if not found then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  perform public.write_audit('vendor_capability_requested', 'vendor', v.id::text, jsonb_build_object('capability', p_capability));
  perform public.notify_admins('vendor_capability_requested', 'Vendor capability request', v.business_name || ' asked to add ' || p_capability::text || '.', '/admin/vendors/' || v.id);
end $$;

-- Existing hosts (D1): mirrors a host into a vendor, with the stays capability approved, WITHOUT changing anything about their properties or bookings.
create function public.ensure_legacy_vendor() returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_prof from public.profiles where id = v_uid;
  if not found or v_prof.is_suspended then raise exception 'account_suspended' using errcode = '42501'; end if;
  select id into v_id from public.vendors where owner_id = v_uid;
  if found then return v_id; end if;
  if v_prof.role <> 'host' then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.vendors (owner_id, slug, business_name, contact_name, contact_email, contact_phone, status, is_legacy_host, reviewed_at)
  values (v_uid, public.vendor_slug(coalesce(nullif(v_prof.full_name, ''), 'stay-host')), coalesce(nullif(v_prof.full_name, ''), 'Stay host'),
          nullif(v_prof.full_name, ''), v_prof.email, v_prof.phone, 'approved', true, now())
  returning id into v_id;
  insert into public.vendor_capabilities (vendor_id, capability, status, reason, reviewed_at)
  values (v_id, 'stays', 'approved', 'Existing host: carried over without re-verification', now());
  perform public.write_audit('legacy_vendor_created', 'vendor', v_id::text, jsonb_build_object('owner', v_uid));
  return v_id;
end $$;

-- ---------------------------------------------------------------- functions: administrator review
create function public.admin_review_vendor(p_vendor uuid, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v public.vendors%rowtype;
  v_to public.vendor_status;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v from public.vendors where id = p_vendor for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_decision = 'start_review' and v.status = 'submitted' then v_to := 'under_review';
  elsif p_decision = 'approve' and v.status in ('submitted', 'under_review') then v_to := 'approved';
  elsif p_decision = 'reject' and v.status in ('submitted', 'under_review') then
    if coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
    v_to := 'rejected';
  elsif p_decision = 'suspend' and v.status = 'approved' then
    if coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
    v_to := 'suspended';
  elsif p_decision = 'reinstate' and v.status = 'suspended' then v_to := 'approved';
  else raise exception 'invalid_status' using errcode = 'P0001'; end if;
  update public.vendors set status = v_to, rejection_reason = case when v_to in ('rejected', 'suspended') then left(btrim(p_reason), 1000) else null end,
         reviewed_by = auth.uid(), reviewed_at = now() where id = v.id;
  perform public.write_audit('vendor_' || p_decision, 'vendor', v.id::text, jsonb_build_object('from', v.status, 'to', v_to, 'reason', p_reason));
  if p_decision <> 'start_review' then
    perform public.notify(v.owner_id, 'vendor_' || p_decision, 'Vendor application update',
      case v_to when 'approved' then 'Your business has been verified. Capabilities are approved separately.'
                when 'rejected' then 'Your application needs changes: ' || coalesce(left(p_reason, 300), '')
                else 'Your vendor account status changed to ' || v_to::text || coalesce(': ' || left(p_reason, 300), '.') end, '/vendor');
  end if;
end $$;

create function public.admin_review_capability(p_vendor uuid, p_capability public.vendor_capability, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v public.vendors%rowtype;
  c public.vendor_capabilities%rowtype;
  v_to public.capability_status;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v from public.vendors where id = p_vendor for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  select * into c from public.vendor_capabilities where vendor_id = p_vendor and capability = p_capability for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_decision = 'approve' and c.status = 'pending' then
    if v.status <> 'approved' then raise exception 'vendor_not_approved' using errcode = 'P0001'; end if;
    v_to := 'approved';
  elsif p_decision = 'reject' and c.status = 'pending' then
    if coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
    v_to := 'rejected';
  elsif p_decision = 'suspend' and c.status = 'approved' then
    if coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
    v_to := 'suspended';
  elsif p_decision = 'reinstate' and c.status = 'suspended' then
    if v.status <> 'approved' then raise exception 'vendor_not_approved' using errcode = 'P0001'; end if;
    v_to := 'approved';
  else raise exception 'invalid_status' using errcode = 'P0001'; end if;
  update public.vendor_capabilities set status = v_to, reason = left(btrim(p_reason), 1000), reviewed_by = auth.uid(), reviewed_at = now()
   where vendor_id = p_vendor and capability = p_capability;
  -- Approving the stays capability for a new vendor makes them a host through the same audited route as become_host().
  if p_capability = 'stays' and v_to = 'approved' then
    update public.profiles set role = 'host' where id = v.owner_id and role = 'traveller';
  end if;
  perform public.write_audit('vendor_capability_' || p_decision, 'vendor', v.id::text, jsonb_build_object('capability', p_capability, 'from', c.status, 'to', v_to, 'reason', p_reason));
  perform public.notify(v.owner_id, 'vendor_capability', 'Vendor capability update', initcap(p_capability::text) || ' access is now ' || v_to::text
    || coalesce(': ' || left(p_reason, 300), '.'), '/vendor');
end $$;

-- ---------------------------------------------------------------- functions: documents and coverage
create function public.register_vendor_document(p_requirement bigint, p_label text, p_path text, p_name text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v public.vendors%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v from public.vendors where owner_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v.status = 'suspended' then raise exception 'account_suspended' using errcode = '42501'; end if;
  if p_path is null or p_path not like v.id::text || '/%' or char_length(p_path) > 300 then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_requirement is not null and not exists (select 1 from public.vendor_document_requirements where id = p_requirement and is_active) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if (select count(*) from public.vendor_documents where vendor_id = v.id) >= 30 then raise exception 'too_many_documents' using errcode = 'P0001'; end if;
  insert into public.vendor_documents (vendor_id, requirement_id, label, storage_path, original_name)
  values (v.id, p_requirement, left(btrim(coalesce(nullif(p_label, ''), 'Document')), 120), p_path, left(p_name, 200))
  returning id into v_id;
  perform public.write_audit('vendor_document_added', 'vendor', v.id::text, jsonb_build_object('document', v_id));
  return v_id;
end $$;

create function public.delete_vendor_document(p_document uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d public.vendor_documents%rowtype;
begin
  select d2.* into d from public.vendor_documents d2 join public.vendors v on v.id = d2.vendor_id where d2.id = p_document and v.owner_id = auth.uid() for update of d2;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if d.status = 'accepted' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  delete from public.vendor_documents where id = d.id;
  perform public.write_audit('vendor_document_removed', 'vendor', d.vendor_id::text, jsonb_build_object('document', d.id));
  return d.storage_path;
end $$;

create function public.admin_review_vendor_document(p_document uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d public.vendor_documents%rowtype;
  v_to public.document_status;
  v_owner uuid;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into d from public.vendor_documents where id = p_document for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_decision = 'accept' then v_to := 'accepted';
  elsif p_decision = 'reject' then
    if coalesce(btrim(p_note), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
    v_to := 'rejected';
  else raise exception 'invalid_status' using errcode = 'P0001'; end if;
  update public.vendor_documents set status = v_to, reviewer_note = left(btrim(p_note), 1000), reviewed_by = auth.uid(), reviewed_at = now() where id = d.id;
  perform public.write_audit('vendor_document_' || p_decision, 'vendor', d.vendor_id::text, jsonb_build_object('document', d.id));
  select owner_id into v_owner from public.vendors where id = d.vendor_id;
  perform public.notify(v_owner, 'vendor_document', 'Document ' || v_to::text, d.label || ' was ' || v_to::text || coalesce(': ' || left(p_note, 300), '.'), '/vendor/verification');
end $$;

-- Replaces the vendor's coverage for one scope. Codes are 6-digit PINs or 3-digit prefixes (a prefix covers every PIN starting with it).
create function public.set_vendor_service_areas(p_scope text, p_codes text[]) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v public.vendors%rowtype;
  v_codes text[];
  v_bad text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_scope not in ('delivery', 'service') then raise exception 'invalid_scope' using errcode = 'P0001'; end if;
  select * into v from public.vendors where owner_id = auth.uid() for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v.status = 'suspended' then raise exception 'account_suspended' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct btrim(c)) filter (where btrim(c) <> ''), '{}') into v_codes from unnest(coalesce(p_codes, '{}')) c;
  select c into v_bad from unnest(v_codes) c where c !~ '^[0-9]{6}$' and c !~ '^[0-9]{3}$' limit 1;
  if v_bad is not null then raise exception 'invalid_pin: %', v_bad using errcode = 'P0001'; end if;
  if cardinality(v_codes) > 500 then raise exception 'too_many_areas' using errcode = 'P0001'; end if;
  delete from public.vendor_service_areas where vendor_id = v.id and scope = p_scope;
  insert into public.vendor_service_areas (vendor_id, scope, pin_code, pin_prefix)
  select v.id, p_scope, case when char_length(c) = 6 then c end, case when char_length(c) = 3 then c end from unnest(v_codes) c;
  return cardinality(v_codes);
end $$;

-- ---------------------------------------------------------------- privileges
revoke all on function public.vendor_slug(text), public.vendor_text(jsonb, text, int) from public, anon, authenticated;
revoke all on function public.is_vendor_member(uuid) from public, anon;
grant execute on function public.is_vendor_member(uuid) to authenticated;
revoke all on function public.vendor_can(uuid, public.vendor_capability), public.owns_vendor(uuid, public.vendor_capability), public.vendor_covers_pin(uuid, text, text) from public;
grant execute on function public.vendor_can(uuid, public.vendor_capability), public.owns_vendor(uuid, public.vendor_capability), public.vendor_covers_pin(uuid, text, text) to anon, authenticated;
revoke all on function public.save_vendor_profile(jsonb), public.submit_vendor_application(public.vendor_capability[]), public.ensure_legacy_vendor(), public.request_vendor_capability(public.vendor_capability),
  public.admin_review_vendor(uuid, text, text), public.admin_review_capability(uuid, public.vendor_capability, text, text),
  public.register_vendor_document(bigint, text, text, text), public.delete_vendor_document(uuid), public.admin_review_vendor_document(uuid, text, text),
  public.set_vendor_service_areas(text, text[]) from public, anon;
grant execute on function public.save_vendor_profile(jsonb), public.submit_vendor_application(public.vendor_capability[]), public.ensure_legacy_vendor(), public.request_vendor_capability(public.vendor_capability),
  public.admin_review_vendor(uuid, text, text), public.admin_review_capability(uuid, public.vendor_capability, text, text),
  public.register_vendor_document(bigint, text, text, text), public.delete_vendor_document(uuid), public.admin_review_vendor_document(uuid, text, text),
  public.set_vendor_service_areas(text, text[]) to authenticated;

-- ---------------------------------------------------------------- storage: private bucket for verification documents (Supabase only)
do $storage$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema not present - skipping vendor-documents bucket';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('vendor-documents', 'vendor-documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  -- Object paths are "<vendor id>/<file>". Only that vendor (or an admin, read-only) can touch them; there is no public access at all.
  execute $p$
    create policy "vendors upload own documents" on storage.objects for insert to authenticated
      with check (bucket_id = 'vendor-documents' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
                  and public.is_vendor_member(((storage.foldername(name))[1])::uuid))
  $p$;
  execute $p$
    create policy "vendors read own documents, admins read all" on storage.objects for select to authenticated
      using (bucket_id = 'vendor-documents' and (public.is_admin()
             or ((storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.is_vendor_member(((storage.foldername(name))[1])::uuid))))
  $p$;
  execute $p$
    create policy "vendors delete own documents" on storage.objects for delete to authenticated
      using (bucket_id = 'vendor-documents' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
             and public.is_vendor_member(((storage.foldername(name))[1])::uuid))
  $p$;
end
$storage$;
