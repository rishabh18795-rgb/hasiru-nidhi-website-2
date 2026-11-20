-- Hasiru Nidhi marketplace - M4: cart, checkout and product orders (Phase 5). ADDITIVE. Apply AFTER 20261121000100_product_catalogue.sql.
--
--  * Persistent multi-vendor cart. ONE checkout splits into ONE ORDER PER VENDOR in a single transaction (all or nothing).
--  * Stock is checked and decremented atomically at placement (row locks, fixed lock order), so nothing can oversell; every change is logged.
--  * Duplicate submissions are impossible: place_order() is idempotent per (customer, idempotency key).
--  * PAYMENT: there is no gateway. Every order is UNPAID - PAYMENT NOT CONFIGURED. Nothing in this migration can set any other payment status, and
--    there is no payment table, transaction id or "paid" path (owner decisions D2/D11). Delivery fee and tax are NULL = "not configured" (D4/D6).
--  * Product orders are a separate workflow from Nature Stay bookings. No Stays table or function is touched.
--  * Vendors see only their own orders. A customer's phone and street address become visible to the vendor only once the vendor accepts the
--    order, and again hidden if it is rejected or cancelled. Vendors never read the checkout.
--  * Return / replacement rules are configurable per product category and start UNCONFIGURED (no invented windows, D7).

-- ---------------------------------------------------------------- flag and enums
insert into public.platform_settings (key, value, is_public, description) values
  ('marketplace_orders_enabled', 'false'::jsonb, true, 'Turn ON only after cart, checkout and orders have passed their launch checks. Also needs the Products flag.')
on conflict (key) do nothing;

create or replace function public.platform_settings_validate() returns trigger
language plpgsql as $$
begin
  if new.key = 'commission_rate_percent' and not (jsonb_typeof(new.value) = 'number' and (new.value #>> '{}')::numeric between 0 and 50) then
    raise exception 'invalid_setting: commission_rate_percent must be a number between 0 and 50' using errcode = 'P0001';
  elsif new.key = 'commission_base' and not (jsonb_typeof(new.value) = 'string' and new.value #>> '{}' in ('accommodation', 'accommodation_and_cleaning')) then
    raise exception 'invalid_setting: commission_base' using errcode = 'P0001';
  elsif new.key in ('commission_reverse_on_cancellation', 'refund_reverses_commission', 'settlement_requires_payment',
                    'marketplace_vendor_registration_enabled', 'marketplace_products_enabled', 'marketplace_services_enabled', 'marketplace_orders_enabled')
        and jsonb_typeof(new.value) <> 'boolean' then
    raise exception 'invalid_setting: % must be true or false', new.key using errcode = 'P0001';
  end if;
  return new;
end $$;

create function public.orders_enabled() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.products_enabled() and public.setting_bool('marketplace_orders_enabled', false)
$$;

create type public.order_status as enum ('placed', 'confirmed', 'rejected', 'packed', 'shipped', 'delivered', 'cancelled');
create type public.order_payment_status as enum ('unpaid', 'paid', 'partially_refunded', 'refunded');   -- only 'unpaid' is ever written in this release
create type public.shipment_status as enum ('shipped', 'in_transit', 'out_for_delivery', 'delivered', 'failed');
create type public.order_request_kind as enum ('cancel', 'return', 'replacement');
create type public.order_request_status as enum ('requested', 'approved', 'rejected', 'completed');
create type public.dispute_status as enum ('open', 'in_review', 'resolved', 'dismissed');

create sequence public.order_number_seq start 100001;
create sequence public.checkout_number_seq start 100001;

-- ---------------------------------------------------------------- addresses
create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  landmark text,
  city text not null,
  state text not null,
  postal_code text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_addresses_pin check (postal_code ~ '^[0-9]{6}$'),
  constraint customer_addresses_lens check (char_length(full_name) between 2 and 120 and char_length(phone) between 8 and 20 and char_length(line1) between 3 and 200
    and coalesce(char_length(line2), 0) <= 200 and coalesce(char_length(landmark), 0) <= 120 and char_length(city) between 2 and 120 and char_length(state) between 2 and 120
    and coalesce(char_length(label), 0) <= 40)
);
create index customer_addresses_user_idx on public.customer_addresses (user_id);
create unique index customer_addresses_one_default on public.customer_addresses (user_id) where is_default;
create trigger customer_addresses_touch before update on public.customer_addresses for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- cart
create table public.cart_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity int not null check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, variant_id)
);
create trigger cart_items_touch before update on public.cart_items for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- checkouts and orders
create table public.checkouts (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references public.profiles (id) on delete restrict,
  idempotency_key text not null,
  customer_email text,
  ship_name text not null,
  ship_phone text not null,
  ship_line1 text not null,
  ship_line2 text,
  ship_landmark text,
  ship_city text not null,
  ship_state text not null,
  ship_postal_code text not null,
  items_total_inr numeric(12, 2) not null check (items_total_inr >= 0),
  order_count int not null check (order_count >= 1),
  payment_status public.order_payment_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  constraint checkouts_key unique (user_id, idempotency_key),
  constraint checkouts_key_len check (char_length(idempotency_key) between 8 and 80)
);
create index checkouts_user_idx on public.checkouts (user_id, created_at desc);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  checkout_id uuid not null references public.checkouts (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  vendor_name text not null,                       -- snapshot
  status public.order_status not null default 'placed',
  payment_status public.order_payment_status not null default 'unpaid',
  items_total_inr numeric(12, 2) not null check (items_total_inr >= 0),
  shipping_fee_inr numeric(12, 2),                 -- NULL = delivery charges not configured (never invented)
  tax_inr numeric(12, 2),                          -- NULL = tax treatment not confirmed (never invented)
  ship_name text not null,                         -- coarse delivery info the vendor may see from the start
  ship_city text not null,
  ship_state text not null,
  ship_postal_code text not null,
  rejection_reason text,
  cancel_reason text,
  stock_restored boolean not null default false,
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_vendor_idx on public.orders (vendor_id, status, created_at desc);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_checkout_idx on public.orders (checkout_id);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

-- Phone and street address: visible to the vendor only while the order is accepted (see policy).
create table public.order_shipping (
  order_id uuid primary key references public.orders (id) on delete restrict,
  ship_phone text not null,
  ship_line1 text not null,
  ship_line2 text,
  ship_landmark text
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  category_id bigint not null references public.product_categories (id) on delete restrict,
  product_name text not null,
  product_slug text not null,
  variant_name text not null,
  sku text not null,
  options jsonb not null default '{}'::jsonb,
  image_path text,
  unit_price_inr numeric(10, 2) not null check (unit_price_inr > 0),
  quantity int not null check (quantity between 1 and 99),
  line_total_inr numeric(12, 2) not null,
  constraint order_items_total check (line_total_inr = unit_price_inr * quantity)
);
create index order_items_order_idx on public.order_items (order_id);
-- A placed order line is a historical record: it can never be edited or removed.
create function public.order_items_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'order_items_are_immutable' using errcode = 'P0001';
end $$;
create trigger order_items_immutable before update or delete on public.order_items for each row execute function public.order_items_immutable();

alter table public.inventory_movements add constraint inventory_movements_order_fk foreign key (order_id) references public.orders (id) on delete restrict;

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid,
  actor_kind text not null check (actor_kind in ('customer', 'vendor', 'admin', 'system')),
  note text,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, id);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  carrier text not null check (char_length(carrier) between 2 and 80),
  tracking_number text not null check (char_length(tracking_number) between 3 and 80),
  tracking_url text check (tracking_url is null or (char_length(tracking_url) <= 500 and tracking_url ~ '^https?://')),
  status public.shipment_status not null default 'shipped',
  shipped_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shipments_touch before update on public.shipments for each row execute function public.touch_updated_at();

create table public.shipment_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments (id) on delete restrict,
  status public.shipment_status not null,
  note text check (note is null or char_length(note) <= 300),
  actor_id uuid,
  created_at timestamptz not null default now()
);
create function public.shipment_events_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'shipment_log_is_append_only' using errcode = 'P0001';
end $$;
create trigger shipment_events_append_only before update or delete on public.shipment_events for each row execute function public.shipment_events_append_only();

create table public.order_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  kind public.order_request_kind not null,
  status public.order_request_status not null default 'requested',
  reason text not null check (char_length(reason) between 3 and 500),
  details text check (details is null or char_length(details) <= 2000),
  policy_note text,
  requested_by uuid references public.profiles (id) on delete set null,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  created_at timestamptz not null default now()
);
create unique index order_requests_one_open on public.order_requests (order_id, kind) where status in ('requested', 'approved');
create index order_requests_order_idx on public.order_requests (order_id);

create table public.order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  raised_by uuid references public.profiles (id) on delete set null,
  description text not null check (char_length(description) between 10 and 3000),
  status public.dispute_status not null default 'open',
  resolution text check (resolution is null or char_length(resolution) <= 2000),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index order_disputes_order_idx on public.order_disputes (order_id);

-- Return / replacement rules by product category. NO ROW = not configured; nothing is invented.
create table public.product_category_policies (
  category_id bigint primary key references public.product_categories (id) on delete cascade,
  returns_allowed boolean,
  return_window_days int check (return_window_days is null or return_window_days between 1 and 365),
  replacements_allowed boolean,
  replacement_window_days int check (replacement_window_days is null or replacement_window_days between 1 and 365),
  notes text check (notes is null or char_length(notes) <= 500),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger audit_product_category_policies after insert or update or delete on public.product_category_policies for each row execute function public.audit_admin_change();

-- ---------------------------------------------------------------- status history trigger
create function public.record_order_status() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_kind text;
  v_note text := nullif(current_setting('hn.status_note', true), '');
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return null; end if;
  v_kind := case when auth.uid() is null then 'system' when auth.uid() = new.customer_id then 'customer' when public.is_vendor_member(new.vendor_id) then 'vendor' when public.is_admin() then 'admin' else 'system' end;
  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_kind, note)
  values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid(), v_kind, v_note);
  return null;
end $$;
create trigger orders_status_history after insert or update of status on public.orders for each row execute function public.record_order_status();

-- ---------------------------------------------------------------- row level security
alter table public.customer_addresses enable row level security;
alter table public.cart_items enable row level security;
alter table public.checkouts enable row level security;
alter table public.orders enable row level security;
alter table public.order_shipping enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.order_requests enable row level security;
alter table public.order_disputes enable row level security;
alter table public.product_category_policies enable row level security;

create policy addresses_select on public.customer_addresses for select to authenticated using (user_id = auth.uid());
create policy cart_select on public.cart_items for select to authenticated using (user_id = auth.uid());
create policy checkouts_select on public.checkouts for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy orders_select on public.orders for select to authenticated using (customer_id = auth.uid() or public.is_vendor_member(vendor_id) or public.is_admin());
-- Children are visible whenever their order is (the order's own policy decides who that is).
create policy order_items_select on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id));
create policy order_history_select on public.order_status_history for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id));
create policy shipments_select on public.shipments for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id));
create policy shipment_events_select on public.shipment_events for select to authenticated using (exists (select 1 from public.shipments s join public.orders o on o.id = s.order_id where s.id = shipment_id));
create policy order_requests_select on public.order_requests for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id));
create policy order_disputes_select on public.order_disputes for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id) and (public.is_admin() or raised_by = auth.uid()
  or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())));
create policy order_shipping_select on public.order_shipping for select to authenticated using (exists (
  select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.is_admin()
    or (public.is_vendor_member(o.vendor_id) and o.status in ('confirmed', 'packed', 'shipped', 'delivered')))));
create policy category_policies_read on public.product_category_policies for select to anon, authenticated using (true);
create policy category_policies_admin on public.product_category_policies for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete on public.customer_addresses, public.cart_items, public.checkouts, public.orders, public.order_shipping, public.order_items,
  public.order_status_history, public.shipments, public.shipment_events, public.order_requests, public.order_disputes from anon, authenticated;
revoke all on public.customer_addresses, public.cart_items, public.checkouts, public.orders, public.order_shipping, public.order_items, public.order_status_history,
  public.shipments, public.shipment_events, public.order_requests, public.order_disputes from anon;
revoke insert, update, delete on public.product_category_policies from anon;

-- ---------------------------------------------------------------- addresses
create function public.save_address(p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_default boolean := coalesce((p ->> 'is_default')::boolean, false);
  v_pin text := public.vendor_text(p, 'postal_code', 6);
  v_count int;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and not is_suspended) then raise exception 'account_suspended' using errcode = '42501'; end if;
  if v_pin is null or v_pin !~ '^[0-9]{6}$' then raise exception 'invalid_pin' using errcode = 'P0001'; end if;
  if public.vendor_text(p, 'full_name', 120) is null or public.vendor_text(p, 'phone', 20) is null or public.vendor_text(p, 'line1', 200) is null
     or public.vendor_text(p, 'city', 120) is null or public.vendor_text(p, 'state', 120) is null then
    raise exception 'address_incomplete' using errcode = 'P0001';
  end if;
  select count(*) into v_count from public.customer_addresses where user_id = v_uid;
  if v_id is null and v_count >= 10 then raise exception 'too_many_addresses' using errcode = 'P0001'; end if;
  if v_count = 0 then v_default := true; end if;
  if v_default then update public.customer_addresses set is_default = false where user_id = v_uid and is_default and id is distinct from v_id; end if;
  if v_id is null then
    insert into public.customer_addresses (user_id, label, full_name, phone, line1, line2, landmark, city, state, postal_code, is_default)
    values (v_uid, public.vendor_text(p, 'label', 40), public.vendor_text(p, 'full_name', 120), public.vendor_text(p, 'phone', 20), public.vendor_text(p, 'line1', 200),
            public.vendor_text(p, 'line2', 200), public.vendor_text(p, 'landmark', 120), public.vendor_text(p, 'city', 120), public.vendor_text(p, 'state', 120), v_pin, v_default)
    returning id into v_id;
  else
    update public.customer_addresses set label = public.vendor_text(p, 'label', 40), full_name = public.vendor_text(p, 'full_name', 120), phone = public.vendor_text(p, 'phone', 20),
           line1 = public.vendor_text(p, 'line1', 200), line2 = public.vendor_text(p, 'line2', 200), landmark = public.vendor_text(p, 'landmark', 120),
           city = public.vendor_text(p, 'city', 120), state = public.vendor_text(p, 'state', 120), postal_code = v_pin, is_default = v_default or is_default
     where id = v_id and user_id = v_uid;
    if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  end if;
  return v_id;
end $$;

create function public.delete_address(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare was_default boolean;
begin
  delete from public.customer_addresses where id = p_id and user_id = auth.uid() returning is_default into was_default;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if was_default then
    update public.customer_addresses set is_default = true where id = (select id from public.customer_addresses where user_id = auth.uid() order by created_at limit 1);
  end if;
end $$;

create function public.set_default_address(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.customer_addresses where id = p_id and user_id = auth.uid()) then raise exception 'not_found' using errcode = 'P0001'; end if;
  update public.customer_addresses set is_default = false where user_id = auth.uid() and is_default;
  update public.customer_addresses set is_default = true where id = p_id;
end $$;

-- ---------------------------------------------------------------- cart
create function public.cart_set_item(p_variant uuid, p_quantity int) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and not is_suspended and role <> 'admin') then raise exception 'account_suspended' using errcode = '42501'; end if;
  if not public.orders_enabled() then raise exception 'orders_closed' using errcode = 'P0001'; end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > 99 then raise exception 'invalid_quantity' using errcode = 'P0001'; end if;
  if p_quantity = 0 then
    delete from public.cart_items where user_id = v_uid and variant_id = p_variant;
    return 0;
  end if;
  select v.id, v.is_active, v.track_inventory, v.stock_on_hand, p.id as product_id, p.is_available, p.vendor_id, vd.owner_id
    into r from public.product_variants v join public.products p on p.id = v.product_id join public.vendors vd on vd.id = p.vendor_id where v.id = p_variant;
  if not found or not r.is_active or not public.product_is_public(r.product_id) then raise exception 'product_unavailable' using errcode = 'P0001'; end if;
  if not r.is_available then raise exception 'product_paused' using errcode = 'P0001'; end if;
  if r.owner_id = v_uid then raise exception 'own_product' using errcode = 'P0001'; end if;
  if r.track_inventory and p_quantity > r.stock_on_hand then raise exception 'insufficient_stock:%', r.stock_on_hand using errcode = 'P0001'; end if;
  if (select count(*) from public.cart_items where user_id = v_uid and variant_id <> p_variant) >= 50 then raise exception 'cart_full' using errcode = 'P0001'; end if;
  insert into public.cart_items (user_id, variant_id, quantity) values (v_uid, p_variant, p_quantity)
  on conflict (user_id, variant_id) do update set quantity = excluded.quantity;
  return p_quantity;
end $$;

create function public.cart_clear() returns void
language sql security definer set search_path = public, pg_temp as $$
  delete from public.cart_items where user_id = auth.uid()
$$;

-- The caller's cart with live prices, availability and, when a PIN is given, each seller's delivery answer. Never a client-supplied price.
create function public.get_cart(p_pin text default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_pin text := case when p_pin ~ '^[0-9]{6}$' then p_pin end;
  v_lines jsonb;
  v_vendors jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'variant_id', ci.variant_id, 'quantity', ci.quantity, 'variant_name', v.name, 'sku', v.sku, 'options', v.options, 'unit_price_inr', v.price_inr,
      'line_total_inr', ci.quantity * v.price_inr, 'product_id', p.id, 'product_slug', p.slug, 'product_name', p.name, 'vendor_id', p.vendor_id,
      'vendor_name', vd.business_name, 'vendor_slug', vd.slug, 'category_id', p.category_id,
      'image_path', (select i.path from public.product_images i where i.product_id = p.id order by i.sort_order, i.created_at limit 1),
      'max_qty', case when v.track_inventory then least(99, v.stock_on_hand) else 99 end,
      'issue', case when not public.product_is_public(p.id) or not v.is_active then 'unavailable' when not p.is_available then 'paused'
                    when v.track_inventory and v.stock_on_hand = 0 then 'out_of_stock' when v.track_inventory and v.stock_on_hand < ci.quantity then 'limited_stock' end
    ) order by vd.business_name, p.name, v.name), '[]'::jsonb)
    into v_lines
    from public.cart_items ci join public.product_variants v on v.id = ci.variant_id join public.products p on p.id = v.product_id join public.vendors vd on vd.id = p.vendor_id
   where ci.user_id = v_uid;
  select coalesce(jsonb_agg(jsonb_build_object(
      'vendor_id', g.vendor_id, 'vendor_name', g.vendor_name, 'subtotal_inr', g.subtotal,
      'delivery', case when v_pin is null then null
                       when not exists (select 1 from public.vendor_service_areas a where a.vendor_id = g.vendor_id and a.scope = 'delivery') then 'unknown'
                       when public.vendor_covers_pin(g.vendor_id, 'delivery', v_pin) then 'yes' else 'no' end
    ) order by g.vendor_name), '[]'::jsonb)
    into v_vendors
    from (select (l ->> 'vendor_id')::uuid as vendor_id, l ->> 'vendor_name' as vendor_name, sum((l ->> 'line_total_inr')::numeric) as subtotal
            from jsonb_array_elements(v_lines) l group by 1, 2) g;
  return jsonb_build_object('lines', v_lines, 'vendors', v_vendors, 'pin', v_pin,
    'item_count', (select coalesce(sum((l ->> 'quantity')::int), 0) from jsonb_array_elements(v_lines) l),
    'subtotal_inr', (select coalesce(sum((l ->> 'line_total_inr')::numeric), 0) from jsonb_array_elements(v_lines) l),
    'orders_enabled', public.orders_enabled());
end $$;

-- ---------------------------------------------------------------- order helpers (internal)
create function public.order_note(p_note text) returns void language sql as $$
  select set_config('hn.status_note', coalesce(p_note, ''), true)
$$;

-- Puts an order's stock back exactly once.
create function public.restock_order(p_order uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.orders%rowtype;
  i record;
  v_new int;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.stock_restored then return; end if;
  for i in select oi.* from public.order_items oi where oi.order_id = p_order order by oi.variant_id loop
    update public.product_variants set stock_on_hand = stock_on_hand + i.quantity where id = i.variant_id and track_inventory returning stock_on_hand into v_new;
    if found then
      insert into public.inventory_movements (variant_id, product_id, vendor_id, delta, balance_after, reason, note, order_id)
      values (i.variant_id, i.product_id, i.vendor_id, i.quantity, v_new, 'order_cancelled', 'Order ' || o.order_number || ' cancelled', p_order);
    end if;
  end loop;
  update public.orders set stock_restored = true where id = p_order;
end $$;

-- ---------------------------------------------------------------- place_order: one checkout -> one order per vendor, atomically
create function public.place_order(p_address uuid, p_key text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles%rowtype;
  a public.customer_addresses%rowtype;
  c record;
  v_lines jsonb := '[]'::jsonb;
  v_checkout uuid;
  v_ref text;
  v_vendor record;
  v_order uuid;
  v_onum text;
  l jsonb;
  v_total numeric := 0;
  v_vtotal numeric;
  v_new int;
  v_count int := 0;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_prof from public.profiles where id = v_uid;
  if not found or v_prof.is_suspended or v_prof.role = 'admin' then raise exception 'account_suspended' using errcode = '42501'; end if;
  if not public.orders_enabled() then raise exception 'orders_closed' using errcode = 'P0001'; end if;
  if p_key is null or char_length(p_key) < 8 or char_length(p_key) > 80 then raise exception 'invalid_key' using errcode = 'P0001'; end if;

  -- A repeated submission (double click, retry, refresh) returns the checkout that already exists: no second order, no second stock deduction.
  select id into v_checkout from public.checkouts where user_id = v_uid and idempotency_key = p_key;
  if found then return v_checkout; end if;

  select * into a from public.customer_addresses where id = p_address and user_id = v_uid;
  if not found then raise exception 'address_required' using errcode = 'P0001'; end if;

  -- Validate every line under row locks, in a fixed order so two checkouts can never deadlock.
  for c in
    select ci.variant_id, ci.quantity, v.name as variant_name, v.sku, v.options, v.price_inr, v.track_inventory, v.stock_on_hand, v.is_active,
           p.id as product_id, p.slug as product_slug, p.name as product_name, p.is_available, p.vendor_id, p.category_id, vd.business_name, vd.owner_id
      from public.cart_items ci
      join public.product_variants v on v.id = ci.variant_id
      join public.products p on p.id = v.product_id
      join public.vendors vd on vd.id = p.vendor_id
     where ci.user_id = v_uid
     order by ci.variant_id
       for update of v
  loop
    if not c.is_active or not public.product_is_public(c.product_id) then raise exception 'product_unavailable:%', c.product_name using errcode = 'P0001'; end if;
    if not c.is_available then raise exception 'product_paused:%', c.product_name using errcode = 'P0001'; end if;
    if c.owner_id = v_uid then raise exception 'own_product:%', c.product_name using errcode = 'P0001'; end if;
    if c.track_inventory and c.stock_on_hand < c.quantity then raise exception 'out_of_stock:%', c.product_name || ' (' || c.variant_name || ')' using errcode = 'P0001'; end if;
    if not public.vendor_covers_pin(c.vendor_id, 'delivery', a.postal_code) then raise exception 'not_deliverable:%', c.business_name using errcode = 'P0001'; end if;
    v_lines := v_lines || jsonb_build_object('variant_id', c.variant_id, 'quantity', c.quantity, 'variant_name', c.variant_name, 'sku', c.sku, 'options', c.options,
      'price', c.price_inr, 'track', c.track_inventory, 'product_id', c.product_id, 'product_slug', c.product_slug, 'product_name', c.product_name,
      'vendor_id', c.vendor_id, 'vendor_name', c.business_name, 'category_id', c.category_id,
      'image', (select i.path from public.product_images i where i.product_id = c.product_id order by i.sort_order, i.created_at limit 1));
    v_total := v_total + c.quantity * c.price_inr;
  end loop;
  if jsonb_array_length(v_lines) = 0 then raise exception 'cart_empty' using errcode = 'P0001'; end if;

  select count(distinct l2 ->> 'vendor_id') into v_count from jsonb_array_elements(v_lines) l2;
  v_ref := 'HN-C-' || nextval('public.checkout_number_seq');
  insert into public.checkouts (reference, user_id, idempotency_key, customer_email, ship_name, ship_phone, ship_line1, ship_line2, ship_landmark, ship_city, ship_state, ship_postal_code,
                                items_total_inr, order_count)
  values (v_ref, v_uid, p_key, v_prof.email, a.full_name, a.phone, a.line1, a.line2, a.landmark, a.city, a.state, a.postal_code, v_total, v_count)
  returning id into v_checkout;

  for v_vendor in select distinct (x ->> 'vendor_id')::uuid as vendor_id, x ->> 'vendor_name' as vendor_name from jsonb_array_elements(v_lines) x order by 1 loop
    select coalesce(sum((x ->> 'quantity')::int * (x ->> 'price')::numeric), 0) into v_vtotal from jsonb_array_elements(v_lines) x where (x ->> 'vendor_id')::uuid = v_vendor.vendor_id;
    v_onum := 'HN-O-' || nextval('public.order_number_seq');
    perform public.order_note('Order placed');
    insert into public.orders (order_number, checkout_id, customer_id, vendor_id, vendor_name, items_total_inr, ship_name, ship_city, ship_state, ship_postal_code)
    values (v_onum, v_checkout, v_uid, v_vendor.vendor_id, v_vendor.vendor_name, v_vtotal, a.full_name, a.city, a.state, a.postal_code)
    returning id into v_order;
    insert into public.order_shipping (order_id, ship_phone, ship_line1, ship_line2, ship_landmark) values (v_order, a.phone, a.line1, a.line2, a.landmark);
    for l in select x from jsonb_array_elements(v_lines) x where (x ->> 'vendor_id')::uuid = v_vendor.vendor_id loop
      insert into public.order_items (order_id, variant_id, product_id, vendor_id, category_id, product_name, product_slug, variant_name, sku, options, image_path, unit_price_inr, quantity, line_total_inr)
      values (v_order, (l ->> 'variant_id')::uuid, (l ->> 'product_id')::uuid, v_vendor.vendor_id, (l ->> 'category_id')::bigint, l ->> 'product_name', l ->> 'product_slug',
              l ->> 'variant_name', l ->> 'sku', l -> 'options', l ->> 'image', (l ->> 'price')::numeric, (l ->> 'quantity')::int, (l ->> 'quantity')::int * (l ->> 'price')::numeric);
      if (l ->> 'track')::boolean then
        update public.product_variants set stock_on_hand = stock_on_hand - (l ->> 'quantity')::int where id = (l ->> 'variant_id')::uuid returning stock_on_hand into v_new;
        insert into public.inventory_movements (variant_id, product_id, vendor_id, delta, balance_after, reason, note, order_id, actor_id)
        values ((l ->> 'variant_id')::uuid, (l ->> 'product_id')::uuid, v_vendor.vendor_id, -(l ->> 'quantity')::int, v_new, 'order_placed', 'Order ' || v_onum, v_order, v_uid);
      end if;
    end loop;
    perform public.notify((select owner_id from public.vendors where id = v_vendor.vendor_id), 'order_placed', 'New order request ' || v_onum,
      'A customer has requested an order of ' || v_vtotal || ' INR. It is unpaid: payment is not configured yet.', '/vendor/orders/' || v_order);
  end loop;

  delete from public.cart_items where user_id = v_uid;
  perform public.write_audit('checkout_placed', 'checkout', v_checkout::text, jsonb_build_object('reference', v_ref, 'orders', v_count, 'items_total_inr', v_total));
  perform public.notify(v_uid, 'order_placed', 'Order request submitted (' || v_ref || ')', 'We sent your request to ' || v_count || ' seller' || case when v_count = 1 then '' else 's' end || '. Payment is not configured: nothing has been paid.', '/dashboard/orders');
  return v_checkout;
end $$;

-- ---------------------------------------------------------------- vendor fulfilment
create function public.vendor_order(p_order uuid) returns public.orders
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_selling_vendor();
  o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order and vendor_id = v_vendor for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  return o;
end $$;

create function public.vendor_respond_order(p_order uuid, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders%rowtype;
begin
  o := public.vendor_order(p_order);
  if o.status <> 'placed' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if p_decision = 'accept' then
    perform public.order_note(p_reason);
    update public.orders set status = 'confirmed', confirmed_at = now() where id = o.id;
    perform public.notify(o.customer_id, 'order_status', 'Order ' || o.order_number || ' accepted', o.vendor_name || ' accepted your order request. It is still unpaid: payment is not configured yet.', '/dashboard/orders/' || o.id);
  elsif p_decision = 'reject' then
    if coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
    perform public.order_note(p_reason);
    update public.orders set status = 'rejected', rejection_reason = left(btrim(p_reason), 500), cancelled_at = now() where id = o.id;
    perform public.restock_order(o.id);
    perform public.notify(o.customer_id, 'order_status', 'Order ' || o.order_number || ' declined', o.vendor_name || ' could not accept your request: ' || left(p_reason, 200), '/dashboard/orders/' || o.id);
  else
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  perform public.write_audit('order_' || p_decision, 'order', o.id::text, jsonb_build_object('number', o.order_number));
end $$;

create function public.vendor_mark_packed(p_order uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders%rowtype;
begin
  o := public.vendor_order(p_order);
  if o.status <> 'confirmed' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  perform public.order_note('Packed and ready to dispatch');
  update public.orders set status = 'packed' where id = o.id;
  perform public.notify(o.customer_id, 'order_status', 'Order ' || o.order_number || ' packed', o.vendor_name || ' has packed your order.', '/dashboard/orders/' || o.id);
end $$;

create function public.vendor_ship_order(p_order uuid, p_carrier text, p_tracking text, p_url text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.orders%rowtype;
  v_ship uuid;
begin
  o := public.vendor_order(p_order);
  if o.status <> 'packed' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_carrier, ''))) < 2 or char_length(btrim(coalesce(p_tracking, ''))) < 3 then raise exception 'tracking_required' using errcode = 'P0001'; end if;
  insert into public.shipments (order_id, carrier, tracking_number, tracking_url) values (o.id, left(btrim(p_carrier), 80), left(btrim(p_tracking), 80), nullif(btrim(coalesce(p_url, '')), ''))
  returning id into v_ship;
  insert into public.shipment_events (shipment_id, status, note, actor_id) values (v_ship, 'shipped', 'Dispatched with ' || left(btrim(p_carrier), 80), auth.uid());
  perform public.order_note('Dispatched with ' || left(btrim(p_carrier), 80) || ', tracking ' || left(btrim(p_tracking), 80));
  update public.orders set status = 'shipped', shipped_at = now() where id = o.id;
  perform public.notify(o.customer_id, 'order_status', 'Order ' || o.order_number || ' shipped', 'Tracking: ' || left(btrim(p_carrier), 80) || ' ' || left(btrim(p_tracking), 80), '/dashboard/orders/' || o.id);
  return v_ship;
end $$;

create function public.vendor_update_shipment(p_order uuid, p_status public.shipment_status, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.orders%rowtype;
  s public.shipments%rowtype;
begin
  o := public.vendor_order(p_order);
  select * into s from public.shipments where order_id = o.id for update;
  if not found or o.status <> 'shipped' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if p_status = 'shipped' or s.status = 'delivered' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  update public.shipments set status = p_status, delivered_at = case when p_status = 'delivered' then now() else delivered_at end where id = s.id;
  insert into public.shipment_events (shipment_id, status, note, actor_id) values (s.id, p_status, left(btrim(p_note), 300), auth.uid());
  if p_status = 'delivered' then
    perform public.order_note('Delivered');
    update public.orders set status = 'delivered', delivered_at = now() where id = o.id;
  end if;
  perform public.notify(o.customer_id, 'order_status', 'Order ' || o.order_number || ': ' || replace(p_status::text, '_', ' '), coalesce(left(btrim(p_note), 200), 'Shipment update from ' || o.vendor_name || '.'), '/dashboard/orders/' || o.id);
end $$;

-- ---------------------------------------------------------------- customer: cancel, return / replacement, dispute
create function public.cancel_order(p_order uuid, p_reason text default null) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.orders%rowtype;
  v_req uuid;
begin
  select * into o from public.orders where id = p_order and customer_id = auth.uid() for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if o.status = 'placed' then
    perform public.order_note(coalesce(nullif(btrim(p_reason), ''), 'Cancelled by the customer'));
    update public.orders set status = 'cancelled', cancel_reason = left(btrim(p_reason), 500), cancelled_at = now() where id = o.id;
    perform public.restock_order(o.id);
    perform public.notify((select owner_id from public.vendors where id = o.vendor_id), 'order_status', 'Order ' || o.order_number || ' cancelled', 'The customer cancelled before you accepted it.', '/vendor/orders/' || o.id);
    return 'cancelled';
  elsif o.status in ('confirmed', 'packed') then
    if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
    insert into public.order_requests (order_id, kind, reason, requested_by) values (o.id, 'cancel', left(btrim(p_reason), 500), auth.uid())
    returning id into v_req;
    perform public.notify((select owner_id from public.vendors where id = o.vendor_id), 'order_request', 'Cancellation requested for ' || o.order_number, left(btrim(p_reason), 200), '/vendor/orders/' || o.id);
    perform public.notify_admins('order_request', 'Cancellation requested', o.order_number || ' (' || o.vendor_name || ')', '/admin/orders/' || o.id);
    return 'requested';
  end if;
  raise exception 'cannot_cancel' using errcode = 'P0001';
end $$;

create function public.request_return(p_order uuid, p_kind public.order_request_kind, p_reason text, p_details text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.orders%rowtype;
  i record;
  pol public.product_category_policies%rowtype;
  v_unconfigured text[] := '{}';
  v_window int;
  v_id uuid;
begin
  if p_kind = 'cancel' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  select * into o from public.orders where id = p_order and customer_id = auth.uid() for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if o.status <> 'delivered' then raise exception 'not_delivered' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  for i in select distinct oi.category_id, c.name from public.order_items oi join public.product_categories c on c.id = oi.category_id where oi.order_id = o.id loop
    select * into pol from public.product_category_policies where category_id = i.category_id;
    if not found or (p_kind = 'return' and pol.returns_allowed is null) or (p_kind = 'replacement' and pol.replacements_allowed is null) then
      v_unconfigured := array_append(v_unconfigured, i.name);
      continue;
    end if;
    if (p_kind = 'return' and not pol.returns_allowed) or (p_kind = 'replacement' and not pol.replacements_allowed) then
      raise exception 'not_allowed_by_policy:%', i.name using errcode = 'P0001';
    end if;
    v_window := case when p_kind = 'return' then pol.return_window_days else pol.replacement_window_days end;
    if v_window is not null and now() > o.delivered_at + make_interval(days => v_window) then raise exception 'window_expired:%', i.name using errcode = 'P0001'; end if;
  end loop;
  insert into public.order_requests (order_id, kind, reason, details, policy_note, requested_by)
  values (o.id, p_kind, left(btrim(p_reason), 500), left(btrim(p_details), 2000),
          case when cardinality(v_unconfigured) > 0 then 'No ' || p_kind::text || ' policy is configured yet for: ' || array_to_string(v_unconfigured, ', ') || '. The seller and our team will decide.' else 'Within the configured policy.' end, auth.uid())
  returning id into v_id;
  perform public.notify((select owner_id from public.vendors where id = o.vendor_id), 'order_request', initcap(p_kind::text) || ' requested for ' || o.order_number, left(btrim(p_reason), 200), '/vendor/orders/' || o.id);
  perform public.notify_admins('order_request', initcap(p_kind::text) || ' requested', o.order_number || ' (' || o.vendor_name || ')', '/admin/orders/' || o.id);
  perform public.write_audit('order_request_' || p_kind::text, 'order', o.id::text, jsonb_build_object('request', v_id));
  return v_id;
end $$;

create function public.open_dispute(p_order uuid, p_description text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.orders%rowtype;
  v_id uuid;
begin
  select * into o from public.orders where id = p_order and customer_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_description, ''))) < 10 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  insert into public.order_disputes (order_id, raised_by, description) values (o.id, auth.uid(), left(btrim(p_description), 3000)) returning id into v_id;
  perform public.notify_admins('order_dispute', 'Dispute opened', o.order_number || ' (' || o.vendor_name || ')', '/admin/orders/' || o.id);
  perform public.write_audit('order_dispute_opened', 'order', o.id::text, jsonb_build_object('dispute', v_id));
  return v_id;
end $$;

-- ---------------------------------------------------------------- request decisions (vendor for their own orders, admin for any)
create function public.decide_order_request(p_request uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.order_requests%rowtype;
  o public.orders%rowtype;
  v_admin boolean := public.is_admin();
  v_to public.order_request_status;
begin
  select * into r from public.order_requests where id = p_request for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  select * into o from public.orders where id = r.order_id for update;
  if not v_admin and not (public.is_vendor_member(o.vendor_id) and public.vendor_can(o.vendor_id, 'products')) then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_decision = 'approve' and r.status = 'requested' then
    if r.kind = 'cancel' then
      if o.status not in ('confirmed', 'packed') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
      perform public.order_note('Cancellation approved: ' || coalesce(nullif(btrim(p_note), ''), 'no note'));
      update public.orders set status = 'cancelled', cancel_reason = left(btrim(r.reason), 500), cancelled_at = now() where id = o.id;
      perform public.restock_order(o.id);
      v_to := 'completed';
    else
      v_to := 'approved';
    end if;
  elsif p_decision = 'reject' and r.status = 'requested' then
    if coalesce(btrim(p_note), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
    v_to := 'rejected';
  elsif p_decision = 'complete' and r.status = 'approved' and r.kind <> 'cancel' then
    v_to := 'completed';
  else
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  update public.order_requests set status = v_to, decided_by = auth.uid(), decided_at = now(), decision_note = left(btrim(p_note), 1000) where id = r.id;
  perform public.write_audit('order_request_' || p_decision, 'order', o.id::text, jsonb_build_object('request', r.id, 'kind', r.kind, 'by', case when v_admin then 'admin' else 'vendor' end));
  perform public.notify(o.customer_id, 'order_request', initcap(r.kind::text) || ' request ' || v_to::text, 'Order ' || o.order_number || coalesce(': ' || left(btrim(p_note), 200), '.'), '/dashboard/orders/' || o.id);
end $$;

-- ---------------------------------------------------------------- admin
create function public.admin_cancel_order(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if o.status not in ('placed', 'confirmed', 'packed') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  perform public.order_note('Cancelled by Hasiru Nidhi: ' || left(btrim(p_reason), 300));
  update public.orders set status = 'cancelled', cancel_reason = left(btrim(p_reason), 500), cancelled_at = now() where id = o.id;
  perform public.restock_order(o.id);
  perform public.write_audit('order_cancelled_by_admin', 'order', o.id::text, jsonb_build_object('reason', p_reason));
  perform public.notify(o.customer_id, 'order_status', 'Order ' || o.order_number || ' cancelled', left(btrim(p_reason), 200), '/dashboard/orders/' || o.id);
  perform public.notify((select owner_id from public.vendors where id = o.vendor_id), 'order_status', 'Order ' || o.order_number || ' cancelled', left(btrim(p_reason), 200), '/vendor/orders/' || o.id);
end $$;

create function public.admin_resolve_dispute(p_dispute uuid, p_status public.dispute_status, p_resolution text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.order_disputes%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into d from public.order_disputes where id = p_dispute for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_status = 'open' or (d.status in ('resolved', 'dismissed')) then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if p_status in ('resolved', 'dismissed') and char_length(btrim(coalesce(p_resolution, ''))) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;
  update public.order_disputes set status = p_status, resolution = left(btrim(p_resolution), 2000), resolved_by = case when p_status in ('resolved', 'dismissed') then auth.uid() end,
         resolved_at = case when p_status in ('resolved', 'dismissed') then now() end where id = d.id;
  perform public.write_audit('order_dispute_' || p_status::text, 'order', d.order_id::text, jsonb_build_object('dispute', d.id));
  if p_status in ('resolved', 'dismissed') then
    perform public.notify(d.raised_by, 'order_dispute', 'Your dispute was ' || p_status::text, left(btrim(p_resolution), 200), '/dashboard/orders/' || d.order_id);
  end if;
end $$;

-- ---------------------------------------------------------------- the product page learns each category's return policy (replaces the M3 function; same signature)
create or replace function public.get_product_public(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare pr public.products%rowtype;
begin
  select * into pr from public.products where slug = p_slug;
  if not found or not public.product_is_public(pr.id) then return null; end if;
  return jsonb_build_object(
    'id', pr.id, 'slug', pr.slug, 'name', pr.name, 'summary', pr.summary, 'description', pr.description, 'brand', pr.brand,
    'attributes', pr.attributes, 'is_available', pr.is_available, 'published_at', pr.published_at,
    'category', (select jsonb_build_object('slug', c.slug, 'name', c.name) from public.product_categories c where c.id = pr.category_id),
    'vendor', (select jsonb_build_object('slug', v.slug, 'business_name', v.business_name, 'description', v.description, 'city', v.city, 'state', v.state) from public.vendors v where v.id = pr.vendor_id),
    'images', coalesce((select jsonb_agg(jsonb_build_object('path', i.path, 'alt', i.alt) order by i.sort_order, i.created_at) from public.product_images i where i.product_id = pr.id), '[]'::jsonb),
    'variants', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'sku', x.sku, 'name', x.name, 'options', x.options, 'price_inr', x.price_inr, 'weight_grams', x.weight_grams,
                         'in_stock', (not x.track_inventory or x.stock_on_hand > 0)) order by x.sort_order, x.created_at)
                         from public.product_variants x where x.product_id = pr.id and x.is_active), '[]'::jsonb),
    'return_policy', (select jsonb_build_object('configured', true, 'returns_allowed', q.returns_allowed, 'return_window_days', q.return_window_days,
                        'replacements_allowed', q.replacements_allowed, 'replacement_window_days', q.replacement_window_days, 'notes', q.notes)
                        from public.product_category_policies q where q.category_id = pr.category_id),
    'orders_enabled', public.orders_enabled());
end $$;

-- ---------------------------------------------------------------- privileges
revoke all on function public.record_order_status(), public.order_items_immutable(), public.shipment_events_append_only(), public.order_note(text), public.restock_order(uuid),
  public.vendor_order(uuid) from public, anon, authenticated;
revoke all on function public.orders_enabled() from public;
grant execute on function public.orders_enabled() to anon, authenticated;
revoke all on function public.save_address(jsonb), public.delete_address(uuid), public.set_default_address(uuid), public.cart_set_item(uuid, int), public.cart_clear(), public.get_cart(text),
  public.place_order(uuid, text), public.vendor_respond_order(uuid, text, text), public.vendor_mark_packed(uuid), public.vendor_ship_order(uuid, text, text, text),
  public.vendor_update_shipment(uuid, public.shipment_status, text), public.cancel_order(uuid, text), public.request_return(uuid, public.order_request_kind, text, text),
  public.open_dispute(uuid, text), public.decide_order_request(uuid, text, text), public.admin_cancel_order(uuid, text), public.admin_resolve_dispute(uuid, public.dispute_status, text) from public, anon;
grant execute on function public.save_address(jsonb), public.delete_address(uuid), public.set_default_address(uuid), public.cart_set_item(uuid, int), public.cart_clear(), public.get_cart(text),
  public.place_order(uuid, text), public.vendor_respond_order(uuid, text, text), public.vendor_mark_packed(uuid), public.vendor_ship_order(uuid, text, text, text),
  public.vendor_update_shipment(uuid, public.shipment_status, text), public.cancel_order(uuid, text), public.request_return(uuid, public.order_request_kind, text, text),
  public.open_dispute(uuid, text), public.decide_order_request(uuid, text, text), public.admin_cancel_order(uuid, text), public.admin_resolve_dispute(uuid, public.dispute_status, text) to authenticated;
