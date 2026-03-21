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
  /** Action IDs completed in previous cycles — deprioritized (cost +10) */
  recentlyCompletedIds?: string[],
): PlanResult | null {
  const completedSet = new Set(recentlyCompletedIds ?? []);
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
        // Penalize recently completed actions to encourage variety
        const costPenalty = completedSet.has(action.id) ? 10 : 0;
        queue.push({
          state: newState,
          actions: [...node.actions, action],
          cost: node.cost + action.cost + costPenalty,
          time: node.time + action.timeCost,
        });
      }
    }
  }

  return bestPlan;
}

/**
 * Map a 5W1H goal to a GOAP goal state.
 * Extracts context (who/where) to generate more specific effect keys,
 * preventing different actions from colliding on the same generic effect.
 */
export function mapGoalToGOAPState(what: string, where: string): GOAPWorldState {
  const state: GOAPWorldState = { atDestination: true };

  const lower = what.toLowerCase();
  // Extract target NPC name from the goal text for contextual effects
  const npcMatch = lower.match(/(?:与|跟|向|找|问)([\u4e00-\u9fa5]{2,4})/);
  const npcSuffix = npcMatch ? `_${npcMatch[1]}` : '';
  const locSuffix = where ? `_at_${where}` : '';

  if (lower.includes('查阅') || lower.includes('查找') || lower.includes('研究')) {
    state[`hasInformation${locSuffix}`] = true;
  }
  if (lower.includes('交谈') || lower.includes('询问') || lower.includes('打听')) {
    state[`hasDialogue${npcSuffix || locSuffix}`] = true;
  }
  if (lower.includes('调查') || lower.includes('线索') || lower.includes('搜索')) {
    state[`hasClue${locSuffix}`] = true;
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
