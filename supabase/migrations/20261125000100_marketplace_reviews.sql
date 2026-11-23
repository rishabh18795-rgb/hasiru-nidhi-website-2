-- Hasiru Nidhi marketplace - M7: verified reviews for products and services, with admin moderation (Phase 7). ADDITIVE.
-- Apply AFTER 20261124000100_marketplace_commission.sql.
--
--  * Owner decision D10: only a VERIFIED purchase (a delivered order line) or a COMPLETED service request can be reviewed, once each, by the
--    customer who bought it. Nobody else can post. No reviews are ever created by the system.
--  * Every review starts PENDING and is invisible to the public until an administrator approves it. An administrator can also hide an
--    approved review again. The text of a review can never be edited after it is submitted.
--  * The public sees only approved reviews, for listings that are themselves public, with the reviewer's first name only.

create type public.review_status as enum ('pending', 'approved', 'rejected');

create table public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('product', 'service')),
  product_id uuid references public.products (id) on delete restrict,
  service_id uuid references public.services (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  author_id uuid references public.profiles (id) on delete set null,
  order_item_id uuid unique references public.order_items (id) on delete restrict,          -- the verified purchase
  service_request_id uuid unique references public.service_requests (id) on delete restrict, -- the completed service
  rating smallint not null check (rating between 1 and 5),
  title text check (title is null or char_length(title) <= 100),
  body text not null check (char_length(body) between 10 and 2000),
  status public.review_status not null default 'pending',
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  moderation_note text check (moderation_note is null or char_length(moderation_note) <= 500),
  created_at timestamptz not null default now(),
  constraint marketplace_reviews_subject check (
    (kind = 'product' and product_id is not null and order_item_id is not null and service_id is null and service_request_id is null)
    or (kind = 'service' and service_id is not null and service_request_id is not null and product_id is null and order_item_id is null))
);
create index marketplace_reviews_product_idx on public.marketplace_reviews (product_id, status, created_at desc) where product_id is not null;
create index marketplace_reviews_service_idx on public.marketplace_reviews (service_id, status, created_at desc) where service_id is not null;
create index marketplace_reviews_status_idx on public.marketplace_reviews (status, created_at);

-- Only the moderation columns may change after submission.
create function public.marketplace_reviews_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'reviews_cannot_be_deleted' using errcode = 'P0001'; end if;
  if new.kind is distinct from old.kind or new.product_id is distinct from old.product_id or new.service_id is distinct from old.service_id
     or new.vendor_id is distinct from old.vendor_id or new.author_id is distinct from old.author_id or new.order_item_id is distinct from old.order_item_id
     or new.service_request_id is distinct from old.service_request_id or new.rating is distinct from old.rating or new.title is distinct from old.title
     or new.body is distinct from old.body or new.created_at is distinct from old.created_at then
    raise exception 'review_content_is_immutable' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger marketplace_reviews_guard before update or delete on public.marketplace_reviews for each row execute function public.marketplace_reviews_guard();

alter table public.marketplace_reviews enable row level security;
-- The author sees their own (whatever its status), an administrator sees all, a vendor sees the approved reviews of their own listings.
create policy marketplace_reviews_select on public.marketplace_reviews for select to authenticated
  using (author_id = auth.uid() or public.is_admin() or (status = 'approved' and public.is_vendor_member(vendor_id)));
revoke insert, update, delete on public.marketplace_reviews from anon, authenticated;
revoke all on public.marketplace_reviews from anon;

-- p_kind 'product': p_ref is the order line (order_items.id). p_kind 'service': p_ref is the service request id.
create function public.submit_marketplace_review(p_kind text, p_ref uuid, p_rating int, p_title text, p_body text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v_id uuid;
  v_title text := nullif(left(btrim(coalesce(p_title, '')), 100), '');
  v_body text := btrim(coalesce(p_body, ''));
  oi record;
  r public.service_requests%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_prof from public.profiles where id = v_uid;
  if not found or v_prof.is_suspended then raise exception 'account_suspended' using errcode = '42501'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'invalid_rating' using errcode = 'P0001'; end if;
  if char_length(v_body) < 10 or char_length(v_body) > 2000 then raise exception 'review_body_required' using errcode = 'P0001'; end if;

  if p_kind = 'product' then
    select i.id, i.product_id, i.vendor_id, o.customer_id, o.status into oi from public.order_items i join public.orders o on o.id = i.order_id where i.id = p_ref;
    if not found or oi.customer_id is distinct from v_uid then raise exception 'not_found' using errcode = 'P0001'; end if;
    if oi.status <> 'delivered' then raise exception 'not_eligible' using errcode = 'P0001'; end if;
    begin
      insert into public.marketplace_reviews (kind, product_id, vendor_id, author_id, order_item_id, rating, title, body) values ('product', oi.product_id, oi.vendor_id, v_uid, oi.id, p_rating, v_title, v_body) returning id into v_id;
    exception when unique_violation then raise exception 'already_reviewed' using errcode = 'P0001'; end;
  elsif p_kind = 'service' then
    select * into r from public.service_requests where id = p_ref;
    if not found or r.customer_id is distinct from v_uid then raise exception 'not_found' using errcode = 'P0001'; end if;
    if r.status <> 'completed' then raise exception 'not_eligible' using errcode = 'P0001'; end if;
    begin
      insert into public.marketplace_reviews (kind, service_id, vendor_id, author_id, service_request_id, rating, title, body) values ('service', r.service_id, r.vendor_id, v_uid, r.id, p_rating, v_title, v_body) returning id into v_id;
    exception when unique_violation then raise exception 'already_reviewed' using errcode = 'P0001'; end;
  else
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;
  perform public.notify_admins('review_submitted', 'Review awaiting moderation', 'A ' || p_kind || ' review (' || p_rating || ' of 5) was submitted.', '/admin/marketplace-reviews');
  return v_id;
end $$;

-- approve | reject. Approving makes it public (when its listing is public). Rejecting (or hiding an approved one) needs a note.
create function public.admin_moderate_marketplace_review(p_review uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare rv public.marketplace_reviews%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into rv from public.marketplace_reviews where id = p_review for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_decision = 'approve' and rv.status in ('pending', 'rejected') then
    update public.marketplace_reviews set status = 'approved', moderated_by = auth.uid(), moderated_at = now(), moderation_note = nullif(left(btrim(p_note), 500), '') where id = p_review;
  elsif p_decision = 'reject' and rv.status in ('pending', 'approved') then
    if coalesce(btrim(p_note), '') = '' then raise exception 'reason_required' using errcode = 'P0001'; end if;
    update public.marketplace_reviews set status = 'rejected', moderated_by = auth.uid(), moderated_at = now(), moderation_note = left(btrim(p_note), 500) where id = p_review;
  else
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  perform public.write_audit('marketplace_review_' || p_decision, 'marketplace_review', p_review::text, jsonb_build_object('from', rv.status));
  if rv.author_id is not null then
    perform public.notify(rv.author_id, 'review_moderated', case p_decision when 'approve' then 'Your review is now public' else 'Your review was not published' end,
      case when p_decision = 'approve' then 'Thank you for sharing your experience.' else coalesce(left(btrim(p_note), 200), 'It did not meet our review guidelines.') end, '/dashboard');
  end if;
end $$;

-- Approved reviews of a PUBLIC listing, with the average and count. First name only. Kind: 'product' | 'service'; p_slug is the listing's slug.
create function public.get_marketplace_reviews(p_kind text, p_slug text, p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if p_kind = 'product' then
    select id into v_id from public.products where slug = p_slug;
    if v_id is null or not public.product_is_public(v_id) then return null; end if;
  elsif p_kind = 'service' then
    select id into v_id from public.services where slug = p_slug;
    if v_id is null or not public.service_is_public(v_id) then return null; end if;
  else
    return null;
  end if;
  return jsonb_build_object(
    'count', (select count(*) from public.marketplace_reviews r where r.status = 'approved' and ((p_kind = 'product' and r.product_id = v_id) or (p_kind = 'service' and r.service_id = v_id))),
    'average', (select round(avg(r.rating)::numeric, 1) from public.marketplace_reviews r where r.status = 'approved' and ((p_kind = 'product' and r.product_id = v_id) or (p_kind = 'service' and r.service_id = v_id))),
    'reviews', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select r.rating, r.title, r.body, r.created_at, coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'A customer') as author
          from public.marketplace_reviews r left join public.profiles p on p.id = r.author_id
         where r.status = 'approved' and ((p_kind = 'product' and r.product_id = v_id) or (p_kind = 'service' and r.service_id = v_id))
         order by r.created_at desc limit least(greatest(coalesce(p_limit, 20), 1), 50)) x), '[]'::jsonb));
end $$;

revoke all on function public.marketplace_reviews_guard() from public, anon, authenticated;
revoke all on function public.submit_marketplace_review(text, uuid, int, text, text), public.admin_moderate_marketplace_review(uuid, text, text) from public, anon;
grant execute on function public.submit_marketplace_review(text, uuid, int, text, text), public.admin_moderate_marketplace_review(uuid, text, text) to authenticated;
revoke all on function public.get_marketplace_reviews(text, text, int) from public;
grant execute on function public.get_marketplace_reviews(text, text, int) to anon, authenticated;
