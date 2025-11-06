import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://esm.sh/zod@3.23.8';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Validation schema
const emailRequestSchema = z.object({
  parentEmail: z.string().email().max(255),
  childName: z.string().trim().min(1).max(100),
  childUserId: z.string().uuid(),
  temporaryPassword: z.string().min(8).max(100)
});

// HTML escape function to prevent XSS
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized - Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with user's auth token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Invalid auth token:', userError);
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = emailRequestSchema.safeParse(body);
    
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

    const { parentEmail, childName, childUserId, temporaryPassword } = validationResult.data;

    // Verify the child belongs to this parent
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('parent_id')
      .eq('user_id', childUserId)
      .single();

    if (childError || !child) {
      console.error('Child not found:', childError);
      return new Response(JSON.stringify({ error: 'Child not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (child.parent_id !== user.id) {
      console.error('Unauthorized: User is not the parent of this child');
      return new Response(JSON.stringify({ error: 'Unauthorized - You are not the parent of this child' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Sending child credentials email (email address redacted for security)');

    // Escape all user-controlled variables for HTML
    const safeChildName = escapeHtml(childName);
    const safeChildUserId = escapeHtml(childUserId);
    const safeTemporaryPassword = escapeHtml(temporaryPassword);

    const emailResponse = await resend.emails.send({
      from: "FamilyBank <onboarding@resend.dev>",
      to: [parentEmail],
      subject: `Login Credentials for ${safeChildName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
              .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; }
              .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏦 FamilyBank Child Account Created!</h1>
              </div>
              <div class="content">
                <p>Hi!</p>
                <p>Great news! You've successfully created a FamilyBank account for <strong>${safeChildName}</strong>. Here are the login credentials:</p>
                
                <div class="credentials">
                  <p><strong>📧 Email:</strong> ${safeChildUserId}@familybank.app</p>
                  <p><strong>🔑 Temporary Password:</strong> ${safeTemporaryPassword}</p>
                </div>

                <div class="warning">
                  <p><strong>⚠️ Important Security Information:</strong></p>
                  <ul>
                    <li><strong>${safeChildName} will be required to change this password</strong> on their first login</li>
                    <li>Please share these credentials with ${safeChildName} in a secure way</li>
                    <li>Do not share this email with anyone else</li>
                    <li>After ${safeChildName} has logged in and changed their password, please delete this email</li>
                  </ul>
                </div>

                <p><strong>Next Steps:</strong></p>
                <ol>
                  <li>Share the login credentials with ${safeChildName}</li>
                  <li>Have them visit the FamilyBank child login page</li>
                  <li>They'll be prompted to create their own secure password</li>
                  <li>Then they can start exploring their dashboard!</li>
                </ol>

                <div class="footer">
                  <p>This is an educational platform for teaching children about financial literacy. All tokens and transactions are for learning purposes only.</p>
                  <p>Questions? Contact your family administrator.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully (response details redacted)");

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-confirmation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
