-- Hasiru Nidhi marketplace - M5: services marketplace (Phase 6). ADDITIVE: no existing table or function is changed.
-- Apply AFTER 20261122000100_cart_and_orders.sql.
--
--  * Admin-managed service categories. Gardening is the first (reference data, NOT a provider).
--  * Provider-owned service listings: FIXED-PRICE (price x quantity, per visit / hour / sq ft ...) or QUOTATION-BASED (no price on the listing).
--    No deposits in this release. Payment is not configured: every request reads UNPAID, never paid.
--  * Providers need the vendor 'services' capability (M1). Listing approval is a SEPARATE admin decision from provider approval; editing an
--    approved listing sends it back for review.
--  * Requests -> (quotation) -> acceptance -> appointment -> in progress -> completed. Every transition is a function that re-checks who is
--    calling and what state the request is in. The status log is append-only.
--  * The provider sees the area, property type and details from the start, but the customer's phone and street address only once the
--    request is accepted (the same rule as order shipping details).
--  * Availability: weekly windows + time off + booked appointments, evaluated in Asia/Kolkata. Overlaps are refused under a provider row lock.
--  * The existing gardening enquiry form and every historical enquiry (gardening_enquiries) are untouched.
--  * Reviews, commission and settlements are NOT part of this migration.

create type public.service_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'suspended', 'archived');
create type public.service_pricing_model as enum ('fixed', 'quote');
create type public.service_request_status as enum ('submitted', 'quoted', 'accepted', 'in_progress', 'completed', 'declined', 'cancelled');
create type public.quotation_status as enum ('sent', 'accepted', 'declined', 'superseded');
create type public.appointment_status as enum ('confirmed', 'cancelled', 'completed');

-- ---------------------------------------------------------------- categories (admin managed)
create table public.service_categories (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint service_categories_slug check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60 and slug <> 'all'),
  constraint service_categories_lens check (char_length(name) between 2 and 80 and coalesce(char_length(description), 0) <= 400)
);
insert into public.service_categories (slug, name, description, sort_order) values
  ('gardening', 'Gardening', 'Garden design, planting, lawn and plant care, and garden maintenance.', 10);

create trigger service_categories_slug_immutable before update on public.service_categories for each row execute function public.product_categories_slug_immutable();
create trigger audit_service_categories after insert or update or delete on public.service_categories for each row execute function public.audit_admin_change();

-- ---------------------------------------------------------------- listings
create table public.services (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  category_id bigint not null references public.service_categories (id) on delete restrict,
  slug text not null unique,
  name text not null,
  summary text,
  description text not null default '',
  pricing_model public.service_pricing_model not null default 'quote',
  price_inr numeric(10, 2),                              -- fixed-price only; NULL for quotation-based
  price_unit text,                                       -- fixed-price only
  duration_minutes int not null default 60,              -- length of one visit; the unit for availability slots
  attributes jsonb not null default '[]'::jsonb,         -- what is included / how it works: [{label, value}], validated
  status public.service_status not null default 'draft',
  rejection_reason text,
  is_available boolean not null default true,            -- the provider can pause bookings without losing the listing
  is_featured boolean not null default false,            -- admin only
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_name_len check (char_length(name) between 3 and 120),
  constraint services_summary_len check (summary is null or char_length(summary) <= 240),
  constraint services_desc_len check (char_length(description) <= 8000),
  constraint services_attributes check (jsonb_typeof(attributes) = 'array' and jsonb_array_length(attributes) <= 20 and pg_column_size(attributes) <= 8192),
  constraint services_duration check (duration_minutes between 15 and 480),
  constraint services_price_unit check (price_unit is null or price_unit in ('visit', 'hour', 'day', 'sq_ft', 'plant', 'session', 'job')),
  constraint services_pricing check (
    (pricing_model = 'fixed' and price_inr is not null and price_inr > 0 and price_inr <= 10000000 and price_unit is not null)
    or (pricing_model = 'quote' and price_inr is null and price_unit is null))
);
create index services_vendor_idx on public.services (vendor_id, status);
create index services_category_idx on public.services (category_id) where status = 'approved';
create index services_status_idx on public.services (status);
create trigger services_touch before update on public.services for each row execute function public.touch_updated_at();

create table public.service_images (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  path text not null unique,
  alt text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint service_images_lens check (char_length(path) <= 300 and coalesce(char_length(alt), 0) <= 200)
);
create index service_images_service_idx on public.service_images (service_id, sort_order);

-- ---------------------------------------------------------------- availability (provider level, Asia/Kolkata)
create table public.service_availability_rules (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),          -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  constraint service_availability_window check (end_time > start_time)
);
create index service_availability_vendor_idx on public.service_availability_rules (vendor_id, weekday);

create table public.service_time_off (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  note text,
  created_at timestamptz not null default now(),
  constraint service_time_off_range check (ends_on >= starts_on and ends_on - starts_on <= 366),
  constraint service_time_off_note check (note is null or char_length(note) <= 200)
);
create index service_time_off_vendor_idx on public.service_time_off (vendor_id, starts_on);

-- ---------------------------------------------------------------- requests
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  category_id bigint not null references public.service_categories (id) on delete restrict,
  idempotency_key text not null,
  -- snapshot of the listing at request time (a later edit never rewrites what the customer asked for)
  vendor_name text not null,
  service_name text not null,
  pricing_model public.service_pricing_model not null,
  unit_price_inr numeric(10, 2),
  price_unit text,
  quantity int not null default 1 check (quantity between 1 and 1000),
  agreed_total_inr numeric(12, 2),                       -- fixed: price x quantity at request time; quote: the accepted quotation
  duration_minutes int not null,
  status public.service_request_status not null default 'submitted',
  payment_status public.order_payment_status not null default 'unpaid',   -- only 'unpaid' is ever written in this release
  -- coarse site information the provider may see from the start
  customer_name text not null,
  site_city text not null,
  site_pin text not null,
  property_type text,
  site_size text,
  details text,
  preferred_start timestamptz,
  decline_reason text,
  cancel_reason text,
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_requests_pin check (site_pin ~ '^[0-9]{6}$'),
  constraint service_requests_lens check (
    char_length(customer_name) between 2 and 120 and char_length(site_city) between 2 and 120 and coalesce(char_length(property_type), 0) <= 80
    and coalesce(char_length(site_size), 0) <= 80 and coalesce(char_length(details), 0) <= 4000 and coalesce(char_length(decline_reason), 0) <= 1000
    and coalesce(char_length(cancel_reason), 0) <= 1000),
  constraint service_requests_money check (
    (pricing_model = 'fixed' and unit_price_inr is not null and price_unit is not null)
    or (pricing_model = 'quote' and unit_price_inr is null and price_unit is null))
);
create unique index service_requests_idem on public.service_requests (customer_id, idempotency_key);
create index service_requests_vendor_idx on public.service_requests (vendor_id, status, created_at desc);
create index service_requests_customer_idx on public.service_requests (customer_id, created_at desc);
-- A customer has at most one open request per listing: no accidental duplicates, no request spam against one provider.
create unique index service_requests_one_open on public.service_requests (customer_id, service_id) where status in ('submitted', 'quoted', 'accepted', 'in_progress');
create trigger service_requests_touch before update on public.service_requests for each row execute function public.touch_updated_at();

-- Phone and street address: visible to the provider only once the request is accepted (see policy).
create table public.service_request_contact (
  request_id uuid primary key references public.service_requests (id) on delete restrict,
  phone text not null,
  address_line text not null,
  constraint service_request_contact_lens check (char_length(phone) between 7 and 20 and char_length(address_line) between 3 and 300)
);

create table public.service_quotations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  version int not null,
  amount_inr numeric(12, 2) not null check (amount_inr > 0 and amount_inr <= 100000000),
  description text not null check (char_length(description) between 10 and 4000),
  valid_until date not null,
  proposed_start timestamptz,
  proposed_duration_minutes int check (proposed_duration_minutes is null or proposed_duration_minutes between 15 and 720),
  status public.quotation_status not null default 'sent',
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, version)
);
create unique index service_quotations_one_live on public.service_quotations (request_id) where status = 'sent';
create index service_quotations_request_idx on public.service_quotations (request_id, version);

create table public.service_appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_appointments_range check (ends_at > starts_at and ends_at - starts_at <= interval '12 hours')
);
create unique index service_appointments_one_live on public.service_appointments (request_id) where status = 'confirmed';
create index service_appointments_vendor_idx on public.service_appointments (vendor_id, starts_at) where status = 'confirmed';
create trigger service_appointments_touch before update on public.service_appointments for each row execute function public.touch_updated_at();

create table public.service_request_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.service_requests (id) on delete restrict,
  from_status public.service_request_status,
  to_status public.service_request_status not null,
  actor_id uuid,
  actor_kind text not null check (actor_kind in ('customer', 'provider', 'admin', 'system')),
  note text,
  created_at timestamptz not null default now()
);
create index service_request_history_idx on public.service_request_history (request_id, id);
create function public.service_history_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'service_history_is_append_only' using errcode = 'P0001';
end $$;
create trigger service_history_append_only before update or delete on public.service_request_history for each row execute function public.service_history_append_only();

-- ---------------------------------------------------------------- guards
-- Who, what and how much a request is for never changes after it is made, and a request only moves along the allowed paths.
create function public.service_requests_guard() returns trigger language plpgsql as $$
begin
  if new.customer_id is distinct from old.customer_id or new.vendor_id is distinct from old.vendor_id or new.service_id is distinct from old.service_id
     or new.pricing_model is distinct from old.pricing_model or new.unit_price_inr is distinct from old.unit_price_inr or new.quantity is distinct from old.quantity
     or new.request_number is distinct from old.request_number or new.service_name is distinct from old.service_name then
    raise exception 'service_request_is_immutable' using errcode = 'P0001';
  end if;
  if new.status is distinct from old.status and not (
       (old.status = 'submitted' and new.status in ('quoted', 'accepted', 'declined', 'cancelled'))
    or (old.status = 'quoted' and new.status in ('submitted', 'accepted', 'declined', 'cancelled'))
    or (old.status = 'accepted' and new.status in ('in_progress', 'completed', 'cancelled'))
    or (old.status = 'in_progress' and new.status in ('completed', 'cancelled'))) then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if new.payment_status <> 'unpaid' then raise exception 'payment_not_configured' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger service_requests_guard before update on public.service_requests for each row execute function public.service_requests_guard();

create function public.service_quotations_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'quotations_are_immutable' using errcode = 'P0001'; end if;
  if new.request_id is distinct from old.request_id or new.vendor_id is distinct from old.vendor_id or new.version is distinct from old.version
     or new.amount_inr is distinct from old.amount_inr or new.description is distinct from old.description or new.valid_until is distinct from old.valid_until
     or new.proposed_start is distinct from old.proposed_start then
    raise exception 'quotations_are_immutable' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger service_quotations_guard before update or delete on public.service_quotations for each row execute function public.service_quotations_guard();

-- Status history, written by the database so no code path can forget it.
create function public.record_service_status() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_kind text;
  v_note text := nullif(current_setting('hn.status_note', true), '');
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return null; end if;
  v_kind := case when auth.uid() is null then 'system' when auth.uid() = new.customer_id then 'customer' when public.is_vendor_member(new.vendor_id) then 'provider'
                 when public.is_admin() then 'admin' else 'system' end;
  insert into public.service_request_history (request_id, from_status, to_status, actor_id, actor_kind, note)
  values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid(), v_kind, v_note);
  return null;
end $$;
create trigger service_requests_history after insert or update of status on public.service_requests for each row execute function public.record_service_status();

-- ---------------------------------------------------------------- helpers
create function public.services_enabled() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.setting_bool('marketplace_services_enabled', false)
$$;

-- A visitor may see a listing only while: module ON, listing approved, category active, provider verified with the services capability.
create function public.service_is_public(p_service uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.services_enabled() and exists (
    select 1 from public.services s join public.service_categories c on c.id = s.category_id
     where s.id = p_service and s.status = 'approved' and c.is_active and public.vendor_can(s.vendor_id, 'services')
  )
$$;

create function public.service_note(p_note text) returns void language sql as $$
  select set_config('hn.status_note', coalesce(p_note, ''), true)
$$;

create function public.service_slug(p_name text) returns text
language plpgsql volatile set search_path = public, pg_temp as $$
declare
  v_base text := trim(both '-' from lower(regexp_replace(coalesce(p_name, ''), '[^a-zA-Z0-9]+', '-', 'g')));
  v_slug text;
begin
  if v_base = '' then v_base := 'service'; end if;
  v_base := left(v_base, 50);
  loop
    v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    exit when not exists (select 1 from public.services where slug = v_slug);
  end loop;
  return v_slug;
end $$;

-- The caller's vendor, only if it may provide services right now.
create function public.my_service_vendor() returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select id into v_id from public.vendors where owner_id = auth.uid();
  if v_id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  if not public.vendor_can(v_id, 'services') then raise exception 'capability_not_approved' using errcode = 'P0001'; end if;
  return v_id;
end $$;

-- Can this provider take this slot? Not in time off, not overlapping a confirmed appointment, and (when the provider has published weekly
-- windows) inside one of them. p_exclude lets a reschedule ignore the request's own appointment.
create function public.slot_is_open(p_vendor uuid, p_start timestamptz, p_end timestamptz, p_exclude uuid default null) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_ls timestamp := p_start at time zone 'Asia/Kolkata';
  v_le timestamp := p_end at time zone 'Asia/Kolkata';
begin
  if p_end <= p_start or p_start <= now() then return false; end if;
  if exists (select 1 from public.service_time_off t where t.vendor_id = p_vendor and v_ls::date <= t.ends_on and v_le::date >= t.starts_on) then return false; end if;
  if exists (select 1 from public.service_appointments a where a.vendor_id = p_vendor and a.status = 'confirmed' and a.request_id is distinct from p_exclude
              and a.starts_at < p_end and a.ends_at > p_start) then return false; end if;
  if exists (select 1 from public.service_availability_rules r where r.vendor_id = p_vendor) then
    return v_ls::date = v_le::date and exists (
      select 1 from public.service_availability_rules r
       where r.vendor_id = p_vendor and r.weekday = extract(dow from v_ls)::int and r.start_time <= v_ls::time and r.end_time >= v_le::time);
  end if;
  return true;
end $$;

-- Locks the provider, then the request (always in that order, so two actions on one provider can never deadlock).
create function public.service_request_lock(p_request uuid) returns public.service_requests
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.service_requests%rowtype;
  v_vendor uuid;
begin
  select vendor_id into v_vendor from public.service_requests where id = p_request;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform 1 from public.vendors where id = v_vendor for update;
  select * into r from public.service_requests where id = p_request for update;
  return r;
end $$;

create function public.valid_service_attributes(j jsonb) returns boolean
language plpgsql immutable as $$
declare e jsonb;
begin
  if jsonb_typeof(j) <> 'array' or jsonb_array_length(j) > 20 then return false; end if;
  for e in select * from jsonb_array_elements(j) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'label') <> 'string' or jsonb_typeof(e -> 'value') <> 'string'
       or char_length(btrim(e ->> 'label')) not between 1 and 60 or char_length(btrim(e ->> 'value')) not between 1 and 200 then
      return false;
    end if;
  end loop;
  return true;
end $$;

create function public.service_request_number() returns text
language plpgsql volatile set search_path = public, pg_temp as $$
declare v text;
begin
  loop
    v := 'SR-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (select 1 from public.service_requests where request_number = v);
  end loop;
  return v;
end $$;

-- ---------------------------------------------------------------- row level security
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.service_images enable row level security;
alter table public.service_availability_rules enable row level security;
alter table public.service_time_off enable row level security;
alter table public.service_requests enable row level security;
alter table public.service_request_contact enable row level security;
alter table public.service_quotations enable row level security;
alter table public.service_appointments enable row level security;
alter table public.service_request_history enable row level security;

create policy service_categories_read on public.service_categories for select to anon, authenticated using (is_active or public.is_admin());
create policy service_categories_admin on public.service_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy services_select on public.services for select to authenticated using (public.is_vendor_member(vendor_id) or public.is_admin());
create policy service_images_select on public.service_images for select to authenticated
  using (exists (select 1 from public.services s where s.id = service_id and (public.is_vendor_member(s.vendor_id) or public.is_admin())));
create policy service_availability_select on public.service_availability_rules for select to authenticated using (public.is_vendor_member(vendor_id) or public.is_admin());
create policy service_time_off_select on public.service_time_off for select to authenticated using (public.is_vendor_member(vendor_id) or public.is_admin());

create policy service_requests_select on public.service_requests for select to authenticated
  using (customer_id = auth.uid() or public.is_vendor_member(vendor_id) or public.is_admin());
create policy service_request_contact_select on public.service_request_contact for select to authenticated using (exists (
  select 1 from public.service_requests r where r.id = request_id and (r.customer_id = auth.uid() or public.is_admin()
    or (public.is_vendor_member(r.vendor_id) and r.status in ('accepted', 'in_progress', 'completed')))));
-- Children are visible whenever their request is (the request's own policy decides who that is).
create policy service_quotations_select on public.service_quotations for select to authenticated using (exists (select 1 from public.service_requests r where r.id = request_id));
create policy service_appointments_select on public.service_appointments for select to authenticated using (exists (select 1 from public.service_requests r where r.id = request_id));
create policy service_history_select on public.service_request_history for select to authenticated using (exists (select 1 from public.service_requests r where r.id = request_id));

revoke insert, update, delete on public.services, public.service_images, public.service_availability_rules, public.service_time_off, public.service_requests,
  public.service_request_contact, public.service_quotations, public.service_appointments, public.service_request_history from anon, authenticated;
revoke all on public.services, public.service_images, public.service_availability_rules, public.service_time_off, public.service_requests,
  public.service_request_contact, public.service_quotations, public.service_appointments, public.service_request_history from anon;
revoke insert, update, delete on public.service_categories from anon;

-- ---------------------------------------------------------------- provider functions: listings
create function public.save_service(p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_service_vendor();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_cat bigint := nullif(p ->> 'category_id', '')::bigint;
  v_name text := public.vendor_text(p, 'name', 120);
  v_attr jsonb := coalesce(p -> 'attributes', '[]'::jsonb);
  v_model public.service_pricing_model;
  v_price numeric;
  v_unit text := public.vendor_text(p, 'price_unit', 20);
  v_dur int := coalesce(nullif(p ->> 'duration_minutes', '')::int, 60);
  sv public.services%rowtype;
  v_changed boolean;
begin
  if v_name is null or char_length(v_name) < 3 then raise exception 'name_required' using errcode = 'P0001'; end if;
  if v_cat is null or not exists (select 1 from public.service_categories where id = v_cat and is_active) then raise exception 'invalid_category' using errcode = 'P0001'; end if;
  if not public.valid_service_attributes(v_attr) then raise exception 'invalid_attributes' using errcode = 'P0001'; end if;
  v_attr := (select coalesce(jsonb_agg(jsonb_build_object('label', btrim(e ->> 'label'), 'value', btrim(e ->> 'value'))), '[]'::jsonb) from jsonb_array_elements(v_attr) e);
  if coalesce(p ->> 'pricing_model', '') not in ('fixed', 'quote') then raise exception 'invalid_pricing' using errcode = 'P0001'; end if;
  v_model := (p ->> 'pricing_model')::public.service_pricing_model;
  if v_dur not between 15 and 480 then raise exception 'invalid_duration' using errcode = 'P0001'; end if;
  if v_model = 'fixed' then
    begin v_price := nullif(p ->> 'price_inr', '')::numeric; exception when others then raise exception 'invalid_price' using errcode = 'P0001'; end;
    if v_price is null or v_price <= 0 or v_price > 10000000 or scale(v_price) > 2 then raise exception 'invalid_price' using errcode = 'P0001'; end if;
    if v_unit is null or v_unit not in ('visit', 'hour', 'day', 'sq_ft', 'plant', 'session', 'job') then raise exception 'invalid_price_unit' using errcode = 'P0001'; end if;
  else
    v_price := null; v_unit := null;
  end if;

  if v_id is null then
    insert into public.services (vendor_id, category_id, slug, name, summary, description, pricing_model, price_inr, price_unit, duration_minutes, attributes)
    values (v_vendor, v_cat, public.service_slug(v_name), v_name, public.vendor_text(p, 'summary', 240), coalesce(public.vendor_text(p, 'description', 8000), ''),
            v_model, v_price, v_unit, v_dur, v_attr)
    returning id into v_id;
    perform public.write_audit('service_created', 'service', v_id::text, jsonb_build_object('vendor', v_vendor));
    return v_id;
  end if;

  select * into sv from public.services where id = v_id and vendor_id = v_vendor for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if sv.status = 'pending_review' then raise exception 'service_locked_in_review' using errcode = 'P0001'; end if;
  if sv.status in ('suspended', 'archived') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  v_changed := sv.name is distinct from v_name or sv.category_id is distinct from v_cat or sv.summary is distinct from public.vendor_text(p, 'summary', 240)
    or sv.description is distinct from coalesce(public.vendor_text(p, 'description', 8000), '') or sv.pricing_model is distinct from v_model
    or sv.price_inr is distinct from v_price or sv.price_unit is distinct from v_unit or sv.duration_minutes is distinct from v_dur or sv.attributes is distinct from v_attr;
  update public.services set name = v_name, category_id = v_cat, summary = public.vendor_text(p, 'summary', 240),
         description = coalesce(public.vendor_text(p, 'description', 8000), ''), pricing_model = v_model, price_inr = v_price, price_unit = v_unit,
         duration_minutes = v_dur, attributes = v_attr,
         -- A live listing whose content changed is taken down until an administrator approves the new version.
         status = case when sv.status = 'approved' and v_changed then 'pending_review' else sv.status end,
         submitted_at = case when sv.status = 'approved' and v_changed then now() else submitted_at end
   where id = v_id;
  if sv.status = 'approved' and v_changed then
    perform public.write_audit('service_resubmitted', 'service', v_id::text, '{}'::jsonb);
    perform public.notify_admins('service_submitted', 'Service edited and awaiting review', v_name || ' was changed and needs review before it is public again.', '/admin/services/' || v_id);
  end if;
  return v_id;
end $$;

create function public.register_service_image(p_service uuid, p_path text, p_alt text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_service_vendor();
  sv public.services%rowtype;
  v_id uuid;
begin
  select * into sv from public.services where id = p_service and vendor_id = v_vendor for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if sv.status not in ('draft', 'rejected', 'approved') then raise exception 'service_locked' using errcode = 'P0001'; end if;
  if p_path is null or p_path not like v_vendor::text || '/' || p_service::text || '/%' or char_length(p_path) > 300 or p_path like '%..%' then raise exception 'forbidden' using errcode = '42501'; end if;
  if (select count(*) from public.service_images where service_id = p_service) >= 10 then raise exception 'too_many_images' using errcode = 'P0001'; end if;
  insert into public.service_images (service_id, path, alt, sort_order)
  values (p_service, p_path, left(btrim(p_alt), 200), (select coalesce(max(sort_order), 0) + 10 from public.service_images where service_id = p_service))
  returning id into v_id;
  if sv.status = 'approved' then
    update public.services set status = 'pending_review', submitted_at = now() where id = p_service;
    perform public.notify_admins('service_submitted', 'Service edited and awaiting review', sv.name || ' has new photos and needs review before it is public again.', '/admin/services/' || p_service);
  end if;
  return v_id;
end $$;

create function public.delete_service_image(p_image uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_service_vendor();
  i public.service_images%rowtype;
  sv public.services%rowtype;
begin
  select i2.* into i from public.service_images i2 join public.services s on s.id = i2.service_id where i2.id = p_image and s.vendor_id = v_vendor for update of i2;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  select * into sv from public.services where id = i.service_id for update;
  if sv.status not in ('draft', 'rejected', 'approved') then raise exception 'service_locked' using errcode = 'P0001'; end if;
  if sv.status = 'approved' and (select count(*) from public.service_images where service_id = sv.id) <= 1 then raise exception 'last_image' using errcode = 'P0001'; end if;
  delete from public.service_images where id = i.id;
  if sv.status = 'approved' then
    update public.services set status = 'pending_review', submitted_at = now() where id = sv.id;
    perform public.notify_admins('service_submitted', 'Service edited and awaiting review', sv.name || ' had a photo removed and needs review before it is public again.', '/admin/services/' || sv.id);
  end if;
  return i.path;
end $$;

create function public.reorder_service_images(p_service uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_service_vendor();
  sv public.services%rowtype;
begin
  select * into sv from public.services where id = p_service and vendor_id = v_vendor for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if sv.status not in ('draft', 'rejected', 'approved') then raise exception 'service_locked' using errcode = 'P0001'; end if;
  if (select count(*) from public.service_images where service_id = p_service) <> coalesce(cardinality(p_ids), 0)
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.service_images where id = x and service_id = p_service)) then
    raise exception 'invalid_order' using errcode = 'P0001';
  end if;
  update public.service_images i set sort_order = o.ord * 10 from unnest(p_ids) with ordinality as o(id, ord) where i.id = o.id;
end $$;

create function public.set_service_availability_flag(p_service uuid, p_available boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_vendor uuid := public.my_service_vendor();
begin
  update public.services set is_available = p_available where id = p_service and vendor_id = v_vendor;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
end $$;

create function public.service_missing_items(p_service uuid) returns text[]
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  sv public.services%rowtype;
  v_missing text[] := '{}';
begin
  select * into sv from public.services where id = p_service;
  if not found then return array['service']; end if;
  if char_length(sv.name) < 3 then v_missing := array_append(v_missing, 'name'); end if;
  if char_length(btrim(sv.description)) < 30 then v_missing := array_append(v_missing, 'description'); end if;
  if not exists (select 1 from public.service_images where service_id = sv.id) then v_missing := array_append(v_missing, 'images'); end if;
  -- Coverage is mandatory: without service areas nobody could ever request the service.
  if not exists (select 1 from public.vendor_service_areas where vendor_id = sv.vendor_id and scope = 'service') then v_missing := array_append(v_missing, 'service_areas'); end if;
  return v_missing;
end $$;

create function public.submit_service(p_service uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_service_vendor();
  sv public.services%rowtype;
  v_missing text[];
begin
  select * into sv from public.services where id = p_service and vendor_id = v_vendor for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if sv.status not in ('draft', 'rejected') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  v_missing := public.service_missing_items(p_service);
  if cardinality(v_missing) > 0 then raise exception 'incomplete_service: %', array_to_string(v_missing, ',') using errcode = 'P0001'; end if;
  update public.services set status = 'pending_review', submitted_at = now(), rejection_reason = null where id = p_service;
  perform public.write_audit('service_submitted', 'service', p_service::text, '{}'::jsonb);
  perform public.notify_admins('service_submitted', 'Service awaiting review', sv.name || ' was submitted for review.', '/admin/services/' || p_service);
end $$;

create function public.archive_service(p_service uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_vendor uuid := public.my_service_vendor();
begin
  update public.services set status = 'archived' where id = p_service and vendor_id = v_vendor and status in ('draft', 'rejected', 'approved', 'pending_review');
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform public.write_audit('service_archived', 'service', p_service::text, '{}'::jsonb);
end $$;

create function public.restore_service(p_service uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_vendor uuid := public.my_service_vendor();
begin
  update public.services set status = 'draft', published_at = null where id = p_service and vendor_id = v_vendor and status = 'archived';
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform public.write_audit('service_restored', 'service', p_service::text, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------- provider functions: availability
-- Replaces the weekly windows. p_rules: [{weekday 0-6, start 'HH:MM', end 'HH:MM'}]. An empty list means "no published hours" (any time can be offered).
create function public.set_service_availability(p_rules jsonb) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_service_vendor();
  e jsonb;
  v_n int := 0;
  v_start time;
  v_end time;
  v_day int;
begin
  if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) > 28 then raise exception 'invalid_availability' using errcode = 'P0001'; end if;
  perform 1 from public.vendors where id = v_vendor for update;
  delete from public.service_availability_rules where vendor_id = v_vendor;
  for e in select * from jsonb_array_elements(p_rules) loop
    begin
      v_day := (e ->> 'weekday')::int; v_start := (e ->> 'start')::time; v_end := (e ->> 'end')::time;
    exception when others then raise exception 'invalid_availability' using errcode = 'P0001';
    end;
    if v_day not between 0 and 6 or v_end <= v_start then raise exception 'invalid_availability' using errcode = 'P0001'; end if;
    if exists (select 1 from public.service_availability_rules where vendor_id = v_vendor and weekday = v_day and start_time < v_end and end_time > v_start) then
      raise exception 'overlapping_availability' using errcode = 'P0001';
    end if;
    insert into public.service_availability_rules (vendor_id, weekday, start_time, end_time) values (v_vendor, v_day, v_start, v_end);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create function public.add_service_time_off(p_start date, p_end date, p_note text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_service_vendor();
  v_id uuid;
begin
  if p_start is null or p_end is null or p_end < p_start or p_end - p_start > 366 or p_end < (now() at time zone 'Asia/Kolkata')::date then raise exception 'invalid_dates' using errcode = 'P0001'; end if;
  if (select count(*) from public.service_time_off where vendor_id = v_vendor and ends_on >= (now() at time zone 'Asia/Kolkata')::date) >= 50 then raise exception 'too_many_items' using errcode = 'P0001'; end if;
  insert into public.service_time_off (vendor_id, starts_on, ends_on, note) values (v_vendor, p_start, p_end, left(btrim(p_note), 200)) returning id into v_id;
  return v_id;
end $$;

create function public.delete_service_time_off(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_vendor uuid := public.my_service_vendor();
begin
  delete from public.service_time_off where id = p_id and vendor_id = v_vendor;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
end $$;

-- ---------------------------------------------------------------- customer functions
-- p: {service_id, quantity, customer_name, phone, address_line, city, pin, property_type, site_size, details, preferred_start}
create function public.request_service(p jsonb, p_key text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v_existing uuid;
  sv public.services%rowtype;
  vd public.vendors%rowtype;
  v_qty int := coalesce(nullif(p ->> 'quantity', '')::int, 1);
  v_pin text := public.vendor_text(p, 'pin', 6);
  v_name text := public.vendor_text(p, 'customer_name', 120);
  v_phone text := public.vendor_text(p, 'phone', 20);
  v_addr text := public.vendor_text(p, 'address_line', 300);
  v_city text := public.vendor_text(p, 'city', 120);
  v_details text := public.vendor_text(p, 'details', 4000);
  v_pref timestamptz := nullif(p ->> 'preferred_start', '')::timestamptz;
  v_total numeric;
  v_id uuid := gen_random_uuid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_prof from public.profiles where id = v_uid;
  if not found or v_prof.is_suspended or v_prof.role = 'admin' then raise exception 'account_suspended' using errcode = '42501'; end if;
  if not public.services_enabled() then raise exception 'services_closed' using errcode = 'P0001'; end if;
  if p_key is null or char_length(p_key) < 8 or char_length(p_key) > 80 then raise exception 'invalid_key' using errcode = 'P0001'; end if;

  -- A repeated submission (double click, retry, refresh) returns the request that already exists.
  select id into v_existing from public.service_requests where customer_id = v_uid and idempotency_key = p_key;
  if found then return v_existing; end if;

  select * into sv from public.services where id = nullif(p ->> 'service_id', '')::uuid;
  if not found or not public.service_is_public(sv.id) then raise exception 'not_found' using errcode = 'P0001'; end if;
  if not sv.is_available then raise exception 'service_unavailable' using errcode = 'P0001'; end if;
  select * into vd from public.vendors where id = sv.vendor_id;
  if vd.owner_id = v_uid then raise exception 'own_service' using errcode = 'P0001'; end if;

  if v_name is null or char_length(v_name) < 2 then raise exception 'name_required' using errcode = 'P0001'; end if;
  if v_phone is null or v_phone !~ '^[0-9+() -]{7,20}$' then raise exception 'invalid_phone' using errcode = 'P0001'; end if;
  if v_addr is null or char_length(v_addr) < 3 or v_city is null or char_length(v_city) < 2 then raise exception 'address_incomplete' using errcode = 'P0001'; end if;
  if v_pin is null or v_pin !~ '^[0-9]{6}$' then raise exception 'invalid_pin' using errcode = 'P0001'; end if;
  if not public.vendor_covers_pin(sv.vendor_id, 'service', v_pin) then raise exception 'outside_service_area' using errcode = 'P0001'; end if;
  if sv.pricing_model = 'quote' and (v_details is null or char_length(v_details) < 10) then raise exception 'details_required' using errcode = 'P0001'; end if;
  if sv.pricing_model = 'fixed' and v_qty not between 1 and 1000 then raise exception 'invalid_quantity' using errcode = 'P0001'; end if;
  if sv.pricing_model = 'quote' then v_qty := 1; end if;
  if v_pref is not null and v_pref <= now() then raise exception 'invalid_slot' using errcode = 'P0001'; end if;
  if v_pref is not null and not public.slot_is_open(sv.vendor_id, v_pref, v_pref + make_interval(mins => sv.duration_minutes)) then raise exception 'slot_unavailable' using errcode = 'P0001'; end if;
  if (select count(*) from public.service_requests where customer_id = v_uid and status in ('submitted', 'quoted', 'accepted', 'in_progress')) >= 20 then raise exception 'too_many_open_requests' using errcode = 'P0001'; end if;
  if exists (select 1 from public.service_requests where customer_id = v_uid and service_id = sv.id and status in ('submitted', 'quoted', 'accepted', 'in_progress')) then raise exception 'duplicate_request' using errcode = 'P0001'; end if;

  v_total := case when sv.pricing_model = 'fixed' then sv.price_inr * v_qty end;
  perform public.service_note('Request submitted');
  insert into public.service_requests (id, request_number, customer_id, vendor_id, service_id, category_id, idempotency_key, vendor_name, service_name, pricing_model, unit_price_inr, price_unit,
                                       quantity, agreed_total_inr, duration_minutes, customer_name, site_city, site_pin, property_type, site_size, details, preferred_start)
  values (v_id, public.service_request_number(), v_uid, sv.vendor_id, sv.id, sv.category_id, p_key, vd.business_name, sv.name, sv.pricing_model, sv.price_inr, sv.price_unit,
          v_qty, v_total, sv.duration_minutes, v_name, v_city, v_pin, public.vendor_text(p, 'property_type', 80), public.vendor_text(p, 'site_size', 80), v_details, v_pref);
  insert into public.service_request_contact (request_id, phone, address_line) values (v_id, v_phone, v_addr);
  perform public.notify(vd.owner_id, 'service_request', 'New service request', sv.name || ' in ' || v_city || ' (' || v_pin || ').', '/vendor/service-requests/' || v_id);
  perform public.write_audit('service_requested', 'service_request', v_id::text, jsonb_build_object('service', sv.id, 'pricing', sv.pricing_model));
  return v_id;
end $$;

create function public.cancel_service_request(p_request uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.service_requests%rowtype;
begin
  r := public.service_request_lock(p_request);
  if r.customer_id is distinct from auth.uid() then raise exception 'not_found' using errcode = 'P0001'; end if;
  if r.status not in ('submitted', 'quoted', 'accepted') then raise exception 'cannot_cancel' using errcode = 'P0001'; end if;
  perform public.service_note(coalesce(nullif(btrim(p_reason), ''), 'Cancelled by the customer'));
  update public.service_requests set status = 'cancelled', cancel_reason = left(btrim(p_reason), 1000), cancelled_at = now() where id = r.id;
  update public.service_quotations set status = 'superseded', decided_at = now() where request_id = r.id and status = 'sent';
  update public.service_appointments set status = 'cancelled' where request_id = r.id and status = 'confirmed';
  perform public.notify((select owner_id from public.vendors where id = r.vendor_id), 'service_request', 'Request ' || r.request_number || ' cancelled', 'The customer cancelled this request.', '/vendor/service-requests/' || r.id);
  perform public.write_audit('service_request_cancelled', 'service_request', r.id::text, jsonb_build_object('by', 'customer'));
end $$;

-- accept | decline a live quotation. Accepting fixes the agreed total (and books the proposed slot, if it is still open).
create function public.decide_quotation(p_quotation uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  q public.service_quotations%rowtype;
  r public.service_requests%rowtype;
  v_dur int;
begin
  select request_id into r.id from public.service_quotations where id = p_quotation;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  r := public.service_request_lock(r.id);
  if r.customer_id is distinct from auth.uid() then raise exception 'not_found' using errcode = 'P0001'; end if;
  select * into q from public.service_quotations where id = p_quotation for update;
  if q.status <> 'sent' or r.status <> 'quoted' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if p_decision = 'accept' then
    if q.valid_until < (now() at time zone 'Asia/Kolkata')::date then raise exception 'quotation_expired' using errcode = 'P0001'; end if;
    if not public.vendor_can(r.vendor_id, 'services') then raise exception 'provider_unavailable' using errcode = 'P0001'; end if;
    v_dur := coalesce(q.proposed_duration_minutes, r.duration_minutes);
    if q.proposed_start is not null and not public.slot_is_open(r.vendor_id, q.proposed_start, q.proposed_start + make_interval(mins => v_dur), r.id) then
      raise exception 'slot_unavailable' using errcode = 'P0001';
    end if;
    update public.service_quotations set status = 'accepted', decided_at = now(), decision_note = left(btrim(p_note), 1000) where id = q.id;
    perform public.service_note('Quotation v' || q.version || ' accepted');
    update public.service_requests set status = 'accepted', agreed_total_inr = q.amount_inr, accepted_at = now() where id = r.id;
    if q.proposed_start is not null then
      insert into public.service_appointments (request_id, vendor_id, starts_at, ends_at) values (r.id, r.vendor_id, q.proposed_start, q.proposed_start + make_interval(mins => v_dur));
    end if;
    perform public.notify((select owner_id from public.vendors where id = r.vendor_id), 'service_request', 'Quotation accepted', 'Request ' || r.request_number || ' was accepted at the quoted amount.', '/vendor/service-requests/' || r.id);
  elsif p_decision = 'decline' then
    update public.service_quotations set status = 'declined', decided_at = now(), decision_note = left(btrim(p_note), 1000) where id = q.id;
    perform public.service_note('Quotation v' || q.version || ' declined' || coalesce(': ' || left(btrim(p_note), 200), ''));
    update public.service_requests set status = 'submitted' where id = r.id;
    perform public.notify((select owner_id from public.vendors where id = r.vendor_id), 'service_request', 'Quotation declined', 'Request ' || r.request_number || ': the customer declined the quotation.' || coalesce(' ' || left(btrim(p_note), 200), ''), '/vendor/service-requests/' || r.id);
  else
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  perform public.write_audit('quotation_' || p_decision, 'service_request', r.id::text, jsonb_build_object('version', q.version));
end $$;

-- ---------------------------------------------------------------- provider functions: requests
create function public.provider_request(p_request uuid) returns public.service_requests
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_service_vendor();
  r public.service_requests%rowtype;
begin
  r := public.service_request_lock(p_request);
  if r.vendor_id is distinct from v_vendor then raise exception 'not_found' using errcode = 'P0001'; end if;
  return r;
end $$;

-- accept (fixed-price only) | decline. Accepting a fixed-price request books the customer's preferred slot when there is one.
create function public.provider_respond_service_request(p_request uuid, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.service_requests%rowtype;
begin
  r := public.provider_request(p_request);
  if r.status not in ('submitted', 'quoted') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if p_decision = 'accept' then
    if r.pricing_model <> 'fixed' or r.status <> 'submitted' then raise exception 'quotation_required' using errcode = 'P0001'; end if;
    if r.preferred_start is not null and not public.slot_is_open(r.vendor_id, r.preferred_start, r.preferred_start + make_interval(mins => r.duration_minutes), r.id) then
      raise exception 'slot_unavailable' using errcode = 'P0001';
    end if;
    perform public.service_note(p_reason);
    update public.service_requests set status = 'accepted', accepted_at = now() where id = r.id;
    if r.preferred_start is not null then
      insert into public.service_appointments (request_id, vendor_id, starts_at, ends_at) values (r.id, r.vendor_id, r.preferred_start, r.preferred_start + make_interval(mins => r.duration_minutes));
    end if;
    perform public.notify(r.customer_id, 'service_request', 'Request ' || r.request_number || ' accepted', r.vendor_name || ' accepted your request. It is unpaid: payment is not configured yet.', '/dashboard/requests/' || r.id);
  elsif p_decision = 'decline' then
    if coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
    perform public.service_note(p_reason);
    update public.service_requests set status = 'declined', decline_reason = left(btrim(p_reason), 1000) where id = r.id;
    update public.service_quotations set status = 'superseded', decided_at = now() where request_id = r.id and status = 'sent';
    perform public.notify(r.customer_id, 'service_request', 'Request ' || r.request_number || ' declined', r.vendor_name || ' could not take this on: ' || left(p_reason, 200), '/dashboard/requests/' || r.id);
  else
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  perform public.write_audit('service_request_' || p_decision, 'service_request', r.id::text, jsonb_build_object('number', r.request_number));
end $$;

-- p: {amount_inr, description, valid_until (date), proposed_start (optional), proposed_duration_minutes (optional)}
create function public.provider_send_quotation(p_request uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.service_requests%rowtype;
  v_amount numeric;
  v_desc text := public.vendor_text(p, 'description', 4000);
  v_valid date;
  v_start timestamptz := nullif(p ->> 'proposed_start', '')::timestamptz;
  v_dur int := nullif(p ->> 'proposed_duration_minutes', '')::int;
  v_version int;
  v_id uuid;
begin
  r := public.provider_request(p_request);
  if r.pricing_model <> 'quote' then raise exception 'not_quotation_based' using errcode = 'P0001'; end if;
  if r.status not in ('submitted', 'quoted') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  begin v_amount := nullif(p ->> 'amount_inr', '')::numeric; v_valid := nullif(p ->> 'valid_until', '')::date;
  exception when others then raise exception 'invalid_quotation' using errcode = 'P0001'; end;
  if v_amount is null or v_amount <= 0 or v_amount > 100000000 or scale(v_amount) > 2 then raise exception 'invalid_price' using errcode = 'P0001'; end if;
  if v_desc is null or char_length(v_desc) < 10 then raise exception 'description_required' using errcode = 'P0001'; end if;
  if v_valid is null or v_valid < (now() at time zone 'Asia/Kolkata')::date or v_valid > (now() at time zone 'Asia/Kolkata')::date + 180 then raise exception 'invalid_validity' using errcode = 'P0001'; end if;
  if v_dur is not null and v_dur not between 15 and 720 then raise exception 'invalid_duration' using errcode = 'P0001'; end if;
  if v_start is not null and not public.slot_is_open(r.vendor_id, v_start, v_start + make_interval(mins => coalesce(v_dur, r.duration_minutes)), r.id) then raise exception 'slot_unavailable' using errcode = 'P0001'; end if;

  -- A revision supersedes the live quotation: only one is ever open for the customer to accept.
  update public.service_quotations set status = 'superseded', decided_at = now() where request_id = r.id and status = 'sent';
  select coalesce(max(version), 0) + 1 into v_version from public.service_quotations where request_id = r.id;
  insert into public.service_quotations (request_id, vendor_id, version, amount_inr, description, valid_until, proposed_start, proposed_duration_minutes)
  values (r.id, r.vendor_id, v_version, v_amount, v_desc, v_valid, v_start, v_dur) returning id into v_id;
  if r.status = 'submitted' then
    perform public.service_note('Quotation v' || v_version || ' sent');
    update public.service_requests set status = 'quoted' where id = r.id;
  end if;
  perform public.notify(r.customer_id, 'service_request', 'Quotation received', r.vendor_name || ' sent a quotation for ' || r.service_name || '. Review and accept it to go ahead.', '/dashboard/requests/' || r.id);
  perform public.write_audit('quotation_sent', 'service_request', r.id::text, jsonb_build_object('version', v_version));
  return v_id;
end $$;

-- Sets (or changes) the confirmed appointment of an accepted request.
create function public.provider_schedule_appointment(p_request uuid, p_start timestamptz, p_duration int default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.service_requests%rowtype;
  v_dur int;
  v_id uuid;
begin
  r := public.provider_request(p_request);
  if r.status not in ('accepted', 'in_progress') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  v_dur := coalesce(p_duration, r.duration_minutes);
  if v_dur not between 15 and 720 then raise exception 'invalid_duration' using errcode = 'P0001'; end if;
  if p_start is null or not public.slot_is_open(r.vendor_id, p_start, p_start + make_interval(mins => v_dur), r.id) then raise exception 'slot_unavailable' using errcode = 'P0001'; end if;
  update public.service_appointments set status = 'cancelled' where request_id = r.id and status = 'confirmed';
  insert into public.service_appointments (request_id, vendor_id, starts_at, ends_at) values (r.id, r.vendor_id, p_start, p_start + make_interval(mins => v_dur)) returning id into v_id;
  perform public.notify(r.customer_id, 'service_request', 'Appointment scheduled', r.vendor_name || ' scheduled your service for ' || to_char(p_start at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM') || ' (IST).', '/dashboard/requests/' || r.id);
  return v_id;
end $$;

create function public.provider_start_service(p_request uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.service_requests%rowtype;
begin
  r := public.provider_request(p_request);
  if r.status <> 'accepted' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  perform public.service_note('Work started');
  update public.service_requests set status = 'in_progress' where id = r.id;
  perform public.notify(r.customer_id, 'service_request', 'Service started', r.vendor_name || ' has started ' || r.service_name || '.', '/dashboard/requests/' || r.id);
end $$;

create function public.provider_complete_service(p_request uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.service_requests%rowtype;
begin
  r := public.provider_request(p_request);
  if r.status not in ('accepted', 'in_progress') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  perform public.service_note('Marked completed by the provider');
  update public.service_requests set status = 'completed', completed_at = now() where id = r.id;
  update public.service_appointments set status = 'completed' where request_id = r.id and status = 'confirmed';
  perform public.notify(r.customer_id, 'service_request', 'Service completed', r.vendor_name || ' marked ' || r.service_name || ' as completed. Payment is not configured yet: this request stays unpaid.', '/dashboard/requests/' || r.id);
  perform public.write_audit('service_completed', 'service_request', r.id::text, jsonb_build_object('number', r.request_number));
end $$;

create function public.provider_cancel_service_request(p_request uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.service_requests%rowtype;
begin
  r := public.provider_request(p_request);
  if r.status not in ('accepted', 'in_progress') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  perform public.service_note(p_reason);
  update public.service_requests set status = 'cancelled', cancel_reason = left(btrim(p_reason), 1000), cancelled_at = now() where id = r.id;
  update public.service_appointments set status = 'cancelled' where request_id = r.id and status = 'confirmed';
  perform public.notify(r.customer_id, 'service_request', 'Request ' || r.request_number || ' cancelled', r.vendor_name || ' cancelled this request: ' || left(btrim(p_reason), 200), '/dashboard/requests/' || r.id);
  perform public.notify_admins('service_request', 'Provider cancelled an accepted request', r.request_number || ' (' || r.vendor_name || ')', '/admin/service-requests/' || r.id);
  perform public.write_audit('service_request_cancelled', 'service_request', r.id::text, jsonb_build_object('by', 'provider'));
end $$;

-- ---------------------------------------------------------------- admin functions
create function public.admin_review_service(p_service uuid, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  sv public.services%rowtype;
  v_to public.service_status;
  v_missing text[];
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into sv from public.services where id = p_service for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_decision = 'approve' and sv.status = 'pending_review' then
    if not public.vendor_can(sv.vendor_id, 'services') then raise exception 'capability_not_approved' using errcode = 'P0001'; end if;
    v_missing := public.service_missing_items(p_service);
    if cardinality(v_missing) > 0 then raise exception 'incomplete_service: %', array_to_string(v_missing, ',') using errcode = 'P0001'; end if;
    v_to := 'approved';
  elsif p_decision = 'reject' and sv.status = 'pending_review' then v_to := 'rejected';
  elsif p_decision = 'request_changes' and sv.status = 'pending_review' then v_to := 'draft';
  elsif p_decision = 'suspend' and sv.status = 'approved' then v_to := 'suspended';
  elsif p_decision = 'reinstate' and sv.status = 'suspended' then v_to := 'approved';
  else raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if p_decision in ('reject', 'request_changes', 'suspend') and coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
  update public.services set status = v_to, reviewed_by = auth.uid(), reviewed_at = now(),
         rejection_reason = case when p_decision in ('reject', 'request_changes', 'suspend') then left(btrim(p_reason), 1000) else null end,
         published_at = case when v_to = 'approved' and published_at is null then now() else published_at end,
         is_featured = case when v_to = 'approved' then is_featured else false end
   where id = p_service;
  perform public.write_audit('service_' || p_decision, 'service', p_service::text, jsonb_build_object('from', sv.status, 'to', v_to, 'reason', p_reason));
  perform public.notify((select owner_id from public.vendors where id = sv.vendor_id), 'service_' || p_decision,
    case p_decision when 'approve' then 'Service approved' when 'reject' then 'Service rejected' when 'request_changes' then 'Changes requested'
                    when 'suspend' then 'Service suspended' else 'Service reinstated' end,
    sv.name || coalesce(': ' || left(p_reason, 300), '.'), '/vendor/services/' || p_service);
end $$;

create function public.admin_set_service_featured(p_service uuid, p_featured boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.services set is_featured = p_featured where id = p_service and status = 'approved';
  if not found then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  perform public.write_audit('service_featured', 'service', p_service::text, jsonb_build_object('featured', p_featured));
end $$;

create function public.admin_reorder_service_categories(p_ids bigint[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if (select count(*) from public.service_categories) <> coalesce(cardinality(p_ids), 0)
     or (select count(distinct x) from unnest(p_ids) x) <> coalesce(cardinality(p_ids), 0)
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.service_categories where id = x)) then
    raise exception 'invalid_order' using errcode = 'P0001';
  end if;
  update public.service_categories c set sort_order = o.ord * 10 from unnest(p_ids) with ordinality as o(id, ord) where c.id = o.id;
  perform public.write_audit('service_categories_reordered', 'service_categories', 'order', jsonb_build_object('ids', to_jsonb(p_ids)));
end $$;

-- Support action: an administrator can cancel any open request (for example a stuck or abusive one). A reason is mandatory and logged.
create function public.admin_cancel_service_request(p_request uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.service_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  r := public.service_request_lock(p_request);
  if r.status not in ('submitted', 'quoted', 'accepted', 'in_progress') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  perform public.service_note('Cancelled by an administrator: ' || left(btrim(p_reason), 300));
  update public.service_requests set status = 'cancelled', cancel_reason = left(btrim(p_reason), 1000), cancelled_at = now() where id = r.id;
  update public.service_quotations set status = 'superseded', decided_at = now() where request_id = r.id and status = 'sent';
  update public.service_appointments set status = 'cancelled' where request_id = r.id and status = 'confirmed';
  perform public.notify(r.customer_id, 'service_request', 'Request ' || r.request_number || ' cancelled', 'An administrator cancelled this request: ' || left(btrim(p_reason), 200), '/dashboard/requests/' || r.id);
  perform public.notify((select owner_id from public.vendors where id = r.vendor_id), 'service_request', 'Request ' || r.request_number || ' cancelled', 'An administrator cancelled this request.', '/vendor/service-requests/' || r.id);
  perform public.write_audit('admin_service_request_cancelled', 'service_request', r.id::text, jsonb_build_object('reason', p_reason));
end $$;

-- ---------------------------------------------------------------- public read functions (visitors never read the tables)
create function public.search_services(
  p_query text default null, p_category text default null, p_vendor text default null, p_pricing text default null, p_pin text default null,
  p_featured boolean default false, p_sort text default 'newest', p_limit int default 24, p_offset int default 0
) returns table (
  id uuid, slug text, name text, summary text, category_slug text, category_name text, vendor_slug text, vendor_name text, vendor_city text,
  pricing_model public.service_pricing_model, price_inr numeric, price_unit text, duration_minutes int, is_available boolean, is_featured boolean,
  cover_path text, cover_alt text, total_count bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  with q as (
    select nullif(btrim(coalesce(p_query, '')), '') as term, case when p_pin ~ '^[0-9]{6}$' then p_pin end as pin
  ), base as (
    select s.id, s.slug, s.name, s.summary, c.slug as cslug, c.name as cname, v.slug as vslug, v.business_name as vname, v.city as vcity, s.pricing_model as pm,
           s.price_inr as pr, s.price_unit as pu, s.duration_minutes as dur, s.is_available as av, s.is_featured as feat, s.published_at,
           (select i.path from public.service_images i where i.service_id = s.id order by i.sort_order, i.created_at limit 1) as cpath,
           (select i.alt from public.service_images i where i.service_id = s.id order by i.sort_order, i.created_at limit 1) as calt
      from public.services s
      join public.service_categories c on c.id = s.category_id
      join public.vendors v on v.id = s.vendor_id
      cross join q
     where public.services_enabled() and s.status = 'approved' and c.is_active and public.vendor_can(s.vendor_id, 'services')
       and (p_category is null or c.slug = p_category)
       and (p_vendor is null or v.slug = p_vendor)
       and (p_pricing is null or s.pricing_model::text = p_pricing)
       and (not p_featured or s.is_featured)
       and (q.pin is null or public.vendor_covers_pin(s.vendor_id, 'service', q.pin))
       and (q.term is null or s.name ilike '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
            or s.summary ilike '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
            or c.name ilike '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
            or v.business_name ilike '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\')
  )
  select b.id, b.slug, b.name, b.summary, b.cslug, b.cname, b.vslug, b.vname, b.vcity, b.pm, b.pr, b.pu, b.dur, b.av, b.feat, b.cpath, b.calt, count(*) over () as total_count
    from base b
   order by case when p_sort = 'price_asc' then b.pr end asc nulls last, case when p_sort = 'price_desc' then b.pr end desc nulls last,
            case when p_sort = 'name' then b.name end asc, b.feat desc, b.published_at desc nulls last, b.id
   limit least(greatest(coalesce(p_limit, 24), 1), 48) offset greatest(coalesce(p_offset, 0), 0)
$$;

create function public.get_service_public(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare sv public.services%rowtype;
begin
  select * into sv from public.services where slug = p_slug;
  if not found or not public.service_is_public(sv.id) then return null; end if;
  return jsonb_build_object(
    'id', sv.id, 'slug', sv.slug, 'name', sv.name, 'summary', sv.summary, 'description', sv.description, 'pricing_model', sv.pricing_model,
    'price_inr', sv.price_inr, 'price_unit', sv.price_unit, 'duration_minutes', sv.duration_minutes, 'attributes', sv.attributes,
    'is_available', sv.is_available, 'published_at', sv.published_at,
    'category', (select jsonb_build_object('slug', c.slug, 'name', c.name) from public.service_categories c where c.id = sv.category_id),
    'vendor', (select jsonb_build_object('slug', v.slug, 'business_name', v.business_name, 'description', v.description, 'city', v.city, 'state', v.state) from public.vendors v where v.id = sv.vendor_id),
    'images', coalesce((select jsonb_agg(jsonb_build_object('path', i.path, 'alt', i.alt) order by i.sort_order, i.created_at) from public.service_images i where i.service_id = sv.id), '[]'::jsonb),
    'has_availability', exists (select 1 from public.service_availability_rules r where r.vendor_id = sv.vendor_id),
    'services_enabled', true);
end $$;

-- Does the provider serve this PIN? 'yes', 'no', or 'unknown' when the provider has not listed any service areas.
create function public.check_service_coverage(p_service uuid, p_pin text) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_vendor uuid;
begin
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then raise exception 'invalid_pin' using errcode = 'P0001'; end if;
  if not public.service_is_public(p_service) then raise exception 'not_found' using errcode = 'P0001'; end if;
  select vendor_id into v_vendor from public.services where id = p_service;
  if not exists (select 1 from public.vendor_service_areas where vendor_id = v_vendor and scope = 'service') then return 'unknown'; end if;
  return case when public.vendor_covers_pin(v_vendor, 'service', p_pin) then 'yes' else 'no' end;
end $$;

-- Open start times for a listing over the next p_days days (max 31), one slot per listing duration, evaluated in IST. Empty when the
-- provider has not published weekly hours (then the customer simply states a preference and the provider confirms a time).
create function public.get_service_slots(p_service uuid, p_from date default null, p_days int default 14)
returns table (slot_start timestamptz, slot_label text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  sv public.services%rowtype;
  v_from date := coalesce(p_from, (now() at time zone 'Asia/Kolkata')::date);
  v_days int := least(greatest(coalesce(p_days, 14), 1), 31);
  d date;
  r record;
  t timestamp;
  v_start timestamptz;
begin
  if not public.service_is_public(p_service) then return; end if;
  select * into sv from public.services where id = p_service;
  for d in select generate_series(v_from, v_from + v_days - 1, interval '1 day')::date loop
    for r in select * from public.service_availability_rules where vendor_id = sv.vendor_id and weekday = extract(dow from d)::int order by start_time loop
      t := d + r.start_time;
      while (t + make_interval(mins => sv.duration_minutes))::time <= r.end_time and (t + make_interval(mins => sv.duration_minutes))::date = d loop
        v_start := t at time zone 'Asia/Kolkata';
        if public.slot_is_open(sv.vendor_id, v_start, v_start + make_interval(mins => sv.duration_minutes)) then
          slot_start := v_start; slot_label := to_char(t, 'Dy DD Mon, HH12:MI AM'); return next;
        end if;
        t := t + make_interval(mins => sv.duration_minutes);
      end loop;
    end loop;
  end loop;
end $$;

create function public.get_service_provider(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v public.vendors%rowtype;
begin
  select * into v from public.vendors where slug = p_slug;
  if not found or not public.services_enabled() or not public.vendor_can(v.id, 'services') then return null; end if;
  return jsonb_build_object('slug', v.slug, 'business_name', v.business_name, 'description', v.description, 'city', v.city, 'state', v.state,
    'service_count', (select count(*) from public.services s where s.vendor_id = v.id and public.service_is_public(s.id)));
end $$;

-- ---------------------------------------------------------------- privileges
revoke all on function public.service_history_append_only(), public.service_requests_guard(), public.service_quotations_guard(), public.record_service_status(),
  public.service_note(text), public.service_slug(text), public.my_service_vendor(), public.service_request_lock(uuid), public.valid_service_attributes(jsonb),
  public.service_request_number(), public.service_missing_items(uuid), public.provider_request(uuid), public.slot_is_open(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.services_enabled(), public.service_is_public(uuid), public.search_services(text, text, text, text, text, boolean, text, int, int),
  public.get_service_public(text), public.check_service_coverage(uuid, text), public.get_service_slots(uuid, date, int), public.get_service_provider(text) from public;
grant execute on function public.services_enabled(), public.service_is_public(uuid), public.search_services(text, text, text, text, text, boolean, text, int, int),
  public.get_service_public(text), public.check_service_coverage(uuid, text), public.get_service_slots(uuid, date, int), public.get_service_provider(text) to anon, authenticated;
revoke all on function public.save_service(jsonb), public.register_service_image(uuid, text, text), public.delete_service_image(uuid), public.reorder_service_images(uuid, uuid[]),
  public.set_service_availability_flag(uuid, boolean), public.submit_service(uuid), public.archive_service(uuid), public.restore_service(uuid),
  public.set_service_availability(jsonb), public.add_service_time_off(date, date, text), public.delete_service_time_off(uuid),
  public.request_service(jsonb, text), public.cancel_service_request(uuid, text), public.decide_quotation(uuid, text, text),
  public.provider_respond_service_request(uuid, text, text), public.provider_send_quotation(uuid, jsonb), public.provider_schedule_appointment(uuid, timestamptz, int),
  public.provider_start_service(uuid), public.provider_complete_service(uuid), public.provider_cancel_service_request(uuid, text),
  public.admin_review_service(uuid, text, text), public.admin_set_service_featured(uuid, boolean), public.admin_reorder_service_categories(bigint[]),
  public.admin_cancel_service_request(uuid, text) from public, anon;
grant execute on function public.save_service(jsonb), public.register_service_image(uuid, text, text), public.delete_service_image(uuid), public.reorder_service_images(uuid, uuid[]),
  public.set_service_availability_flag(uuid, boolean), public.submit_service(uuid), public.archive_service(uuid), public.restore_service(uuid),
  public.set_service_availability(jsonb), public.add_service_time_off(date, date, text), public.delete_service_time_off(uuid),
  public.request_service(jsonb, text), public.cancel_service_request(uuid, text), public.decide_quotation(uuid, text, text),
  public.provider_respond_service_request(uuid, text, text), public.provider_send_quotation(uuid, jsonb), public.provider_schedule_appointment(uuid, timestamptz, int),
  public.provider_start_service(uuid), public.provider_complete_service(uuid), public.provider_cancel_service_request(uuid, text),
  public.admin_review_service(uuid, text, text), public.admin_set_service_featured(uuid, boolean), public.admin_reorder_service_categories(bigint[]),
  public.admin_cancel_service_request(uuid, text) to authenticated;

-- ---------------------------------------------------------------- storage: public bucket for service photos (Supabase only)
do $storage$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema not present - skipping service-images bucket';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('service-images', 'service-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  -- Object paths are "<vendor id>/<service id>/<file>". Photos are public to read; only that provider (with the services capability) may write.
  execute $p$ create policy "service images are public" on storage.objects for select using (bucket_id = 'service-images') $p$;
  execute $p$
    create policy "providers upload service images" on storage.objects for insert to authenticated
      with check (bucket_id = 'service-images' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.owns_vendor(((storage.foldername(name))[1])::uuid, 'services'))
  $p$;
  execute $p$
    create policy "providers delete service images" on storage.objects for delete to authenticated
      using (bucket_id = 'service-images' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.owns_vendor(((storage.foldername(name))[1])::uuid, 'services'))
  $p$;
end
$storage$;
