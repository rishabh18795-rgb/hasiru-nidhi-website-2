// Removes the clearly labelled DEMO and TEST records from the STAGING project, and nothing else.
//   node tests/staging/remove-demo.mjs          dry run: lists what would be removed
//   node tests/staging/remove-demo.mjs --apply  does it
// A record is demo/test only if its name carries the label this project's seed scripts and browser tests add: "(demo)", "UI ...", "E2E ...", "Staging ...".
// Genuine vendors, products, services, customers and orders never match, so they are never touched. Records that orders or requests refer to are
// ARCHIVED (kept for history); unreferenced ones are deleted. loadEnv() refuses to run against any project except staging, so production is out of reach.
import { loadEnv, clients } from "./lib.mjs";

const apply = process.argv.includes("--apply");
const env = loadEnv();
const svc = clients(env).service;
const LABEL = /\(demo\)|^UI |^E2E |^Staging /;
let removed = 0, archived = 0;
const say = (m) => console.log(`${apply ? "" : "[dry run] "}${m}`);

async function sweep(table, nameCol, refTables) {
  const { data } = await svc.from(table).select(`id, ${nameCol}, status`);
  for (const row of (data ?? []).filter((r) => LABEL.test(r[nameCol] ?? ""))) {
    let referenced = false;
    for (const [t, col] of refTables) { const r = await svc.from(t).select("id", { count: "exact", head: true }).eq(col, row.id); if ((r.count ?? 0) > 0) referenced = true; }
    if (referenced) { say(`archive ${table}: ${row[nameCol]}`); if (apply && row.status !== "archived") await svc.from(table).update({ status: "archived", is_featured: false }).eq("id", row.id); archived++; }
    else { say(`delete  ${table}: ${row[nameCol]}`); if (apply) { const d = await svc.from(table).delete().eq("id", row.id); if (d.error) { await svc.from(table).update({ status: "archived", is_featured: false }).eq("id", row.id); archived++; continue; } } removed++; }
  }
}
await sweep("products", "name", [["order_items", "product_id"], ["cart_items", "variant_id"]]);
await sweep("services", "name", [["service_requests", "service_id"]]);
// demo stays: only the labelled property, never a real one
const props = (await svc.from("properties").select("id, name, status").like("name", "%(demo)")).data ?? [];
for (const p of props) { say(`archive properties: ${p.name}`); if (apply) await svc.from("properties").update({ status: "archived" }).eq("id", p.id); archived++; }
// demo vendors keep their account but lose the "(demo)" marker only when asked, so nothing real is renamed by accident
console.log(`\n${apply ? "Done" : "Would change"}: ${removed} deleted, ${archived} archived. Genuine records are untouched.`);
if (!apply) console.log("Run again with --apply to do it.");
