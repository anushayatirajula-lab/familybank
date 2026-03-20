import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PushNotificationRequest {
  userId: string;
  title: string;
  body: string;
  data?: any;
  url?: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-PUSH] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { userId, title, body, data, url }: PushNotificationRequest = await req.json();
    logStep("Request parsed", { userId, title });

    if (!userId || !title || !body) {
      throw new Error("Missing required fields: userId, title, body");
    }

    // Authorization: either internal secret OR authenticated parent of target user
    const internalSecret = req.headers.get("x-internal-secret");
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isInternalCall = cronSecret && internalSecret === cronSecret;

    if (!isInternalCall) {
      // Must be an authenticated parent of a child with this user_id
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }

      const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }

      const callerId = claimsData.claims.sub;

      // Verify caller is parent of a child whose user_id matches the target userId
      const { data: childRecord, error: childError } = await supabaseAdmin
        .from("children")
        .select("id")
        .eq("parent_id", callerId)
        .eq("user_id", userId)
        .maybeSingle();

      // Also allow sending to yourself
      if (!childRecord && callerId !== userId) {
        logStep("Authorization failed: caller is not parent of target user");
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (subsError) {
      logStep("Error fetching subscriptions", subsError);
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      logStep("No subscriptions found for user");
      return new Response(
        JSON.stringify({ message: "No push subscriptions found for user" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    logStep("Found subscriptions", { count: subscriptions.length });

    // Check if VAPID keys are configured
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      logStep("VAPID keys not configured - notifications cannot be sent");
      
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        title,
        body,
        data: data || {},
      });

      return new Response(
        JSON.stringify({ 
          message: "VAPID keys not configured. Notification saved to database.",
          vapid_setup_required: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Send push notifications
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          const pushPayload = JSON.stringify({
            title,
            body,
            data: data || {},
            url: url || "/",
            icon: "/pwa-192x192.png",
            badge: "/pwa-192x192.png",
          });

          const response = await fetch(subscription.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "TTL": "86400",
            },
            body: pushPayload,
          });

          if (!response.ok) {
            throw new Error(`Push failed: ${response.status}`);
          }

          logStep("Push sent successfully", { endpoint: subscription.endpoint.substring(0, 50) });
          return { success: true, endpoint: subscription.endpoint };
        } catch (err) {
          const error = err as Error;
          logStep("Push failed", { error: error.message, endpoint: subscription.endpoint.substring(0, 50) });
          
          if (error.message.includes("410") || error.message.includes("404")) {
            await supabaseAdmin
              .from("push_subscriptions")
              .delete()
              .eq("id", subscription.id);
          }
          
          return { success: false, endpoint: subscription.endpoint, error: error.message };
        }
      })
    );

    // Log notification to database
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title,
      body,
      data: data || {},
    });

    const successCount = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    logStep("Push notifications sent", { total: subscriptions.length, successful: successCount });

    return new Response(
      JSON.stringify({ 
        message: `Sent ${successCount}/${subscriptions.length} notifications`,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err) {
    const error = err as Error;
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
