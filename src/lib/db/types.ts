// Hand-written row types for the tables the app reads. They mirror supabase/migrations.

export type AppRole = "traveller" | "host" | "admin";
export type PropertyStatus = "draft" | "pending_review" | "approved" | "rejected" | "suspended";
export type BookingStatus =
  | "requested"
  | "confirmed"
  | "rejected"
  | "cancelled_by_traveller"
  | "cancelled_by_host"
  | "completed";
export type CancellationPolicy = "flexible" | "moderate" | "strict";
export type PriceUnit = "per_night" | "per_person_night" | "per_day_visit";
export type EnquiryStatus = "new" | "in_progress" | "resolved" | "spam";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  role: AppRole;
  is_suspended: boolean;
  host_verified: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}
export interface Amenity {
  id: number;
  slug: string;
  name: string;
  group_name: string;
}
export interface Experience {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

export interface Property {
  id: string;
  host_id: string | null;
  slug: string;
  name: string;
  category_id: number | null;
  summary: string | null;
  description: string;
  city: string | null;
  state: string | null;
  region: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  rooms_count: number;
  max_guests: number;
  price_inr: number | null;
  price_unit: PriceUnit;
  check_in_time: string;
  check_out_time: string;
  house_rules: string | null;
  cancellation_policy: CancellationPolicy;
  status: PropertyStatus;
  rejection_reason: string | null;
  is_featured: boolean;
  is_sample: boolean;
  terms_accepted_at: string | null;
  submitted_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyPrivate {
  property_id: string;
  address_line: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  current_platforms: string | null;
  partnership_model: string | null;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  path: string;
  source: "storage" | "static";
  alt: string | null;
  sort_order: number;
}

export interface RoomType {
  id: string;
  property_id: string;
  name: string;
  capacity: number;
  quantity: number;
  price_inr: number | null;
  description: string | null;
}

export interface AvailabilityBlock {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

export interface Booking {
  id: string;
  property_id: string;
  traveller_id: string | null;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  status: BookingStatus;
  message: string | null;
  host_response: string | null;
  property_name: string;
  cancellation_policy: CancellationPolicy;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  indicative_total_inr: number | null;
  created_at: string;
  cancelled_at: string | null;
  cancellation_note: string | null;
}

export interface SearchResult {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  category_slug: string | null;
  category_name: string | null;
  price_inr: number | null;
  price_unit: PriceUnit;
  max_guests: number;
  rooms_count: number;
  is_featured: boolean;
  is_sample: boolean;
  cover_path: string | null;
  cover_source: "storage" | "static" | null;
  cover_alt: string | null;
  total_count: number;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}
