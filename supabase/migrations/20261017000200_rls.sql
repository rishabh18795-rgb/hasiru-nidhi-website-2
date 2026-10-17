-- Hasiru Nidhi marketplace — Row Level Security
-- Principle: deny by default. A table with RLS enabled and no matching policy is inaccessible.

-- Ownership helper: true for the listing's host (while their account is active) or any admin.
create function public.owns_property(p_property uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_admin() or exists (
    select 1 from public.properties p
     where p.id = p_property and p.host_id = auth.uid() and public.is_host()
  )
$$;
grant execute on function public.owns_property(uuid) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.property_categories enable row level security;
alter table public.amenities enable row level security;
alter table public.experiences enable row level security;
alter table public.properties enable row level security;
alter table public.property_private enable row level security;
alter table public.property_amenities enable row level security;
alter table public.property_experiences enable row level security;
alter table public.property_images enable row level security;
alter table public.room_types enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.bookings enable row level security;
alter table public.saved_properties enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.contact_enquiries enable row level security;
alter table public.partner_applications enable row level security;
alter table public.gardening_enquiries enable row level security;
alter table public.reports enable row level security;
alter table public.platform_settings enable row level security;
alter table public.audit_logs enable row level security;

-- ------------------------------------------------------------ profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- (role / suspension / verification are additionally locked by profiles_guard; admins use admin_update_user())

-- ------------------------------------------------------------ catalogue
create policy categories_read on public.property_categories for select to anon, authenticated
  using (is_active or public.is_admin());
create policy categories_admin on public.property_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy amenities_read on public.amenities for select to anon, authenticated
  using (is_active or public.is_admin());
create policy amenities_admin on public.amenities for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy experiences_read on public.experiences for select to anon, authenticated
  using (is_active or public.is_admin());
create policy experiences_admin on public.experiences for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------ properties
create policy properties_select on public.properties for select to anon, authenticated
  using (status = 'approved' or host_id = auth.uid() or public.is_admin());
create policy properties_insert on public.properties for insert to authenticated
  with check (host_id = auth.uid() and public.is_host() and status = 'draft');
create policy properties_update on public.properties for update to authenticated
  using ((host_id = auth.uid() and public.is_host()) or public.is_admin())
  with check ((host_id = auth.uid() and public.is_host()) or public.is_admin());
create policy properties_delete on public.properties for delete to authenticated
  using ((host_id = auth.uid() and public.is_host() and status = 'draft') or public.is_admin());

create policy property_private_all on public.property_private for all to authenticated
  using (public.owns_property(property_id)) with check (public.owns_property(property_id));

-- Child rows are readable whenever the parent listing is readable by the caller.
create policy property_amenities_read on public.property_amenities for select to anon, authenticated
  using (exists (select 1 from public.properties p where p.id = property_id));
create policy property_amenities_write on public.property_amenities for all to authenticated
  using (public.owns_property(property_id)) with check (public.owns_property(property_id));

create policy property_experiences_read on public.property_experiences for select to anon, authenticated
  using (exists (select 1 from public.properties p where p.id = property_id));
create policy property_experiences_write on public.property_experiences for all to authenticated
  using (public.owns_property(property_id)) with check (public.owns_property(property_id));

create policy property_images_read on public.property_images for select to anon, authenticated
  using (exists (select 1 from public.properties p where p.id = property_id));
create policy property_images_write on public.property_images for all to authenticated
  using (public.owns_property(property_id)) with check (public.owns_property(property_id));

create policy room_types_read on public.room_types for select to anon, authenticated
  using (exists (select 1 from public.properties p where p.id = property_id));
create policy room_types_write on public.room_types for all to authenticated
  using (public.owns_property(property_id)) with check (public.owns_property(property_id));

-- Raw availability blocks (with the host's private reasons) are owner-only; the public gets
-- anonymised ranges through property_unavailable_ranges().
create policy availability_blocks_all on public.availability_blocks for all to authenticated
  using (public.owns_property(property_id)) with check (public.owns_property(property_id));

-- ------------------------------------------------------------ bookings (read-only for clients)
create policy bookings_select on public.bookings for select to authenticated
  using (traveller_id = auth.uid() or public.owns_property(property_id));
revoke insert, update, delete on public.bookings from anon, authenticated;
revoke all on public.bookings from anon;

-- ------------------------------------------------------------ saved / reviews / notifications
create policy saved_select on public.saved_properties for select to authenticated
  using (user_id = auth.uid());
create policy saved_insert on public.saved_properties for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.properties p where p.id = property_id and p.status = 'approved'));
create policy saved_delete on public.saved_properties for delete to authenticated
  using (user_id = auth.uid());

create policy reviews_read on public.reviews for select to anon, authenticated
  using ((not is_hidden and exists (select 1 from public.properties p where p.id = property_id))
         or traveller_id = auth.uid() or public.is_admin());
create policy reviews_insert on public.reviews for insert to authenticated
  with check (
    traveller_id = auth.uid()
    and not is_hidden
    and exists (
      select 1 from public.bookings b
       where b.id = booking_id and b.traveller_id = auth.uid() and b.property_id = reviews.property_id
         and b.status in ('confirmed', 'completed') and b.check_out <= public.today_ist()
    )
  );
create policy reviews_admin_update on public.reviews for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, delete on public.notifications from anon, authenticated;
revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;
revoke all on public.notifications from anon;

-- ------------------------------------------------------------ enquiries & applications
create policy contact_insert on public.contact_enquiries for insert to anon, authenticated
  with check (status = 'new' and admin_notes is null and (user_id is null or user_id = auth.uid()));
create policy contact_select on public.contact_enquiries for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
create policy contact_admin_update on public.contact_enquiries for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy partner_insert on public.partner_applications for insert to anon, authenticated
  with check (status = 'new' and admin_notes is null and (user_id is null or user_id = auth.uid()));
create policy partner_select on public.partner_applications for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
create policy partner_admin_update on public.partner_applications for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy gardening_insert on public.gardening_enquiries for insert to anon, authenticated
  with check (status = 'new' and admin_notes is null and (user_id is null or user_id = auth.uid()));
create policy gardening_select on public.gardening_enquiries for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
create policy gardening_admin_update on public.gardening_enquiries for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy reports_insert on public.reports for insert to anon, authenticated
  with check (status = 'open' and (reporter_id is null or reporter_id = auth.uid())
              and exists (select 1 from public.properties p where p.id = property_id and p.status = 'approved'));
create policy reports_admin_select on public.reports for select to authenticated using (public.is_admin());
create policy reports_admin_update on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------ settings & audit
create policy settings_read on public.platform_settings for select to anon, authenticated
  using (is_public or public.is_admin());
create policy settings_admin on public.platform_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy audit_admin_select on public.audit_logs for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.audit_logs from anon, authenticated;
revoke all on public.audit_logs from anon;
