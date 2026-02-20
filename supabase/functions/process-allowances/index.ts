import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resend API helper
async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "FamilyBank <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send email: ${await response.text()}`);
  }
  
  return response.json();
}

interface Allowance {
  id: string;
  child_id: string;
  weekly_amount: number;
  day_of_week: number;
  next_payment_at: string;
  is_active: boolean;
}

interface Child {
  id: string;
  name: string;
  parent_id: string;
}

interface Parent {
  id: string;
  email: string;
  full_name: string | null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate CRON_SECRET to prevent unauthorized invocations
  const cronSecret = req.headers.get("X-Cron-Secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!expectedSecret || cronSecret !== expectedSecret) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting allowance processing...");

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    // Find all active allowances where next_payment_at is today or earlier
    const { data: allowances, error: allowancesError } = await supabase
      .from("allowances")
      .select(`
        id,
        child_id,
        weekly_amount,
        day_of_week,
        next_payment_at,
        is_active
      `)
      .eq("is_active", true)
      .lte("next_payment_at", todayStr);

    if (allowancesError) {
      console.error("Error fetching allowances:", allowancesError);
      throw allowancesError;
    }

    console.log(`Found ${allowances?.length || 0} allowances to process`);

    const processedCount = { success: 0, failed: 0 };
    const notifications: { parentEmail: string; childName: string; amount: number }[] = [];

    // Process each allowance
    for (const allowance of allowances || []) {
      try {
        console.log(`Processing allowance ${allowance.id} for child ${allowance.child_id}`);

        // Get child details
        const { data: child, error: childError } = await supabase
          .from("children")
          .select("id, name, parent_id")
          .eq("id", allowance.child_id)
          .single();

        if (childError || !child) {
          console.error(`Error fetching child ${allowance.child_id}:`, childError);
          processedCount.failed++;
          continue;
        }

        // Distribute tokens using the existing function
        const { error: distributeError } = await supabase.rpc("fb_split_into_jars", {
          p_child: allowance.child_id,
          p_amount: allowance.weekly_amount,
          p_type: "ALLOWANCE",
          p_reference_id: allowance.id,
        });

        if (distributeError) {
          console.error(`Error distributing tokens for allowance ${allowance.id}:`, distributeError);
          processedCount.failed++;
          continue;
        }

        // Calculate next payment date (7 days from now)
        const nextPayment = new Date();
        nextPayment.setDate(nextPayment.getDate() + 7);
        nextPayment.setHours(0, 0, 0, 0);

        // Update next_payment_at
        const { error: updateError } = await supabase
          .from("allowances")
          .update({ next_payment_at: nextPayment.toISOString() })
          .eq("id", allowance.id);

        if (updateError) {
          console.error(`Error updating allowance ${allowance.id}:`, updateError);
          processedCount.failed++;
          continue;
        }

        // Get parent email for notification
        const { data: parent, error: parentError } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", child.parent_id)
          .single();

        if (!parentError && parent) {
          notifications.push({
            parentEmail: parent.email,
            childName: child.name,
            amount: allowance.weekly_amount,
          });
        }

        processedCount.success++;
        console.log(`Successfully processed allowance ${allowance.id}`);
      } catch (error) {
        console.error(`Error processing allowance ${allowance.id}:`, error);
        processedCount.failed++;
      }
    }

    // Send email notifications to parents
    console.log(`Sending ${notifications.length} email notifications...`);
    
    const resendApiKey = Deno.env.get("RESEND_API_KEY") as string;
    
    for (const notification of notifications) {
      try {
        await sendEmail(
          resendApiKey,
          notification.parentEmail,
          "Weekly Allowance Paid",
          `
            <h2>Weekly Allowance Processed</h2>
            <p>Hello!</p>
            <p>The weekly allowance of <strong>${notification.amount.toFixed(2)} tokens</strong> has been automatically paid to <strong>${notification.childName}</strong>.</p>
            <p>The tokens have been distributed across their savings jars according to your configured percentages.</p>
            <p>Best regards,<br>FamilyBank</p>
          `
        );
        console.log(`Email sent to ${notification.parentEmail}`);
      } catch (emailError) {
        console.error(`Error sending email to ${notification.parentEmail}:`, emailError);
      }
    }

    const result = {
      success: true,
      processedCount,
      notificationsSent: notifications.length,
      message: `Processed ${processedCount.success} allowances successfully, ${processedCount.failed} failed`,
    };

    console.log("Allowance processing complete:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in process-allowances function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.toString() 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
