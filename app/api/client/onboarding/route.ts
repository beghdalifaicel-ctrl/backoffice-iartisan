import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { PlanType, PLAN_AGENTS, DEFAULT_AGENT_NAMES } from '@/lib/agents/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — Get onboarding state for current client (uses session, no clientId param needed)
export async function GET() {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;

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
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    console.error('Client onboarding GET error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST — Process onboarding steps (clientId from session)
export async function POST(request: NextRequest) {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;

    const body = await request.json();
    const { step, data } = body;

    if (step === undefined) {
      return NextResponse.json({ error: 'step required' }, { status: 400 });
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
      const { agents } = data;

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
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    console.error('Client onboarding POST error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
