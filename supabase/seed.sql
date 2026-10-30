-- SAMPLE DATA ONLY — for testing the marketplace interface, search filters, detail pages and the booking flow.
-- Six listings, every one flagged is_sample = true: the website labels each "Sample listing", keeps it out of Google
-- (noindex, not in the sitemap) and the descriptions say so. These are NOT real properties, hosts, prices, reviews or
-- bookings, and the photographs are illustrative. They have no host (platform-managed), so booking requests on them go
-- to the admin inbox.
-- Run AFTER all migrations. Remove them completely with supabase/scripts/remove_sample_data.sql.

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
   'Sample house rules: helmets compulsory on the cycling trail.', 'strict', 'approved', false, true, now(), now(), now()),
  ('sample-village-homestay', 'Sample Village Homestay',
   (select id from public.property_categories where slug = 'village-homestay'),
   'Sample listing: a family-run homestay on a quiet village lane, priced per guest.',
   'This is a sample listing used to test per-guest pricing, search filters and booking requests. It is not a real homestay; the photograph is illustrative and every detail is a placeholder.',
   'Melkote', 'Karnataka', 'Mandya district', 3, 6, 1800, 'per_person_night',
   'Sample house rules: shoes off inside the house.', 'flexible', 'approved', false, true, now(), now(), now()),
  ('sample-hilltop-villa', 'Sample Hilltop Villa',
   (select id from public.property_categories where slug = 'villa'),
   'Sample listing: a large private villa with weekend pricing and an extra-guest charge.',
   'This is a sample listing used to test weekend rates, extra-guest charges, cleaning fee, tax and minimum-stay rules in the price breakdown. It is not a real property and none of its prices are real.',
   'Nandi Hills', 'Karnataka', 'Chikkaballapur district', 5, 9, 14000, 'per_night',
   'Sample house rules: no parties; quiet after 10 PM.', 'strict', 'approved', false, true, now(), now(), now()),
  ('sample-lakeside-nature-retreat', 'Sample Lakeside Nature Retreat',
   (select id from public.property_categories where slug = 'nature-retreat'),
   'Sample listing: a calm retreat beside a lake, with a two-night minimum stay.',
   'This is a sample listing used to test minimum and maximum stay rules and the availability calendar. It is not a real property and its details are placeholders.',
   'Madikeri', 'Karnataka', 'Kodagu district', 4, 8, 8500, 'per_night',
   'Sample house rules: please keep the lakeside quiet after dark.', 'moderate', 'approved', false, true, now(), now(), now())
on conflict (slug) do nothing;

-- Structured details the listing wizard collects (rooms, pricing rules, stay length) so every sample exercises a different rule.
update public.properties set bedrooms = 2, beds = 3, bathrooms = 1, accommodation_arrangement = 'private_rooms' where slug = 'sample-farmhouse-room';
update public.properties set bedrooms = 2, beds = 3, bathrooms = 1.5, accommodation_arrangement = 'entire_property',
  weekend_price_inr = 7500, cleaning_fee_inr = 500 where slug = 'sample-garden-cottage';
update public.properties set bedrooms = 6, beds = 12, bathrooms = 4, accommodation_arrangement = 'entire_property' where slug = 'sample-cycling-eco-retreat';
update public.properties set bedrooms = 3, beds = 4, bathrooms = 2, accommodation_arrangement = 'private_rooms', min_nights = 1, max_nights = 7 where slug = 'sample-village-homestay';
update public.properties set bedrooms = 5, beds = 7, bathrooms = 4, accommodation_arrangement = 'entire_property',
  weekend_price_inr = 16500, included_guests = 6, extra_guest_fee_inr = 800, cleaning_fee_inr = 1500, tax_percent = 12, min_nights = 2, max_nights = 14 where slug = 'sample-hilltop-villa';
update public.properties set bedrooms = 4, beds = 6, bathrooms = 3, accommodation_arrangement = 'entire_property', min_nights = 2, max_nights = 14 where slug = 'sample-lakeside-nature-retreat';

insert into public.property_images (property_id, path, source, alt, sort_order)
select p.id, v.path, 'static', v.alt, 0
  from (values
    ('sample-farmhouse-room', '/images/stay/farmhouse-tiled-roof-verandah-karnataka.jpg', 'Tiled-roof farmhouse verandah (illustrative image)'),
    ('sample-garden-cottage', '/images/stay/farmhouse-cottage-courtyard-karnataka.jpg', 'Cottage courtyard (illustrative image)'),
    ('sample-cycling-eco-retreat', '/images/cycling/family-of-three-cycling-tree-lane-karnataka.jpg', 'Family cycling on a tree-lined lane (illustrative image)'),
    ('sample-village-homestay', '/images/gallery/misty-hills-village-karnataka.jpg', 'Misty hills above a village (illustrative image)'),
    ('sample-hilltop-villa', '/images/stay/verandah-corridor-karnataka.jpg', 'A long verandah corridor (illustrative image)'),
    ('sample-lakeside-nature-retreat', '/images/gallery/forest-valley-dusk-western-ghats.jpg', 'Forest valley at dusk (illustrative image)')
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
insert into public.property_amenities (property_id, amenity_id)
select p.id, a.id from public.properties p join public.amenities a on a.slug in ('home-cooked-meals', 'veg-meals', 'hot-water', 'private-bathroom', 'garden')
 where p.slug = 'sample-village-homestay' on conflict do nothing;
insert into public.property_amenities (property_id, amenity_id)
select p.id, a.id from public.properties p join public.amenities a on a.slug in ('wifi', 'parking', 'swimming-pool', 'kitchen', 'air-conditioning', 'power-backup', 'outdoor-seating')
 where p.slug = 'sample-hilltop-villa' on conflict do nothing;
insert into public.property_amenities (property_id, amenity_id)
select p.id, a.id from public.properties p join public.amenities a on a.slug in ('wifi', 'parking', 'hot-water', 'private-bathroom', 'garden', 'outdoor-seating')
 where p.slug = 'sample-lakeside-nature-retreat' on conflict do nothing;
insert into public.property_experiences (property_id, experience_id)
select p.id, e.id from public.properties p join public.experiences e on e.slug in ('farm-to-table-meals', 'nature-walks', 'local-food-experiences')
 where p.slug = 'sample-village-homestay' on conflict do nothing;
insert into public.property_experiences (property_id, experience_id)
select p.id, e.id from public.properties p join public.experiences e on e.slug in ('bonfire-evenings', 'family-activities')
 where p.slug = 'sample-hilltop-villa' on conflict do nothing;
insert into public.property_experiences (property_id, experience_id)
select p.id, e.id from public.properties p join public.experiences e on e.slug in ('nature-walks', 'yoga-wellness')
 where p.slug = 'sample-lakeside-nature-retreat' on conflict do nothing;

-- One blocked range on the villa so the public availability calendar has something to show.
insert into public.availability_blocks (property_id, start_date, end_date, reason)
select p.id, current_date + 20, current_date + 24, 'Sample block (owner use)'
  from public.properties p
 where p.slug = 'sample-hilltop-villa'
   and not exists (select 1 from public.availability_blocks b where b.property_id = p.id);

insert into public.room_types (property_id, name, capacity, quantity, price_inr, description)
select p.id, 'Standard room (sample)', 3, 4, 4500, 'Placeholder room type.'
  from public.properties p where p.slug = 'sample-farmhouse-room'
   and not exists (select 1 from public.room_types r where r.property_id = p.id);
