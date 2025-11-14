import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { userId, title, body, data, url }: PushNotificationRequest = await req.json();
    logStep("Request parsed", { userId, title });

    if (!userId || !title || !body) {
      throw new Error("Missing required fields: userId, title, body");
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subsError } = await supabase
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
      
      // Store notification in database for future retrieval
      await supabase.from("notifications").insert({
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
          
          // If subscription is invalid, remove it
          if (error.message.includes("410") || error.message.includes("404")) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", subscription.id);
          }
          
          return { success: false, endpoint: subscription.endpoint, error: error.message };
        }
      })
    );

    // Log notification to database
    await supabase.from("notifications").insert({
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
