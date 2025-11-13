import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Database, Code, Wrench, FileCode, Lock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DeveloperDocs = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Developer Documentation</h1>
          <p className="text-muted-foreground">
            Technical reference for FamilyBank's architecture, database schema, and API endpoints
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="api">API Endpoints</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="extend">Extending</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="h-5 w-5" />
                  Tech Stack
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Frontend</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>React 18 + TypeScript</li>
                    <li>Vite (Build tool)</li>
                    <li>TailwindCSS + shadcn/ui components</li>
                    <li>React Router v6 (Routing)</li>
                    <li>TanStack Query (Data fetching & caching)</li>
                    <li>React Hook Form + Zod (Form validation)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Backend (Lovable Cloud)</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>PostgreSQL with Row Level Security (RLS)</li>
                    <li>Deno Edge Functions (Serverless)</li>
                    <li>JWT Authentication</li>
                    <li>Real-time subscriptions</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Integrations</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Stripe (Subscriptions & Payments)</li>
                    <li>Resend (Email notifications)</li>
                    <li>Lovable AI (AI coaching via Gemini/GPT models)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Architecture Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground">
                <p>
                  FamilyBank follows a <strong>serverless full-stack architecture</strong> with clear separation between frontend and backend:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Client Layer:</strong> React SPA handles all UI interactions</li>
                  <li><strong>API Layer:</strong> Edge functions process business logic (AI, emails, Stripe)</li>
                  <li><strong>Data Layer:</strong> PostgreSQL with RLS ensures data security</li>
                  <li><strong>Auth Layer:</strong> Role-based access (PARENT/CHILD) with JWT tokens</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Database Tab */}
          <TabsContent value="database" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Schema
                </CardTitle>
                <CardDescription>9 core tables with relational integrity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profiles Table */}
                <div className="border-l-4 border-primary pl-4">
                  <h4 className="font-semibold text-lg mb-2">profiles</h4>
                  <p className="text-sm text-muted-foreground mb-3">User account information and subscription status</p>
                  <div className="font-mono text-xs space-y-1 bg-muted p-3 rounded">
                    <div>• id: uuid (PK, references auth.users)</div>
                    <div>• email: text</div>
                    <div>• full_name: text</div>
                    <div>• stripe_customer_id: text</div>
                    <div>• subscription_status: text (default: 'trialing')</div>
                    <div>• trial_ends_at: timestamp (default: now() + 14 days)</div>
                    <div>• current_period_end: timestamp</div>
                  </div>
                </div>

                {/* User Roles Table */}
                <div className="border-l-4 border-accent pl-4">
                  <h4 className="font-semibold text-lg mb-2">user_roles</h4>
                  <p className="text-sm text-muted-foreground mb-3">Role-based access control (PARENT/CHILD)</p>
                  <div className="font-mono text-xs space-y-1 bg-muted p-3 rounded">
                    <div>• id: uuid (PK)</div>
                    <div>• user_id: uuid (FK to auth.users)</div>
                    <div>• role: enum ('PARENT', 'CHILD')</div>
                    <div className="text-amber-600">⚠️ Unique constraint: (user_id, role)</div>
                  </div>
                </div>

                {/* Children Table */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold text-lg mb-2">children</h4>
                  <p className="text-sm text-muted-foreground mb-3">Child profiles with parental controls</p>
                  <div className="font-mono text-xs space-y-1 bg-muted p-3 rounded">
                    <div>• id: uuid (PK)</div>
                    <div>• parent_id: uuid (FK to auth.users)</div>
                    <div>• user_id: uuid (nullable, FK to auth.users)</div>
                    <div>• name: text</div>
                    <div>• age: integer</div>
                    <div>• avatar_url: text</div>
                    <div>• initial_password: text (for first login)</div>
                    <div>• first_login: boolean (default: true)</div>
                    <div>• ai_tips_enabled: boolean (default: true)</div>
                    <div>• daily_spend_limit: numeric (default: 10.00)</div>
                    <div>• per_txn_limit: numeric (default: 5.00)</div>
                  </div>
                </div>

                {/* Jars Table */}
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold text-lg mb-2">jars</h4>
                  <p className="text-sm text-muted-foreground mb-3">Token allocation rules (Save/Spend/Give)</p>
                  <div className="font-mono text-xs space-y-1 bg-muted p-3 rounded">
                    <div>• id: uuid (PK)</div>
                    <div>• child_id: uuid (FK to children)</div>
                    <div>• jar_type: enum ('SAVE', 'SPEND', 'GIVE', 'WISHLIST')</div>
                    <div>• percentage: integer (allocation %)</div>
                    <div className="text-amber-600">⚠️ Unique constraint: (child_id, jar_type)</div>
                  </div>
                </div>

                {/* Balances Table */}
                <div className="border-l-4 border-green-600 pl-4">
                  <h4 className="font-semibold text-lg mb-2">balances</h4>
                  <p className="text-sm text-muted-foreground mb-3">Current token balance per jar</p>
                  <div className="font-mono text-xs space-y-1 bg-muted p-3 rounded">
                    <div>• id: uuid (PK)</div>
                    <div>• child_id: uuid (FK to children)</div>
                    <div>• jar_type: enum</div>
                    <div>• amount: numeric (default: 0.00)</div>
                    <div>• updated_at: timestamp</div>
                    <div className="text-amber-600">⚠️ Unique constraint: (child_id, jar_type)</div>
                  </div>
                </div>

                {/* Transactions Table */}
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold text-lg mb-2">transactions</h4>
                  <p className="text-sm text-muted-foreground mb-3">Immutable transaction history</p>
                  <div className="font-mono text-xs space-y-1 bg-muted p-3 rounded">
                    <div>• id: uuid (PK)</div>
                    <div>• child_id: uuid (FK to children)</div>
                    <div>• jar_type: enum</div>
                    <div>• amount: numeric</div>
                    <div>• transaction_type: enum ('ALLOWANCE', 'CHORE_REWARD', 'SPEND', 'TRANSFER')</div>
                    <div>• reference_id: uuid (nullable, links to chore/wishlist)</div>
                    <div>• description: text</div>
                    <div>• created_at: timestamp</div>
                    <div className="text-amber-600">🔒 Read-only via RLS</div>
                  </div>
                </div>

                {/* Chores Table */}
                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-semibold text-lg mb-2">chores</h4>
                  <p className="text-sm text-muted-foreground mb-3">Task management with approval workflow</p>
                  <div className="font-mono text-xs space-y-1 bg-muted p-3 rounded">
                    <div>• id: uuid (PK)</div>
                    <div>• child_id: uuid (FK to children)</div>
                    <div>• title: text</div>
                    <div>• description: text</div>
                    <div>• token_reward: numeric</div>
                    <div>• status: enum ('PENDING', 'SUBMITTED', 'APPROVED')</div>
                    <div>• due_at: timestamp</div>
                    <div>• submitted_at: timestamp</div>
                    <div>• approved_at: timestamp</div>
                  </div>
                </div>

                {/* Wishlist Items Table */}
                <div className="border-l-4 border-pink-500 pl-4">
                  <h4 className="font-semibold text-lg mb-2">wishlist_items</h4>
                  <p className="text-sm text-muted-foreground mb-3">Goal-based savings with parent approval</p>
                  <div className="font-mono text-xs space-y-1 bg-muted p-3 rounded">
                    <div>• id: uuid (PK)</div>
                    <div>• child_id: uuid (FK to children)</div>
                    <div>• title: text</div>
                    <div>• description: text</div>
                    <div>• image_url: text</div>
                    <div>• target_amount: numeric</div>
                    <div>• current_amount: numeric (default: 0.00)</div>
                    <div>• approved_by_parent: boolean (default: false)</div>
                    <div>• is_purchased: boolean (default: false)</div>
                  </div>
                </div>

                {/* Allowances Table */}
                <div className="border-l-4 border-cyan-500 pl-4">
                  <h4 className="font-semibold text-lg mb-2">allowances</h4>
                  <p className="text-sm text-muted-foreground mb-3">Automated weekly token distribution</p>
                  <div className="font-mono text-xs space-y-1 bg-muted p-3 rounded">
                    <div>• id: uuid (PK)</div>
                    <div>• child_id: uuid (FK to children)</div>
                    <div>• weekly_amount: numeric</div>
                    <div>• day_of_week: integer (0-6, Sunday-Saturday)</div>
                    <div>• next_payment_at: timestamp</div>
                    <div>• is_active: boolean (default: true)</div>
                  </div>
                </div>

                {/* Database Functions */}
                <div className="mt-8 border-t pt-6">
                  <h3 className="font-semibold text-xl mb-4">Database Functions</h3>
                  
                  <div className="space-y-4">
                    <div className="bg-muted p-4 rounded">
                      <code className="font-mono text-sm">fb_split_into_jars(child_id, amount, type, reference_id?)</code>
                      <p className="text-sm text-muted-foreground mt-2">Distributes tokens across Save/Spend/Give jars based on configured percentages. Creates transactions and updates balances atomically.</p>
                    </div>

                    <div className="bg-muted p-4 rounded">
                      <code className="font-mono text-sm">fb_approve_chore(chore_id)</code>
                      <p className="text-sm text-muted-foreground mt-2">Approves a chore and distributes the token reward. Updates chore status and calls fb_split_into_jars.</p>
                    </div>

                    <div className="bg-muted p-4 rounded">
                      <code className="font-mono text-sm">authenticate_child(name, pin)</code>
                      <p className="text-sm text-muted-foreground mt-2">Authenticates a child using their name and optional PIN. Returns success status and child details.</p>
                    </div>

                    <div className="bg-muted p-4 rounded">
                      <code className="font-mono text-sm">has_role(user_id, role)</code>
                      <p className="text-sm text-muted-foreground mt-2">Security definer function to check if a user has a specific role. Used in RLS policies to prevent recursive queries.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Endpoints Tab */}
          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Edge Functions (API Endpoints)
                </CardTitle>
                <CardDescription>Serverless Deno functions deployed automatically</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* AI Coach Function */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-mono rounded">POST</span>
                    <code className="font-mono text-sm">/ai-coach</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">AI-powered financial literacy coaching for children</p>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <strong>Authentication:</strong> Required (JWT)
                    </div>
                    <div>
                      <strong>Request Body:</strong>
                      <pre className="bg-muted p-3 rounded mt-1 overflow-x-auto"><code>{`{
  "messages": [{ "role": "user", "content": "..." }],
  "childAge": 8,
  "mode": "lesson" | "quiz" | "chat",
  "childId": "uuid"
}`}</code></pre>
                    </div>
                    <div>
                      <strong>Models Used:</strong> Lovable AI (Gemini 2.5 Pro/Flash, GPT-5)
                    </div>
                    <div>
                      <strong>Features:</strong>
                      <ul className="list-disc list-inside ml-2 text-muted-foreground">
                        <li>Age-appropriate content filtering</li>
                        <li>Three modes: lessons, quizzes, casual chat</li>
                        <li>Parent authorization check</li>
                        <li>No external API key required</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Process Allowances Function */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-mono rounded">POST</span>
                    <code className="font-mono text-sm">/process-allowances</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Automated weekly allowance distribution (cron job)</p>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <strong>Trigger:</strong> Scheduled (weekly cron)
                    </div>
                    <div>
                      <strong>Functionality:</strong>
                      <ul className="list-disc list-inside ml-2 text-muted-foreground">
                        <li>Queries allowances due for payment</li>
                        <li>Calls fb_split_into_jars() for each child</li>
                        <li>Updates next_payment_at timestamps</li>
                        <li>Sends email notifications to parents via Resend</li>
                      </ul>
                    </div>
                    <div>
                      <strong>External Services:</strong> Resend (email)
                    </div>
                  </div>
                </div>

                {/* Approve Wishlist Item Function */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-mono rounded">POST</span>
                    <code className="font-mono text-sm">/approve-wishlist-item</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Approves and purchases a wishlist item</p>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <strong>Request Body:</strong>
                      <pre className="bg-muted p-3 rounded mt-1 overflow-x-auto"><code>{`{
  "wishlist_item_id": "uuid"
}`}</code></pre>
                    </div>
                    <div>
                      <strong>Functionality:</strong>
                      <ul className="list-disc list-inside ml-2 text-muted-foreground">
                        <li>Checks WISHLIST jar balance</li>
                        <li>Deducts tokens and records transaction</li>
                        <li>Marks item as purchased</li>
                        <li>Sends confirmation email to parent</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Stripe Functions */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs font-mono rounded">POST</span>
                    <code className="font-mono text-sm">/create-checkout</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Creates Stripe checkout session for subscription</p>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <strong>Authentication:</strong> Required (JWT)
                    </div>
                    <div>
                      <strong>Features:</strong>
                      <ul className="list-disc list-inside ml-2 text-muted-foreground">
                        <li>Creates/retrieves Stripe customer</li>
                        <li>14-day free trial period</li>
                        <li>Subscription billing</li>
                        <li>Success/cancel redirect URLs</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs font-mono rounded">POST</span>
                    <code className="font-mono text-sm">/check-subscription</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Verifies user's subscription status</p>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <strong>Returns:</strong> Trial status, subscription status, expiration dates
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs font-mono rounded">POST</span>
                    <code className="font-mono text-sm">/customer-portal</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Redirects to Stripe customer portal</p>
                </div>

                {/* Send Child Credentials Function */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-mono rounded">POST</span>
                    <code className="font-mono text-sm">/send-child-credentials</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Emails child login credentials to parent</p>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <strong>Request Body:</strong>
                      <pre className="bg-muted p-3 rounded mt-1 overflow-x-auto"><code>{`{
  "parentEmail": "parent@example.com",
  "childName": "Alex",
  "childUsername": "alex@family.local",
  "childPassword": "initial_password",
  "childId": "uuid"
}`}</code></pre>
                    </div>
                    <div>
                      <strong>Security:</strong> Verifies parent-child relationship before sending
                    </div>
                  </div>
                </div>

                <div className="mt-6 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Calling Edge Functions
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">Use the Supabase client to invoke functions:</p>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto"><code>{`import { supabase } from "@/integrations/supabase/client";

const { data, error } = await supabase.functions.invoke('ai-coach', {
  body: {
    messages: [{ role: 'user', content: 'Tell me about saving money' }],
    childAge: 8,
    mode: 'chat',
    childId: 'uuid'
  }
});`}</code></pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Security & Authentication
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-3">Role-Based Access Control (RBAC)</h4>
                  <div className="bg-muted p-4 rounded space-y-3">
                    <div>
                      <strong>Two roles:</strong> PARENT and CHILD
                    </div>
                    <div>
                      <strong>Role storage:</strong> Separate <code>user_roles</code> table (prevents privilege escalation)
                    </div>
                    <div>
                      <strong>Role checking:</strong> <code>has_role(user_id, role)</code> function with SECURITY DEFINER
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Row Level Security (RLS) Policies</h4>
                  <p className="text-sm text-muted-foreground mb-3">Every table has RLS enabled with strict policies:</p>
                  
                  <div className="space-y-3 text-sm">
                    <div className="bg-muted p-3 rounded">
                      <strong>children table:</strong>
                      <ul className="list-disc list-inside ml-2 text-muted-foreground mt-1">
                        <li>Parents can CRUD their own children</li>
                        <li>Children can view and update their own profile</li>
                      </ul>
                    </div>

                    <div className="bg-muted p-3 rounded">
                      <strong>balances, transactions, jars:</strong>
                      <ul className="list-disc list-inside ml-2 text-muted-foreground mt-1">
                        <li>Parents can view/manage for their children</li>
                        <li>Children can view their own data</li>
                        <li>Transactions are read-only (immutable)</li>
                      </ul>
                    </div>

                    <div className="bg-muted p-3 rounded">
                      <strong>chores:</strong>
                      <ul className="list-disc list-inside ml-2 text-muted-foreground mt-1">
                        <li>Parents can create and approve</li>
                        <li>Children can view and submit</li>
                      </ul>
                    </div>

                    <div className="bg-muted p-3 rounded">
                      <strong>wishlist_items:</strong>
                      <ul className="list-disc list-inside ml-2 text-muted-foreground mt-1">
                        <li>Children can create before parent approval</li>
                        <li>Children cannot edit after approval</li>
                        <li>Parents have full CRUD access</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Authentication Flow</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <strong>Parents:</strong>
                      <ul className="list-disc list-inside ml-2 text-muted-foreground">
                        <li>Standard email/password signup</li>
                        <li>JWT token stored in localStorage</li>
                        <li>Auto-refresh token mechanism</li>
                      </ul>
                    </div>
                    <div>
                      <strong>Children:</strong>
                      <ul className="list-disc list-inside ml-2 text-muted-foreground">
                        <li>Parent creates account with initial password</li>
                        <li>Name + optional PIN authentication</li>
                        <li>Must change password on first login</li>
                        <li>Separate auth flow via <code>authenticate_child()</code></li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 rounded">
                  <h4 className="font-semibold mb-2 text-red-900 dark:text-red-100">Security Best Practices</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-800 dark:text-red-200">
                    <li>Never store roles on profiles or users table</li>
                    <li>Always use SECURITY DEFINER for role-checking functions</li>
                    <li>Never expose Stripe secret keys to frontend</li>
                    <li>Validate all parent-child relationships in edge functions</li>
                    <li>Use parameterized queries to prevent SQL injection</li>
                    <li>Sanitize user input (especially in AI prompts)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Extending Tab */}
          <TabsContent value="extend" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Extending the Application
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold text-lg mb-3">Adding a New Feature: Example Flow</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Let's say you want to add a "Bonus Rewards" feature where parents can give one-time bonuses:
                  </p>

                  <div className="space-y-4">
                    <div className="border-l-4 border-primary pl-4">
                      <h5 className="font-semibold mb-2">1. Database Schema</h5>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto"><code>{`-- Create new table
CREATE TABLE public.bonus_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid REFERENCES children(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES auth.users(id),
  amount numeric NOT NULL,
  reason text,
  given_at timestamp DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bonus_rewards ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Parents can give bonuses to their children"
ON public.bonus_rewards FOR INSERT
WITH CHECK (
  parent_id = auth.uid() AND
  child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
);`}</code></pre>
                    </div>

                    <div className="border-l-4 border-accent pl-4">
                      <h5 className="font-semibold mb-2">2. Update TypeScript Types</h5>
                      <p className="text-xs text-muted-foreground mb-2">After migration, types are auto-generated. Import them:</p>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto"><code>{`import { Tables } from "@/integrations/supabase/types";
type BonusReward = Tables<"bonus_rewards">;`}</code></pre>
                    </div>

                    <div className="border-l-4 border-blue-500 pl-4">
                      <h5 className="font-semibold mb-2">3. Create API Hook</h5>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto"><code>{`// src/hooks/use-bonus-rewards.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useGiveBonus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      childId, 
      amount, 
      reason 
    }: { 
      childId: string; 
      amount: number; 
      reason: string 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert bonus record
      const { error: bonusError } = await supabase
        .from("bonus_rewards")
        .insert({
          child_id: childId,
          parent_id: user.id,
          amount,
          reason,
        });

      if (bonusError) throw bonusError;

      // Distribute to jars using existing function
      const { error: splitError } = await supabase.rpc(
        "fb_split_into_jars",
        {
          p_child: childId,
          p_amount: amount,
          p_type: "BONUS",
        }
      );

      if (splitError) throw splitError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      toast.success("Bonus given successfully!");
    },
  });
};`}</code></pre>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4">
                      <h5 className="font-semibold mb-2">4. Create UI Component</h5>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto"><code>{`// src/components/GiveBonusDialog.tsx
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useGiveBonus } from "@/hooks/use-bonus-rewards";

export const GiveBonusDialog = ({ childId, open, onClose }) => {
  const giveBonus = useGiveBonus();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    giveBonus.mutate({ childId, amount: Number(amount), reason });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>Give Bonus Reward</DialogHeader>
        <Input 
          type="number" 
          placeholder="Amount" 
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input 
          placeholder="Reason (optional)" 
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button onClick={handleSubmit}>Give Bonus</Button>
      </DialogContent>
    </Dialog>
  );
};`}</code></pre>
                    </div>

                    <div className="border-l-4 border-purple-500 pl-4">
                      <h5 className="font-semibold mb-2">5. Add to Parent Dashboard</h5>
                      <p className="text-xs text-muted-foreground">Import and add the dialog to ParentChildDetail.tsx with a trigger button</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-semibold text-lg mb-3">Adding Edge Functions</h4>
                  <div className="space-y-3 text-sm">
                    <p>Create a new function in <code>supabase/functions/your-function/index.ts</code></p>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto"><code>{`import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  );

  // Your logic here
  const { data, error } = await supabaseClient
    .from('your_table')
    .select('*');

  return new Response(JSON.stringify({ data, error }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});`}</code></pre>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-semibold text-lg mb-3">Common Extension Patterns</h4>
                  <div className="grid gap-4">
                    <div className="bg-muted p-4 rounded">
                      <strong>Adding a new jar type:</strong>
                      <ul className="list-disc list-inside ml-2 text-sm text-muted-foreground mt-2">
                        <li>Add enum value to jar_type in database</li>
                        <li>Update default jar creation logic</li>
                        <li>Add UI for managing the new jar</li>
                      </ul>
                    </div>

                    <div className="bg-muted p-4 rounded">
                      <strong>Adding notifications:</strong>
                      <ul className="list-disc list-inside ml-2 text-sm text-muted-foreground mt-2">
                        <li>Create notifications table</li>
                        <li>Use Supabase Realtime for live updates</li>
                        <li>Add bell icon with unread count</li>
                      </ul>
                    </div>

                    <div className="bg-muted p-4 rounded">
                      <strong>Adding reports/analytics:</strong>
                      <ul className="list-disc list-inside ml-2 text-muted-foreground mt-2">
                        <li>Query transactions table with date filters</li>
                        <li>Use Recharts for visualizations</li>
                        <li>Create custom database views for complex queries</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded">
                  <h4 className="font-semibold mb-2">Useful Resources</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• <a href="https://supabase.com/docs" className="text-primary hover:underline" target="_blank" rel="noopener">Supabase Documentation</a></li>
                    <li>• <a href="https://ui.shadcn.com" className="text-primary hover:underline" target="_blank" rel="noopener">shadcn/ui Components</a></li>
                    <li>• <a href="https://tanstack.com/query" className="text-primary hover:underline" target="_blank" rel="noopener">TanStack Query Docs</a></li>
                    <li>• <a href="https://stripe.com/docs/api" className="text-primary hover:underline" target="_blank" rel="noopener">Stripe API Reference</a></li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DeveloperDocs;