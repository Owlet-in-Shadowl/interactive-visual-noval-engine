import { create } from 'zustand';
import type {
  CharacterState,
  CorePersona,
  LongTermGoal,
  ShortTermGoal,
  PersonaShift,
  Goal5W1H,
} from './schemas';

interface CharacterMemoryStore {
  characters: Record<string, CharacterState>;

  resetAll(): void;
  initCharacter(id: string, state: CharacterState): void;
  getPersona(id: string): CorePersona | undefined;
  getGoals(id: string): { longTerm: LongTermGoal[]; shortTerm: ShortTermGoal[] };
  getPersonaShifts(id: string): PersonaShift[];

  addShortTermGoal(characterId: string, goal: Goal5W1H): void;
  updateShortTermGoalStatus(
    characterId: string,
    index: number,
    status: ShortTermGoal['status'],
  ): void;
  applyPersonaShift(characterId: string, shift: PersonaShift): void;
  applyGoalChanges(characterId: string, addGoals?: LongTermGoal[], removeGoalIds?: string[]): void;
}

export const useCharacterStore = create<CharacterMemoryStore>()((set, get) => ({
  characters: {},

  resetAll() {
    set({ characters: {} });
  },

  initCharacter(id, state) {
    set((s) => ({
      characters: { ...s.characters, [id]: state },
    }));
  },

  getPersona(id) {
    return get().characters[id]?.core;
  },

  getGoals(id) {
    const char = get().characters[id];
    if (!char) return { longTerm: [], shortTerm: [] };
    return {
      longTerm: char.longTermGoals,
      shortTerm: char.shortTermGoals,
    };
  },

  getPersonaShifts(id) {
    return get().characters[id]?.personaShifts ?? [];
  },

  addShortTermGoal(characterId, goal) {
    set((s) => {
      const char = s.characters[characterId];
      if (!char) return s;
      return {
        characters: {
          ...s.characters,
          [characterId]: {
            ...char,
            shortTermGoals: [
              ...char.shortTermGoals,
              { goal, status: 'active' as const, createdAt: Date.now() },
            ],
          },
        },
      };
    });
  },

  updateShortTermGoalStatus(characterId, index, status) {
    set((s) => {
      const char = s.characters[characterId];
      if (!char) return s;
      const goals = [...char.shortTermGoals];
      if (goals[index]) {
        goals[index] = { ...goals[index], status };
      }
      return {
        characters: {
          ...s.characters,
          [characterId]: { ...char, shortTermGoals: goals },
        },
      };
    });
  },

  applyPersonaShift(characterId, shift) {
    set((s) => {
      const char = s.characters[characterId];
      if (!char) return s;
      return {
        characters: {
          ...s.characters,
          [characterId]: {
            ...char,
            personaShifts: [...char.personaShifts, shift],
          },
        },
      };
    });
  },

  applyGoalChanges(characterId, addGoals, removeGoalIds) {
    set((s) => {
      const char = s.characters[characterId];
      if (!char) return s;

      let goals = [...char.longTermGoals];

      // Remove goals by ID
      if (removeGoalIds?.length) {
        goals = goals.filter((g) => !removeGoalIds.includes(g.id));
      }

      // Add new goals (skip duplicates by ID)
      if (addGoals?.length) {
        const existingIds = new Set(goals.map((g) => g.id));
        for (const g of addGoals) {
          if (!existingIds.has(g.id)) {
            goals.push(g);
          }
        }
      }

      return {
        characters: {
          ...s.characters,
          [characterId]: { ...char, longTermGoals: goals },
        },
      };
    });
  },
}));
