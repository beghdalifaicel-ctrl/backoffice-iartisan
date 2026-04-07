import { AgentType, Tool } from '../types';

// Tool registry — each agent capability maps to executable tools
const toolRegistry: Map<string, Tool[]> = new Map();

let initialized = false;

export function registerTool(capability: string, tool: Tool): void {
  const existing = toolRegistry.get(capability) || [];
  existing.push(tool);
  toolRegistry.set(capability, existing);
}

function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;
  // Lazy-load tool modules to avoid circular dependency at module parse time
  require('./admin');
  require('./marketing');
  require('./commercial');
}

export function getAgentTools(agentType: AgentType, taskType: string): Tool[] {
  ensureInitialized();
  return toolRegistry.get(taskType) || [];
}
