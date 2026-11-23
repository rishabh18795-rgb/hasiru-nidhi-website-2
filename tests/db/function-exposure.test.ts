import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

/**
 * Inventory of every function in the public schema and who may EXECUTE it. In Supabase every new function is executable by
 * anon and authenticated unless it is explicitly revoked, so this list is the guard against accidentally exposing an
 * internal or privileged function through the API. Adding a function means deciding, here, who may call it.
 */
let db: Db;
beforeAll(async () => { db = await createDb(); });

async function callable(role: string): Promise<string[]> {
  const { rows } = await db.query<{ proname: string }>(
    `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
        and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
        and has_function_privilege($1, p.oid, 'execute') order by 1`, [role]);
  return rows.map((r) => r.proname);
}

// Read-only helpers that are safe for anyone (they only return what RLS already lets the caller see, or public data).
const PUBLIC_HELPERS = ["is_admin", "is_host", "owns_property", "today_ist", "is_property_available", "property_unavailable_ranges", "search_properties", "quote_stay", "vendor_can", "owns_vendor", "vendor_covers_pin", "products_enabled", "product_is_public", "search_products", "get_product_public", "check_product_delivery", "get_vendor_store", "orders_enabled", "services_enabled", "service_is_public", "search_services", "get_service_public", "check_service_coverage", "get_service_slots", "get_service_provider"];
// Actions a signed-in user may invoke; each re-checks its own authorization inside the function.
const SIGNED_IN_ACTIONS = ["request_booking", "respond_to_booking", "cancel_booking", "submit_property", "review_property", "admin_update_user", "moderate_review", "become_host", "reorder_property_images",
  // commercial layer: every admin_* function checks is_admin() itself; booking_payment_status runs as the caller (RLS applies)
  "admin_record_payment", "admin_record_refund", "admin_settleable_bookings", "admin_create_settlement", "admin_update_settlement", "admin_set_commission", "complete_booking", "booking_payment_status", // vendor foundation: each authorizes internally (owner, admin, or open flag)
  "is_vendor_member", "save_vendor_profile", "submit_vendor_application", "ensure_legacy_vendor", "request_vendor_capability", "admin_review_vendor", "admin_review_capability", "register_vendor_document", "delete_vendor_document", "admin_review_vendor_document", "set_vendor_service_areas", // product catalogue: each authorizes internally (owner with the products capability, or admin)
  "save_product", "save_product_variant", "adjust_inventory", "register_product_image", "delete_product_image", "reorder_product_images", "set_product_availability", "submit_product", "archive_product", "restore_product", "admin_review_product", "admin_set_product_featured", "admin_reorder_product_categories", // cart, checkout and product orders: each authorizes internally (own cart/orders, own vendor, or admin)
  "save_address", "delete_address", "set_default_address", "cart_set_item", "cart_clear", "get_cart", "place_order", "vendor_respond_order", "vendor_mark_packed", "vendor_ship_order", "vendor_update_shipment", "cancel_order", "request_return", "open_dispute", "decide_order_request", "admin_cancel_order", "admin_resolve_dispute",
  // services: each authorizes internally (own requests, own provider with the services capability, or admin)
  "save_service", "register_service_image", "delete_service_image", "reorder_service_images", "set_service_availability_flag", "submit_service", "archive_service", "restore_service", "set_service_availability", "add_service_time_off", "delete_service_time_off", "request_service", "cancel_service_request", "decide_quotation", "provider_respond_service_request", "provider_send_quotation", "provider_schedule_appointment", "provider_start_service", "provider_complete_service", "provider_cancel_service_request", "admin_review_service", "admin_set_service_featured", "admin_reorder_service_categories", "admin_cancel_service_request",
  // commission foundation (admin only, checked inside)
  "admin_set_marketplace_commission"];

describe("who can call which function", () => {
  it("anonymous visitors can call only the public read helpers", async () => {
    expect(await callable("anon")).toEqual([...PUBLIC_HELPERS].sort());
  });

  it("signed-in users can additionally call the booking, listing and moderation actions (each authorizes internally)", async () => {
    expect(await callable("authenticated")).toEqual([...PUBLIC_HELPERS, ...SIGNED_IN_ACTIONS].sort());
  });

  it("only the server (service role) can call the rate limiter, on top of those", async () => {
    const server = await callable("service_role");
    expect(server).toContain("rate_limit_hit");
    expect(await callable("authenticated")).not.toContain("rate_limit_hit");
  });

  it("internal helpers (notifications, audit, pricing core, photo limit) are not callable through the API by anyone but the owner", async () => {
    for (const fn of ["notify", "notify_admins", "write_audit", "compute_stay_quote", "audit_admin_change", "property_images_limit", "handle_new_user",
    "compute_commission", "ledger_accrue", "ledger_reverse", "apply_refund", "booking_net_host_share", "setting_numeric", "setting_text", "setting_bool", "record_payment_event"]) {
      for (const role of ["anon", "authenticated"]) expect(await callable(role), `${role} must not execute ${fn}`).not.toContain(fn);
    }
  });
});

describe("row level security coverage", () => {
  it("every table in the public schema has RLS enabled (deny by default)", async () => {
    const { rows } = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`);
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("anonymous visitors cannot read any private table, even though Supabase grants table privileges by default", async () => {
    const privateTables = ["profiles", "property_private", "bookings", "notifications", "audit_logs", "reports", "contact_enquiries", "partner_applications", "gardening_enquiries", "saved_properties", "rate_limits", "availability_blocks"];
    await db.exec("set role anon");
    try {
      for (const t of privateTables) {
        let rows = -1;
        try { rows = (await db.query(`select 1 from public.${t} limit 1`)).rows.length; } catch { rows = 0; /* permission denied is also fine */ }
        expect(rows, t).toBe(0);
      }
    } finally { await db.exec("reset role"); }
  });
});
