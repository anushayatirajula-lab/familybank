// Eval runner for money-handling RPCs.
//
// Invoke (POST or GET) → runs the full eval suite against the live DB using a
// disposable test parent + child, asserts invariants, and returns a JSON report.
// Always cleans up the test users at the end (cascade deletes everything seeded).
//
// Covered RPCs:
//   - fb_split_into_jars       (jar split math + parent-only authorization)
//   - fb_approve_chore         (SUBMITTED → APPROVED + credit + double-approve blocked)
//   - fb_process_due_allowance (premium gate + split + 7-day advance + idempotency)
//   - fb_spend_wishlist        (deduction + overdraft + double-spend blocked)

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

type Result = { name: string; passed: boolean; error?: string; durationMs: number };

function eq<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function truthy(label: string, v: unknown) {
  if (!v) throw new Error(`${label}: expected truthy, got ${JSON.stringify(v)}`);
}

type Ctx = {
  parentId: string;
  childRowId: string;
  parentClient: SupabaseClient;
  admin: SupabaseClient;
  cleanupUserIds: string[];
};

async function setup(admin: SupabaseClient): Promise<Ctx> {
  const tag = crypto.randomUUID().slice(0, 8);
  const parentEmail = `evalparent_${tag}@familybank.test`;
  const parentPwd = `Pw_${crypto.randomUUID()}`;

  const { data: pUser, error: pErr } = await admin.auth.admin.createUser({
    email: parentEmail,
    password: parentPwd,
    email_confirm: true,
    user_metadata: { full_name: `Eval Parent ${tag}` },
  });
  if (pErr || !pUser.user) throw pErr ?? new Error('parent create failed');
  const parentId = pUser.user.id;

  // Premium trial → free-tier triggers don't block, allowance gate passes
  const { error: trialErr } = await admin
    .from('profiles')
    .update({ trial_ends_at: new Date(Date.now() + 30 * 86400_000).toISOString() })
    .eq('id', parentId);
  if (trialErr) throw trialErr;

  const childEmail = `evalchild_${tag}@familybank.internal`;
  const { data: cUser, error: cErr } = await admin.auth.admin.createUser({
    email: childEmail,
    password: `Pw_${crypto.randomUUID()}`,
    email_confirm: true,
    user_metadata: { role: 'CHILD', full_name: `Eval Child ${tag}` },
  });
  if (cErr || !cUser.user) throw cErr ?? new Error('child create failed');
  const childUserId = cUser.user.id;

  const parentClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error: signErr } = await parentClient.auth.signInWithPassword({
    email: parentEmail,
    password: parentPwd,
  });
  if (signErr) throw signErr;

  const { data: child, error: chErr } = await parentClient
    .from('children')
    .insert({ parent_id: parentId, user_id: childUserId, name: `Eval Kid ${tag}`, age: 10 })
    .select('id')
    .single();
  if (chErr) throw chErr;
  const childRowId = child.id as string;

  const { error: jarErr } = await parentClient.from('jars').insert([
    { child_id: childRowId, jar_type: 'SHOPPING', percentage: 40 },
    { child_id: childRowId, jar_type: 'SAVINGS', percentage: 30 },
    { child_id: childRowId, jar_type: 'CHARITY', percentage: 10 },
    { child_id: childRowId, jar_type: 'WISHLIST', percentage: 20 },
  ]);
  if (jarErr) throw jarErr;

  return { parentId, childRowId, parentClient, admin, cleanupUserIds: [parentId, childUserId] };
}

async function teardown(admin: SupabaseClient, userIds: string[]) {
  for (const uid of userIds) {
    try { await admin.auth.admin.deleteUser(uid); } catch (_) { /* ignore */ }
  }
}

async function balanceMap(admin: SupabaseClient, childId: string) {
  const { data } = await admin.from('balances').select('jar_type, amount').eq('child_id', childId);
  const m: Record<string, number> = {};
  for (const r of data ?? []) m[r.jar_type as string] = Number(r.amount);
  return m;
}

// ---------------------------------------------------------------------------

type Test = (admin: SupabaseClient) => Promise<void>;

const tests: Record<string, Test> = {
  'fb_split_into_jars: splits 100 by jar percentages and records txns': async (admin) => {
    const ctx = await setup(admin);
    try {
      const { error } = await ctx.parentClient.rpc('fb_split_into_jars', {
        p_child: ctx.childRowId, p_amount: 100, p_type: 'CHORE_REWARD', p_reference_id: null,
      });
      eq('rpc error', error, null);
      const b = await balanceMap(admin, ctx.childRowId);
      eq('SHOPPING', b.SHOPPING, 40);
      eq('SAVINGS', b.SAVINGS, 30);
      eq('CHARITY', b.CHARITY, 10);
      eq('WISHLIST', b.WISHLIST, 20);
      const { count } = await admin.from('transactions').select('*', { count: 'exact', head: true }).eq('child_id', ctx.childRowId);
      eq('txn count', count, 4);
    } finally { await teardown(admin, ctx.cleanupUserIds); }
  },

  'fb_split_into_jars: rejects non-parent caller': async (admin) => {
    const a = await setup(admin);
    const b = await setup(admin);
    try {
      const { error } = await b.parentClient.rpc('fb_split_into_jars', {
        p_child: a.childRowId, p_amount: 50, p_type: 'MANUAL_ADJUSTMENT', p_reference_id: null,
      });
      truthy('expected authorization error', error);
      truthy('error mentions Unauthorized', /Unauthorized/i.test(error!.message));
    } finally { await teardown(admin, [...a.cleanupUserIds, ...b.cleanupUserIds]); }
  },

  'fb_approve_chore: SUBMITTED → APPROVED + balances credited + double-approve blocked': async (admin) => {
    const ctx = await setup(admin);
    try {
      const { data: chore, error: chErr } = await admin.from('chores').insert({
        child_id: ctx.childRowId, title: 'Test chore', token_reward: 10,
        status: 'SUBMITTED', submitted_at: new Date().toISOString(),
      }).select('id').single();
      if (chErr) throw chErr;

      const { error } = await ctx.parentClient.rpc('fb_approve_chore', { p_chore: chore!.id });
      eq('approve error', error, null);

      const { data: updated } = await admin.from('chores').select('status, approved_at').eq('id', chore!.id).single();
      eq('status', updated!.status, 'APPROVED');
      truthy('approved_at set', updated!.approved_at);

      const b = await balanceMap(admin, ctx.childRowId);
      eq('SHOPPING', b.SHOPPING, 4);
      eq('SAVINGS', b.SAVINGS, 3);
      eq('CHARITY', b.CHARITY, 1);
      eq('WISHLIST', b.WISHLIST, 2);

      const second = await ctx.parentClient.rpc('fb_approve_chore', { p_chore: chore!.id });
      truthy('second approval should fail', second.error);
    } finally { await teardown(admin, ctx.cleanupUserIds); }
  },

  'fb_approve_chore: rejects non-parent caller': async (admin) => {
    const a = await setup(admin);
    const b = await setup(admin);
    try {
      const { data: chore } = await admin.from('chores').insert({
        child_id: a.childRowId, title: 'x', token_reward: 5, status: 'SUBMITTED',
      }).select('id').single();
      const { error } = await b.parentClient.rpc('fb_approve_chore', { p_chore: chore!.id });
      truthy('expected unauthorized', error);
      truthy('mentions Unauthorized', /Unauthorized/i.test(error!.message));
    } finally { await teardown(admin, [...a.cleanupUserIds, ...b.cleanupUserIds]); }
  },

  'fb_process_due_allowance: credits jars, advances next_payment_at, is idempotent': async (admin) => {
    const ctx = await setup(admin);
    try {
      const past = new Date(Date.now() - 86400_000);
      const { data: allowance } = await admin.from('allowances').insert({
        child_id: ctx.childRowId, weekly_amount: 20,
        next_payment_at: past.toISOString(), is_active: true,
      }).select('id, next_payment_at').single();

      const { data: ok, error } = await admin.rpc('fb_process_due_allowance', { p_allowance_id: allowance!.id });
      eq('process error', error, null);
      eq('returned ok', ok, true);

      const b = await balanceMap(admin, ctx.childRowId);
      eq('SHOPPING', b.SHOPPING, 8);
      eq('SAVINGS', b.SAVINGS, 6);
      eq('CHARITY', b.CHARITY, 2);
      eq('WISHLIST', b.WISHLIST, 4);

      const { data: after } = await admin.from('allowances').select('next_payment_at').eq('id', allowance!.id).single();
      const advancedMs = new Date(after!.next_payment_at).getTime() - past.getTime();
      truthy(`>=7d advance (got ${advancedMs}ms)`, advancedMs >= 7 * 86400_000);
      truthy('next_payment_at in future', new Date(after!.next_payment_at).getTime() > Date.now());

      const again = await admin.rpc('fb_process_due_allowance', { p_allowance_id: allowance!.id });
      eq('idempotent second call', again.data, false);
    } finally { await teardown(admin, ctx.cleanupUserIds); }
  },

  'fb_process_due_allowance: free-tier parent is gated out': async (admin) => {
    const ctx = await setup(admin);
    try {
      await admin.from('profiles').update({ trial_ends_at: null }).eq('id', ctx.parentId);
      const { data: allowance } = await admin.from('allowances').insert({
        child_id: ctx.childRowId, weekly_amount: 50,
        next_payment_at: new Date(Date.now() - 3600_000).toISOString(), is_active: true,
      }).select('id').single();
      const { data: ok } = await admin.rpc('fb_process_due_allowance', { p_allowance_id: allowance!.id });
      eq('free-tier gated', ok, false);
      const b = await balanceMap(admin, ctx.childRowId);
      eq('no balances created', Object.keys(b).length, 0);
    } finally { await teardown(admin, ctx.cleanupUserIds); }
  },

  'fb_spend_wishlist: deducts, marks purchased, blocks overdraft + double-spend': async (admin) => {
    const ctx = await setup(admin);
    try {
      await admin.from('balances').insert({ child_id: ctx.childRowId, jar_type: 'WISHLIST', amount: 25 });

      const { data: cheap } = await admin.from('wishlist_items').insert({
        child_id: ctx.childRowId, title: 'Too pricey', target_amount: 100,
        approved_by_parent: false, is_purchased: false,
      }).select('id').single();
      const insufficient = await ctx.parentClient.rpc('fb_spend_wishlist', { p_item_id: cheap!.id });
      truthy('overdraft rejected', insufficient.error);
      truthy('mentions Insufficient', /Insufficient/i.test(insufficient.error!.message));

      const { data: item } = await admin.from('wishlist_items').insert({
        child_id: ctx.childRowId, title: 'Lego set', target_amount: 15,
        approved_by_parent: false, is_purchased: false,
      }).select('id').single();
      const { error } = await ctx.parentClient.rpc('fb_spend_wishlist', { p_item_id: item!.id });
      eq('spend error', error, null);

      const b = await balanceMap(admin, ctx.childRowId);
      eq('WISHLIST after spend', b.WISHLIST, 10);

      const { data: it } = await admin.from('wishlist_items').select('is_purchased, approved_by_parent').eq('id', item!.id).single();
      eq('is_purchased', it!.is_purchased, true);
      eq('approved_by_parent', it!.approved_by_parent, true);

      const second = await ctx.parentClient.rpc('fb_spend_wishlist', { p_item_id: item!.id });
      truthy('double-spend rejected', second.error);
      truthy('mentions already purchased', /already purchased/i.test(second.error!.message));
    } finally { await teardown(admin, ctx.cleanupUserIds); }
  },
};

async function runAll(): Promise<{ summary: { total: number; passed: number; failed: number; durationMs: number }; results: Result[] }> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const results: Result[] = [];
  const start = Date.now();
  for (const [name, fn] of Object.entries(tests)) {
    const t0 = Date.now();
    try {
      await fn(admin);
      results.push({ name, passed: true, durationMs: Date.now() - t0 });
    } catch (e) {
      results.push({ name, passed: false, error: (e as Error).message, durationMs: Date.now() - t0 });
    }
  }
  const passed = results.filter((r) => r.passed).length;
  return {
    summary: { total: results.length, passed, failed: results.length - passed, durationMs: Date.now() - start },
    results,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const report = await runAll();
    return new Response(JSON.stringify(report, null, 2), {
      status: report.summary.failed === 0 ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
