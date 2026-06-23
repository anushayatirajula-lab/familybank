// Deno tests for money-handling RPCs:
//   - fb_split_into_jars       (jar split math + authorization)
//   - fb_approve_chore         (workflow + parent-only auth + credit)
//   - fb_process_due_allowance (premium gate + split + next_payment_at advance)
//   - fb_spend_wishlist        (deduction, double-spend guard, insufficient balance)
//
// Setup creates a disposable premium test parent + child, runs assertions, then deletes
// the auth users (cascades children/jars/balances/transactions/chores/allowances/wishlist).

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Ctx = {
  parentId: string;
  parentEmail: string;
  parentPwd: string;
  childRowId: string;
  parentClient: SupabaseClient;
};

async function setup(): Promise<Ctx> {
  const tag = crypto.randomUUID().slice(0, 8);
  const parentEmail = `evalparent_${tag}@familybank.test`;
  const parentPwd = `Pw_${crypto.randomUUID()}`;

  // 1) Create parent auth user (handle_new_user trigger seeds profile + PARENT role)
  const { data: pUser, error: pErr } = await admin.auth.admin.createUser({
    email: parentEmail,
    password: parentPwd,
    email_confirm: true,
    user_metadata: { full_name: `Eval Parent ${tag}` },
  });
  if (pErr || !pUser.user) throw pErr ?? new Error("parent create failed");
  const parentId = pUser.user.id;

  // 2) Grant premium via trial window (so free-tier triggers don't block, and allowance gate passes)
  const { error: trialErr } = await admin
    .from("profiles")
    .update({ trial_ends_at: new Date(Date.now() + 30 * 86400_000).toISOString() })
    .eq("id", parentId);
  if (trialErr) throw trialErr;

  // 3) Create child auth user (so child row can FK to profiles.id via user_id)
  const childEmail = `evalchild_${tag}@familybank.internal`;
  const { data: cUser, error: cErr } = await admin.auth.admin.createUser({
    email: childEmail,
    password: `Pw_${crypto.randomUUID()}`,
    email_confirm: true,
    user_metadata: { role: "CHILD", full_name: `Eval Child ${tag}` },
  });
  if (cErr || !cUser.user) throw cErr ?? new Error("child create failed");
  const childUserId = cUser.user.id;

  // 4) Sign in as parent to get a JWT for RPC calls that check auth.uid()
  const parentClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error: signErr } = await parentClient.auth.signInWithPassword({
    email: parentEmail,
    password: parentPwd,
  });
  if (signErr) throw signErr;

  // 5) Create child row + jars (40/30/20/10) as the parent
  const { data: child, error: chErr } = await parentClient
    .from("children")
    .insert({ parent_id: parentId, user_id: childUserId, name: `Eval Kid ${tag}`, age: 10 })
    .select("id")
    .single();
  if (chErr) throw chErr;
  const childRowId = child.id as string;

  const { error: jarErr } = await parentClient.from("jars").insert([
    { child_id: childRowId, jar_type: "SHOPPING", percentage: 40 },
    { child_id: childRowId, jar_type: "SAVINGS", percentage: 30 },
    { child_id: childRowId, jar_type: "CHARITY", percentage: 10 },
    { child_id: childRowId, jar_type: "WISHLIST", percentage: 20 },
  ]);
  if (jarErr) throw jarErr;

  return { parentId, parentEmail, parentPwd, childRowId, parentClient };
}

async function teardown(ctx: Ctx) {
  // Cascades through profiles -> children -> jars/balances/transactions/chores/allowances/wishlist
  const { data: kids } = await admin.from("children").select("user_id").eq("parent_id", ctx.parentId);
  for (const k of kids ?? []) {
    if (k.user_id) await admin.auth.admin.deleteUser(k.user_id);
  }
  await admin.auth.admin.deleteUser(ctx.parentId);
}

async function balanceMap(childId: string) {
  const { data } = await admin.from("balances").select("jar_type, amount").eq("child_id", childId);
  const m: Record<string, number> = {};
  for (const r of data ?? []) m[r.jar_type as string] = Number(r.amount);
  return m;
}

// ---------------------------------------------------------------------------

Deno.test("fb_split_into_jars: splits 100 by jar percentages and records txns", async () => {
  const ctx = await setup();
  try {
    const { error } = await ctx.parentClient.rpc("fb_split_into_jars", {
      p_child: ctx.childRowId,
      p_amount: 100,
      p_type: "CHORE_REWARD",
      p_reference_id: null,
    });
    assertEquals(error, null);

    const b = await balanceMap(ctx.childRowId);
    assertEquals(b.SHOPPING, 40);
    assertEquals(b.SAVINGS, 30);
    assertEquals(b.CHARITY, 10);
    assertEquals(b.WISHLIST, 20);

    const { count } = await admin
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("child_id", ctx.childRowId);
    assertEquals(count, 4);
  } finally {
    await teardown(ctx);
  }
});

Deno.test("fb_split_into_jars: rejects non-parent caller", async () => {
  const ctx = await setup();
  const otherCtx = await setup();
  try {
    // otherCtx parent client tries to credit ctx's child
    const { error } = await otherCtx.parentClient.rpc("fb_split_into_jars", {
      p_child: ctx.childRowId,
      p_amount: 50,
      p_type: "MANUAL_ADJUSTMENT",
      p_reference_id: null,
    });
    assert(error, "expected authorization error");
    assert(/Unauthorized/i.test(error!.message));
  } finally {
    await teardown(ctx);
    await teardown(otherCtx);
  }
});

Deno.test("fb_approve_chore: SUBMITTED → APPROVED + balances credited", async () => {
  const ctx = await setup();
  try {
    const { data: chore, error: chErr } = await admin
      .from("chores")
      .insert({
        child_id: ctx.childRowId,
        title: "Test chore",
        token_reward: 10,
        status: "SUBMITTED",
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (chErr) throw chErr;

    const { error } = await ctx.parentClient.rpc("fb_approve_chore", { p_chore: chore.id });
    assertEquals(error, null);

    const { data: updated } = await admin.from("chores").select("status, approved_at").eq("id", chore.id).single();
    assertEquals(updated!.status, "APPROVED");
    assert(updated!.approved_at);

    const b = await balanceMap(ctx.childRowId);
    assertEquals(b.SHOPPING, 4);
    assertEquals(b.SAVINGS, 3);
    assertEquals(b.CHARITY, 1);
    assertEquals(b.WISHLIST, 2);

    // Double approve must fail (status is no longer SUBMITTED)
    const second = await ctx.parentClient.rpc("fb_approve_chore", { p_chore: chore.id });
    assert(second.error, "second approval should fail");
  } finally {
    await teardown(ctx);
  }
});

Deno.test("fb_approve_chore: rejects non-parent caller", async () => {
  const ctx = await setup();
  const other = await setup();
  try {
    const { data: chore } = await admin
      .from("chores")
      .insert({ child_id: ctx.childRowId, title: "x", token_reward: 5, status: "SUBMITTED" })
      .select("id")
      .single();

    const { error } = await other.parentClient.rpc("fb_approve_chore", { p_chore: chore!.id });
    assert(error, "expected unauthorized");
    assert(/Unauthorized/i.test(error!.message));
  } finally {
    await teardown(ctx);
    await teardown(other);
  }
});

Deno.test("fb_process_due_allowance: credits jars and advances next_payment_at by 7 days", async () => {
  const ctx = await setup();
  try {
    const past = new Date(Date.now() - 86400_000); // yesterday
    const { data: allowance } = await admin
      .from("allowances")
      .insert({
        child_id: ctx.childRowId,
        weekly_amount: 20,
        next_payment_at: past.toISOString(),
        is_active: true,
      })
      .select("id, next_payment_at")
      .single();

    // Service-role caller; RPC has no auth.uid() check (designed for cron)
    const { data: ok, error } = await admin.rpc("fb_process_due_allowance", {
      p_allowance_id: allowance!.id,
    });
    assertEquals(error, null);
    assertEquals(ok, true);

    const b = await balanceMap(ctx.childRowId);
    assertEquals(b.SHOPPING, 8);
    assertEquals(b.SAVINGS, 6);
    assertEquals(b.CHARITY, 2);
    assertEquals(b.WISHLIST, 4);

    const { data: after } = await admin
      .from("allowances")
      .select("next_payment_at")
      .eq("id", allowance!.id)
      .single();
    const advanced = new Date(after!.next_payment_at).getTime() - past.getTime();
    // Should advance by exactly 7 days (≥1 week), and be in the future
    assert(advanced >= 7 * 86400_000, `expected ≥7d advance, got ${advanced}ms`);
    assert(new Date(after!.next_payment_at).getTime() > Date.now(), "next_payment_at must be in the future");

    // Idempotency: a second immediate call should be a no-op (returns false)
    const again = await admin.rpc("fb_process_due_allowance", { p_allowance_id: allowance!.id });
    assertEquals(again.data, false);
  } finally {
    await teardown(ctx);
  }
});

Deno.test("fb_process_due_allowance: free-tier parent is gated out", async () => {
  const ctx = await setup();
  try {
    // Revoke premium trial → free tier
    await admin.from("profiles").update({ trial_ends_at: null }).eq("id", ctx.parentId);

    const { data: allowance } = await admin
      .from("allowances")
      .insert({
        child_id: ctx.childRowId,
        weekly_amount: 50,
        next_payment_at: new Date(Date.now() - 3600_000).toISOString(),
        is_active: true,
      })
      .select("id")
      .single();

    const { data: ok } = await admin.rpc("fb_process_due_allowance", { p_allowance_id: allowance!.id });
    assertEquals(ok, false);

    const b = await balanceMap(ctx.childRowId);
    assertEquals(Object.keys(b).length, 0, "no balances should be created for free tier");
  } finally {
    await teardown(ctx);
  }
});

Deno.test("fb_spend_wishlist: deducts balance, marks purchased, blocks double-spend & overdraft", async () => {
  const ctx = await setup();
  try {
    // Seed WISHLIST balance directly
    await admin
      .from("balances")
      .insert({ child_id: ctx.childRowId, jar_type: "WISHLIST", amount: 25 });

    // Insufficient first
    const { data: cheap } = await admin
      .from("wishlist_items")
      .insert({
        child_id: ctx.childRowId,
        title: "Too pricey",
        target_amount: 100,
        approved_by_parent: false,
        is_purchased: false,
      })
      .select("id")
      .single();
    const insufficient = await ctx.parentClient.rpc("fb_spend_wishlist", { p_item_id: cheap!.id });
    assert(insufficient.error, "should reject overdraft");
    assert(/Insufficient/i.test(insufficient.error!.message));

    // Affordable item
    const { data: item } = await admin
      .from("wishlist_items")
      .insert({
        child_id: ctx.childRowId,
        title: "Lego set",
        target_amount: 15,
        approved_by_parent: false,
        is_purchased: false,
      })
      .select("id")
      .single();

    const { error } = await ctx.parentClient.rpc("fb_spend_wishlist", { p_item_id: item!.id });
    assertEquals(error, null);

    const b = await balanceMap(ctx.childRowId);
    assertEquals(b.WISHLIST, 10);

    const { data: it } = await admin
      .from("wishlist_items")
      .select("is_purchased, approved_by_parent")
      .eq("id", item!.id)
      .single();
    assertEquals(it!.is_purchased, true);
    assertEquals(it!.approved_by_parent, true);

    // Double spend blocked
    const second = await ctx.parentClient.rpc("fb_spend_wishlist", { p_item_id: item!.id });
    assert(second.error, "double-spend should fail");
    assert(/already purchased/i.test(second.error!.message));
  } finally {
    await teardown(ctx);
  }
});
