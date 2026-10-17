-- Reference data (real catalogue vocabulary, NOT properties) and Storage setup.

insert into public.property_categories (slug, name, description, sort_order) values
  ('farm-stay', 'Farm stays', 'Stay on a working farm or garden estate.', 10),
  ('village-homestay', 'Village homestays', 'Live alongside a local host family.', 20),
  ('cottage', 'Cottages', 'Private cottages set in nature.', 30),
  ('eco-retreat', 'Eco-retreats', 'Low-impact stays built around the landscape.', 40),
  ('family-getaway', 'Family getaways', 'Easy, safe stays that work for children and grandparents.', 50),
  ('cycling-friendly', 'Cycling-friendly stays', 'Bicycles, safe routes and early-start breakfasts.', 60)
on conflict (slug) do nothing;

insert into public.amenities (slug, name, group_name, sort_order) values
  ('wifi', 'Wi-Fi', 'essentials', 10),
  ('parking', 'Free parking', 'essentials', 20),
  ('home-cooked-meals', 'Home-cooked meals', 'food', 30),
  ('veg-meals', 'Vegetarian meals', 'food', 40),
  ('kitchen-garden', 'Kitchen garden access', 'nature', 50),
  ('bonfire', 'Bonfire area', 'outdoors', 60),
  ('bicycles', 'Bicycles available', 'outdoors', 70),
  ('swimming-pool', 'Swimming pool', 'outdoors', 80),
  ('pet-friendly', 'Pet friendly', 'policies', 90),
  ('air-conditioning', 'Air conditioning', 'comfort', 100),
  ('hot-water', 'Hot water', 'comfort', 110),
  ('power-backup', 'Power backup', 'comfort', 120),
  ('children-play-area', 'Children''s play area', 'family', 130),
  ('accessible-ground-floor', 'Ground-floor rooms', 'accessibility', 140)
on conflict (slug) do nothing;

insert into public.experiences (slug, name, description, sort_order) values
  ('cycling-trails', 'Cycling trails', 'Guided or self-paced rides on quiet routes.', 10),
  ('gardening-sessions', 'Gardening sessions', 'Learn and take part in a working garden.', 20),
  ('nature-walks', 'Nature walks', 'Guided walks, tree and bird identification.', 30),
  ('bonfire-evenings', 'Bonfire evenings', 'Evenings by the fire.', 40),
  ('farm-to-table-meals', 'Farm-to-table meals', 'Meals built around what the garden gives.', 50),
  ('village-walk', 'Village walks', 'Walks with a local guide.', 60),
  ('stargazing', 'Stargazing', 'Dark-sky evenings.', 70),
  ('yoga-wellness', 'Yoga and slow mornings', 'Outdoor movement and rest.', 80)
on conflict (slug) do nothing;

-- Public, admin-editable settings. WhatsApp / contact values are intentionally left empty:
-- the owner must supply the official business number (never invent one).
insert into public.platform_settings (key, value, is_public, description) values
  ('whatsapp_number', '""'::jsonb, true, 'Official WhatsApp business number, digits only with country code, e.g. 9198XXXXXXXX'),
  ('support_email', '""'::jsonb, true, 'Public support e-mail address'),
  ('support_phone', '""'::jsonb, true, 'Public support phone number'),
  ('announcement', '""'::jsonb, true, 'Genuine offer or notice shown in the announcement bar. Leave empty to hide the bar.')
on conflict (key) do nothing;

-- ------------------------------------------------------------ Storage (Supabase only)
-- Skipped automatically where the storage schema does not exist (e.g. plain Postgres test runs).
do $storage$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema not present - skipping bucket setup';
    return;
  end if;

  -- Listing photos: public read (they are shown on public pages), writes restricted below.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('property-images', 'property-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public, file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Enquiry photos: PRIVATE. Written by the server with the service role, read by admins via signed URLs.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('enquiry-photos', 'enquiry-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public, file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Object paths are "<property uuid>/<file>"; only that property's owner (or an admin) may write.
  execute $p$
    create policy "property images are public" on storage.objects for select
      using (bucket_id = 'property-images')
  $p$;
  execute $p$
    create policy "owners upload property images" on storage.objects for insert to authenticated
      with check (
        bucket_id = 'property-images'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and public.owns_property(((storage.foldername(name))[1])::uuid)
      )
  $p$;
  execute $p$
    create policy "owners update property images" on storage.objects for update to authenticated
      using (
        bucket_id = 'property-images'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and public.owns_property(((storage.foldername(name))[1])::uuid)
      )
  $p$;
  execute $p$
    create policy "owners delete property images" on storage.objects for delete to authenticated
      using (
        bucket_id = 'property-images'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and public.owns_property(((storage.foldername(name))[1])::uuid)
      )
  $p$;
end
$storage$;
