// Placeholder. This function exists only to host Deno tests for the money-handling RPCs.
// Run via the test runner; it is not meant to be invoked over HTTP.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve((_req) => {
  return new Response(
    JSON.stringify({ ok: true, note: 'This function hosts RPC eval tests; nothing to do here.' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
