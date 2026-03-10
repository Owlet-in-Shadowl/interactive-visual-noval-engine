/**
 * GOAP Planner - Simple goal-oriented action planning using forward search.
 * MVP: brute-force BFS instead of A* (sufficient for small action sets).
 */

import type { GOAPAction, GOAPWorldState } from '../memory/schemas';

interface PlanResult {
  actions: GOAPAction[];
  totalCost: number;
  totalTime: number;
}

/**
 * Check if all preconditions of an action are satisfied by the current state.
 */
function preconditionsMet(state: GOAPWorldState, action: GOAPAction): boolean {
  for (const [key, value] of Object.entries(action.preconditions)) {
    if (state[key] !== value) return false;
  }
  return true;
}

/**
 * Apply action effects to a state, returning a new state.
 */
function applyEffects(state: GOAPWorldState, action: GOAPAction): GOAPWorldState {
  return { ...state, ...action.effects };
}

/**
 * Check if all goal conditions are met by the current state.
 */
function goalMet(state: GOAPWorldState, goal: GOAPWorldState): boolean {
  for (const [key, value] of Object.entries(goal)) {
    if (state[key] !== value) return false;
  }
  return true;
}

/**
 * Plan a sequence of actions to reach the goal state from the current state.
 * Uses BFS to find the cheapest valid plan.
 */
export function planActions(
  currentState: GOAPWorldState,
  goalState: GOAPWorldState,
  availableActions: GOAPAction[],
  maxDepth: number = 5,
): PlanResult | null {
  interface SearchNode {
    state: GOAPWorldState;
    actions: GOAPAction[];
    cost: number;
    time: number;
  }

  const queue: SearchNode[] = [
    { state: currentState, actions: [], cost: 0, time: 0 },
  ];

  let bestPlan: PlanResult | null = null;

  while (queue.length > 0) {
    const node = queue.shift()!;

    if (goalMet(node.state, goalState)) {
      if (!bestPlan || node.cost < bestPlan.totalCost) {
        bestPlan = {
          actions: node.actions,
          totalCost: node.cost,
          totalTime: node.time,
        };
      }
      continue;
    }

    if (node.actions.length >= maxDepth) continue;

    for (const action of availableActions) {
      if (preconditionsMet(node.state, action)) {
        // Skip if we already used this exact action
        if (node.actions.some((a) => a.id === action.id)) continue;

        const newState = applyEffects(node.state, action);
        queue.push({
          state: newState,
          actions: [...node.actions, action],
          cost: node.cost + action.cost,
          time: node.time + action.timeCost,
        });
      }
    }
  }

  return bestPlan;
}

/**
 * Map a 5W1H goal to a GOAP goal state.
 * MVP: simple keyword mapping.
 */
export function mapGoalToGOAPState(what: string, where: string): GOAPWorldState {
  const state: GOAPWorldState = { atDestination: true };

  const lower = what.toLowerCase();
  if (lower.includes('查阅') || lower.includes('查找') || lower.includes('研究')) {
    state.hasInformation = true;
  }
  if (lower.includes('交谈') || lower.includes('询问') || lower.includes('打听')) {
    state.hasDialogue = true;
  }
  if (lower.includes('调查') || lower.includes('线索') || lower.includes('搜索')) {
    state.hasClue = true;
  }
  if (lower.includes('采集') || lower.includes('草药')) {
    state.hasHerbs = true;
  }
  if (lower.includes('躲') || lower.includes('藏')) {
    state.isHidden = true;
  }
  if (lower.includes('逃') || lower.includes('撤离')) {
    state.isSafe = true;
  }
  if (lower.includes('交易') || lower.includes('购买') || lower.includes('补给')) {
    state.hasSupplies = true;
  }

  return state;
}
