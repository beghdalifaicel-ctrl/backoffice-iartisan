import { AgentType, Tool } from '../types';

// Tool registry — each agent capability maps to executable tools
const toolRegistry: Map<string, Tool[]> = new Map();

export function registerTool(capability: string, tool: Tool): void {
  const existing = toolRegistry.get(capability) || [];
  existing.push(tool);
  toolRegistry.set(capability, existing);
}

export function getAgentTools(agentType: AgentType, taskType: string): Tool[] {
  return toolRegistry.get(taskType) || [];
}

// Register all tools on module load
import './admin';
import './marketing';
import './commercial';
