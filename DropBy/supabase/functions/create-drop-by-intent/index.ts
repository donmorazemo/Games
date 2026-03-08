import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the calling user's JWT
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { visitor_id, host_id, window_id } = await req.json();

    // Ensure caller is the visitor (prevents spoofing)
    if (visitor_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role for the write (bypasses RLS for atomic notification)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: intent, error: intentError } = await supabase
      .from('drop_by_intents')
      .upsert(
        { visitor_id, host_id, window_id, status: 'active', updated_at: new Date().toISOString() },
        { onConflict: 'visitor_id,window_id' }
      )
      .select()
      .single();

    if (intentError) {
      return new Response(JSON.stringify({ error: intentError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Write notification to host atomically
    const { data: visitor } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', visitor_id)
      .single();

    await supabase.from('notifications').insert({
      user_id: host_id,
      type: 'drop_by_intent',
      body: `${visitor?.display_name ?? 'Someone'} plans to drop by tonight.`,
      data: { intent_id: intent.id, visitor_id, window_id },
    });

    return new Response(JSON.stringify(intent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
