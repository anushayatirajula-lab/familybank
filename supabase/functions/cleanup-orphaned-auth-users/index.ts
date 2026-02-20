import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting orphaned auth user cleanup...");

    // Get all auth users with @familybank.internal emails
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error("Failed to list auth users:", listError);
      return new Response(
        JSON.stringify({ error: "Failed to list auth users" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter to child account emails (both legacy @familybank.app and current @familybank.internal)
    const childAuthUsers = authUsers.users.filter(
      (user) => user.email?.endsWith("@familybank.internal") || user.email?.endsWith("@familybank.app")
    );

    console.log(`Found ${childAuthUsers.length} child auth users (@familybank.internal + legacy @familybank.app)`);

    // Get all child user_ids from the database
    const { data: children, error: childrenError } = await supabaseAdmin
      .from("children")
      .select("user_id")
      .not("user_id", "is", null);

    if (childrenError) {
      console.error("Failed to fetch children:", childrenError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch children" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validUserIds = new Set(children.map((c) => c.user_id));
    console.log(`Found ${validUserIds.size} valid child user_ids in database`);

    // Find orphaned users (auth users without matching child records)
    const orphanedUsers = childAuthUsers.filter(
      (user) => !validUserIds.has(user.id)
    );

    console.log(`Found ${orphanedUsers.length} orphaned auth users to delete`);

    const deleted: string[] = [];
    const failed: string[] = [];

    // Delete each orphaned user
    for (const user of orphanedUsers) {
      console.log(`Deleting orphaned user: ${user.email} (${user.id})`);
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

      if (deleteError) {
        console.error(`Failed to delete ${user.email}:`, deleteError.message);
        failed.push(user.email || user.id);
      } else {
        console.log(`Successfully deleted: ${user.email}`);
        deleted.push(user.email || user.id);
      }
    }

    const result = {
      success: true,
      summary: {
        totalChildAuthUsers: childAuthUsers.length,
        validChildUsers: validUserIds.size,
        orphanedFound: orphanedUsers.length,
        deleted: deleted.length,
        failed: failed.length,
      },
      deletedUsers: deleted,
      failedUsers: failed,
    };

    console.log("Cleanup complete:", JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify(result),
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
