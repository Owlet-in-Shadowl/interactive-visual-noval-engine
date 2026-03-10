/**
 * DeepSeek provider configuration.
 * Uses @ai-sdk/openai-compatible which sends to /chat/completions
 * with response_format: json_object (supported by DeepSeek).
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export const deepseek = createOpenAICompatible({
  name: 'deepseek',
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY ?? '',
});

export const deepseekChat = deepseek.chatModel('deepseek-chat');
