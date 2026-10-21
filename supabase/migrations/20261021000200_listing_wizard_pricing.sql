-- Hasiru Nidhi marketplace — multi-step listing wizard support and structured pricing.
-- Apply AFTER 20261021000100_*. Safe on a fresh database; every new column has a default.

-- ---------------------------------------------------------------- listing details
alter table public.properties
  add column country text not null default 'India',
  add column bedrooms int,
  add column beds int,
  add column bathrooms numeric(3, 1),
  add column accommodation_arrangement text,
  -- 'approximate' rounds the public map pin to ~1 km; the exact pin and street address stay in property_private.
  add column location_precision text not null default 'approximate',
  -- Structured pricing. Weekend nights are Friday and Saturday nights.
  add column weekend_price_inr numeric(10, 2),
  add column included_guests int,
  add column extra_guest_fee_inr numeric(10, 2),
  add column cleaning_fee_inr numeric(10, 2),
  add column tax_percent numeric(5, 2) not null default 0,
  add column min_nights int not null default 1,
  add column max_nights int not null default 30,
  add column currency text not null default 'INR',
  -- 'rejected' or 'changes_requested' when status = 'rejected'. Set only by review_property().
  add column review_kind text,
  add column photo_rights_confirmed_at timestamptz,
  add column wizard_step text;

alter table public.properties
  add constraint properties_country_len check (char_length(country) between 2 and 80),
  add constraint properties_bedrooms check (bedrooms is null or bedrooms between 0 and 100),
  add constraint properties_beds check (beds is null or beds between 0 and 300),
  add constraint properties_bathrooms check (bathrooms is null or bathrooms between 0 and 100),
  add constraint properties_arrangement check (accommodation_arrangement is null
    or accommodation_arrangement in ('entire_property', 'private_rooms', 'shared_space')),
  add constraint properties_location_precision check (location_precision in ('exact', 'approximate')),
  add constraint properties_weekend_price check (weekend_price_inr is null or (weekend_price_inr >= 0 and weekend_price_inr <= 10000000)),
  add constraint properties_included_guests check (included_guests is null or included_guests between 1 and 500),
  add constraint properties_extra_guest_fee check (extra_guest_fee_inr is null or (extra_guest_fee_inr >= 0 and extra_guest_fee_inr <= 1000000)),
  add constraint properties_cleaning_fee check (cleaning_fee_inr is null or (cleaning_fee_inr >= 0 and cleaning_fee_inr <= 1000000)),
  add constraint properties_tax_percent check (tax_percent between 0 and 40),
  add constraint properties_stay_length check (min_nights between 1 and 30 and max_nights between 1 and 30 and max_nights >= min_nights),
  add constraint properties_currency check (currency = 'INR'),
  add constraint properties_review_kind check (review_kind is null or review_kind in ('rejected', 'changes_requested')),
  add constraint properties_coords check ((latitude is null or latitude between -90 and 90) and (longitude is null or longitude between -180 and 180));

alter table public.property_private
  add column exact_latitude numeric(9, 6),
  add column exact_longitude numeric(9, 6),
  add constraint property_private_coords check (
    (exact_latitude is null or exact_latitude between -90 and 90) and (exact_longitude is null or exact_longitude between -180 and 180));

-- Snapshot of the price the guest was shown, so later edits to a listing never rewrite history.
alter table public.bookings add column price_breakdown jsonb;

-- ---------------------------------------------------------------- pricing
-- One definition of "what does this stay cost", used for the guest quote AND for the stored booking total.
-- per_night: whole property per night (+ optional extra-guest fee above included_guests).
-- per_person_night: rate x guests per night.  per_day_visit: rate x guests, once.
create function public.compute_stay_quote(p public.properties, p_check_in date, p_check_out date, p_guests int)
returns jsonb
language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_nights int := p_check_out - p_check_in;
  v_weekend int;
  v_nightly numeric;
  v_base numeric;
  v_extra numeric := 0;
  v_clean numeric := coalesce(p.cleaning_fee_inr, 0);
  v_sub numeric;
  v_tax numeric;
begin
  if p.price_inr is null or v_nights < 1 or p_guests < 1 then
    return null;
  end if;

  select count(*) filter (where p.weekend_price_inr is not null and extract(dow from d) in (5, 6)),
         coalesce(sum(case when p.weekend_price_inr is not null and extract(dow from d) in (5, 6)
                           then p.weekend_price_inr else p.price_inr end), 0)
    into v_weekend, v_nightly
    from generate_series(p_check_in::timestamp, (p_check_out - 1)::timestamp, interval '1 day') d;

  if p.price_unit = 'per_person_night' then
    v_base := v_nightly * p_guests;
  elsif p.price_unit = 'per_day_visit' then
    v_base := p.price_inr * p_guests;
    v_weekend := 0;
  else
    v_base := v_nightly;
    if p.included_guests is not null and p.extra_guest_fee_inr is not null and p_guests > p.included_guests then
      v_extra := (p_guests - p.included_guests) * p.extra_guest_fee_inr * v_nights;
    end if;
  end if;

  v_sub := v_base + v_extra + v_clean;
  v_tax := round(v_sub * p.tax_percent / 100, 2);
  return jsonb_build_object(
    'currency', p.currency, 'unit', p.price_unit, 'nights', v_nights, 'guests', p_guests,
    'weekend_nights', v_weekend, 'base', v_base, 'extra_guests', v_extra, 'cleaning', v_clean,
    'subtotal', v_sub, 'tax_percent', p.tax_percent, 'tax', v_tax, 'total', v_sub + v_tax);
end $$;
revoke all on function public.compute_stay_quote(public.properties, date, date, int) from public, anon, authenticated;

-- Public quote for a live listing (owners and admins may also quote their own drafts).
create function public.quote_stay(p_property uuid, p_check_in date, p_check_out date, p_guests int)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  p public.properties%rowtype;
begin
  select * into p from public.properties where id = p_property;
  -- coalesce: for anonymous callers auth.uid() is NULL, and NULL must mean "not allowed".
  if not found or not coalesce(p.status = 'approved' or p.host_id = auth.uid() or public.is_admin(), false) then
    return null;
  end if;
  return public.compute_stay_quote(p, p_check_in, p_check_out, p_guests);
end $$;
revoke all on function public.quote_stay(uuid, date, date, int) from public;
grant execute on function public.quote_stay(uuid, date, date, int) to anon, authenticated;

-- ---------------------------------------------------------------- guard (adds review_kind)
create or replace function public.properties_guard() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.status <> 'draft' or new.is_featured or new.is_sample
         or new.reviewed_by is not null or new.published_at is not null or new.review_kind is not null
         or new.host_id is distinct from auth.uid() then
        raise exception 'forbidden_property_change' using errcode = '42501';
      end if;
    else
      if new.host_id is distinct from old.host_id
         or new.is_featured is distinct from old.is_featured
         or new.is_sample is distinct from old.is_sample
         or new.reviewed_by is distinct from old.reviewed_by
         or new.reviewed_at is distinct from old.reviewed_at
         or new.published_at is distinct from old.published_at
         or new.submitted_at is distinct from old.submitted_at
         or new.rejection_reason is distinct from old.rejection_reason
         or new.review_kind is distinct from old.review_kind
         or new.slug is distinct from old.slug then
        raise exception 'forbidden_property_change' using errcode = '42501';
      end if;
      -- Status cannot be changed directly; submit_property()/review_property() do that.
      if new.status is distinct from old.status then
        raise exception 'forbidden_status_change' using errcode = '42501';
      end if;
      -- Material edits to a live listing send it back for re-review.
      if old.status = 'approved' and (
           new.name is distinct from old.name
        or new.description is distinct from old.description
        or new.category_id is distinct from old.category_id
        or new.city is distinct from old.city
        or new.state is distinct from old.state) then
        new.status := 'pending_review';
      end if;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- booking request now enforces stay length and prices from structured rules
create or replace function public.request_booking(
  p_property uuid,
  p_check_in date,
  p_check_out date,
  p_adults int,
  p_children int default 0,
  p_message text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v_prop public.properties%rowtype;
  v_guests int;
  v_nights int;
  v_total numeric(12, 2);
  v_quote jsonb;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_prof from public.profiles where id = v_uid;
  if not found or v_prof.is_suspended then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  select * into v_prop from public.properties where id = p_property and status = 'approved';
  if not found then
    raise exception 'property_unavailable' using errcode = 'P0001';
  end if;
  if v_prop.host_id = v_uid then
    raise exception 'own_property' using errcode = 'P0001';
  end if;

  if p_check_in is null or p_check_out is null or p_check_in < public.today_ist() then
    raise exception 'invalid_dates' using errcode = 'P0001';
  end if;
  if p_check_out <= p_check_in or p_check_out - p_check_in > 30 then
    raise exception 'invalid_dates' using errcode = 'P0001';
  end if;
  v_nights := p_check_out - p_check_in;
  if v_nights < v_prop.min_nights or v_nights > v_prop.max_nights then
    raise exception 'invalid_stay_length:%-%', v_prop.min_nights, v_prop.max_nights using errcode = 'P0001';
  end if;

  v_guests := coalesce(p_adults, 0) + coalesce(p_children, 0);
  if coalesce(p_adults, 0) < 1 or coalesce(p_children, 0) < 0 or v_guests > v_prop.max_guests then
    raise exception 'invalid_guests' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.property_id = p_property and b.status = 'confirmed'
      and daterange(b.check_in, b.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) or exists (
    select 1 from public.availability_blocks ab
    where ab.property_id = p_property
      and daterange(ab.start_date, ab.end_date, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) then
    raise exception 'dates_unavailable' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.property_id = p_property and b.traveller_id = v_uid and b.status = 'requested'
      and daterange(b.check_in, b.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) then
    raise exception 'duplicate_request' using errcode = 'P0001';
  end if;

  -- Price comes from the same structured rules the guest saw (compute_stay_quote); never from the browser.
  v_quote := public.compute_stay_quote(v_prop, p_check_in, p_check_out, v_guests);
  v_total := (v_quote ->> 'total')::numeric;

  insert into public.bookings (
    property_id, traveller_id, check_in, check_out, adults, children, message,
    property_name, cancellation_policy, guest_name, guest_email, guest_phone, indicative_total_inr, price_breakdown
  ) values (
    p_property, v_uid, p_check_in, p_check_out, p_adults, coalesce(p_children, 0), nullif(trim(p_message), ''),
    v_prop.name, v_prop.cancellation_policy, v_prof.full_name, v_prof.email, v_prof.phone, v_total, v_quote
  ) returning id into v_id;

  if v_prop.host_id is not null then
    perform public.notify(v_prop.host_id, 'booking_requested', 'New booking request',
      v_prof.full_name || ' requested ' || v_prop.name || ' for ' || p_check_in || ' to ' || p_check_out || '.',
      '/host/bookings');
  else
    perform public.notify_admins('booking_requested', 'Booking request on a platform-managed listing',
      v_prop.name || ' · ' || p_check_in || ' to ' || p_check_out, '/admin/bookings');
  end if;
  perform public.notify(v_uid, 'booking_requested', 'Request sent',
    'Your request for ' || v_prop.name || ' is with the host. It is not a confirmed reservation yet.',
    '/dashboard/bookings');

  return v_id;
end $$;

-- ---------------------------------------------------------------- submit / review workflows
create or replace function public.submit_property(p_property uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  p public.properties%rowtype;
  v_missing text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into p from public.properties where id = p_property for update;
  if not found or p.host_id is distinct from v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'host' and not is_suspended) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p.status not in ('draft', 'rejected') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  if char_length(trim(p.name)) < 3 then v_missing := array_append(v_missing, 'name'); end if;
  if p.category_id is null then v_missing := array_append(v_missing, 'category'); end if;
  if coalesce(trim(p.city), '') = '' then v_missing := array_append(v_missing, 'city'); end if;
  if coalesce(trim(p.state), '') = '' then v_missing := array_append(v_missing, 'state'); end if;
  if char_length(trim(p.description)) < 50 then v_missing := array_append(v_missing, 'description'); end if;
  if p.terms_accepted_at is null then v_missing := array_append(v_missing, 'terms'); end if;
  if p.photo_rights_confirmed_at is null then v_missing := array_append(v_missing, 'photo_rights'); end if;
  if not exists (select 1 from public.property_images i where i.property_id = p.id) then
    v_missing := array_append(v_missing, 'photos');
  end if;
  if not exists (
    select 1 from public.property_private pp
    where pp.property_id = p.id and coalesce(trim(pp.contact_phone), '') <> '' and coalesce(trim(pp.address_line), '') <> ''
  ) then
    v_missing := array_append(v_missing, 'contact_and_address');
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'incomplete_listing: %', array_to_string(v_missing, ',') using errcode = 'P0001';
  end if;

  update public.properties
     set status = 'pending_review', submitted_at = now(), rejection_reason = null, review_kind = null
   where id = p.id;
  perform public.notify_admins('property_submitted', 'Listing awaiting review', p.name, '/admin/properties');
  perform public.notify(v_uid, 'property_submitted', 'Listing submitted',
    p.name || ' is pending review. It will not be public until an administrator approves it.', '/host/properties');
end $$;

create or replace function public.review_property(p_property uuid, p_decision text, p_reason text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  p public.properties%rowtype;
  v_status public.property_status;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into p from public.properties where id = p_property for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if p_decision = 'approve' then
    if p.status not in ('pending_review', 'rejected') then
      raise exception 'invalid_status' using errcode = 'P0001';
    end if;
    v_status := 'approved';
  elsif p_decision in ('reject', 'request_changes') then
    if p.status <> 'pending_review' then
      raise exception 'invalid_status' using errcode = 'P0001';
    end if;
    if coalesce(trim(p_reason), '') = '' then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;
    v_status := 'rejected';
  elsif p_decision = 'suspend' then
    if p.status <> 'approved' then
      raise exception 'invalid_status' using errcode = 'P0001';
    end if;
    if coalesce(trim(p_reason), '') = '' then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;
    v_status := 'suspended';
  elsif p_decision = 'reinstate' then
    if p.status <> 'suspended' then
      raise exception 'invalid_status' using errcode = 'P0001';
    end if;
    v_status := 'approved';
  else
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;

  update public.properties
     set status = v_status,
         rejection_reason = case when v_status in ('rejected', 'suspended') then trim(p_reason) else null end,
         review_kind = case when p_decision = 'request_changes' then 'changes_requested'
                            when p_decision = 'reject' then 'rejected' else null end,
         reviewed_by = v_uid,
         reviewed_at = now(),
         published_at = case when v_status = 'approved' then coalesce(published_at, now()) else published_at end
   where id = p.id;

  perform public.notify(p.host_id, 'property_' || v_status::text,
    case when p_decision = 'request_changes' then 'Changes requested' else 'Listing ' || replace(v_status::text, '_', ' ') end,
    p.name || case when v_status in ('rejected', 'suspended') then ': ' || trim(p_reason) else '' end,
    '/host/properties');
  perform public.write_audit('property_' || p_decision, 'property', p.id::text,
    jsonb_build_object('reason', p_reason, 'from', p.status, 'to', v_status));
end $$;

-- ---------------------------------------------------------------- become a host
-- A signed-in traveller can start hosting. This can never create or touch an administrator.
create function public.become_host() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_suspended boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select role, is_suspended into v_role, v_suspended from public.profiles where id = v_uid for update;
  if not found or v_suspended then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  if v_role = 'host' then
    return;
  end if;
  if v_role <> 'traveller' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.profiles set role = 'host' where id = v_uid;
  perform public.write_audit('become_host', 'profile', v_uid::text, '{}'::jsonb);
end $$;
revoke all on function public.become_host() from public, anon;
grant execute on function public.become_host() to authenticated;

-- ---------------------------------------------------------------- photos
create function public.property_images_limit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select count(*) from public.property_images where property_id = new.property_id) >= 20 then
    raise exception 'too_many_photos' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.property_images_limit() from public, anon, authenticated;
create trigger property_images_limit before insert on public.property_images
  for each row execute function public.property_images_limit();

-- Atomically sets the display order. The first id becomes the cover photograph.
create function public.reorder_property_images(p_property uuid, p_order uuid[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.owns_property(p_property) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.property_images i
     set sort_order = o.ord::int
    from unnest(p_order) with ordinality as o(id, ord)
   where i.id = o.id and i.property_id = p_property;
end $$;
revoke all on function public.reorder_property_images(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_property_images(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------- vocabulary the listing wizard offers
-- Facilities are claims made by each owner; nothing here is ever assigned to a listing automatically.
insert into public.property_categories (slug, name, description, sort_order) values
  ('nature-retreat', 'Nature retreats', 'Quiet stays surrounded by forest, hills or water.', 35),
  ('villa', 'Villas', 'Larger private homes for families and groups.', 45),
  ('guesthouse', 'Guesthouses', 'Small, hosted guesthouses with a few rooms.', 55),
  ('countryside-stay', 'Countryside accommodation', 'Rural stays outside towns and cities.', 65),
  ('other-accommodation', 'Other approved accommodation', 'Another kind of stay, approved by our team.', 90)
on conflict (slug) do nothing;

insert into public.amenities (slug, name, group_name, sort_order) values
  ('private-bathroom', 'Private bathroom', 'essentials', 25),
  ('kitchen', 'Kitchen', 'essentials', 26),
  ('garden', 'Garden', 'nature', 55),
  ('outdoor-seating', 'Outdoor seating', 'outdoors', 65)
on conflict (slug) do nothing;

insert into public.experiences (slug, name, description, sort_order) values
  ('local-food-experiences', 'Local food experiences', 'Meals, cooking or tastings built around local produce.', 55),
  ('family-activities', 'Family activities', 'Activities designed for children and families together.', 65)
on conflict (slug) do nothing;
