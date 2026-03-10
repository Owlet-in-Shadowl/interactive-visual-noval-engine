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
}

export const useCharacterStore = create<CharacterMemoryStore>()((set, get) => ({
  characters: {},

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
}));
