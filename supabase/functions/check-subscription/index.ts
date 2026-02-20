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

const TRIAL_DAYS = 60;

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

    // 2. Create authenticated client and validate token using getUser
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 3. Validate JWT using getUser (more reliable than getClaims)
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    
    if (userError || !userData?.user) {
      logStep("Authentication failed", { error: userError?.message });
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;
    
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "User email not available" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    logStep("User authenticated", { userId, email: userEmail });

    // 4. Use the same service role client for database operations
    const supabaseClient = supabaseAuth;


    // Get profile with trial info (only trial_ends_at is in profiles now)
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('trial_ends_at')
      .eq('id', userId)
      .single();

    // Get subscription data from protected table (only service role can access)
    const { data: subscriptionData } = await supabaseClient
      .from('subscription_data')
      .select('stripe_customer_id, subscription_id, subscription_status, current_period_end')
      .eq('user_id', userId)
      .single();

    logStep("Data retrieved", { profile, subscriptionData });

    // Check if this is the first login (trial_ends_at is null)
    // If so, start the trial now
    let trialEndsAt = profile?.trial_ends_at;
    
    if (!trialEndsAt) {
      // First login - start the trial period now
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);
      trialEndsAt = trialEndDate.toISOString();
      
      logStep("First login detected, starting trial", { trialEndsAt });
      
      await supabaseClient
        .from('profiles')
        .update({ trial_ends_at: trialEndsAt })
        .eq('id', userId);

      // Create or update subscription_data entry
      await supabaseClient
        .from('subscription_data')
        .upsert({ 
          user_id: userId,
          subscription_status: 'trialing'
        }, { onConflict: 'user_id' });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    // Check Stripe for active subscription
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    
    if (customers.data.length === 0) {
      // No customer in Stripe, check trial status
      const now = new Date();
      const trialEnds = trialEndsAt ? new Date(trialEndsAt) : null;
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

    // Update subscription_data with Stripe customer ID if not set
    if (!subscriptionData?.stripe_customer_id) {
      await supabaseClient
        .from('subscription_data')
        .upsert({ 
          user_id: userId,
          stripe_customer_id: customerId 
        }, { onConflict: 'user_id' });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });

    const subscription = subscriptions.data[0];
    
    if (!subscription) {
      const now = new Date();
      const trialEnds = trialEndsAt ? new Date(trialEndsAt) : null;
      const isTrialActive = trialEnds && now < trialEnds;

      logStep("No subscription found, checking trial", { isTrialActive });

      // Update subscription_data status
      await supabaseClient
        .from('subscription_data')
        .upsert({ 
          user_id: userId,
          subscription_status: isTrialActive ? 'trialing' : 'expired',
        }, { onConflict: 'user_id' });

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

    // Update subscription_data with subscription info
    await supabaseClient
      .from('subscription_data')
      .upsert({ 
        user_id: userId,
        subscription_id: subscription.id,
        subscription_status: subscription.status,
        current_period_end: subscriptionEnd.toISOString(),
      }, { onConflict: 'user_id' });

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