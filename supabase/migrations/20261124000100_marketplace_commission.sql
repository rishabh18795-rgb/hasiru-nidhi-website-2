-- Hasiru Nidhi marketplace - M6: commission rate FOUNDATION for products and services (Phase 8). ADDITIVE.
-- Apply AFTER 20261123000100_services.sql.
--
--  * Owner decision D5: product and service commission stays UNCONFIGURED until the owner approves rates. NOTHING is seeded, and the
--    Stay commission rate (platform_settings.commission_rate_percent) is never read or reused here.
--  * Rates are recorded as an APPEND-ONLY history: each change is a new row with a mandatory note (who approved it and on what basis).
--    The current rate for a vertical is its latest row; a category-specific row overrides the vertical-wide one.
--    A row with a NULL rate means "explicitly unconfigured again".
--  * This release takes no payments (D11), so there is nothing to take commission on: no accrual, ledger or settlement is created here.
--    marketplace_commission_rate() exists so the later payment phase has one place to ask, and it returns NULL while unconfigured.

create type public.commission_vertical as enum ('products', 'services');

create table public.marketplace_commission_rates (
  id bigint generated always as identity primary key,
  vertical public.commission_vertical not null,
  category_id bigint,                                   -- NULL = the whole vertical; else a product_categories / service_categories id
  rate_percent numeric(5, 2),                           -- NULL = unconfigured
  note text not null check (char_length(btrim(note)) between 3 and 500),
  set_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint commission_rate_range check (rate_percent is null or rate_percent between 0 and 50)
);
create index marketplace_commission_scope_idx on public.marketplace_commission_rates (vertical, category_id, id desc);

create function public.marketplace_commission_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'commission_history_is_append_only' using errcode = 'P0001';
end $$;
create trigger marketplace_commission_append_only before update or delete on public.marketplace_commission_rates for each row execute function public.marketplace_commission_append_only();

alter table public.marketplace_commission_rates enable row level security;
create policy marketplace_commission_select on public.marketplace_commission_rates for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.marketplace_commission_rates from anon, authenticated;
revoke all on public.marketplace_commission_rates from anon;

-- The current rate for a category (falling back to the vertical-wide rate). NULL = unconfigured. Internal: not callable through the API.
create function public.marketplace_commission_rate(p_vertical public.commission_vertical, p_category bigint default null) returns numeric
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select r.rate_percent from public.marketplace_commission_rates r where r.vertical = p_vertical and r.category_id = p_category and p_category is not null order by r.id desc limit 1),
    (select r.rate_percent from public.marketplace_commission_rates r where r.vertical = p_vertical and r.category_id is null order by r.id desc limit 1))
$$;

-- Admin only. p_rate NULL records "unconfigured". A note saying who approved the rate and why is mandatory.
create function public.admin_set_marketplace_commission(p_vertical public.commission_vertical, p_category bigint, p_rate numeric, p_note text) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 3 then raise exception 'note_required' using errcode = 'P0001'; end if;
  if p_rate is not null and (p_rate < 0 or p_rate > 50 or scale(p_rate) > 2) then raise exception 'invalid_rate' using errcode = 'P0001'; end if;
  if p_category is not null and not exists (
       select 1 from (select id from public.product_categories where p_vertical = 'products' union all select id from public.service_categories where p_vertical = 'services') c where c.id = p_category) then
    raise exception 'invalid_category' using errcode = 'P0001';
  end if;
  insert into public.marketplace_commission_rates (vertical, category_id, rate_percent, note, set_by) values (p_vertical, p_category, p_rate, left(btrim(p_note), 500), auth.uid()) returning id into v_id;
  perform public.write_audit('marketplace_commission_set', 'marketplace_commission', v_id::text,
    jsonb_build_object('vertical', p_vertical, 'category_id', p_category, 'rate_percent', p_rate));
  return v_id;
end $$;

revoke all on function public.marketplace_commission_append_only(), public.marketplace_commission_rate(public.commission_vertical, bigint) from public, anon, authenticated;
revoke all on function public.admin_set_marketplace_commission(public.commission_vertical, bigint, numeric, text) from public, anon;
grant execute on function public.admin_set_marketplace_commission(public.commission_vertical, bigint, numeric, text) to authenticated;
