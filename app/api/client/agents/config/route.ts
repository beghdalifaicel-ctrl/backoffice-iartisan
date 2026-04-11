/**
 * Agent Configuration API — /api/client/agents/config
 *
 * GET:  Get full agent config (instructions, personality, settings) for all agents
 * PUT:  Update agent config for a specific agent type
 *
 * This is where clients configure:
 * - Agent display name (Sophie, Thomas, Emma…)
 * - Custom instructions ("Toujours proposer un RDV", etc.)
 * - Personality: tone, tutoiement, signature, restrictions
 * - Agent-specific settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/auth';
import { AgentType, AgentPersonality, DEFAULT_PERSONALITY, PLAN_AGENTS, PlanType } from '@/lib/agents/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — Retrieve all agent configs for the authenticated client
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get client plan to know which agents are available
    const { data: client } = await supabase
      .from('clients')
      .select('plan')
      .eq('id', auth.clientId)
      .single();

    const plan = (client?.plan || 'ESSENTIEL') as PlanType;
    const availableAgents = PLAN_AGENTS[plan];

    // Get all agent configs
    const { data: configs } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('client_id', auth.clientId)
      .in('agent_type', availableAgents);

    // Build response with defaults for agents that don't have a config yet
    const result: Record<string, any> = {};
    for (const agentType of availableAgents) {
      const config = configs?.find((c: any) => c.agent_type === agentType);
      result[agentType] = {
        agentType,
        enabled: config?.enabled ?? true,
        displayName: config?.display_name || null,
        instructions: config?.instructions || '',
        personality: config?.personality || DEFAULT_PERSONALITY,
        settings: config?.settings || {},
      };
    }

    return NextResponse.json({ agents: result, plan, availableAgents });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT — Update agent config for a specific agent
export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { agentType, displayName, instructions, personality, enabled, settings } = body;

    if (!agentType || !['ADMIN', 'MARKETING', 'COMMERCIAL'].includes(agentType)) {
      return NextResponse.json(
        { error: 'Invalid agentType. Must be ADMIN, MARKETING, or COMMERCIAL.' },
        { status: 400 }
      );
    }

    // Verify this agent is available in client's plan
    const { data: client } = await supabase
      .from('clients')
      .select('plan')
      .eq('id', auth.clientId)
      .single();

    const plan = (client?.plan || 'ESSENTIEL') as PlanType;
    if (!PLAN_AGENTS[plan].includes(agentType as AgentType)) {
      return NextResponse.json(
        { error: `L'agent ${agentType} n'est pas disponible dans votre plan ${plan}.` },
        { status: 403 }
      );
    }

    // Validate personality if provided
    if (personality) {
      const validTones = ['professionnel', 'amical', 'formel', 'decontracte'];
      if (personality.tone && !validTones.includes(personality.tone)) {
        return NextResponse.json(
          { error: `Ton invalide. Choix : ${validTones.join(', ')}` },
          { status: 400 }
        );
      }
      if (personality.restrictions && !Array.isArray(personality.restrictions)) {
        return NextResponse.json(
          { error: 'restrictions doit être un tableau de strings' },
          { status: 400 }
        );
      }
      // Cap restrictions at 10
      if (personality.restrictions && personality.restrictions.length > 10) {
        return NextResponse.json(
          { error: 'Maximum 10 restrictions par agent.' },
          { status: 400 }
        );
      }
    }

    // Validate instructions length
    if (instructions && instructions.length > 2000) {
      return NextResponse.json(
        { error: 'Les instructions sont trop longues (max 2000 caractères).' },
        { status: 400 }
      );
    }

    // Validate display name length
    if (displayName && displayName.length > 30) {
      return NextResponse.json(
        { error: 'Le nom est trop long (max 30 caractères).' },
        { status: 400 }
      );
    }

    // Build update object (only set fields that are provided)
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (displayName !== undefined) updateData.display_name = displayName;
    if (instructions !== undefined) updateData.instructions = instructions;
    if (personality !== undefined) {
      // Merge with defaults to ensure all fields exist
      updateData.personality = { ...DEFAULT_PERSONALITY, ...personality };
    }
    if (enabled !== undefined) updateData.enabled = enabled;
    if (settings !== undefined) updateData.settings = settings;

    // Upsert the config
    const { data: result, error } = await supabase
      .from('agent_configs')
      .upsert(
        {
          client_id: auth.clientId,
          agent_type: agentType,
          ...updateData,
        },
        { onConflict: 'client_id,agent_type' }
      )
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      config: {
        agentType: result.agent_type,
        enabled: result.enabled,
        displayName: result.display_name,
        instructions: result.instructions,
        personality: result.personality,
        settings: result.settings,
      },
      message: `Configuration de l'agent ${agentType} mise à jour.`,
    });
  } catch (err: any) {
    console.error('[Agent Config API] PUT error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
