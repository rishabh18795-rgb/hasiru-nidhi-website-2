import { beforeAll, describe, expect, it } from "vitest";
import { as, categoryId, createDb, createUser, failure, makeAdmin, type Db } from "./harness";

let db: Db;
let admin: string;

beforeAll(async () => {
  db = await createDb();
  admin = await makeAdmin(db, "admin@example.test");
});

const roleOf = async (id: string) =>
  (await db.query<{ role: string }>("select role from public.profiles where id = $1", [id])).rows[0].role;

describe("signup and role assignment", () => {
  it("creates a traveller profile by default", async () => {
    const id = await createUser(db, "t1@example.test", { full_name: "Asha" });
    expect(await roleOf(id)).toBe("traveller");
  });

  it("creates a host profile only when a host account is requested", async () => {
    const id = await createUser(db, "h1@example.test", { account_type: "host" });
    expect(await roleOf(id)).toBe("host");
  });

  it("IGNORES an attempt to sign up as admin through signup metadata", async () => {
    const id = await createUser(db, "evil@example.test", { account_type: "admin", role: "admin" });
    expect(await roleOf(id)).toBe("traveller");
  });
});

describe("privilege escalation is blocked", () => {
  it("a traveller cannot promote themselves to host or admin", async () => {
    const id = await createUser(db, "esc1@example.test");
    expect(await failure(db, id, "update public.profiles set role = 'admin' where id = $1", [id])).toMatch(
      /forbidden_profile_change/,
    );
    expect(await failure(db, id, "update public.profiles set role = 'host' where id = $1", [id])).toMatch(
      /forbidden_profile_change/,
    );
    expect(await roleOf(id)).toBe("traveller");
  });

  it("a user cannot un-suspend or self-verify", async () => {
    const id = await createUser(db, "esc2@example.test", { account_type: "host" });
    expect(await failure(db, id, "update public.profiles set host_verified = true where id = $1", [id])).toMatch(
      /forbidden_profile_change/,
    );
  });

  it("a user can still edit their own name and phone", async () => {
    const id = await createUser(db, "edit@example.test");
    await as(db, id, "update public.profiles set full_name = 'New Name', phone = '+919000000000' where id = $1", [id]);
    const rows = await as(db, id, "select full_name, phone from public.profiles where id = $1", [id]);
    expect(rows[0]).toMatchObject({ full_name: "New Name", phone: "+919000000000" });
  });

  it("a user cannot edit someone else's profile or read it", async () => {
    const a = await createUser(db, "a@example.test");
    const b = await createUser(db, "b@example.test");
    const changed = await as(db, a, "update public.profiles set full_name = 'Hacked' where id = $1 returning id", [b]);
    expect(changed).toHaveLength(0);
    expect(await as(db, a, "select id from public.profiles where id = $1", [b])).toHaveLength(0);
  });

  it("anonymous visitors cannot read profiles at all", async () => {
    expect(await as(db, null, "select id from public.profiles")).toHaveLength(0);
  });

  it("an admin can read all profiles", async () => {
    const rows = await as(db, admin, "select id from public.profiles");
    expect(rows.length).toBeGreaterThan(3);
  });
});

describe("admin_update_user", () => {
  it("lets an admin promote a traveller to host and verify them", async () => {
    const id = await createUser(db, "promote@example.test");
    await as(db, admin, "select public.admin_update_user($1, 'host', null, true)", [id]);
    const row = (await db.query<{ role: string; host_verified: boolean }>(
      "select role, host_verified from public.profiles where id = $1", [id])).rows[0];
    expect(row).toEqual({ role: "host", host_verified: true });
  });

  it("can NEVER create an admin, even for admins", async () => {
    const id = await createUser(db, "noadmin@example.test");
    expect(await failure(db, admin, "select public.admin_update_user($1, 'admin')", [id])).toMatch(
      /admin_changes_not_allowed/,
    );
    expect(await roleOf(id)).toBe("traveller");
  });

  it("cannot be used by non-admins", async () => {
    const host = await createUser(db, "host-attacker@example.test", { account_type: "host" });
    const victim = await createUser(db, "victim@example.test");
    expect(await failure(db, host, "select public.admin_update_user($1, null, true)", [victim])).toMatch(/forbidden/);
  });

  it("cannot be called anonymously", async () => {
    const victim = await createUser(db, "victim2@example.test");
    expect(await failure(db, null, "select public.admin_update_user($1, null, true)", [victim])).toMatch(
      /permission denied/,
    );
  });

  it("does not let an admin demote another admin", async () => {
    const other = await makeAdmin(db, "admin2@example.test");
    expect(await failure(db, admin, "select public.admin_update_user($1, 'traveller')", [other])).toMatch(
      /admin_changes_not_allowed/,
    );
  });

  it("a suspended admin loses admin powers", async () => {
    const tmp = await makeAdmin(db, "admin3@example.test");
    await db.query("update public.profiles set is_suspended = true where id = $1", [tmp]);
    expect(await failure(db, tmp, "select public.admin_update_user($1, null, true)", [tmp])).toMatch(/forbidden/);
  });
});

describe("listing creation permissions", () => {
  it("a traveller cannot create a property", async () => {
    const t = await createUser(db, "t-prop@example.test");
    const msg = await failure(
      db, t,
      `insert into public.properties (host_id, slug, name) values ($1, 'x-trav', 'Traveller Prop')`, [t],
    );
    expect(msg).toMatch(/row-level security/);
  });

  it("a suspended host cannot create a property", async () => {
    const h = await createUser(db, "h-susp@example.test", { account_type: "host" });
    await db.query("update public.profiles set is_suspended = true where id = $1", [h]);
    const msg = await failure(
      db, h, `insert into public.properties (host_id, slug, name) values ($1, 'x-susp', 'Suspended Host')`, [h],
    );
    expect(msg).toMatch(/row-level security/);
  });

  it("a host can create only a draft owned by themselves", async () => {
    const h = await createUser(db, "h-ok@example.test", { account_type: "host" });
    const cat = await categoryId(db);
    await as(db, h, `insert into public.properties (host_id, slug, name, category_id) values ($1, 'h-ok-draft', 'My Draft', $2)`, [h, cat]);
    expect(await failure(db, h,
      `insert into public.properties (host_id, slug, name, status) values ($1, 'h-ok-live', 'Live Now', 'approved')`, [h],
    )).toMatch(/row-level security|forbidden_property_change/);
    const other = await createUser(db, "h-other@example.test", { account_type: "host" });
    expect(await failure(db, h,
      `insert into public.properties (host_id, slug, name) values ($1, 'h-impersonate', 'Stolen')`, [other],
    )).toMatch(/row-level security|forbidden_property_change/);
    expect(await failure(db, h,
      `insert into public.properties (host_id, slug, name, is_featured) values ($1, 'h-feat', 'Featured', true)`, [h],
    )).toMatch(/forbidden_property_change/);
  });
});
