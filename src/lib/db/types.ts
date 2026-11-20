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
  review_kind: "rejected" | "changes_requested" | null;
  country: string;
  bedrooms: number | null;
  beds: number | null;
  bathrooms: number | null;
  accommodation_arrangement: "entire_property" | "private_rooms" | "shared_space" | null;
  location_precision: "exact" | "approximate";
  weekend_price_inr: number | null;
  included_guests: number | null;
  extra_guest_fee_inr: number | null;
  cleaning_fee_inr: number | null;
  tax_percent: number;
  min_nights: number;
  max_nights: number;
  currency: string;
  photo_rights_confirmed_at: string | null;
  wizard_step: string | null;
  reviewed_at: string | null;
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
  exact_latitude: number | null;
  exact_longitude: number | null;
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
  price_breakdown: import("@/lib/pricing").Quote | null;
  /** Commission snapshot frozen when the request was made (null for bookings that predate commissions). */
  commission_rate_percent: number | null;
  commissionable_amount_inr: number | null;
  commission_amount_inr: number | null;
  host_share_inr: number | null;
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
  postal_code: string | null;
  category_slug: string | null;
  category_name: string | null;
  price_inr: number | null;
  price_unit: PriceUnit;
  max_guests: number;
  rooms_count: number;
  is_featured: boolean;
  is_sample: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  amenity_names: string[];
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

/** One row per booking with its money (view booking_financials; RLS decides who sees which rows). */
export interface BookingFinancial {
  booking_id: string;
  property_id: string;
  host_id: string | null;
  traveller_id: string | null;
  property_name: string;
  guest_name: string;
  status: BookingStatus;
  check_in: string;
  check_out: string;
  gross_inr: number | null;
  commission_rate_percent: number | null;
  commissionable_amount_inr: number | null;
  commission_amount_inr: number | null;
  host_share_inr: number | null;
  net_commission_inr: number;
  net_host_share_inr: number;
  payment_status: "unpaid" | "initiated" | "paid" | "failed" | "partially_refunded" | "refunded";
  settlement_status: "not_due" | "pending" | "processing" | "paid" | "on_hold" | "failed";
}

export interface PaymentRow {
  id: string;
  booking_id: string;
  provider: string;
  provider_reference: string;
  amount_inr: number;
  refunded_inr: number;
  status: string;
  note: string | null;
  created_at: string;
}

export interface LedgerEntry {
  id: number;
  booking_id: string;
  host_id: string | null;
  kind: "accrual" | "reversal";
  commissionable_inr: number;
  commission_rate_percent: number;
  commission_inr: number;
  host_share_inr: number;
  note: string | null;
  created_at: string;
}

export interface HostSettlement {
  id: string;
  host_id: string;
  amount_inr: number;
  status: "not_due" | "pending" | "processing" | "paid" | "on_hold" | "failed";
  reference: string | null;
  note: string | null;
  created_at: string;
  paid_at: string | null;
}

/* ---------------------------------------------------------------- marketplace: vendors (M1) */
export type VendorStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "suspended";
export type VendorCapabilityKind = "products" | "services" | "stays";
export type CapabilityStatus = "pending" | "approved" | "rejected" | "suspended";
export type DocumentStatus = "submitted" | "accepted" | "rejected";

export interface Vendor {
  id: string;
  owner_id: string;
  slug: string;
  business_name: string;
  business_type: string | null;
  description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  tax_identifier: string | null;
  status: VendorStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  is_legacy_host: boolean;
  created_at: string;
}

export interface VendorCapability {
  vendor_id: string;
  capability: VendorCapabilityKind;
  status: CapabilityStatus;
  reason: string | null;
  requested_at: string;
  reviewed_at: string | null;
}

export interface VendorDocumentRequirement {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  capability: VendorCapabilityKind;
  category_kind: "product_category" | "service_category" | null;
  category_id: number | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface VendorDocument {
  id: string;
  vendor_id: string;
  requirement_id: number | null;
  label: string;
  storage_path: string;
  original_name: string | null;
  status: DocumentStatus;
  reviewer_note: string | null;
  created_at: string;
}

/* ---------------------------------------------------------------- marketplace: product catalogue (M3) */
export type ProductStatus = "draft" | "pending_review" | "approved" | "rejected" | "suspended" | "archived";
export type InventoryReason = "initial" | "restock" | "correction" | "damaged" | "returned_to_stock" | "other";

export interface ProductCategory {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ProductAttribute { label: string; value: string }

export interface Product {
  id: string;
  vendor_id: string;
  category_id: number;
  slug: string;
  name: string;
  summary: string | null;
  description: string;
  brand: string | null;
  attributes: ProductAttribute[];
  status: ProductStatus;
  rejection_reason: string | null;
  is_available: boolean;
  is_featured: boolean;
  submitted_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  options: Record<string, string>;
  price_inr: number | string;
  track_inventory: boolean;
  stock_on_hand: number;
  weight_grams: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface ProductImage { id: string; product_id: string; path: string; alt: string | null; sort_order: number }

export interface InventoryMovement {
  id: number;
  variant_id: string;
  delta: number;
  balance_after: number;
  reason: InventoryReason;
  note: string | null;
  created_at: string;
}

/** One row of search_products(): everything a shopper card needs, never stock counts. */
export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  category_slug: string;
  category_name: string;
  vendor_slug: string;
  vendor_name: string;
  min_price: number | string;
  max_price: number | string;
  in_stock: boolean;
  is_available: boolean;
  is_featured: boolean;
  cover_path: string | null;
  cover_alt: string | null;
  total_count: number | string;
}

/** get_product_public(): the shopper's view of one product. */
export interface PublicProduct {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string;
  brand: string | null;
  attributes: ProductAttribute[];
  is_available: boolean;
  published_at: string | null;
  category: { slug: string; name: string };
  vendor: { slug: string; business_name: string; description: string | null; city: string | null; state: string | null };
  images: { path: string; alt: string | null }[];
  variants: { id: string; sku: string; name: string; options: Record<string, string>; price_inr: number | string; weight_grams: number | null; in_stock: boolean }[];
  return_policy?: { configured: boolean; returns_allowed: boolean | null; return_window_days: number | null; replacements_allowed: boolean | null; replacement_window_days: number | null; notes: string | null } | null;
  orders_enabled?: boolean;
}

export interface VendorStore { slug: string; business_name: string; description: string | null; city: string | null; state: string | null; product_count: number }

/* ---------------------------------------------------------------- marketplace: cart and orders (M4) */
export type OrderStatus = "placed" | "confirmed" | "rejected" | "packed" | "shipped" | "delivered" | "cancelled";
export type ShipmentStatus = "shipped" | "in_transit" | "out_for_delivery" | "delivered" | "failed";
export type OrderRequestKind = "cancel" | "return" | "replacement";
export type OrderRequestStatus = "requested" | "approved" | "rejected" | "completed";
export type DisputeStatus = "open" | "in_review" | "resolved" | "dismissed";

export interface CustomerAddress {
  id: string; user_id: string; label: string | null; full_name: string; phone: string; line1: string; line2: string | null; landmark: string | null;
  city: string; state: string; postal_code: string; is_default: boolean;
}

export interface CartLine {
  variant_id: string; quantity: number; variant_name: string; sku: string; options: Record<string, string>; unit_price_inr: number | string; line_total_inr: number | string;
  product_id: string; product_slug: string; product_name: string; vendor_id: string; vendor_name: string; vendor_slug: string; category_id: number; image_path: string | null;
  max_qty: number; issue: "unavailable" | "paused" | "out_of_stock" | "limited_stock" | null;
}
export interface CartVendorGroup { vendor_id: string; vendor_name: string; subtotal_inr: number | string; delivery: "yes" | "no" | "unknown" | null }
export interface Cart { lines: CartLine[]; vendors: CartVendorGroup[]; pin: string | null; item_count: number; subtotal_inr: number | string; orders_enabled: boolean }

export interface Checkout {
  id: string; reference: string; user_id: string; ship_name: string; ship_phone: string; ship_line1: string; ship_line2: string | null; ship_landmark: string | null;
  ship_city: string; ship_state: string; ship_postal_code: string; items_total_inr: number | string; order_count: number; payment_status: string; created_at: string;
}

export interface Order {
  id: string; order_number: string; checkout_id: string; customer_id: string; vendor_id: string; vendor_name: string; status: OrderStatus; payment_status: string;
  items_total_inr: number | string; shipping_fee_inr: number | string | null; tax_inr: number | string | null; ship_name: string; ship_city: string; ship_state: string; ship_postal_code: string;
  rejection_reason: string | null; cancel_reason: string | null; confirmed_at: string | null; shipped_at: string | null; delivered_at: string | null; cancelled_at: string | null; created_at: string;
}
export interface OrderItem {
  id: string; order_id: string; product_id: string; product_name: string; product_slug: string; variant_name: string; sku: string; options: Record<string, string>; image_path: string | null;
  unit_price_inr: number | string; quantity: number; line_total_inr: number | string; category_id: number;
}
export interface OrderHistoryRow { id: number; from_status: OrderStatus | null; to_status: OrderStatus; actor_kind: string; note: string | null; created_at: string }
export interface Shipment { id: string; order_id: string; carrier: string; tracking_number: string; tracking_url: string | null; status: ShipmentStatus; shipped_at: string; delivered_at: string | null }
export interface OrderRequest { id: string; order_id: string; kind: OrderRequestKind; status: OrderRequestStatus; reason: string; details: string | null; policy_note: string | null; decision_note: string | null; created_at: string; decided_at: string | null }
export interface OrderDispute { id: string; order_id: string; description: string; status: DisputeStatus; resolution: string | null; created_at: string }
export interface CategoryPolicy { category_id: number; returns_allowed: boolean | null; return_window_days: number | null; replacements_allowed: boolean | null; replacement_window_days: number | null; notes: string | null }
