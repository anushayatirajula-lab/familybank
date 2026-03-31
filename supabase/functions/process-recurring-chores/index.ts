import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RecurringChore {
  id: string;
  child_id: string;
  title: string;
  description: string | null;
  token_reward: number;
  is_recurring: boolean;
  recurrence_type: string;
  recurrence_day: number | null;
  recurrence_days: number[] | null;
  parent_chore_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const cronSecret = req.headers.get("X-Cron-Secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");
    const isCronCall = expectedSecret && cronSecret === expectedSecret;

    let parentId: string | null = null;

    if (!isCronCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "PARENT")
        .maybeSingle();

      if (!roleData) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Only parents can trigger this" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      parentId = user.id;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const dayOfWeek = today.getDay();

    console.log(`Processing recurring chores for day: ${dayOfWeek}, parentId: ${parentId || "ALL (cron)"}`);

    // If called by a parent, only get their children's IDs
    let childIds: string[] | null = null;
    if (parentId) {
      const { data: children, error: childError } = await supabase
        .from("children")
        .select("id")
        .eq("parent_id", parentId);

      if (childError) throw childError;
      childIds = (children || []).map((c) => c.id);

      if (childIds.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No children found for this parent." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // Build query for recurring chore templates
    let query = supabase
      .from("chores")
      .select("*")
      .eq("is_recurring", true)
      .eq("status", "APPROVED")
      .is("parent_chore_id", null);

    // Scope to parent's children when triggered by a parent
    if (childIds) {
      query = query.in("child_id", childIds);
    }

    const { data: recurringChores, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching recurring chores:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${recurringChores?.length || 0} recurring chore templates`);

    const choresToCreate: Partial<RecurringChore>[] = [];

    for (const chore of recurringChores || []) {
      let shouldCreate = false;

      if (chore.recurrence_type === "daily") {
        shouldCreate = true;
      } else if (chore.recurrence_type === "weekly") {
        if (chore.recurrence_days && Array.isArray(chore.recurrence_days)) {
          shouldCreate = chore.recurrence_days.includes(dayOfWeek);
        } else if (chore.recurrence_day === dayOfWeek) {
          shouldCreate = true;
        }
      }

      if (shouldCreate) {
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);

        const { data: existingChore } = await supabase
          .from("chores")
          .select("id")
          .eq("parent_chore_id", chore.id)
          .gte("created_at", startOfDay.toISOString())
          .maybeSingle();

        if (!existingChore) {
          choresToCreate.push({
            child_id: chore.child_id,
            title: chore.title,
            description: chore.description,
            token_reward: chore.token_reward,
            is_recurring: false,
            parent_chore_id: chore.id,
          });
        } else {
          console.log(`Chore ${chore.id} already created today, skipping`);
        }
      }
    }

    console.log(`Creating ${choresToCreate.length} new chore instances`);

    if (choresToCreate.length > 0) {
      const { data: createdChores, error: insertError } = await supabase
        .from("chores")
        .insert(
          choresToCreate.map((c) => ({
            child_id: c.child_id,
            title: c.title,
            description: c.description,
            token_reward: c.token_reward,
            is_recurring: false,
            parent_chore_id: c.parent_chore_id,
            status: "PENDING",
          }))
        )
        .select();

      if (insertError) {
        console.error("Error creating chores:", insertError);
        throw insertError;
      }

      console.log(`Successfully created ${createdChores?.length || 0} chores`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${recurringChores?.length || 0} templates, created ${choresToCreate.length} new chores`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred. Please try again.";
    console.error("Error processing recurring chores:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
