/**
 * Model Configuration Store - Manages AI model provider settings.
 * Supports multiple protocols: OpenAI, Anthropic, Gemini, DeepSeek.
 * Persists to localStorage, auto-fills from env vars.
 */

import { create } from 'zustand';

export type ModelProtocol = 'openai' | 'anthropic' | 'gemini' | 'deepseek';
export type MemoryProvider = 'builtin' | 'mem0';

export interface ModelConfig {
  protocol: ModelProtocol;
  baseURL: string;
  apiKey: string;
  modelName: string;
}

export interface MemoryConfig {
  provider: MemoryProvider;
  mem0ApiKey: string;
}

export interface ModelConfigState {
  chatModel: ModelConfig;
  embeddingModel: ModelConfig;
  memoryConfig: MemoryConfig;
  initialized: boolean;

  setChatModel: (config: Partial<ModelConfig>) => void;
  setEmbeddingModel: (config: Partial<ModelConfig>) => void;
  setMemoryConfig: (config: Partial<MemoryConfig>) => void;
  init: () => void;
  save: () => void;
}

/** Default base URLs per protocol */
export const DEFAULT_BASE_URLS: Record<ModelProtocol, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
};

/** Default model names per protocol */
export const DEFAULT_MODEL_NAMES: Record<ModelProtocol, { chat: string; embedding: string }> = {
  openai: { chat: 'gpt-4o', embedding: 'text-embedding-3-small' },
  anthropic: { chat: 'claude-sonnet-4-20250514', embedding: '' },
  gemini: { chat: 'gemini-2.0-flash', embedding: 'text-embedding-004' },
  deepseek: { chat: 'deepseek-chat', embedding: '' },
};

const STORAGE_KEY = 'novel-engine-model-config';

function getEnvApiKey(): string {
  try {
    return import.meta.env.VITE_DEEPSEEK_API_KEY ?? '';
  } catch {
    return '';
  }
}

function createDefaultChatModel(): ModelConfig {
  return {
    protocol: 'deepseek',
    baseURL: DEFAULT_BASE_URLS.deepseek,
    apiKey: getEnvApiKey(),
    modelName: 'deepseek-chat',
  };
}

function createDefaultEmbeddingModel(): ModelConfig {
  return {
    protocol: 'deepseek',
    baseURL: DEFAULT_BASE_URLS.deepseek,
    apiKey: getEnvApiKey(),
    modelName: '',
  };
}

function createDefaultMemoryConfig(): MemoryConfig {
  return { provider: 'builtin', mem0ApiKey: '' };
}

export const useModelConfigStore = create<ModelConfigState>()((set, get) => ({
  chatModel: createDefaultChatModel(),
  embeddingModel: createDefaultEmbeddingModel(),
  memoryConfig: createDefaultMemoryConfig(),
  initialized: false,

  setChatModel: (config) => {
    set((s) => ({
      chatModel: { ...s.chatModel, ...config },
    }));
  },

  setEmbeddingModel: (config) => {
    set((s) => ({
      embeddingModel: { ...s.embeddingModel, ...config },
    }));
  },

  setMemoryConfig: (config) => {
    set((s) => ({
      memoryConfig: { ...s.memoryConfig, ...config },
    }));
  },

  init: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const envKey = getEnvApiKey();

        // Merge saved config with env defaults
        const chatModel: ModelConfig = {
          ...createDefaultChatModel(),
          ...parsed.chatModel,
        };
        const embeddingModel: ModelConfig = {
          ...createDefaultEmbeddingModel(),
          ...parsed.embeddingModel,
        };

        // If saved key is empty but env has one, use env
        if (!chatModel.apiKey && envKey) chatModel.apiKey = envKey;
        if (!embeddingModel.apiKey && envKey) embeddingModel.apiKey = envKey;

        const memoryConfig: MemoryConfig = {
          ...createDefaultMemoryConfig(),
          ...parsed.memoryConfig,
        };

        set({ chatModel, embeddingModel, memoryConfig, initialized: true });
      } else {
        set({ initialized: true });
      }
    } catch {
      set({ initialized: true });
    }
  },

  save: () => {
    const { chatModel, embeddingModel, memoryConfig } = get();
    // Don't persist api keys from env to localStorage (security)
    const envKey = getEnvApiKey();
    const chatToSave = { ...chatModel };
    const embeddingToSave = { ...embeddingModel };

    // If the key matches env, don't persist it
    if (chatToSave.apiKey === envKey) chatToSave.apiKey = '';
    if (embeddingToSave.apiKey === envKey) embeddingToSave.apiKey = '';

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ chatModel: chatToSave, embeddingModel: embeddingToSave, memoryConfig }),
    );
  },
}));
