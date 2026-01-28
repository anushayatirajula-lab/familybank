import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // 1. Verify authentication - get the auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No authorization header provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create authenticated client for JWT validation
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // 3. Validate JWT using getClaims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      logStep("Authentication failed", { error: claimsError?.message });
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email as string;
    
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "User email not available" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    logStep("User authenticated", { userId, email: userEmail });

    // 4. Create service role client for database operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get profile with trial info
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('trial_ends_at, subscription_status, stripe_customer_id, subscription_id')
      .eq('id', userId)
      .single();

    logStep("Profile retrieved", { profile });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    // Check Stripe for active subscription
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    
    if (customers.data.length === 0) {
      // No customer in Stripe, check trial status
      const now = new Date();
      const trialEnds = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
      const isTrialActive = trialEnds && now < trialEnds;

      logStep("No Stripe customer, checking trial", { isTrialActive, trialEnds });

      return new Response(JSON.stringify({
        subscribed: false,
        on_trial: isTrialActive,
        trial_ends_at: trialEnds?.toISOString(),
        subscription_status: isTrialActive ? 'trialing' : 'expired'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Update profile with Stripe customer ID if not set
    if (!profile?.stripe_customer_id) {
      await supabaseClient
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });

    const subscription = subscriptions.data[0];
    
    if (!subscription) {
      const now = new Date();
      const trialEnds = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
      const isTrialActive = trialEnds && now < trialEnds;

      logStep("No subscription found, checking trial", { isTrialActive });

      // Update profile subscription status
      await supabaseClient
        .from('profiles')
        .update({ 
          subscription_status: isTrialActive ? 'trialing' : 'expired',
        })
        .eq('id', userId);

      return new Response(JSON.stringify({
        subscribed: false,
        on_trial: isTrialActive,
        trial_ends_at: trialEnds?.toISOString(),
        subscription_status: isTrialActive ? 'trialing' : 'expired'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const subscriptionEnd = new Date(subscription.current_period_end * 1000);
    const isOnTrial = subscription.status === 'trialing';

    logStep("Subscription found", { 
      subscriptionId: subscription.id, 
      status: subscription.status,
      isActive,
      isOnTrial
    });

    // Update profile with subscription info
    await supabaseClient
      .from('profiles')
      .update({ 
        subscription_id: subscription.id,
        subscription_status: subscription.status,
        current_period_end: subscriptionEnd.toISOString(),
      })
      .eq('id', userId);

    return new Response(JSON.stringify({
      subscribed: isActive,
      on_trial: isOnTrial,
      trial_ends_at: isOnTrial ? subscriptionEnd.toISOString() : null,
      subscription_status: subscription.status,
      current_period_end: subscriptionEnd.toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
