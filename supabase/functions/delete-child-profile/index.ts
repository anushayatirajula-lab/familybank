import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create authenticated client for user context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user's token
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Token verification failed:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parentUserId = claimsData.claims.sub;
    console.log("Authenticated parent:", parentUserId);

    // Parse request body
    const { childId } = await req.json();
    
    if (!childId) {
      return new Response(
        JSON.stringify({ error: "childId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Attempting to delete child:", childId);

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the child belongs to this parent and get the child's user_id
    const { data: child, error: childError } = await supabaseAdmin
      .from("children")
      .select("id, name, user_id, parent_id")
      .eq("id", childId)
      .single();

    if (childError || !child) {
      console.error("Child not found:", childError);
      return new Response(
        JSON.stringify({ error: "Child not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership
    if (child.parent_id !== parentUserId) {
      console.error("Unauthorized: Parent mismatch", { parent_id: child.parent_id, caller: parentUserId });
      return new Response(
        JSON.stringify({ error: "Unauthorized: You can only delete your own children" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Verified ownership. Child user_id:", child.user_id);

    // Step 1: Delete the Auth user if exists
    if (child.user_id) {
      console.log("Deleting auth user:", child.user_id);
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(child.user_id);
      
      if (authDeleteError) {
        // Log but don't fail - the auth user might already be deleted or not exist
        console.warn("Warning deleting auth user (continuing anyway):", authDeleteError.message);
      } else {
        console.log("Auth user deleted successfully");
      }
    } else {
      console.log("No auth user linked to this child profile");
    }

    // Step 2: Delete the child profile (CASCADE will handle balances, chores, etc.)
    console.log("Deleting child profile from database");
    const { error: deleteError } = await supabaseAdmin
      .from("children")
      .delete()
      .eq("id", childId);

    if (deleteError) {
      console.error("Failed to delete child profile:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete child profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Child profile deleted successfully:", child.name);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${child.name}'s profile and auth account have been deleted` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
