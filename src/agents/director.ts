/**
 * Director Agent - Translates mechanical GOAP actions into literary narrative.
 *
 * Architecture:
 *   IDirector (interface) → SinglePovDirector (default implementation)
 *
 * SinglePovDirector generates scenes from a single POV character's perspective,
 * but knows about other NPCs in the scene and can produce their dialogue too.
 * Future implementations (e.g. MultiPovDirector) can generate from multiple perspectives.
 */

import { generateText } from 'ai';
import { z } from 'zod';
import { getChatModel } from './deepseek';
import { extractJSON } from './utils';
import { SceneOutputSchema } from '../memory/schemas';
import type { GOAPAction, Goal5W1H, CorePersona, WorldEvent, SceneOutput } from '../memory/schemas';

// ─── Types ──────────────────────────────────────────

export interface DirectorInput {
  characterPersona: CorePersona;
  npcPersonas?: CorePersona[];
  currentGoal: Goal5W1H;
  action: GOAPAction;
  worldEvent?: WorldEvent;
  interrupted?: boolean;
  playerMessage?: string;
}

export interface DirectorResult {
  scenes: SceneOutput[];
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

// ─── Interface ──────────────────────────────────────

export interface IDirector {
  generateScenes(input: DirectorInput): Promise<DirectorResult>;
}

// ─── SinglePovDirector ─────────────────────────────

const ScenesSchema = z.object({ scenes: z.array(SceneOutputSchema) });

export class SinglePovDirector implements IDirector {
  async generateScenes(input: DirectorInput): Promise<DirectorResult> {
    const startTime = Date.now();

    const eventContext = input.worldEvent
      ? `\n⚠ 突发事件：${input.worldEvent.name} - ${input.worldEvent.description}`
      : '';

    const interruptContext = input.interrupted
      ? '\n注意：角色的原计划被突发事件打断，需要表现出被中断的反应。'
      : '';

    const playerContext = input.playerMessage
      ? `\n\n⚡ 玩家介入："${input.playerMessage}"\n请在叙事中体现对玩家指令/对话的回应，角色的行动和对话应该反映出受到了这个输入的影响。`
      : '';

    // Build NPC context block
    const npcContext = input.npcPersonas && input.npcPersonas.length > 0
      ? '\n\n场景中的其他角色：\n' + input.npcPersonas.map((npc) =>
          `- ${npc.name}（ID: ${npc.id}）：${npc.speechStyle}\n  背景：${npc.background}`,
        ).join('\n')
      : '';

    // Build speaker ID list for the prompt
    const allSpeakerIds = [input.characterPersona.id];
    if (input.npcPersonas) {
      for (const npc of input.npcPersonas) {
        allSpeakerIds.push(npc.id);
      }
    }
    const speakerHint = allSpeakerIds.map((id) => `"${id}"`).join('、');

    const system = `你是一位互动小说的叙事导演。你需要将角色的机械动作翻译为富有文学性的对话和环境描写。

主视角角色：
- 名字：${input.characterPersona.name}（ID: ${input.characterPersona.id}）
- 说话风格：${input.characterPersona.speechStyle}
- 背景：${input.characterPersona.background}${npcContext}

当前目标：${input.currentGoal.what}
原因：${input.currentGoal.why}${eventContext}${interruptContext}${playerContext}`;

    const { text, usage } = await generateText({
      model: getChatModel(),
      system,
      prompt: `角色正在执行动作："${input.action.name}" - ${input.action.description}

请将这个动作转化为1-3个叙事场景片段。严格输出以下JSON格式（不要添加任何其他内容）：
{
  "scenes": [
    {
      "speaker": "角色ID（${speakerHint}）或null（null表示旁白）",
      "dialogue": "对话或旁白文本",
      "emotion": "neutral/happy/sad/angry/surprised/fearful/determined/suspicious",
      "narration": "环境描写/动作描述（可选）"
    }
  ]
}

要求：
1. 对话要符合各角色的说话风格和性格
2. 加入适当的环境描写和动作描述
3. emotion使用：neutral/happy/sad/angry/surprised/fearful/determined/suspicious
4. speaker为null时表示旁白
5. 如果场景中有其他角色在场，可以生成他们的对话（使用他们的角色ID作为speaker）
6. 主视角角色的内心想法用旁白（speaker=null）描述，不要用thought类型

请用中文创作，仅输出JSON。`,
    });

    const durationMs = Date.now() - startTime;

    const rawJson = extractJSON(text);
    const parsed = JSON.parse(rawJson);
    const result = ScenesSchema.parse(parsed);

    return {
      scenes: result.scenes,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      durationMs,
    };
  }
}
