-- Hasiru Nidhi marketplace — richer Explore Stays cards.
-- Apply AFTER 20261030000100_*.
--
-- search_properties() now also returns bedrooms, bathrooms and the amenity names, so a result card can show them without extra
-- queries. The function is replaced (a return type cannot be altered in place); the logic, visibility rules (approved listings
-- only, caller's own RLS) and privileges are unchanged.

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
  p_offset int default 0
) returns table (
  id uuid, slug text, name text, summary text, city text, state text, region text,
  category_slug text, category_name text, price_inr numeric, price_unit public.price_unit,
  max_guests int, rooms_count int, is_featured boolean, is_sample boolean,
  bedrooms int, bathrooms numeric, amenity_names text[],
  cover_path text, cover_source text, cover_alt text, total_count bigint
)
language sql stable security invoker set search_path = public, pg_temp as $$
  select p.id, p.slug, p.name, p.summary, p.city, p.state, p.region,
         c.slug, c.name, p.price_inr, p.price_unit, p.max_guests, p.rooms_count,
         p.is_featured, p.is_sample,
         p.bedrooms, p.bathrooms,
         (select coalesce(array_agg(a.name order by a.sort_order, a.name), '{}'::text[])
            from public.property_amenities pa join public.amenities a on a.id = pa.amenity_id
           where pa.property_id = p.id) as amenity_names,
         img.path, img.source, img.alt,
         count(*) over () as total_count
    from public.properties p
    left join public.property_categories c on c.id = p.category_id
    left join lateral (
      select i.path, i.source, i.alt from public.property_images i
       where i.property_id = p.id order by i.sort_order, i.created_at limit 1
    ) img on true
   where p.status = 'approved'
     and (coalesce(p_query, '') = '' or p.name ilike '%' || p_query || '%'
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

revoke all on function public.search_properties(text, text, numeric, numeric, int, text[], text[], date, date, text, int, int) from public;
grant execute on function public.search_properties(text, text, numeric, numeric, int, text[], text[], date, date, text, int, int) to anon, authenticated;
