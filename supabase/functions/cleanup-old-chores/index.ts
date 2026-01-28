import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[CLEANUP-CHORES] Starting cleanup of old approved chores");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    console.log(`[CLEANUP-CHORES] Deleting approved chores older than: ${cutoffDate}`);

    // Delete approved chores that are older than 30 days
    // Only delete non-recurring chores OR child instances of recurring chores (not templates)
    const { data: deletedChores, error } = await supabase
      .from("chores")
      .delete()
      .eq("status", "APPROVED")
      .lt("approved_at", cutoffDate)
      .or("is_recurring.eq.false,parent_chore_id.not.is.null")
      .select("id, title");

    if (error) {
      console.error("[CLEANUP-CHORES] Error deleting chores:", error);
      throw error;
    }

    const deletedCount = deletedChores?.length || 0;
    console.log(`[CLEANUP-CHORES] Successfully deleted ${deletedCount} old chores`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${deletedCount} approved chores older than 30 days`,
        deletedCount,
        deletedChores: deletedChores?.map((c) => c.title) || [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[CLEANUP-CHORES] Error:", errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
