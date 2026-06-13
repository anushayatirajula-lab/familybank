// Cron-triggered. Sends ONE day-10 trial reminder (≈4 days before trial_ends_at)
// via email (Resend) + push (best-effort). Idempotent: uses subscription_data.trial_reminder_sent_at.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const log = (s: string, d?: unknown) =>
  console.log(`[TRIAL-REMINDER] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const admin = createClient(supabaseUrl, serviceKey);

  // Reminder window: 3.5 to 4.5 days before trial_ends_at (i.e. day 10 of a 14-day trial)
  const now = new Date();
  const windowStart = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 4.5 * 24 * 60 * 60 * 1000).toISOString();

  // Find candidates: trial_ends_at inside window, no reminder sent yet, not subscribed.
  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, full_name, trial_ends_at")
    .gte("trial_ends_at", windowStart)
    .lte("trial_ends_at", windowEnd);

  if (pErr) {
    log("profiles query failed", pErr);
    return new Response(JSON.stringify({ error: "query failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log("candidates", { count: profiles?.length ?? 0 });
  let sent = 0;

  for (const p of profiles ?? []) {
    try {
      // Check subscription state — skip if already paid or reminder already sent.
      const { data: sub } = await admin
        .from("subscription_data")
        .select("subscription_status, trial_reminder_sent_at")
        .eq("user_id", p.id)
        .maybeSingle();

      if (sub?.trial_reminder_sent_at) continue;
      if (sub?.subscription_status === "active") continue;

      // Resolve email + name
      const { data: userRes } = await admin.auth.admin.getUserById(p.id);
      const email = userRes?.user?.email;
      const name = (p.full_name as string | null)?.trim() || email?.split("@")[0] || "there";

      const trialEnds = new Date(p.trial_ends_at as string);
      const daysLeft = Math.max(1, Math.round((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      // 1) Email via Resend (best-effort)
      if (email && resendKey) {
        const subject = `${name}, ${daysLeft} days left in your FamilyBank Premium trial`;
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
            <h2 style="margin-top:0">Hi ${name},</h2>
            <p>You're <strong>${daysLeft} days</strong> away from the end of your FamilyBank Premium trial.</p>
            <p>While on Premium you've had access to:</p>
            <ul>
              <li>Up to 5 child accounts</li>
              <li>Automated weekly allowances</li>
              <li>Recurring chores</li>
              <li>Unlimited AI coach sessions</li>
              <li>Custom jar percentages & push notifications</li>
            </ul>
            <p>When your trial ends you'll be moved to the Free plan (1 child, 5 active chores/child, 10 AI sessions/month, manual allowances only). Keep everything by upgrading for <strong>$4.99/mo</strong>.</p>
            <p style="margin:24px 0">
              <a href="https://familybank.lovable.app/pricing"
                 style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">
                Upgrade to Premium
              </a>
            </p>
            <p style="color:#666;font-size:13px">You're getting this because you started a FamilyBank trial. This is the only trial-reminder email we'll send.</p>
          </div>`;
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "FamilyBank <onboarding@resend.dev>",
            to: [email],
            subject,
            html,
          }),
        });
        if (!r.ok) log("email failed", { userId: p.id, status: r.status, body: await r.text() });
      }

      // 2) Push (best-effort) — gate is handled inside send-push-notification (Premium during trial)
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": cronSecret,
          },
          body: JSON.stringify({
            userId: p.id,
            title: `${daysLeft} days left in your Premium trial`,
            body: "Tap to keep automated allowances, recurring chores, and unlimited AI coach.",
            url: "/pricing",
          }),
        });
      } catch (e) {
        log("push failed", { userId: p.id, err: String(e) });
      }

      // 3) Mark reminder sent (idempotency)
      await admin.from("subscription_data").upsert(
        { user_id: p.id, trial_reminder_sent_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      sent++;
    } catch (e) {
      log("user failed", { userId: p.id, err: String(e) });
    }
  }

  return new Response(JSON.stringify({ processed: profiles?.length ?? 0, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
