export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { PlanType, PLAN_AGENTS, DEFAULT_AGENT_NAMES } from '@/lib/agents/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — Get onboarding state for current client
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const { data: client } = await supabase
    .from('clients')
    .select('*, agent_configs:agent_configs(*)')
    .eq('id', clientId)
    .single();

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  // Get integrations status
  const { data: integrations } = await supabase
    .from('integrations')
    .select('type, status')
    .eq('client_id', clientId);

  // Get channel links
  const { data: channels } = await supabase
    .from('channel_links')
    .select('channel, is_active')
    .eq('client_id', clientId);

  return NextResponse.json({
    client,
    onboardingStep: client.onboarding_step || 0,
    onboardingCompleted: client.onboarding_completed || false,
    agents: client.agent_configs || [],
    integrations: integrations || [],
    channels: channels || [],
  });
}

// POST — Process onboarding steps
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { clientId, step, data } = body;

  if (!clientId || step === undefined) {
    return NextResponse.json({ error: 'clientId and step required' }, { status: 400 });
  }

  // Step 1: Company info
  if (step === 1) {
    const { company, metier, ville, codePostal, siret, phone, adresse } = data;

    const { error } = await supabase
      .from('clients')
      .update({
        company, metier, ville, codePostal, siret, phone, adresse,
        onboarding_step: 1,
      })
      .eq('id', clientId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, step: 1 });
  }

  // Step 2: Name your agents
  if (step === 2) {
    const { agents } = data; // Array of { agentType, displayName }

    // Get client plan to know which agents are available
    const { data: client } = await supabase
      .from('clients')
      .select('plan')
      .eq('id', clientId)
      .single();

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const plan = client.plan as PlanType;
    const allowedAgents = PLAN_AGENTS[plan];

    for (const agent of agents) {
      if (!allowedAgents.includes(agent.agentType)) continue;

      // Upsert agent config with display name
      await supabase
        .from('agent_configs')
        .upsert({
          client_id: clientId,
          agent_type: agent.agentType,
          enabled: true,
          display_name: agent.displayName || DEFAULT_AGENT_NAMES[agent.agentType as keyof typeof DEFAULT_AGENT_NAMES],
          settings: {},
        }, { onConflict: 'client_id,agent_type' });
    }

    await supabase
      .from('clients')
      .update({ onboarding_step: 2 })
      .eq('id', clientId);

    return NextResponse.json({ ok: true, step: 2 });
  }

  // Step 3: Connect email (handled by Gmail OAuth flow, just mark step)
  if (step === 3) {
    await supabase
      .from('clients')
      .update({ onboarding_step: 3 })
      .eq('id', clientId);

    return NextResponse.json({ ok: true, step: 3 });
  }

  // Step 4: Connect Telegram/WhatsApp (mark as complete)
  if (step === 4) {
    await supabase
      .from('clients')
      .update({ onboarding_step: 4, onboarding_completed: true })
      .eq('id', clientId);

    return NextResponse.json({ ok: true, step: 4, completed: true });
  }

  return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
}
