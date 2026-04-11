import { NextRequest, NextResponse } from "next/server";
import { requireClient } from "@/lib/auth";
import { AgentOrchestrator } from "@/lib/agents/orchestrator";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const orchestrator = new AgentOrchestrator();

// POST — Submit a new agent task
export async function POST(req: NextRequest) {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;
    const body = await req.json();

    const { agentType, taskType, payload = {} } = body;

    if (!agentType || !taskType) {
      return NextResponse.json(
        { error: "agentType et taskType requis" },
        { status: 400 }
      );
    }

    const result = await orchestrator.submitTask(
      clientId,
      agentType,
      taskType,
      payload
    );

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ taskId: result.taskId, status: "PENDING" });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    console.error("Submit task error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// GET — List tasks with optional filters
export async function GET(req: NextRequest) {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;

    const { searchParams } = new URL(req.url);
    const agentType = searchParams.get("agentType");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("agent_tasks")
      .select(
        "id, agent_type, task_type, status, priority, payload, result, error, created_at, completed_at, started_at"
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (agentType) {
      query = query.eq("agent_type", agentType);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data: tasks, error } = await query;

    if (error) {
      console.error("List tasks error:", error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    // Format for frontend
    const formatted = (tasks || []).map((t: any) => ({
      id: t.id,
      agentType: t.agent_type,
      taskType: t.task_type,
      status: t.status,
      payload: t.payload,
      result: t.result,
      error: t.error,
      createdAt: t.created_at,
      completedAt: t.completed_at,
      startedAt: t.started_at,
    }));

    return NextResponse.json({ tasks: formatted });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    console.error("List tasks error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
