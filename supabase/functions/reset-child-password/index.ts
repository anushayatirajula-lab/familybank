import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://esm.sh/zod@3.23.8';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {

// Validation schema
const resetRequestSchema = z.object({
  familyCode: z.string().min(4).max(10),
  childUsername: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/)
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

// Handler logic starts here
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Parse and validate request body
    const body = await req.json();
    const validationResult = resetRequestSchema.safeParse(body);
    
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

    const { familyCode, childUsername } = validationResult.data;

    // Find the parent by family code
    const { data: parent, error: parentError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .eq('family_code', familyCode.toUpperCase())
      .single();

    if (parentError || !parent) {
      console.error('Parent not found for family code');
      return new Response(JSON.stringify({ error: 'Invalid family code' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Construct the internal email for the child
    const childInternalEmail = `${childUsername}_${familyCode.toLowerCase()}@familybank.internal`;

    // Find the child by internal email
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error listing users:', authError);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const childAuthUser = authUser.users.find(u => u.email === childInternalEmail);
    
    if (!childAuthUser) {
      console.error('Child account not found');
      return new Response(JSON.stringify({ error: 'Child account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get child's display name
    const { data: child, error: childError } = await supabaseAdmin
      .from('children')
      .select('name')
      .eq('user_id', childAuthUser.id)
      .single();

    const childDisplayName = child?.name || childUsername;

    // Generate password reset link for the child
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: childInternalEmail,
      options: {
        redirectTo: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || 'https://familybank.lovable.app'}/update-password`,
      }
    });

    if (resetError || !resetData) {
      console.error('Error generating reset link:', resetError);
      return new Response(JSON.stringify({ error: 'Failed to generate reset link' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Escape all user-controlled variables for HTML
    const safeChildName = escapeHtml(childDisplayName);
    const safeUsername = escapeHtml(childUsername);
    const resetLink = resetData.properties?.action_link || '';

    console.log('Sending password reset email to parent (email redacted for security)');

    const emailResponse = await resend.emails.send({
      from: "FamilyBank <onboarding@resend.dev>",
      to: [parent.email],
      subject: `Password Reset Request for ${safeChildName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #667eea; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
              .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; }
              .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔑 Password Reset Request</h1>
              </div>
              <div class="content">
                <p>Hi${parent.full_name ? ` ${escapeHtml(parent.full_name)}` : ''},</p>
                <p><strong>${safeChildName}</strong> has requested a password reset for their FamilyBank account.</p>
                
                <div class="details">
                  <p><strong>Child's Username:</strong> ${safeUsername}</p>
                </div>

                <p>Click the button below to reset their password:</p>
                
                <a href="${resetLink}" class="button">Reset Password</a>

                <div class="warning">
                  <p><strong>⚠️ Security Note:</strong></p>
                  <ul>
                    <li>This link will expire in 24 hours</li>
                    <li>If you did not expect this request, you can ignore this email</li>
                    <li>Share the new password securely with ${safeChildName}</li>
                  </ul>
                </div>

                <div class="footer">
                  <p>This is an educational platform for teaching children about financial literacy.</p>
                  <p>If you didn't request this, please ignore this email or contact support.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Password reset email sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in reset-child-password function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});