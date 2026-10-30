-- Removes ALL sample data created by supabase/seed.sql (every property flagged is_sample = true), including any test
-- booking requests made against those sample listings. Real listings, hosts and travellers are never touched.
-- Run in the Supabase SQL editor when you no longer need the demonstration listings.

begin;
  delete from public.reviews  where property_id in (select id from public.properties where is_sample);
  delete from public.bookings where property_id in (select id from public.properties where is_sample);
  delete from public.properties where is_sample;   -- images, amenities, experiences, rooms and blocks cascade
commit;

select count(*) as sample_listings_left from public.properties where is_sample;
