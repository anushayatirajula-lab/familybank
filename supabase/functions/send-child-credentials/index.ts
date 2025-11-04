import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  parentEmail: string;
  childName: string;
  childUserId: string;
  temporaryPassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { parentEmail, childName, childUserId, temporaryPassword }: EmailRequest = await req.json();

    console.log(`Sending child credentials email to ${parentEmail} for child ${childName}`);

    const emailResponse = await resend.emails.send({
      from: "FamilyBank <noreply@anusha.org>",
      to: [parentEmail],
      subject: `Child Account Created: ${childName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #e5e7eb; }
              .credential-item { margin: 15px 0; }
              .label { font-weight: 600; color: #6b7280; margin-bottom: 5px; }
              .value { background: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px; word-break: break-all; }
              .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🎉 Child Account Created!</h1>
              </div>
              <div class="content">
                <p>Hello!</p>
                <p>A new child account has been created for <strong>${childName}</strong> on FamilyBank.</p>
                
                <div class="warning">
                  <strong>⚠️ Important Security Notice</strong>
                  <p style="margin: 10px 0 0 0;">This is a temporary password. Both you and your child should reset the password upon first login to ensure account security.</p>
                </div>

                <div class="credentials">
                  <h2 style="margin-top: 0; color: #374151;">Login Credentials</h2>
                  
                  <div class="credential-item">
                    <div class="label">Child User ID:</div>
                    <div class="value">${childUserId}</div>
                  </div>
                  
                  <div class="credential-item">
                    <div class="label">Temporary Password:</div>
                    <div class="value">${temporaryPassword}</div>
                  </div>
                </div>

                <p><strong>Next Steps:</strong></p>
                <ol>
                  <li>Share these credentials securely with your child</li>
                  <li>Help your child log in for the first time</li>
                  <li>Both parent and child should reset the password immediately</li>
                  <li>Keep the new password secure and private</li>
                </ol>

                <p style="margin-top: 30px;">If you did not create this account or believe this is an error, please contact support immediately.</p>
              </div>
              
              <div class="footer">
                <p>This email was sent by FamilyBank. Please do not reply to this email.</p>
                <p>© ${new Date().getFullYear()} FamilyBank. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-child-credentials function:", error);
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
