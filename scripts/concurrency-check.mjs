// LIVE concurrency check for the booking engine, against a real Supabase project (the in-memory test database cannot run truly
// parallel transactions). It fires simultaneous booking requests and simultaneous host acceptances for the SAME dates and
// verifies the database keeps at most ONE confirmed booking.
//
// Needs (environment variables only — never put passwords in files or chat):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
//   HOST_EMAIL, HOST_PASSWORD                       a verified HOST account that owns the property (see assign_demo_listings_to_host.sql)
//   TRAVELLER_EMAILS="a@x.test,b@x.test,c@x.test"   verified traveller accounts (3+), TRAVELLER_PASSWORD (same password for all test travellers)
//   PROPERTY_SLUG                                   e.g. demo-green-valley-farm-stay
// Usage: node scripts/concurrency-check.mjs
import { createClient } from "@supabase/supabase-js";

const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Missing ${k}`); process.exit(2); } return v; };
const url = need("NEXT_PUBLIC_SUPABASE_URL"), anon = need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const travellers = need("TRAVELLER_EMAILS").split(",").map((s) => s.trim()).filter(Boolean);
if (travellers.length < 3) { console.error("Need at least 3 traveller accounts"); process.exit(2); }

async function login(email, password) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login failed for ${email}: ${error.message}`);
  return c;
}

const host = await login(need("HOST_EMAIL"), need("HOST_PASSWORD"));
const clients = await Promise.all(travellers.map((e) => login(e, need("TRAVELLER_PASSWORD"))));
const { data: prop, error: pe } = await host.from("properties").select("id, max_guests, min_nights").eq("slug", need("PROPERTY_SLUG")).single();
if (pe) throw new Error(`cannot read the property as the host: ${pe.message}`);

// A window 90–93 days out (so it never collides with the demo blocks). Uses min_nights so the request is valid.
const start = new Date(Date.now() + 90 * 86400000);
const day = (d, n) => new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
const [ci, co] = [day(start, 0), day(start, Math.max(prop.min_nights, 1))];

console.log(`Requesting ${ci} → ${co} from ${clients.length} travellers at the same instant…`);
const requests = await Promise.allSettled(clients.map((c) => c.rpc("request_booking", { p_property: prop.id, p_check_in: ci, p_check_out: co, p_adults: 1, p_children: 0, p_message: "concurrency check" })));
const ids = requests.map((r) => (r.status === "fulfilled" && !r.value.error ? r.value.data : null)).filter(Boolean);
console.log(`  ${ids.length} requests created (pending requests may overlap by design)`);

console.log("Host accepts ALL of them simultaneously…");
const accepts = await Promise.allSettled(ids.map((id) => host.rpc("respond_to_booking", { p_booking: id, p_accept: true, p_note: null })));
const accepted = accepts.filter((r) => r.status === "fulfilled" && !r.value.error).length;
const { data: confirmed } = await host.from("bookings").select("id").eq("property_id", prop.id).eq("status", "confirmed").eq("check_in", ci);
console.log(`  accept calls that succeeded: ${accepted}; confirmed bookings for those dates: ${confirmed?.length}`);

// Clean up what this script created so the calendar is left as it was.
for (const id of ids) await host.rpc("cancel_booking", { p_booking: id, p_note: "concurrency check cleanup" });

if (ids.length >= 2 && accepted === 1 && confirmed?.length === 1) { console.log("PASS: exactly one overlapping reservation was confirmed."); process.exit(0); }
console.error("FAIL: expected exactly one confirmed booking."); process.exit(1);
