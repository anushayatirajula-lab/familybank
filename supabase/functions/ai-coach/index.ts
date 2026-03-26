import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schema
const aiCoachRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(1000)
  })).min(1).max(50),
  childAge: z.number().int().min(4).max(18),
  mode: z.enum(['lesson', 'quiz', 'chat']),
  childId: z.string().uuid()
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication - JWT is already validated by gateway when verify_jwt = true
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract user ID from JWT token (already validated by gateway)
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) {
      return new Response(JSON.stringify({ error: 'Invalid token format' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const payload = JSON.parse(atob(parts[1]));
    const userId = payload.sub;
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid token payload' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role for database queries
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request body
    const body = await req.json();
    const validationResult = aiCoachRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error);
      return new Response(JSON.stringify({ 
        error: 'Invalid input data',
        details: validationResult.error.errors 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages, childAge, mode, childId } = validationResult.data;

    // Verify the child belongs to this user (either they are the parent or the child)
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('parent_id, user_id')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      return new Response(JSON.stringify({ error: 'Child not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check authorization: user must be either the parent or the child themselves
    if (child.parent_id !== userId && child.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized - You do not have access to this child' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch child's financial context for personalized coaching
    const [balancesRes, wishlistRes, transactionsRes] = await Promise.all([
      supabase.from('balances').select('jar_type, amount').eq('child_id', childId),
      supabase.from('wishlist_items').select('title, target_amount, current_amount, approved_by_parent, is_purchased').eq('child_id', childId).eq('is_purchased', false).limit(10),
      supabase.from('transactions').select('jar_type, amount, transaction_type, description, created_at').eq('child_id', childId).order('created_at', { ascending: false }).limit(15),
    ]);

    const balances = balancesRes.data || [];
    const wishlistItems = wishlistRes.data || [];
    const recentTransactions = transactionsRes.data || [];

    // Build context string
    let childContext = "\n\nCHILD'S FINANCIAL CONTEXT (use this to personalize your responses):";
    
    // Helper: amounts are stored with a 10x multiplier (10 units = $1.00)
    const fmt = (amt: number) => (amt / 10).toFixed(2);

    if (balances.length > 0) {
      const totalBalance = balances.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
      const jarSummary = balances.map((b: any) => `${b.jar_type}: $${fmt(b.amount || 0)}`).join(', ');
      childContext += `\n- Current Balances: ${jarSummary} (Total: $${fmt(totalBalance)})`;
    } else {
      childContext += "\n- No balances yet (they're just getting started!)";
    }

    if (wishlistItems.length > 0) {
      const goals = wishlistItems.map((w: any) => {
        const progress = w.target_amount > 0 ? Math.round(((w.current_amount || 0) / w.target_amount) * 100) : 0;
        const status = w.approved_by_parent ? '✅ approved' : '⏳ pending approval';
        return `"${w.title}" - $${fmt(w.current_amount || 0)}/$${fmt(w.target_amount)} (${progress}%, ${status})`;
      }).join('; ');
      childContext += `\n- Savings Goals: ${goals}`;
    } else {
      childContext += "\n- No savings goals set yet";
    }

    if (recentTransactions.length > 0) {
      const txSummary = recentTransactions.slice(0, 5).map((t: any) => 
        `${t.transaction_type}: $${fmt(t.amount)} to ${t.jar_type}${t.description ? ` (${t.description})` : ''}`
      ).join('; ');
      childContext += `\n- Recent Activity: ${txSummary}`;
    } else {
      childContext += "\n- No recent transactions";
    }

    childContext += "\n\nUse the above context to give specific, personalized advice. Reference their actual numbers, goals, and progress when relevant. Don't just repeat the data back - weave it naturally into your coaching.";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("AI Coach request:", { childAge, mode, messageCount: messages.length, hasContext: balances.length > 0 });

    // Age-appropriate system prompts
    let systemPrompt = "";
    
    if (mode === "lesson") {
      // Age-appropriate lesson topics
      let ageGuidance = "";
      
      if (childAge <= 8) {
        ageGuidance = `
AGE 6-8 FOCUS: Basic money concepts
- Counting coins and simple math
- Difference between wants and needs
- Why we save money (for things we want later)
- Being patient to save up
- Sharing and helping others
- Where money comes from (parents work)
Choose ONE of these topics that hasn't been covered yet in the conversation.`;
      } else if (childAge <= 11) {
        ageGuidance = `
AGE 9-11 FOCUS: Building habits
- Setting savings goals
- Earning money through chores
- Smart spending vs impulse buying
- The 3 jar system (save, spend, share)
- Making choices with limited money
- How to compare prices
Choose ONE of these topics that hasn't been covered yet in the conversation.`;
      } else {
        ageGuidance = `
AGE 12+ FOCUS: Financial responsibility
- Creating a simple budget
- Understanding value vs price
- Long-term vs short-term goals
- Basic entrepreneurship (making money)
- Compound saving (saving early matters)
- Researching before buying
- Financial independence basics
Choose ONE of these topics that hasn't been covered yet in the conversation.`;
      }

      systemPrompt = `You are FamilyBank Coach, a friendly financial literacy teacher for a ${childAge}-year-old child.

${ageGuidance}

LESSON STRUCTURE:
1. Pick an age-appropriate topic from above that you haven't taught yet
2. Start with a fun relatable example (video games, toys, activities they know)
3. Explain the concept in 3-4 SHORT sentences
4. End with "Ready for a quick quiz? Type 'quiz' when you're ready!"

RULES:
- Keep it SUPER SHORT (3-4 sentences max)
- Use words and examples for their exact age
- ONE topic per lesson - don't overwhelm
- Be enthusiastic and encouraging! 
- NEVER discuss: investing, stocks, debt, credit cards, loans, or banking products
- If asked complex questions, say "Great question! Ask your parent about that."
- Vary topics - don't repeat the same lesson twice`;
    } else if (mode === "quiz") {
      systemPrompt = `You are FamilyBank Coach creating a simple quiz for a child aged ${childAge}.

RULES:
- Ask ONE question at a time
- Multiple choice with 3 options (A, B, C)
- Keep questions SHORT and clear
- Make it fun and encouraging
- After they answer, say if it's correct and explain why in 1-2 sentences
- Give lots of praise for trying!
- After 3 questions, say "Great job! You earned a gold star! 🌟"`;
    } else {
      systemPrompt = `You are FamilyBank Coach, a helpful friend teaching kids aged ${childAge} about money.

RULES:
- Keep answers SHORT (2-3 sentences)
- Use simple, friendly language
- Give practical examples kids understand
- Stay encouraging and positive
- If unsure or complex, say "Ask your parent about this!"
- NEVER discuss: investing, debt, credit cards, or banking products`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt + childContext },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service unavailable. Please contact support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received successfully");

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in ai-coach function:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};
Deno.serve(handler);
