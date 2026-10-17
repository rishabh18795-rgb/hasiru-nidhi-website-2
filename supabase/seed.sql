-- SAMPLE DATA ONLY — for local development and demos.
-- Every row below is flagged is_sample = true and the website labels it "Sample listing".
-- These are NOT real properties, prices, reviews or bookings. Do not run in production
-- unless you want demonstration listings visible; delete them with:
--   delete from public.properties where is_sample;

insert into public.properties
  (slug, name, category_id, summary, description, city, state, region, rooms_count, max_guests,
   price_inr, price_unit, house_rules, cancellation_policy, status, is_featured, is_sample,
   terms_accepted_at, submitted_at, published_at)
values
  ('sample-farmhouse-room', 'Sample Farmhouse Room',
   (select id from public.property_categories where slug = 'farm-stay'),
   'Sample listing: a quiet farmhouse room facing the garden.',
   'This is a sample listing used to demonstrate how a property page looks. Replace it with a real, host-submitted property. All details on this page are placeholders.',
   'Bengaluru Rural', 'Karnataka', 'South Bengaluru', 4, 3, 4500, 'per_night',
   'Sample house rules: quiet hours after 10 PM.', 'moderate', 'approved', true, true, now(), now(), now()),
  ('sample-garden-cottage', 'Sample Garden Cottage',
   (select id from public.property_categories where slug = 'cottage'),
   'Sample listing: a standalone cottage among trees.',
   'This is a sample listing used to demonstrate search, filters and booking requests. It is not a real property and its price is a placeholder.',
   'Bengaluru Rural', 'Karnataka', 'South Bengaluru', 1, 4, 6500, 'per_night',
   'Sample house rules: no loud music.', 'flexible', 'approved', false, true, now(), now(), now()),
  ('sample-cycling-eco-retreat', 'Sample Cycling Eco-Retreat',
   (select id from public.property_categories where slug = 'cycling-friendly'),
   'Sample listing: price on request, to demonstrate listings without a price.',
   'This sample listing has no price configured, which shows how the site behaves when a host has not published indicative pricing.',
   'Ramanagara', 'Karnataka', 'Ramanagara district', 6, 12, null, 'per_night',
   'Sample house rules: helmets compulsory on the cycling trail.', 'strict', 'approved', false, true, now(), now(), now())
on conflict (slug) do nothing;

insert into public.property_images (property_id, path, source, alt, sort_order)
select p.id, v.path, 'static', v.alt, 0
  from (values
    ('sample-farmhouse-room', '/images/stay/farmhouse-tiled-roof-verandah-karnataka.jpg', 'Tiled-roof farmhouse verandah (illustrative image)'),
    ('sample-garden-cottage', '/images/stay/farmhouse-cottage-courtyard-karnataka.jpg', 'Cottage courtyard (illustrative image)'),
    ('sample-cycling-eco-retreat', '/images/cycling/family-of-three-cycling-tree-lane-karnataka.jpg', 'Family cycling on a tree-lined lane (illustrative image)')
  ) as v(slug, path, alt)
  join public.properties p on p.slug = v.slug
 where not exists (select 1 from public.property_images i where i.property_id = p.id);

insert into public.property_amenities (property_id, amenity_id)
select p.id, a.id from public.properties p
  join public.amenities a on a.slug in ('wifi', 'parking', 'home-cooked-meals', 'kitchen-garden', 'hot-water')
 where p.slug = 'sample-farmhouse-room'
on conflict do nothing;
insert into public.property_amenities (property_id, amenity_id)
select p.id, a.id from public.properties p
  join public.amenities a on a.slug in ('parking', 'bonfire', 'bicycles', 'pet-friendly', 'hot-water')
 where p.slug = 'sample-garden-cottage'
on conflict do nothing;
insert into public.property_amenities (property_id, amenity_id)
select p.id, a.id from public.properties p
  join public.amenities a on a.slug in ('parking', 'bicycles', 'veg-meals', 'children-play-area', 'power-backup')
 where p.slug = 'sample-cycling-eco-retreat'
on conflict do nothing;

insert into public.property_experiences (property_id, experience_id)
select p.id, e.id from public.properties p
  join public.experiences e on e.slug in ('gardening-sessions', 'nature-walks', 'farm-to-table-meals')
 where p.slug = 'sample-farmhouse-room'
on conflict do nothing;
insert into public.property_experiences (property_id, experience_id)
select p.id, e.id from public.properties p
  join public.experiences e on e.slug in ('bonfire-evenings', 'stargazing', 'cycling-trails')
 where p.slug = 'sample-garden-cottage'
on conflict do nothing;
insert into public.property_experiences (property_id, experience_id)
select p.id, e.id from public.properties p
  join public.experiences e on e.slug in ('cycling-trails', 'nature-walks', 'village-walk')
 where p.slug = 'sample-cycling-eco-retreat'
on conflict do nothing;

insert into public.room_types (property_id, name, capacity, quantity, price_inr, description)
select p.id, 'Standard room (sample)', 3, 4, 4500, 'Placeholder room type.'
  from public.properties p where p.slug = 'sample-farmhouse-room'
   and not exists (select 1 from public.room_types r where r.property_id = p.id);
