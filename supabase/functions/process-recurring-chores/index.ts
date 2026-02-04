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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

    console.log(`Processing recurring chores for day: ${dayOfWeek}`);

    // Get all recurring chores that should be created today
    // Daily chores: create every day
    // Weekly chores: create on the specified day
    const { data: recurringChores, error: fetchError } = await supabase
      .from("chores")
      .select("*")
      .eq("is_recurring", true)
      .eq("status", "APPROVED") // Only create from approved templates
      .is("parent_chore_id", null); // Only get template chores

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
        // Check recurrence_days array first, fall back to recurrence_day for backward compat
        if (chore.recurrence_days && Array.isArray(chore.recurrence_days)) {
          shouldCreate = chore.recurrence_days.includes(dayOfWeek);
        } else if (chore.recurrence_day === dayOfWeek) {
          shouldCreate = true;
        }
      }

      if (shouldCreate) {
        // Check if a chore from this template was already created today
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
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing recurring chores:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
