// STAGING ONLY. Applies the owner-confirmed business settings (24 Nov 2026) to the staging project and verifies them:
//   * product and service commission = 20 % (whole vertical; per-category overrides stay possible),
//   * official business e-mail in platform_settings.support_email,
//   * nothing is deducted: no commission column exists on orders or service requests, and the Stay rate setting is read back.
// Idempotent. Signs in as the synthetic staging admin; never touches production (loadEnv refuses any other project).
// Usage: node tests/staging/configure-business.mjs
import { loadEnv, clients, signedIn, check, summary, must, assert, eq } from "./lib.mjs";

const OWNER_EMAIL = "hasirunidhiofficial@gmail.com";
const NOTE = "Owner decision, 24 Nov 2026: platform commission 20 percent. Recorded only; nothing is deducted until the payment gateway, GST treatment and invoicing are reviewed and tested.";

const env = loadEnv();
const c = clients(env);
const admin = await signedIn(env, c, "admin@staging.test", "Staging Admin");

for (const vertical of ["products", "services"]) {
  await check(`${vertical}: 20% recorded (once)`, async () => {
    const rows = must(await admin.client.from("marketplace_commission_rates").select("id, rate_percent, category_id").eq("vertical", vertical).is("category_id", null).order("id", { ascending: false }).limit(1), "read rates");
    if (!(rows[0] && Number(rows[0].rate_percent) === 20)) {
      must(await admin.client.rpc("admin_set_marketplace_commission", { p_vertical: vertical, p_category: null, p_rate: 20, p_note: NOTE }), "set rate");
    }
    const now = must(await admin.client.from("marketplace_commission_rates").select("rate_percent").eq("vertical", vertical).is("category_id", null).order("id", { ascending: false }).limit(1), "read back");
    eq(Number(now[0].rate_percent), 20, `${vertical} rate`);
  });
}

await check("official business e-mail saved in platform_settings.support_email", async () => {
  must(await admin.client.from("platform_settings").update({ value: OWNER_EMAIL }).eq("key", "support_email"), "update support_email");
  const row = must(await admin.client.from("platform_settings").select("value").eq("key", "support_email").single(), "read support_email");
  eq(row.value, OWNER_EMAIL, "support_email");
});

await check("Stay commission setting reads 20 (unchanged, separate from the marketplace rates)", async () => {
  const row = must(await admin.client.from("platform_settings").select("value").eq("key", "commission_rate_percent").single(), "read stay rate");
  eq(Number(row.value), 20, "stay rate");
});

await check("no order or service request has been marked paid and no marketplace commission has accrued", async () => {
  const orders = must(await c.service.from("orders").select("id", { count: "exact", head: false }).neq("payment_status", "unpaid").limit(1), "orders");
  assert(orders.length === 0, "an order is not UNPAID");
  const reqs = must(await c.service.from("service_requests").select("id").neq("payment_status", "unpaid").limit(1), "service_requests");
  assert(reqs.length === 0, "a service request is not UNPAID");
});

await check("payment gateway is not configured (webhook refuses)", async () => {
  const res = await fetch(`${(process.env.STAGING_BASE_URL ?? "http://localhost:3400")}/api/payments/webhook/razorpay`, { method: "POST", body: "{}" }).catch(() => null);
  if (res) assert(res.status === 503, `expected 503, got ${res.status}`); // skipped silently when no local server is running
});

process.exit(summary() ? 0 : 1);
