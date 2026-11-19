-- Hasiru Nidhi marketplace - M3: product catalogue (Phase 4). ADDITIVE: no existing table or function is changed.
-- Apply AFTER 20261120000100_vendors_foundation.sql.
--
--  * Admin-managed product categories (the six from the brief are seeded as reference data, NOT inventory). Slugs never change.
--  * Vendor-owned products, variants (size, weight, pack quantity, pot size ...), images, and an APPEND-ONLY inventory movement log.
--  * Selling requires the vendor's 'products' capability (M1). Product approval is a SEPARATE admin decision: an approved vendor's new
--    product is never public automatically, and editing an approved product's content sends it back for review.
--  * Vendors never write these tables directly: every change is a function that re-checks ownership, capability and state.
--  * The public never reads the tables either. It reads through functions that expose only what a shopper may see (no stock counts) and
--    only while marketplace_products_enabled is ON.
--  * No cart, checkout, order, price rule, tax or shipping fee exists here (Phase 5 and policy decisions).

create type public.product_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'suspended', 'archived');
create type public.inventory_reason as enum ('initial', 'restock', 'correction', 'damaged', 'returned_to_stock', 'other');

-- ---------------------------------------------------------------- categories (admin managed)
create table public.product_categories (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint product_categories_slug check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60 and slug <> 'all'),
  constraint product_categories_lens check (char_length(name) between 2 and 80 and coalesce(char_length(description), 0) <= 400)
);
-- The six categories from the business brief. Reference data only.
insert into public.product_categories (slug, name, description, sort_order) values
  ('plants-seeds-saplings', 'Plants, seeds and saplings', 'Live plants, seeds and saplings for gardens, balconies and farms.', 10),
  ('gardening-tools-accessories', 'Gardening tools and accessories', 'Tools, pots, planters and everyday gardening accessories.', 20),
  ('organic-fertilisers-compost', 'Organic fertilisers and compost', 'Compost, manure and other fertilisers for growing.', 30),
  ('handmade-eco-friendly', 'Handmade and eco-friendly products', 'Handmade, reusable and low-impact products.', 40),
  ('farm-produce-organic-food', 'Farm produce and organic food', 'Produce and food from farms and growers.', 50),
  ('nature-lifestyle', 'Nature and lifestyle products', 'Nature-inspired home and lifestyle products.', 60);

create function public.product_categories_slug_immutable() returns trigger language plpgsql as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'slug_immutable' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger product_categories_slug_immutable before update on public.product_categories for each row execute function public.product_categories_slug_immutable();
create trigger audit_product_categories after insert or update or delete on public.product_categories for each row execute function public.audit_admin_change();

-- ---------------------------------------------------------------- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  category_id bigint not null references public.product_categories (id) on delete restrict,
  slug text not null unique,
  name text not null,
  summary text,
  description text not null default '',
  brand text,
  attributes jsonb not null default '[]'::jsonb,       -- specifications: [{label, value}], validated
  status public.product_status not null default 'draft',
  rejection_reason text,
  is_available boolean not null default true,           -- the vendor can pause selling without losing the listing
  is_featured boolean not null default false,           -- admin only
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_len check (char_length(name) between 3 and 120),
  constraint products_summary_len check (summary is null or char_length(summary) <= 240),
  constraint products_desc_len check (char_length(description) <= 8000),
  constraint products_brand_len check (brand is null or char_length(brand) <= 80),
  constraint products_attributes check (jsonb_typeof(attributes) = 'array' and jsonb_array_length(attributes) <= 20 and pg_column_size(attributes) <= 8192)
);
create index products_vendor_idx on public.products (vendor_id, status);
create index products_category_idx on public.products (category_id) where status = 'approved';
create index products_status_idx on public.products (status);
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  sku text not null,
  name text not null,                                   -- shown to shoppers, e.g. "6 inch pot, pack of 2"
  options jsonb not null default '{}'::jsonb,           -- {"Size": "Medium", "Pot size": "6 inch"} (validated)
  price_inr numeric(10, 2) not null,
  track_inventory boolean not null default true,
  stock_on_hand int not null default 0,
  weight_grams int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_sku check (sku ~ '^[A-Za-z0-9._-]{1,40}$'),
  constraint product_variants_name_len check (char_length(name) between 1 and 120),
  constraint product_variants_price check (price_inr >= 0.01 and price_inr <= 10000000),
  constraint product_variants_stock check (stock_on_hand >= 0 and stock_on_hand <= 1000000),
  constraint product_variants_weight check (weight_grams is null or (weight_grams > 0 and weight_grams <= 1000000)),
  constraint product_variants_options check (jsonb_typeof(options) = 'object' and pg_column_size(options) <= 2048)
);
create unique index product_variants_sku_unique on public.product_variants (product_id, lower(sku));
create index product_variants_product_idx on public.product_variants (product_id, sort_order);
create trigger product_variants_touch before update on public.product_variants for each row execute function public.touch_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null unique,                            -- "<vendor id>/<product id>/<file>" in the public product-images bucket
  alt text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint product_images_alt check (alt is null or char_length(alt) <= 200)
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

-- Every stock change, forever. Balance is on the variant; this is the history that explains it.
create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  delta int not null check (delta <> 0),
  balance_after int not null check (balance_after >= 0),
  reason public.inventory_reason not null,
  note text check (note is null or char_length(note) <= 300),
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, id desc);
create index inventory_movements_vendor_idx on public.inventory_movements (vendor_id, id desc);
create function public.inventory_movements_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'inventory_log_is_append_only' using errcode = 'P0001';
end $$;
create trigger inventory_movements_append_only before update or delete on public.inventory_movements for each row execute function public.inventory_movements_append_only();

-- ---------------------------------------------------------------- helpers
create function public.products_enabled() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.setting_bool('marketplace_products_enabled', false)
$$;

-- A shopper may see a product only while: module ON, product approved, category active, vendor verified with the products capability.
create function public.product_is_public(p_product uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.products_enabled() and exists (
    select 1 from public.products p join public.product_categories c on c.id = p.category_id
     where p.id = p_product and p.status = 'approved' and c.is_active and public.vendor_can(p.vendor_id, 'products')
  )
$$;

create function public.valid_product_attributes(j jsonb) returns boolean
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

create function public.valid_variant_options(j jsonb) returns boolean
language plpgsql immutable as $$
declare k text;
begin
  if jsonb_typeof(j) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(j)) > 5 then return false; end if;
  for k in select jsonb_object_keys(j) loop
    if char_length(k) not between 1 and 40 or jsonb_typeof(j -> k) <> 'string' or char_length(btrim(j ->> k)) not between 1 and 60 then return false; end if;
  end loop;
  return true;
end $$;

create function public.product_slug(p_name text) returns text
language plpgsql volatile set search_path = public, pg_temp as $$
declare
  v_base text := trim(both '-' from lower(regexp_replace(coalesce(p_name, ''), '[^a-zA-Z0-9]+', '-', 'g')));
  v_slug text;
begin
  if v_base = '' then v_base := 'product'; end if;
  v_base := left(v_base, 50);
  loop
    v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    exit when not exists (select 1 from public.products where slug = v_slug);
  end loop;
  return v_slug;
end $$;

-- ---------------------------------------------------------------- row level security
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.inventory_movements enable row level security;

create policy product_categories_read on public.product_categories for select to anon, authenticated using (is_active or public.is_admin());
create policy product_categories_admin on public.product_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Owners and admins read the tables. Shoppers go through the public functions below, which never reveal stock counts.
create policy products_select on public.products for select to authenticated using (public.is_vendor_member(vendor_id) or public.is_admin());
create policy product_variants_select on public.product_variants for select to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and (public.is_vendor_member(p.vendor_id) or public.is_admin())));
create policy product_images_select on public.product_images for select to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and (public.is_vendor_member(p.vendor_id) or public.is_admin())));
create policy inventory_movements_select on public.inventory_movements for select to authenticated using (public.is_vendor_member(vendor_id) or public.is_admin());

revoke insert, update, delete on public.products, public.product_variants, public.product_images, public.inventory_movements from anon, authenticated;
revoke all on public.products, public.product_variants, public.product_images, public.inventory_movements from anon;
revoke insert, update, delete on public.product_categories from anon;

-- ---------------------------------------------------------------- vendor functions
-- The caller's vendor, only if it may sell products right now.
create function public.my_selling_vendor() returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select id into v_id from public.vendors where owner_id = auth.uid();
  if v_id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  if not public.vendor_can(v_id, 'products') then raise exception 'capability_not_approved' using errcode = 'P0001'; end if;
  return v_id;
end $$;

create function public.save_product(p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_selling_vendor();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_cat bigint := nullif(p ->> 'category_id', '')::bigint;
  v_name text := public.vendor_text(p, 'name', 120);
  v_attr jsonb := coalesce(p -> 'attributes', '[]'::jsonb);
  pr public.products%rowtype;
  v_changed boolean;
begin
  if v_name is null or char_length(v_name) < 3 then raise exception 'name_required' using errcode = 'P0001'; end if;
  if v_cat is null or not exists (select 1 from public.product_categories where id = v_cat and is_active) then raise exception 'invalid_category' using errcode = 'P0001'; end if;
  if not public.valid_product_attributes(v_attr) then raise exception 'invalid_attributes' using errcode = 'P0001'; end if;
  v_attr := (select coalesce(jsonb_agg(jsonb_build_object('label', btrim(e ->> 'label'), 'value', btrim(e ->> 'value'))), '[]'::jsonb) from jsonb_array_elements(v_attr) e);

  if v_id is null then
    insert into public.products (vendor_id, category_id, slug, name, summary, description, brand, attributes)
    values (v_vendor, v_cat, public.product_slug(v_name), v_name, public.vendor_text(p, 'summary', 240), coalesce(public.vendor_text(p, 'description', 8000), ''),
            public.vendor_text(p, 'brand', 80), v_attr)
    returning id into v_id;
    perform public.write_audit('product_created', 'product', v_id::text, jsonb_build_object('vendor', v_vendor));
    return v_id;
  end if;

  select * into pr from public.products where id = v_id and vendor_id = v_vendor for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if pr.status = 'pending_review' then raise exception 'product_locked_in_review' using errcode = 'P0001'; end if;
  if pr.status in ('suspended', 'archived') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  v_changed := pr.name is distinct from v_name or pr.category_id is distinct from v_cat or pr.summary is distinct from public.vendor_text(p, 'summary', 240)
    or pr.description is distinct from coalesce(public.vendor_text(p, 'description', 8000), '') or pr.brand is distinct from public.vendor_text(p, 'brand', 80)
    or pr.attributes is distinct from v_attr;
  update public.products set name = v_name, category_id = v_cat, summary = public.vendor_text(p, 'summary', 240),
         description = coalesce(public.vendor_text(p, 'description', 8000), ''), brand = public.vendor_text(p, 'brand', 80), attributes = v_attr,
         -- A live product whose content changed is taken down until an administrator approves the new version.
         status = case when pr.status = 'approved' and v_changed then 'pending_review' else pr.status end,
         submitted_at = case when pr.status = 'approved' and v_changed then now() else submitted_at end
   where id = v_id;
  if pr.status = 'approved' and v_changed then
    perform public.write_audit('product_resubmitted', 'product', v_id::text, '{}'::jsonb);
    perform public.notify_admins('product_submitted', 'Product edited and awaiting review', v_name || ' was changed and needs review before it is public again.', '/admin/products/' || v_id);
  end if;
  return v_id;
end $$;

create function public.save_product_variant(p jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_selling_vendor();
  v_product uuid := nullif(p ->> 'product_id', '')::uuid;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_sku text := public.vendor_text(p, 'sku', 40);
  v_name text := public.vendor_text(p, 'name', 120);
  v_opts jsonb := coalesce(p -> 'options', '{}'::jsonb);
  v_price numeric;
  v_weight int := nullif(p ->> 'weight_grams', '')::int;
  v_track boolean := coalesce((p ->> 'track_inventory')::boolean, true);
  v_active boolean := coalesce((p ->> 'is_active')::boolean, true);
  v_initial int := coalesce(nullif(p ->> 'initial_stock', '')::int, 0);
  pr public.products%rowtype;
  cur public.product_variants%rowtype;
begin
  begin v_price := nullif(p ->> 'price_inr', '')::numeric; exception when others then raise exception 'invalid_price' using errcode = 'P0001'; end;
  select * into pr from public.products where id = v_product and vendor_id = v_vendor for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if pr.status not in ('draft', 'rejected', 'approved') then raise exception 'product_locked' using errcode = 'P0001'; end if;
  if v_sku is null or v_sku !~ '^[A-Za-z0-9._-]{1,40}$' then raise exception 'invalid_sku' using errcode = 'P0001'; end if;
  if v_name is null then raise exception 'variant_name_required' using errcode = 'P0001'; end if;
  if v_price is null or v_price < 0.01 or v_price > 10000000 then raise exception 'invalid_price' using errcode = 'P0001'; end if;
  if v_weight is not null and (v_weight <= 0 or v_weight > 1000000) then raise exception 'invalid_weight' using errcode = 'P0001'; end if;
  if not public.valid_variant_options(v_opts) then raise exception 'invalid_options' using errcode = 'P0001'; end if;
  if v_initial < 0 or v_initial > 1000000 then raise exception 'invalid_quantity' using errcode = 'P0001'; end if;

  if v_id is null then
    if (select count(*) from public.product_variants where product_id = v_product) >= 30 then raise exception 'too_many_variants' using errcode = 'P0001'; end if;
    if exists (select 1 from public.product_variants where product_id = v_product and lower(sku) = lower(v_sku)) then raise exception 'duplicate_sku' using errcode = 'P0001'; end if;
    insert into public.product_variants (product_id, sku, name, options, price_inr, track_inventory, stock_on_hand, weight_grams, is_active, sort_order)
    values (v_product, v_sku, v_name, v_opts, v_price, v_track, case when v_track then v_initial else 0 end, v_weight, v_active,
            (select coalesce(max(sort_order), 0) + 10 from public.product_variants where product_id = v_product))
    returning id into v_id;
    if v_track and v_initial > 0 then
      insert into public.inventory_movements (variant_id, product_id, vendor_id, delta, balance_after, reason, note, actor_id)
      values (v_id, v_product, v_vendor, v_initial, v_initial, 'initial', 'Opening stock', auth.uid());
    end if;
    return v_id;
  end if;

  select * into cur from public.product_variants where id = v_id and product_id = v_product for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if exists (select 1 from public.product_variants where product_id = v_product and lower(sku) = lower(v_sku) and id <> v_id) then raise exception 'duplicate_sku' using errcode = 'P0001'; end if;
  -- Stock is NOT editable here: it changes only through adjust_inventory(), which writes the history.
  update public.product_variants set sku = v_sku, name = v_name, options = v_opts, price_inr = v_price, track_inventory = v_track, weight_grams = v_weight, is_active = v_active
   where id = v_id;
  return v_id;
end $$;

-- mode 'set' makes the balance exactly p_quantity; mode 'add' adds a positive or negative amount. Every change is recorded.
create function public.adjust_inventory(p_variant uuid, p_mode text, p_quantity int, p_reason public.inventory_reason, p_note text default null) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_selling_vendor();
  cur public.product_variants%rowtype;
  v_new int;
begin
  if p_mode not in ('set', 'add') or p_quantity is null then raise exception 'invalid_quantity' using errcode = 'P0001'; end if;
  if p_reason = 'initial' then raise exception 'invalid_quantity' using errcode = 'P0001'; end if;
  select v.* into cur from public.product_variants v join public.products p on p.id = v.product_id where v.id = p_variant and p.vendor_id = v_vendor for update of v;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if not cur.track_inventory then raise exception 'inventory_not_tracked' using errcode = 'P0001'; end if;
  v_new := case when p_mode = 'set' then p_quantity else cur.stock_on_hand + p_quantity end;
  if v_new < 0 or v_new > 1000000 then raise exception 'invalid_quantity' using errcode = 'P0001'; end if;
  if v_new = cur.stock_on_hand then return v_new; end if;
  update public.product_variants set stock_on_hand = v_new where id = cur.id;
  insert into public.inventory_movements (variant_id, product_id, vendor_id, delta, balance_after, reason, note, actor_id)
  values (cur.id, cur.product_id, v_vendor, v_new - cur.stock_on_hand, v_new, p_reason, left(btrim(p_note), 300), auth.uid());
  return v_new;
end $$;

create function public.register_product_image(p_product uuid, p_path text, p_alt text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_selling_vendor();
  pr public.products%rowtype;
  v_id uuid;
begin
  select * into pr from public.products where id = p_product and vendor_id = v_vendor for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if pr.status not in ('draft', 'rejected', 'approved') then raise exception 'product_locked' using errcode = 'P0001'; end if;
  if p_path is null or p_path not like v_vendor::text || '/' || p_product::text || '/%' or char_length(p_path) > 300 or p_path like '%..%' then raise exception 'forbidden' using errcode = '42501'; end if;
  if (select count(*) from public.product_images where product_id = p_product) >= 10 then raise exception 'too_many_images' using errcode = 'P0001'; end if;
  insert into public.product_images (product_id, path, alt, sort_order)
  values (p_product, p_path, left(btrim(p_alt), 200), (select coalesce(max(sort_order), 0) + 10 from public.product_images where product_id = p_product))
  returning id into v_id;
  -- Photos are part of what was approved: changing them on a live product sends it back for review.
  if pr.status = 'approved' then
    update public.products set status = 'pending_review', submitted_at = now() where id = p_product;
    perform public.notify_admins('product_submitted', 'Product edited and awaiting review', pr.name || ' has new photos and needs review before it is public again.', '/admin/products/' || p_product);
  end if;
  return v_id;
end $$;

create function public.delete_product_image(p_image uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_selling_vendor();
  i public.product_images%rowtype;
  pr public.products%rowtype;
begin
  select i2.* into i from public.product_images i2 join public.products p on p.id = i2.product_id where i2.id = p_image and p.vendor_id = v_vendor for update of i2;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  select * into pr from public.products where id = i.product_id for update;
  if pr.status not in ('draft', 'rejected', 'approved') then raise exception 'product_locked' using errcode = 'P0001'; end if;
  -- A live product must keep at least one photo; to replace the last one, add the new photo first.
  if pr.status = 'approved' and (select count(*) from public.product_images where product_id = pr.id) <= 1 then raise exception 'last_image' using errcode = 'P0001'; end if;
  delete from public.product_images where id = i.id;
  if pr.status = 'approved' then
    update public.products set status = 'pending_review', submitted_at = now() where id = pr.id;
    perform public.notify_admins('product_submitted', 'Product edited and awaiting review', pr.name || ' had a photo removed and needs review before it is public again.', '/admin/products/' || pr.id);
  end if;
  return i.path;
end $$;

create function public.reorder_product_images(p_product uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_selling_vendor();
  pr public.products%rowtype;
begin
  select * into pr from public.products where id = p_product and vendor_id = v_vendor for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if pr.status not in ('draft', 'rejected', 'approved') then raise exception 'product_locked' using errcode = 'P0001'; end if;
  if (select count(*) from public.product_images where product_id = p_product) <> coalesce(cardinality(p_ids), 0)
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.product_images where id = x and product_id = p_product)) then
    raise exception 'invalid_order' using errcode = 'P0001';
  end if;
  update public.product_images i set sort_order = o.ord * 10 from unnest(p_ids) with ordinality as o(id, ord) where i.id = o.id;
end $$;

create function public.set_product_availability(p_product uuid, p_available boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_vendor uuid := public.my_selling_vendor();
begin
  update public.products set is_available = p_available where id = p_product and vendor_id = v_vendor;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
end $$;

-- What a product needs before an administrator can review it. Returns the missing items.
create function public.product_missing_items(p_product uuid) returns text[]
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  pr public.products%rowtype;
  v_missing text[] := '{}';
begin
  select * into pr from public.products where id = p_product;
  if not found then return array['product']; end if;
  if char_length(pr.name) < 3 then v_missing := array_append(v_missing, 'name'); end if;
  if char_length(btrim(pr.description)) < 30 then v_missing := array_append(v_missing, 'description'); end if;
  if not exists (select 1 from public.product_images where product_id = pr.id) then v_missing := array_append(v_missing, 'images'); end if;
  if not exists (select 1 from public.product_variants where product_id = pr.id and is_active) then v_missing := array_append(v_missing, 'variants'); end if;
  -- Delivery coverage is mandatory (owner decision D4): without it nobody could ever receive the product.
  if not exists (select 1 from public.vendor_service_areas where vendor_id = pr.vendor_id and scope = 'delivery') then v_missing := array_append(v_missing, 'delivery_areas'); end if;
  return v_missing;
end $$;

create function public.submit_product(p_product uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_selling_vendor();
  pr public.products%rowtype;
  v_missing text[];
begin
  select * into pr from public.products where id = p_product and vendor_id = v_vendor for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if pr.status not in ('draft', 'rejected') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  v_missing := public.product_missing_items(p_product);
  if cardinality(v_missing) > 0 then raise exception 'incomplete_product: %', array_to_string(v_missing, ',') using errcode = 'P0001'; end if;
  update public.products set status = 'pending_review', submitted_at = now(), rejection_reason = null where id = p_product;
  perform public.write_audit('product_submitted', 'product', p_product::text, '{}'::jsonb);
  perform public.notify_admins('product_submitted', 'Product awaiting review', pr.name || ' was submitted for review.', '/admin/products/' || p_product);
end $$;

create function public.archive_product(p_product uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_vendor uuid := public.my_selling_vendor();
begin
  update public.products set status = 'archived' where id = p_product and vendor_id = v_vendor and status in ('draft', 'rejected', 'approved', 'pending_review');
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform public.write_audit('product_archived', 'product', p_product::text, '{}'::jsonb);
end $$;

create function public.restore_product(p_product uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_vendor uuid := public.my_selling_vendor();
begin
  -- A restored product starts again as a draft: it must be reviewed before it can be public again.
  update public.products set status = 'draft', published_at = null where id = p_product and vendor_id = v_vendor and status = 'archived';
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform public.write_audit('product_restored', 'product', p_product::text, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------- admin functions
create function public.admin_review_product(p_product uuid, p_decision text, p_reason text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  pr public.products%rowtype;
  v_to public.product_status;
  v_missing text[];
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into pr from public.products where id = p_product for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_decision = 'approve' and pr.status = 'pending_review' then
    if not public.vendor_can(pr.vendor_id, 'products') then raise exception 'capability_not_approved' using errcode = 'P0001'; end if;
    v_missing := public.product_missing_items(p_product);
    if cardinality(v_missing) > 0 then raise exception 'incomplete_product: %', array_to_string(v_missing, ',') using errcode = 'P0001'; end if;
    v_to := 'approved';
  elsif p_decision = 'reject' and pr.status = 'pending_review' then v_to := 'rejected';
  elsif p_decision = 'request_changes' and pr.status = 'pending_review' then v_to := 'draft';
  elsif p_decision = 'suspend' and pr.status = 'approved' then v_to := 'suspended';
  elsif p_decision = 'reinstate' and pr.status = 'suspended' then v_to := 'approved';
  else raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if p_decision in ('reject', 'request_changes', 'suspend') and coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
  update public.products set status = v_to, reviewed_by = auth.uid(), reviewed_at = now(),
         rejection_reason = case when p_decision in ('reject', 'request_changes', 'suspend') then left(btrim(p_reason), 1000) else null end,
         published_at = case when v_to = 'approved' and published_at is null then now() else published_at end,
         is_featured = case when v_to = 'approved' then is_featured else false end
   where id = p_product;
  perform public.write_audit('product_' || p_decision, 'product', p_product::text, jsonb_build_object('from', pr.status, 'to', v_to, 'reason', p_reason));
  perform public.notify((select owner_id from public.vendors where id = pr.vendor_id), 'product_' || p_decision,
    case p_decision when 'approve' then 'Product approved' when 'reject' then 'Product rejected' when 'request_changes' then 'Changes requested'
                    when 'suspend' then 'Product suspended' else 'Product reinstated' end,
    pr.name || coalesce(': ' || left(p_reason, 300), '.'), '/vendor/products/' || p_product);
end $$;

create function public.admin_set_product_featured(p_product uuid, p_featured boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.products set is_featured = p_featured where id = p_product and status = 'approved';
  if not found then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  perform public.write_audit('product_featured', 'product', p_product::text, jsonb_build_object('featured', p_featured));
end $$;

-- Gives the categories the order of the given ids (first = top). Every existing category id must be listed exactly once.
create function public.admin_reorder_product_categories(p_ids bigint[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if (select count(*) from public.product_categories) <> coalesce(cardinality(p_ids), 0)
     or (select count(distinct x) from unnest(p_ids) x) <> coalesce(cardinality(p_ids), 0)
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.product_categories where id = x)) then
    raise exception 'invalid_order' using errcode = 'P0001';
  end if;
  update public.product_categories c set sort_order = o.ord * 10 from unnest(p_ids) with ordinality as o(id, ord) where c.id = o.id;
  perform public.write_audit('product_categories_reordered', 'product_categories', 'order', jsonb_build_object('ids', to_jsonb(p_ids)));
end $$;

-- ---------------------------------------------------------------- public read functions (shoppers never read the tables)
create function public.search_products(
  p_query text default null, p_category text default null, p_vendor text default null, p_min numeric default null, p_max numeric default null,
  p_in_stock boolean default false, p_pin text default null, p_featured boolean default false, p_sort text default 'newest', p_limit int default 24, p_offset int default 0
) returns table (
  id uuid, slug text, name text, summary text, category_slug text, category_name text, vendor_slug text, vendor_name text,
  min_price numeric, max_price numeric, in_stock boolean, is_available boolean, is_featured boolean, cover_path text, cover_alt text, total_count bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  with q as (
    select nullif(btrim(coalesce(p_query, '')), '') as term,
           case when p_pin ~ '^[0-9]{6}$' then p_pin end as pin
  ), base as (
    select p.id, p.slug, p.name, p.summary, c.slug as cslug, c.name as cname, v.slug as vslug, v.business_name as vname, p.vendor_id, p.is_available, p.is_featured, p.published_at,
           (select min(x.price_inr) from public.product_variants x where x.product_id = p.id and x.is_active) as minp,
           (select max(x.price_inr) from public.product_variants x where x.product_id = p.id and x.is_active) as maxp,
           exists (select 1 from public.product_variants x where x.product_id = p.id and x.is_active and (not x.track_inventory or x.stock_on_hand > 0)) as instock,
           (select i.path from public.product_images i where i.product_id = p.id order by i.sort_order, i.created_at limit 1) as cpath,
           (select i.alt from public.product_images i where i.product_id = p.id order by i.sort_order, i.created_at limit 1) as calt
      from public.products p
      join public.product_categories c on c.id = p.category_id
      join public.vendors v on v.id = p.vendor_id
      cross join q
     where public.products_enabled() and p.status = 'approved' and c.is_active and public.vendor_can(p.vendor_id, 'products')
       and (p_category is null or c.slug = p_category)
       and (p_vendor is null or v.slug = p_vendor)
       and (not p_featured or p.is_featured)
       and (q.pin is null or public.vendor_covers_pin(p.vendor_id, 'delivery', q.pin))
       and (q.term is null or p.name ilike '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
            or p.summary ilike '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
            or c.name ilike '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
            or v.business_name ilike '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\')
  )
  select b.id, b.slug, b.name, b.summary, b.cslug, b.cname, b.vslug, b.vname, b.minp, b.maxp, b.instock, b.is_available, b.is_featured, b.cpath, b.calt,
         count(*) over () as total_count
    from base b
   where b.minp is not null
     and (p_min is null or b.minp >= p_min) and (p_max is null or b.minp <= p_max)
     and (not p_in_stock or (b.instock and b.is_available))
   order by case when p_sort = 'price_asc' then b.minp end asc, case when p_sort = 'price_desc' then b.minp end desc,
            case when p_sort = 'name' then b.name end asc, b.is_featured desc, b.published_at desc nulls last, b.id
   limit least(greatest(coalesce(p_limit, 24), 1), 48) offset greatest(coalesce(p_offset, 0), 0)
$$;

-- One product for its page: everything a shopper may see, and no stock counts.
create function public.get_product_public(p_slug text) returns jsonb
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
                         from public.product_variants x where x.product_id = pr.id and x.is_active), '[]'::jsonb));
end $$;

-- Does the seller deliver to this PIN? 'yes', 'no', or 'unknown' when the seller has not listed any delivery areas.
create function public.check_product_delivery(p_product uuid, p_pin text) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_vendor uuid;
begin
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then raise exception 'invalid_pin' using errcode = 'P0001'; end if;
  if not public.product_is_public(p_product) then raise exception 'not_found' using errcode = 'P0001'; end if;
  select vendor_id into v_vendor from public.products where id = p_product;
  if not exists (select 1 from public.vendor_service_areas where vendor_id = v_vendor and scope = 'delivery') then return 'unknown'; end if;
  return case when public.vendor_covers_pin(v_vendor, 'delivery', p_pin) then 'yes' else 'no' end;
end $$;

create function public.get_vendor_store(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v public.vendors%rowtype;
begin
  select * into v from public.vendors where slug = p_slug;
  if not found or not public.products_enabled() or not public.vendor_can(v.id, 'products') then return null; end if;
  return jsonb_build_object('slug', v.slug, 'business_name', v.business_name, 'description', v.description, 'city', v.city, 'state', v.state,
    'product_count', (select count(*) from public.products p where p.vendor_id = v.id and public.product_is_public(p.id)));
end $$;

-- ---------------------------------------------------------------- privileges
revoke all on function public.product_categories_slug_immutable(), public.inventory_movements_append_only(), public.product_slug(text),
  public.valid_product_attributes(jsonb), public.valid_variant_options(jsonb), public.my_selling_vendor(), public.product_missing_items(uuid) from public, anon, authenticated;
revoke all on function public.products_enabled(), public.product_is_public(uuid), public.search_products(text, text, text, numeric, numeric, boolean, text, boolean, text, int, int),
  public.get_product_public(text), public.check_product_delivery(uuid, text), public.get_vendor_store(text) from public;
grant execute on function public.products_enabled(), public.product_is_public(uuid), public.search_products(text, text, text, numeric, numeric, boolean, text, boolean, text, int, int),
  public.get_product_public(text), public.check_product_delivery(uuid, text), public.get_vendor_store(text) to anon, authenticated;
revoke all on function public.save_product(jsonb), public.save_product_variant(jsonb), public.adjust_inventory(uuid, text, int, public.inventory_reason, text),
  public.register_product_image(uuid, text, text), public.delete_product_image(uuid), public.reorder_product_images(uuid, uuid[]), public.set_product_availability(uuid, boolean),
  public.submit_product(uuid), public.archive_product(uuid), public.restore_product(uuid), public.admin_review_product(uuid, text, text),
  public.admin_set_product_featured(uuid, boolean), public.admin_reorder_product_categories(bigint[]) from public, anon;
grant execute on function public.save_product(jsonb), public.save_product_variant(jsonb), public.adjust_inventory(uuid, text, int, public.inventory_reason, text),
  public.register_product_image(uuid, text, text), public.delete_product_image(uuid), public.reorder_product_images(uuid, uuid[]), public.set_product_availability(uuid, boolean),
  public.submit_product(uuid), public.archive_product(uuid), public.restore_product(uuid), public.admin_review_product(uuid, text, text),
  public.admin_set_product_featured(uuid, boolean), public.admin_reorder_product_categories(bigint[]) to authenticated;

-- ---------------------------------------------------------------- storage: public bucket for product photos (Supabase only)
do $storage$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema not present - skipping product-images bucket';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  -- Object paths are "<vendor id>/<product id>/<file>". Photos are public to read; only that vendor (with the products capability) may write.
  execute $p$ create policy "product images are public" on storage.objects for select using (bucket_id = 'product-images') $p$;
  execute $p$
    create policy "sellers upload product images" on storage.objects for insert to authenticated
      with check (bucket_id = 'product-images' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.owns_vendor(((storage.foldername(name))[1])::uuid, 'products'))
  $p$;
  execute $p$
    create policy "sellers delete product images" on storage.objects for delete to authenticated
      using (bucket_id = 'product-images' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' and public.owns_vendor(((storage.foldername(name))[1])::uuid, 'products'))
  $p$;
end
$storage$;
