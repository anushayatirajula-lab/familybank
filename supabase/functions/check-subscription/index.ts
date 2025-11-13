import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get profile with trial info
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('trial_ends_at, subscription_status, stripe_customer_id, subscription_id')
      .eq('id', user.id)
      .single();

    logStep("Profile retrieved", { profile });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    // Check Stripe for active subscription
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
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
        .eq('id', user.id);
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
        .eq('id', user.id);

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
      .eq('id', user.id);

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
