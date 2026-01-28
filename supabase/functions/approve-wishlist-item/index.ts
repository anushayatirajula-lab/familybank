import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ApproveWishlistRequest {
  wishlist_item_id: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication - get the auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create authenticated client to verify user
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // 3. Verify the user and get their ID using getClaims for proper JWT validation
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Failed to verify user:", claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log("Authenticated user:", userId);

    // 4. Create service role client for database operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { wishlist_item_id }: ApproveWishlistRequest = await req.json();

    if (!wishlist_item_id) {
      return new Response(
        JSON.stringify({ error: 'Missing wishlist_item_id' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing wishlist approval for item:", wishlist_item_id);

    // 5. Get wishlist item details with child and parent info
    const { data: wishlistItem, error: itemError } = await supabase
      .from("wishlist_items")
      .select(`
        *,
        children (
          id,
          name,
          parent_id,
          profiles!children_parent_id_fkey (email)
        )
      `)
      .eq("id", wishlist_item_id)
      .single();

    if (itemError || !wishlistItem) {
      console.error("Wishlist item not found:", itemError);
      return new Response(
        JSON.stringify({ error: 'Wishlist item not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const child = wishlistItem.children;

    // 6. CRITICAL: Verify the authenticated user is the parent of this child
    if (child.parent_id !== userId) {
      console.error(`Authorization failed: user ${userId} attempted to approve item for parent ${child.parent_id}`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Only the parent can approve this wishlist item' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User ${userId} authorized to approve wishlist item ${wishlist_item_id}`);

    const parentEmail = child.profiles?.email;
    const amount = wishlistItem.target_amount;

    console.log("Wishlist item:", wishlistItem.title, "Amount:", amount, "Child:", child.name);

    // Check WISHLIST jar balance
    const { data: balance, error: balanceError } = await supabase
      .from("balances")
      .select("amount")
      .eq("child_id", child.id)
      .eq("jar_type", "WISHLIST")
      .single();

    if (balanceError || !balance || balance.amount < amount) {
      return new Response(
        JSON.stringify({ error: 'Insufficient balance in WISHLIST jar' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Current balance:", balance.amount);

    // Deduct from WISHLIST jar
    const { error: updateBalanceError } = await supabase
      .from("balances")
      .update({ amount: balance.amount - amount })
      .eq("child_id", child.id)
      .eq("jar_type", "WISHLIST");

    if (updateBalanceError) {
      throw updateBalanceError;
    }

    console.log("Balance updated, new amount:", balance.amount - amount);

    // Create transaction
    const { error: transactionError } = await supabase
      .from("transactions")
      .insert({
        child_id: child.id,
        jar_type: "WISHLIST",
        amount: -amount,
        transaction_type: "WISHLIST_SPEND",
        reference_id: wishlist_item_id,
        description: `Purchased: ${wishlistItem.title}`,
      });

    if (transactionError) {
      throw transactionError;
    }

    console.log("Transaction recorded");

    // Mark item as approved and purchased
    const { error: updateItemError } = await supabase
      .from("wishlist_items")
      .update({
        approved_by_parent: true,
        is_purchased: true,
      })
      .eq("id", wishlist_item_id);

    if (updateItemError) {
      throw updateItemError;
    }

    console.log("Wishlist item marked as purchased");

    // Send email notification
    if (parentEmail) {
      try {
        const emailResponse = await resend.emails.send({
          from: "Family Finance <onboarding@resend.dev>",
          to: [parentEmail],
          subject: `Wishlist Item Approved: ${wishlistItem.title}`,
          html: `
            <h2>Wishlist Item Purchased!</h2>
            <p>You've approved <strong>${child.name}'s</strong> wishlist item:</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0;">${wishlistItem.title}</h3>
              ${wishlistItem.description ? `<p style="margin: 0 0 10px 0; color: #666;">${wishlistItem.description}</p>` : ''}
              <p style="margin: 0; font-size: 20px; font-weight: bold; color: #4F46E5;">$${amount.toFixed(2)}</p>
            </div>
            <p>The amount has been deducted from ${child.name}'s WISHLIST jar.</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This is an automated notification from your Family Finance app.
            </p>
          `,
        });

        console.log("Email sent:", emailResponse);
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
        // Don't throw - email failure shouldn't block the approval
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Wishlist item approved and purchased" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error approving wishlist item:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
