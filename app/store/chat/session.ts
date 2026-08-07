import { nanoid } from "nanoid";

import type { RequestMessage } from "../../client/api";
import type { ServiceProvider } from "../../constant";
import Locale from "../../locales";
import type { ModelType } from "../config";
import { createEmptyMask, type Mask } from "../mask";
import type { WebSearchResult } from "../../typing";

export type ChatMessageTool = {
  id: string;
  index?: number;
  type?: string;
  function?: {
    name: string;
    arguments?: string;
  };
  content?: string;
  isError?: boolean;
  errorMsg?: string;
};

export type ChatMessage = RequestMessage & {
  date: string;
  streaming?: boolean;
  isError?: boolean;
  id: string;
  model?: ModelType;
  provider?: ServiceProvider;
  tools?: ChatMessageTool[];
  audio_url?: string;
  isMcpResponse?: boolean;
  webSearch?: {
    query: string;
    results: WebSearchResult[];
  };
};

export interface ChatStat {
  tokenCount: number;
  wordCount: number;
  charCount: number;
}

export interface ChatSession {
  id: string;
  topic: string;
  /** Prevent automatic title generation from overwriting a user rename. */
  topicManuallyEdited?: boolean;
  /** Allow the model-generated title to refine the immediate local fallback. */
  topicAutomaticallyDerived?: boolean;
  memoryPrompt: string;
  messages: ChatMessage[];
  stat: ChatStat;
  lastUpdate: number;
  lastSummarizeIndex: number;
  clearContextIndex?: number;
  webSearchEnabled?: boolean;
  mask: Mask;
}

export const DEFAULT_TOPIC = Locale.Store.DefaultTopic;

export function createMessage(override: Partial<ChatMessage>): ChatMessage {
  return {
    id: nanoid(),
    date: new Date().toLocaleString(),
    role: "user",
    content: "",
    ...override,
  };
}

export const BOT_HELLO: ChatMessage = createMessage({
  role: "assistant",
  content: Locale.Store.BotHello,
});

export function createEmptySession(): ChatSession {
  return {
    id: nanoid(),
    topic: DEFAULT_TOPIC,
    memoryPrompt: "",
    messages: [],
    stat: {
      tokenCount: 0,
      wordCount: 0,
      charCount: 0,
    },
    lastUpdate: Date.now(),
    lastSummarizeIndex: 0,
    mask: createEmptyMask(),
  };
}
