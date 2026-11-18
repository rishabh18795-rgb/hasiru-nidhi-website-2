-- Hasiru Nidhi marketplace — commercial layer, PIN-code search, host/admin finance foundation.
-- Apply AFTER 20261031000100_*. Additive and safe on a fresh database.
--
--  * PIN-code search      search_properties() takes a PIN (or treats a six-digit location as one); submit_property() requires a valid PIN.
--  * Commission engine    configurable rate (default 20 %) in platform_settings; every booking stores an immutable commission snapshot.
--  * Ledger               commission_ledger: append-only accrual / reversal entries (cannot be updated or deleted).
--  * Payments foundation  payments + payment_events (idempotent, provider-independent). NO payment provider is integrated; the
--                         only way a payment appears today is an administrator recording a real payment received (audited), or a
--                         verified provider webhook calling record_payment_event() through the server.
--  * Settlements          host_settlements + settlement_items: a booking can be settled only once.
--  * History / completion booking_status_history, complete_booking().
--  * Gardening            PIN code and preferred date / time on gardening enquiries.

-- ---------------------------------------------------------------- PIN-code search
create index properties_postal_code_idx on public.properties (postal_code) where status = 'approved';

drop function if exists public.search_properties(text, text, numeric, numeric, int, text[], text[], date, date, text, int, int);
create function public.search_properties(
  p_query text default null,
  p_category text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_guests int default null,
  p_amenities text[] default null,
  p_experiences text[] default null,
  p_check_in date default null,
  p_check_out date default null,
  p_sort text default 'featured',
  p_limit int default 12,
  p_offset int default 0,
  p_pin text default null
) returns table (
  id uuid, slug text, name text, summary text, city text, state text, region text, postal_code text,
  category_slug text, category_name text, price_inr numeric, price_unit public.price_unit,
  max_guests int, rooms_count int, is_featured boolean, is_sample boolean,
  bedrooms int, bathrooms numeric, amenity_names text[],
  cover_path text, cover_source text, cover_alt text, total_count bigint
)
language sql stable security invoker set search_path = public, pg_temp as $$
  select p.id, p.slug, p.name, p.summary, p.city, p.state, p.region, p.postal_code,
         c.slug, c.name, p.price_inr, p.price_unit, p.max_guests, p.rooms_count,
         p.is_featured, p.is_sample,
         p.bedrooms, p.bathrooms,
         (select coalesce(array_agg(a.name order by a.sort_order, a.name), '{}'::text[])
            from public.property_amenities pa join public.amenities a on a.id = pa.amenity_id
           where pa.property_id = p.id) as amenity_names,
         img.path, img.source, img.alt,
         count(*) over () as total_count
    from public.properties p
    cross join (
      -- A six-digit location is treated as a PIN code, so typing one into either box works.
      select coalesce(nullif(trim(p_pin), ''), case when trim(coalesce(p_query, '')) ~ '^[0-9]{6}$' then trim(p_query) end) as pin,
             (trim(coalesce(p_query, '')) ~ '^[0-9]{6}$') as query_is_pin
    ) q
    left join public.property_categories c on c.id = p.category_id
    left join lateral (
      select i.path, i.source, i.alt from public.property_images i
       where i.property_id = p.id order by i.sort_order, i.created_at limit 1
    ) img on true
   where p.status = 'approved'
     and (q.pin is null or p.postal_code = q.pin)
     and (coalesce(p_query, '') = '' or q.query_is_pin or p.name ilike '%' || p_query || '%'
          or coalesce(p.city, '') ilike '%' || p_query || '%'
          or coalesce(p.region, '') ilike '%' || p_query || '%'
          or coalesce(p.state, '') ilike '%' || p_query || '%'
          or coalesce(p.summary, '') ilike '%' || p_query || '%')
     and (coalesce(p_category, '') = '' or c.slug = p_category)
     and (p_min_price is null or p.price_inr >= p_min_price)
     and (p_max_price is null or p.price_inr <= p_max_price)
     and (p_guests is null or p.max_guests >= p_guests)
     and (p_amenities is null or cardinality(p_amenities) = 0 or (
           select count(distinct a.slug) from public.property_amenities pa
             join public.amenities a on a.id = pa.amenity_id
            where pa.property_id = p.id and a.slug = any (p_amenities)
         ) = (select count(distinct x) from unnest(p_amenities) x))
     and (p_experiences is null or cardinality(p_experiences) = 0 or exists (
           select 1 from public.property_experiences pe
             join public.experiences e on e.id = pe.experience_id
            where pe.property_id = p.id and e.slug = any (p_experiences)
         ))
     and (p_check_in is null or p_check_out is null
          or public.is_property_available(p.id, p_check_in, p_check_out))
   order by
     case when p_sort = 'price_asc' then p.price_inr end asc nulls last,
     case when p_sort = 'price_desc' then p.price_inr end desc nulls last,
     case when p_sort = 'newest' then p.published_at end desc nulls last,
     p.is_featured desc, p.published_at desc nulls last, p.name
   limit greatest(least(coalesce(p_limit, 12), 48), 1) offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.search_properties(text, text, numeric, numeric, int, text[], text[], date, date, text, int, int, text) from public;
grant execute on function public.search_properties(text, text, numeric, numeric, int, text[], text[], date, date, text, int, int, text) to anon, authenticated;

-- ---------------------------------------------------------------- gardening enquiries: PIN + preferred slot
alter table public.gardening_enquiries
  add column pin_code text,
  add column preferred_date date,
  add column preferred_time_window text,
  add constraint gardening_enquiries_pin check (pin_code is null or pin_code ~ '^[0-9]{6}$'),
  add constraint gardening_enquiries_window check (preferred_time_window is null or char_length(preferred_time_window) <= 40);

-- ---------------------------------------------------------------- settings + helpers
insert into public.platform_settings (key, value, is_public, description) values
  ('commission_rate_percent', '20'::jsonb, false, 'Platform commission as a percentage of the commissionable base (default 20). Changing it affects NEW bookings only.'),
  ('commission_base', '"accommodation"'::jsonb, false, 'What the commission is charged on: "accommodation" (stay + extra-guest charges) or "accommodation_and_cleaning". Taxes are never commissionable.'),
  ('commission_reverse_on_cancellation', 'true'::jsonb, false, 'Reverse the commission when a confirmed booking is cancelled.'),
  ('refund_reverses_commission', 'true'::jsonb, false, 'Reverse commission in proportion to a recorded refund.'),
  ('settlement_requires_payment', 'true'::jsonb, false, 'Only settle host earnings for bookings whose payment is recorded as received.')
on conflict (key) do nothing;

create function public.setting_numeric(p_key text, p_default numeric) returns numeric
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select (value #>> '{}')::numeric from public.platform_settings where key = p_key and jsonb_typeof(value) = 'number'), p_default)
$$;
create function public.setting_text(p_key text, p_default text) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select value #>> '{}' from public.platform_settings where key = p_key and jsonb_typeof(value) = 'string'), p_default)
$$;
create function public.setting_bool(p_key text, p_default boolean) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select (value #>> '{}')::boolean from public.platform_settings where key = p_key and jsonb_typeof(value) = 'boolean'), p_default)
$$;
revoke all on function public.setting_numeric(text, numeric), public.setting_text(text, text), public.setting_bool(text, boolean) from public, anon, authenticated;

-- The finance settings can only hold sane values, whoever writes them.
create function public.platform_settings_validate() returns trigger
language plpgsql as $$
begin
  if new.key = 'commission_rate_percent' and not (jsonb_typeof(new.value) = 'number' and (new.value #>> '{}')::numeric between 0 and 50) then
    raise exception 'invalid_setting: commission_rate_percent must be a number between 0 and 50' using errcode = 'P0001';
  elsif new.key = 'commission_base' and not (jsonb_typeof(new.value) = 'string' and new.value #>> '{}' in ('accommodation', 'accommodation_and_cleaning')) then
    raise exception 'invalid_setting: commission_base' using errcode = 'P0001';
  elsif new.key in ('commission_reverse_on_cancellation', 'refund_reverses_commission', 'settlement_requires_payment') and jsonb_typeof(new.value) <> 'boolean' then
    raise exception 'invalid_setting: % must be true or false', new.key using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger platform_settings_validate before insert or update on public.platform_settings
  for each row execute function public.platform_settings_validate();

-- ---------------------------------------------------------------- commission calculation
-- Pure: the rate comes from settings, the base from the stored price breakdown. host_share is the remainder, so the two always
-- add up exactly to the commissionable base (10,000 at 20 % -> 2,000 + 8,000).
create function public.compute_commission(p_quote jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_rate numeric := public.setting_numeric('commission_rate_percent', 20);
  v_basis text := public.setting_text('commission_base', 'accommodation');
  v_base numeric;
  v_commission numeric;
begin
  if p_quote is null then
    return null;
  end if;
  v_base := coalesce((p_quote ->> 'base')::numeric, 0) + coalesce((p_quote ->> 'extra_guests')::numeric, 0);
  if v_basis = 'accommodation_and_cleaning' then
    v_base := v_base + coalesce((p_quote ->> 'cleaning')::numeric, 0);
  end if;
  v_commission := round(v_base * v_rate / 100, 2);
  return jsonb_build_object('rate_percent', v_rate, 'basis', v_basis, 'commissionable', v_base,
                            'commission', v_commission, 'host_share', v_base - v_commission);
end $$;
revoke all on function public.compute_commission(jsonb) from public, anon, authenticated;

alter table public.bookings
  add column commission_rate_percent numeric(5, 2),
  add column commission_basis text,
  add column commissionable_amount_inr numeric(12, 2),
  add column commission_amount_inr numeric(12, 2),
  add column host_share_inr numeric(12, 2),
  add constraint bookings_commission_snapshot check (
    (commission_rate_percent is null and commission_basis is null and commissionable_amount_inr is null
       and commission_amount_inr is null and host_share_inr is null)
    or (commission_rate_percent between 0 and 100 and commissionable_amount_inr >= 0 and commission_amount_inr >= 0
        and host_share_inr >= 0 and commission_amount_inr + host_share_inr = commissionable_amount_inr)
  );

-- Once a commission snapshot exists it can never change (new rates only affect new bookings).
create function public.bookings_commission_immutable() returns trigger
language plpgsql as $$
begin
  if old.commission_amount_inr is not null and (
       new.commission_rate_percent is distinct from old.commission_rate_percent
    or new.commission_basis is distinct from old.commission_basis
    or new.commissionable_amount_inr is distinct from old.commissionable_amount_inr
    or new.commission_amount_inr is distinct from old.commission_amount_inr
    or new.host_share_inr is distinct from old.host_share_inr) then
    raise exception 'commission_snapshot_immutable' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger bookings_commission_immutable before update on public.bookings
  for each row execute function public.bookings_commission_immutable();

-- ---------------------------------------------------------------- booking status history
create table public.booking_status_history (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index booking_status_history_booking_idx on public.booking_status_history (booking_id, id);

create function public.record_booking_status() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into public.booking_status_history (booking_id, from_status, to_status, actor_id) values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.booking_status_history (booking_id, from_status, to_status, actor_id) values (new.id, old.status, new.status, auth.uid());
  end if;
  return null;
end $$;
revoke all on function public.record_booking_status() from public, anon, authenticated;
create trigger bookings_status_history after insert or update of status on public.bookings
  for each row execute function public.record_booking_status();

-- ---------------------------------------------------------------- ledger (append-only)
create type public.ledger_kind as enum ('accrual', 'reversal');

create table public.commission_ledger (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  host_id uuid references public.profiles (id) on delete set null,
  kind public.ledger_kind not null,
  commissionable_inr numeric(12, 2) not null,
  commission_rate_percent numeric(5, 2) not null,
  commission_inr numeric(12, 2) not null,
  host_share_inr numeric(12, 2) not null,
  note text,
  created_at timestamptz not null default now()
);
create unique index commission_ledger_one_accrual on public.commission_ledger (booking_id) where kind = 'accrual';
create index commission_ledger_host_idx on public.commission_ledger (host_id, created_at desc);

create function public.commission_ledger_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'ledger_is_append_only' using errcode = 'P0001';
end $$;
create trigger commission_ledger_append_only before update or delete on public.commission_ledger
  for each row execute function public.commission_ledger_append_only();

-- Records the commission when a booking is confirmed. Idempotent. A booking made before commissions existed is priced now.
create function public.ledger_accrue(p_booking uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b public.bookings%rowtype;
  v_host uuid;
  v_comm jsonb;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if b.commission_amount_inr is null then
    v_comm := public.compute_commission(b.price_breakdown);
    if v_comm is null then
      return;
    end if;
    update public.bookings
       set commission_rate_percent = (v_comm ->> 'rate_percent')::numeric, commission_basis = v_comm ->> 'basis',
           commissionable_amount_inr = (v_comm ->> 'commissionable')::numeric,
           commission_amount_inr = (v_comm ->> 'commission')::numeric, host_share_inr = (v_comm ->> 'host_share')::numeric
     where id = b.id
     returning * into b;
  end if;
  select host_id into v_host from public.properties where id = b.property_id;
  insert into public.commission_ledger (booking_id, host_id, kind, commissionable_inr, commission_rate_percent, commission_inr, host_share_inr, note)
  values (b.id, v_host, 'accrual', b.commissionable_amount_inr, b.commission_rate_percent, b.commission_amount_inr, b.host_share_inr, 'Booking confirmed')
  on conflict do nothing;
end $$;
revoke all on function public.ledger_accrue(uuid) from public, anon, authenticated;

-- Reverses `p_fraction` (0..1] of the booking's original commission, never more than what is still outstanding.
create function public.ledger_reverse(p_booking uuid, p_fraction numeric, p_note text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.commission_ledger%rowtype;
  v_remaining numeric;
  v_commission numeric;
  v_base numeric;
begin
  select * into a from public.commission_ledger where booking_id = p_booking and kind = 'accrual';
  if not found or a.commission_inr <= 0 then
    return;
  end if;
  select coalesce(sum(commission_inr), 0) into v_remaining from public.commission_ledger where booking_id = p_booking;
  v_commission := least(v_remaining, round(a.commission_inr * least(greatest(p_fraction, 0), 1), 2));
  if v_commission <= 0 then
    return;
  end if;
  v_base := round(a.commissionable_inr * v_commission / a.commission_inr, 2);
  insert into public.commission_ledger (booking_id, host_id, kind, commissionable_inr, commission_rate_percent, commission_inr, host_share_inr, note)
  values (p_booking, a.host_id, 'reversal', -v_base, a.commission_rate_percent, -v_commission, -(v_base - v_commission), p_note);
end $$;
revoke all on function public.ledger_reverse(uuid, numeric, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- payments
create type public.payment_status as enum ('initiated', 'paid', 'failed', 'partially_refunded', 'refunded');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  provider text not null check (char_length(provider) between 1 and 40),
  provider_reference text not null check (char_length(provider_reference) between 1 and 120),
  amount_inr numeric(12, 2) not null check (amount_inr > 0),
  refunded_inr numeric(12, 2) not null default 0,
  status public.payment_status not null default 'paid',
  note text check (note is null or char_length(note) <= 500),
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_refund_bounds check (refunded_inr >= 0 and refunded_inr <= amount_inr),
  constraint payments_unique_reference unique (provider, provider_reference)
);
create index payments_booking_idx on public.payments (booking_id);
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

-- Every provider callback, stored once. (provider, event_id) is unique, so a replayed webhook is recognised and ignored.
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb,
  received_at timestamptz not null default now(),
  constraint payment_events_unique unique (provider, event_id)
);

-- Derived payment state of a booking: unpaid | initiated | paid | partially_refunded | refunded | failed.
create function public.booking_payment_status(p_booking uuid) returns text
language sql stable set search_path = public, pg_temp as $$
  select case
    when count(*) = 0 then 'unpaid'
    when coalesce(sum(amount_inr) filter (where status in ('paid', 'partially_refunded', 'refunded')), 0) > 0 then
      case
        when coalesce(sum(refunded_inr), 0) >= sum(amount_inr) filter (where status in ('paid', 'partially_refunded', 'refunded')) then 'refunded'
        when coalesce(sum(refunded_inr), 0) > 0 then 'partially_refunded'
        else 'paid'
      end
    when count(*) filter (where status = 'initiated') > 0 then 'initiated'
    else 'failed'
  end
  from public.payments where booking_id = p_booking
$$;
revoke all on function public.booking_payment_status(uuid) from public, anon;
grant execute on function public.booking_payment_status(uuid) to authenticated;

-- Shared by the admin refund action and the verified refund webhook.
create function public.apply_refund(p_payment uuid, p_amount numeric, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  pay public.payments%rowtype;
  v_new numeric;
begin
  select * into pay from public.payments where id = p_payment for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if pay.status not in ('paid', 'partially_refunded') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or pay.refunded_inr + p_amount > pay.amount_inr then
    raise exception 'invalid_refund_amount' using errcode = 'P0001';
  end if;
  v_new := pay.refunded_inr + p_amount;
  update public.payments
     set refunded_inr = v_new, status = (case when v_new >= amount_inr then 'refunded' else 'partially_refunded' end)::public.payment_status
   where id = pay.id;
  if public.setting_bool('refund_reverses_commission', true) then
    perform public.ledger_reverse(pay.booking_id, p_amount / pay.amount_inr, coalesce(nullif(trim(p_reason), ''), 'Refund'));
  end if;
end $$;
revoke all on function public.apply_refund(uuid, numeric, text) from public, anon, authenticated;

-- An administrator records a payment that was actually received (bank transfer, UPI, cash...). Idempotent on the reference.
create function public.admin_record_payment(p_booking uuid, p_amount numeric, p_reference text, p_note text default null, p_provider text default 'manual')
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b public.bookings%rowtype;
  v_id uuid;
  v_paid numeric;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if b.status not in ('confirmed', 'completed') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or coalesce(trim(p_reference), '') = '' then
    raise exception 'invalid_payment' using errcode = 'P0001';
  end if;
  select id into v_id from public.payments where provider = coalesce(nullif(trim(p_provider), ''), 'manual') and provider_reference = trim(p_reference);
  if v_id is not null then
    return v_id; -- the same payment recorded twice is still one payment
  end if;
  select coalesce(sum(amount_inr), 0) into v_paid from public.payments where booking_id = p_booking and status in ('paid', 'partially_refunded', 'refunded');
  if b.indicative_total_inr is not null and v_paid + p_amount > b.indicative_total_inr then
    raise exception 'overpayment' using errcode = 'P0001';
  end if;
  insert into public.payments (booking_id, provider, provider_reference, amount_inr, status, note, recorded_by)
  values (p_booking, coalesce(nullif(trim(p_provider), ''), 'manual'), trim(p_reference), p_amount, 'paid', nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  perform public.write_audit('payment_recorded', 'booking', p_booking::text, jsonb_build_object('payment', v_id, 'amount_inr', p_amount, 'provider', coalesce(nullif(trim(p_provider), ''), 'manual')));
  perform public.notify(b.traveller_id, 'payment_recorded', 'Payment recorded', 'A payment of INR ' || p_amount || ' was recorded for ' || b.property_name || '.', '/dashboard/bookings/' || b.id);
  return v_id;
end $$;

create function public.admin_record_refund(p_payment uuid, p_amount numeric, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_booking uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  select booking_id into v_booking from public.payments where id = p_payment;
  if v_booking is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.apply_refund(p_payment, p_amount, p_reason);
  perform public.write_audit('refund_recorded', 'booking', v_booking::text, jsonb_build_object('payment', p_payment, 'amount_inr', p_amount, 'reason', left(p_reason, 300)));
end $$;

-- Server-only entry point for a payment provider's webhook (the route verifies the signature first). Idempotent on the event id.
-- Returns 'duplicate' for a replay, 'recorded' otherwise. The browser can never call this: only service_role may.
create function public.record_payment_event(
  p_provider text, p_event_id text, p_event_type text, p_booking uuid, p_provider_reference text, p_amount numeric, p_payload jsonb default '{}'::jsonb
) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_inserted bigint;
  b public.bookings%rowtype;
  pay public.payments%rowtype;
begin
  if coalesce(trim(p_provider), '') = '' or coalesce(trim(p_event_id), '') = '' then
    raise exception 'invalid_event' using errcode = 'P0001';
  end if;
  insert into public.payment_events (provider, event_id, event_type, payload)
  values (p_provider, p_event_id, p_event_type, p_payload)
  on conflict (provider, event_id) do nothing
  returning id into v_inserted;
  if v_inserted is null then
    return 'duplicate';
  end if;

  if p_event_type = 'payment.captured' then
    select * into b from public.bookings where id = p_booking;
    if not found or b.status not in ('confirmed', 'completed') or p_amount is null or p_amount <= 0 or coalesce(trim(p_provider_reference), '') = '' then
      raise exception 'invalid_event' using errcode = 'P0001';
    end if;
    insert into public.payments (booking_id, provider, provider_reference, amount_inr, status)
    values (p_booking, p_provider, p_provider_reference, p_amount, 'paid')
    on conflict (provider, provider_reference) do update set status = 'paid' where public.payments.status = 'initiated';
  elsif p_event_type = 'payment.failed' then
    update public.payments set status = 'failed' where provider = p_provider and provider_reference = p_provider_reference and status = 'initiated';
  elsif p_event_type = 'refund.processed' then
    select * into pay from public.payments where provider = p_provider and provider_reference = p_provider_reference;
    if not found then
      raise exception 'invalid_event' using errcode = 'P0001';
    end if;
    perform public.apply_refund(pay.id, p_amount, 'Provider refund');
  end if;
  return 'recorded';
end $$;
revoke all on function public.record_payment_event(text, text, text, uuid, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.record_payment_event(text, text, text, uuid, text, numeric, jsonb) to service_role;

-- ---------------------------------------------------------------- settlements
create type public.settlement_status as enum ('not_due', 'pending', 'processing', 'paid', 'on_hold', 'failed');

create table public.host_settlements (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete restrict,
  amount_inr numeric(12, 2) not null check (amount_inr > 0),
  status public.settlement_status not null default 'pending',
  reference text check (reference is null or char_length(reference) <= 120),
  note text check (note is null or char_length(note) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);
create index host_settlements_host_idx on public.host_settlements (host_id, created_at desc);
create trigger host_settlements_touch before update on public.host_settlements for each row execute function public.touch_updated_at();

create table public.settlement_items (
  settlement_id uuid not null references public.host_settlements (id) on delete cascade,
  booking_id uuid not null unique references public.bookings (id) on delete restrict,   -- a booking can be settled only once
  host_share_inr numeric(12, 2) not null,
  primary key (settlement_id, booking_id)
);

-- Net host share of one booking: the snapshot share minus whatever refunds / cancellations have reversed.
create function public.booking_net_host_share(p_booking uuid) returns numeric
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(host_share_inr), 0) from public.commission_ledger where booking_id = p_booking
$$;
revoke all on function public.booking_net_host_share(uuid) from public, anon, authenticated;

-- Bookings that can be settled for a host right now: completed, not yet settled, positive net share, and (by default) paid.
create function public.admin_settleable_bookings(p_host uuid) returns table (booking_id uuid, property_name text, check_out date, net_host_share_inr numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select b.id, b.property_name, b.check_out, public.booking_net_host_share(b.id)
      from public.bookings b
      join public.properties p on p.id = b.property_id
     where p.host_id = p_host and b.status = 'completed'
       and not exists (select 1 from public.settlement_items si where si.booking_id = b.id)
       and public.booking_net_host_share(b.id) > 0
       and (not public.setting_bool('settlement_requires_payment', true) or public.booking_payment_status(b.id) in ('paid', 'partially_refunded'))
     order by b.check_out, b.id;
end $$;

create function public.admin_create_settlement(p_host uuid, p_note text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_total numeric;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_host and role = 'host') then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select coalesce(sum(net_host_share_inr), 0) into v_total from public.admin_settleable_bookings(p_host);
  if v_total <= 0 then
    raise exception 'nothing_to_settle' using errcode = 'P0001';
  end if;
  insert into public.host_settlements (host_id, amount_inr, status, note, created_by)
  values (p_host, v_total, 'pending', nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  insert into public.settlement_items (settlement_id, booking_id, host_share_inr)
  select v_id, s.booking_id, s.net_host_share_inr from public.admin_settleable_bookings(p_host) s;
  perform public.write_audit('settlement_created', 'host_settlement', v_id::text, jsonb_build_object('host', p_host, 'amount_inr', v_total));
  perform public.notify(p_host, 'settlement_created', 'Settlement prepared', 'A settlement of INR ' || v_total || ' has been prepared for your completed stays.', '/host/earnings');
  return v_id;
end $$;

create function public.admin_update_settlement(p_settlement uuid, p_status public.settlement_status, p_reference text default null, p_note text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.host_settlements%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.host_settlements where id = p_settlement for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not (
       (s.status = 'pending' and p_status in ('processing', 'on_hold'))
    or (s.status = 'on_hold' and p_status = 'pending')
    or (s.status = 'processing' and p_status in ('paid', 'failed'))
    or (s.status = 'failed' and p_status = 'pending')
  ) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_status = 'paid' and coalesce(trim(p_reference), '') = '' then
    raise exception 'reference_required' using errcode = 'P0001';
  end if;
  update public.host_settlements
     set status = p_status, reference = coalesce(nullif(trim(p_reference), ''), reference), note = coalesce(nullif(trim(p_note), ''), note),
         paid_at = case when p_status = 'paid' then now() else paid_at end
   where id = s.id;
  perform public.write_audit('settlement_' || p_status::text, 'host_settlement', s.id::text, jsonb_build_object('from', s.status, 'to', p_status));
  if p_status in ('paid', 'failed', 'on_hold') then
    perform public.notify(s.host_id, 'settlement_' || p_status::text, 'Settlement ' || replace(p_status::text, '_', ' '), 'Your settlement of INR ' || s.amount_inr || ' is now ' || replace(p_status::text, '_', ' ') || '.', '/host/earnings');
  end if;
end $$;

-- ---------------------------------------------------------------- commission configuration (audited with old -> new values)
create function public.admin_set_commission(
  p_rate numeric, p_basis text, p_reverse_on_cancellation boolean, p_refund_reverses boolean, p_settlement_requires_payment boolean
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_old jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_object_agg(key, value) into v_old from public.platform_settings
   where key in ('commission_rate_percent', 'commission_base', 'commission_reverse_on_cancellation', 'refund_reverses_commission', 'settlement_requires_payment');
  insert into public.platform_settings (key, value, is_public, updated_by) values
    ('commission_rate_percent', to_jsonb(p_rate), false, auth.uid()),
    ('commission_base', to_jsonb(p_basis), false, auth.uid()),
    ('commission_reverse_on_cancellation', to_jsonb(p_reverse_on_cancellation), false, auth.uid()),
    ('refund_reverses_commission', to_jsonb(p_refund_reverses), false, auth.uid()),
    ('settlement_requires_payment', to_jsonb(p_settlement_requires_payment), false, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = auth.uid(), updated_at = now();
  perform public.write_audit('commission_settings_changed', 'platform_settings', 'commission', jsonb_build_object(
    'old', v_old,
    'new', jsonb_build_object('commission_rate_percent', p_rate, 'commission_base', p_basis,
      'commission_reverse_on_cancellation', p_reverse_on_cancellation, 'refund_reverses_commission', p_refund_reverses,
      'settlement_requires_payment', p_settlement_requires_payment)));
end $$;

-- ---------------------------------------------------------------- stay completion
-- Confirmed stays are completed once the check-out date has passed, by the owning host or an administrator.
create function public.complete_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if not (public.owns_property(b.property_id) or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if b.status <> 'confirmed' then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if b.check_out > public.today_ist() then
    raise exception 'stay_not_finished' using errcode = 'P0001';
  end if;
  update public.bookings set status = 'completed' where id = b.id;
  perform public.notify(b.traveller_id, 'booking_completed', 'Stay completed', 'We hope you enjoyed ' || b.property_name || '. You can now leave a review.', '/dashboard/bookings/' || b.id);
end $$;

-- ---------------------------------------------------------------- one row per booking with its money, for dashboards
create view public.booking_financials with (security_invoker = true) as
select b.id as booking_id, b.property_id, pr.host_id, b.traveller_id, b.property_name, b.guest_name, b.status, b.check_in, b.check_out,
       b.indicative_total_inr as gross_inr, b.commission_rate_percent, b.commissionable_amount_inr, b.commission_amount_inr, b.host_share_inr,
       (select coalesce(sum(l.commission_inr), 0) from public.commission_ledger l where l.booking_id = b.id) as net_commission_inr,
       (select coalesce(sum(l.host_share_inr), 0) from public.commission_ledger l where l.booking_id = b.id) as net_host_share_inr,
       public.booking_payment_status(b.id) as payment_status,
       coalesce((select s.status::text from public.settlement_items si join public.host_settlements s on s.id = si.settlement_id where si.booking_id = b.id), 'not_due') as settlement_status
  from public.bookings b
  left join public.properties pr on pr.id = b.property_id;

-- ---------------------------------------------------------------- access
alter table public.booking_status_history enable row level security;
alter table public.commission_ledger enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.host_settlements enable row level security;
alter table public.settlement_items enable row level security;

create policy booking_history_select on public.booking_status_history for select to authenticated
  using (public.is_admin() or exists (select 1 from public.bookings b where b.id = booking_id and (b.traveller_id = auth.uid() or public.owns_property(b.property_id))));
create policy ledger_select on public.commission_ledger for select to authenticated
  using (public.is_admin() or host_id = auth.uid());
create policy payments_select on public.payments for select to authenticated
  using (public.is_admin() or exists (select 1 from public.bookings b where b.id = booking_id and (b.traveller_id = auth.uid() or public.owns_property(b.property_id))));
create policy settlements_select on public.host_settlements for select to authenticated
  using (public.is_admin() or host_id = auth.uid());
create policy settlement_items_select on public.settlement_items for select to authenticated
  using (public.is_admin() or exists (select 1 from public.host_settlements s where s.id = settlement_id and s.host_id = auth.uid()));
-- payment_events: no policy at all, so only the server (service_role bypasses RLS) can read them.

-- Nothing here is writable from the browser: every change goes through the functions above.
revoke all on public.booking_status_history, public.commission_ledger, public.payments, public.payment_events, public.host_settlements, public.settlement_items from anon, authenticated;
grant select on public.booking_status_history, public.commission_ledger, public.payments, public.host_settlements, public.settlement_items to authenticated;
revoke all on public.booking_financials from anon, authenticated;
grant select on public.booking_financials to authenticated;

revoke all on function public.admin_record_payment(uuid, numeric, text, text, text), public.admin_record_refund(uuid, numeric, text),
  public.admin_settleable_bookings(uuid), public.admin_create_settlement(uuid, text), public.admin_update_settlement(uuid, public.settlement_status, text, text),
  public.admin_set_commission(numeric, text, boolean, boolean, boolean), public.complete_booking(uuid) from public, anon;
grant execute on function public.admin_record_payment(uuid, numeric, text, text, text), public.admin_record_refund(uuid, numeric, text),
  public.admin_settleable_bookings(uuid), public.admin_create_settlement(uuid, text), public.admin_update_settlement(uuid, public.settlement_status, text, text),
  public.admin_set_commission(numeric, text, boolean, boolean, boolean), public.complete_booking(uuid) to authenticated;

-- ---------------------------------------------------------------- replaced workflow functions (commission snapshot, ledger, PIN)
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
  v_comm jsonb;
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
  -- Commission snapshot: rate, base and amounts are frozen on the booking, so later rate changes never rewrite history.
  v_comm := public.compute_commission(v_quote);

  insert into public.bookings (
    property_id, traveller_id, check_in, check_out, adults, children, message,
    property_name, cancellation_policy, guest_name, guest_email, guest_phone, indicative_total_inr, price_breakdown,
    commission_rate_percent, commission_basis, commissionable_amount_inr, commission_amount_inr, host_share_inr
  ) values (
    p_property, v_uid, p_check_in, p_check_out, p_adults, coalesce(p_children, 0), nullif(trim(p_message), ''),
    v_prop.name, v_prop.cancellation_policy, v_prof.full_name, v_prof.email, v_prof.phone, v_total, v_quote,
    (v_comm ->> 'rate_percent')::numeric, v_comm ->> 'basis', (v_comm ->> 'commissionable')::numeric,
    (v_comm ->> 'commission')::numeric, (v_comm ->> 'host_share')::numeric
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
  if lower(trim(coalesce(p.country, 'India'))) = 'india' and coalesce(p.postal_code, '') !~ '^[0-9]{6}$' then
    v_missing := array_append(v_missing, 'pin_code');
  end if;
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

create or replace function public.respond_to_booking(p_booking uuid, p_accept boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  b public.bookings%rowtype;
  v_host uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select host_id into v_host from public.properties where id = b.property_id;
  if not (v_uid = v_host or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if b.status <> 'requested' then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  if p_accept then
    if exists (
      select 1 from public.availability_blocks ab
      where ab.property_id = b.property_id
        and daterange(ab.start_date, ab.end_date, '[)') && daterange(b.check_in, b.check_out, '[)')
    ) then
      raise exception 'dates_unavailable' using errcode = 'P0001';
    end if;
    begin
      update public.bookings
         set status = 'confirmed', host_response = nullif(trim(p_note), ''), responded_at = now()
       where id = b.id;
    exception when exclusion_violation then
      raise exception 'dates_unavailable' using errcode = 'P0001';
    end;
    perform public.ledger_accrue(b.id);
    perform public.notify(b.traveller_id, 'booking_confirmed', 'Booking confirmed',
      b.property_name || ' is confirmed for ' || b.check_in || ' to ' || b.check_out || '.', '/dashboard/bookings');
  else
    update public.bookings
       set status = 'rejected', host_response = nullif(trim(p_note), ''), responded_at = now()
     where id = b.id;
    perform public.notify(b.traveller_id, 'booking_rejected', 'Booking request declined',
      'The host could not accept your request for ' || b.property_name || '.', '/dashboard/bookings');
  end if;
end $$;

create or replace function public.cancel_booking(p_booking uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  b public.bookings%rowtype;
  v_host uuid;
  v_new public.booking_status;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select host_id into v_host from public.properties where id = b.property_id;

  if v_uid = b.traveller_id then
    v_new := 'cancelled_by_traveller';
  elsif v_uid = v_host or public.is_admin() then
    v_new := 'cancelled_by_host';
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if b.status not in ('requested', 'confirmed') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if b.check_in < public.today_ist() and b.status = 'confirmed' then
    raise exception 'stay_already_started' using errcode = 'P0001';
  end if;

  update public.bookings
     set status = v_new, cancelled_at = now(), cancellation_note = nullif(trim(p_note), '')
   where id = b.id;

  if b.status = 'confirmed' and public.setting_bool('commission_reverse_on_cancellation', true) then
    perform public.ledger_reverse(b.id, 1, 'Booking cancelled');
  end if;

  -- The cancellation policy governs any refund; no payment is held by the platform yet,
  -- so refunds are settled directly between traveller and host according to this policy.
  if v_new = 'cancelled_by_traveller' then
    perform public.notify(v_host, 'booking_cancelled', 'Booking cancelled by guest',
      b.guest_name || ' cancelled ' || b.property_name || ' (' || b.check_in || ' to ' || b.check_out || ').', '/host/bookings');
  else
    perform public.notify(b.traveller_id, 'booking_cancelled', 'Booking cancelled by host',
      b.property_name || ' (' || b.check_in || ' to ' || b.check_out || ') was cancelled by the host.', '/dashboard/bookings');
  end if;
end $$;
