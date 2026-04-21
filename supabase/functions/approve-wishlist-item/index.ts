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
    // 1. Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. User-scoped client to forward the JWT into the RPC (so auth.uid() works inside SECURITY DEFINER)
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userData.user.id;

    // 3. Service-role client for admin lookups & item read
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { wishlist_item_id }: ApproveWishlistRequest = await req.json();
    if (!wishlist_item_id) {
      return new Response(
        JSON.stringify({ error: "Missing wishlist_item_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Read item + child for the email payload (auth check is done atomically in the RPC below)
    const { data: wishlistItem, error: itemError } = await supabase
      .from("wishlist_items")
      .select("id, title, description, target_amount, child_id, children:children!wishlist_items_child_id_fkey(id, name, parent_id)")
      .eq("id", wishlist_item_id)
      .single();

    if (itemError || !wishlistItem) {
      return new Response(
        JSON.stringify({ error: "Wishlist item not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const child = (wishlistItem as any).children;
    if (!child || child.parent_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Only the parent can approve this wishlist item" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Atomic spend via RPC (locks the balance row, deducts, inserts transaction, marks purchased)
    const { error: rpcError } = await supabaseUser.rpc("fb_spend_wishlist", {
      p_item_id: wishlist_item_id,
    });

    if (rpcError) {
      console.error("fb_spend_wishlist failed:", rpcError);
      const msg = rpcError.message || "";
      const status = msg.includes("Insufficient") ? 400
        : msg.includes("Unauthorized") ? 403
        : msg.includes("not found") ? 404
        : 500;
      return new Response(
        JSON.stringify({ error: msg || "Failed to approve wishlist item" }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Look up parent email via Auth Admin API (the profiles table no longer stores email)
    let parentEmail: string | undefined;
    try {
      const { data: parentAuth } = await supabase.auth.admin.getUserById(child.parent_id);
      parentEmail = parentAuth?.user?.email ?? undefined;
    } catch (e) {
      console.error("Failed to fetch parent email:", e);
    }

    // 7. Send email notification (non-blocking)
    if (parentEmail) {
      try {
        await resend.emails.send({
          from: "Family Finance <onboarding@resend.dev>",
          to: [parentEmail],
          subject: `Wishlist Item Approved: ${wishlistItem.title}`,
          html: `
            <h2>Wishlist Item Purchased!</h2>
            <p>You've approved <strong>${child.name}'s</strong> wishlist item:</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0;">${wishlistItem.title}</h3>
              ${wishlistItem.description ? `<p style="margin: 0 0 10px 0; color: #666;">${wishlistItem.description}</p>` : ""}
              <p style="margin: 0; font-size: 20px; font-weight: bold; color: #4F46E5;">$${Number(wishlistItem.target_amount).toFixed(2)}</p>
            </div>
            <p>The amount has been deducted from ${child.name}'s WISHLIST jar.</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This is an automated notification from your Family Finance app.
            </p>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
        // Don't throw — email failure should not block the approval
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Wishlist item approved and purchased" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error approving wishlist item:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
