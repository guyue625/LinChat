import { Mask } from "../store/mask";
import { useAppConfig } from "../store/config";
import { ASSISTANT_AVATARS } from "../masks/avatars";

export type FeaturedAssistant = {
  key: string;
  name: string;
  avatar: string;
  description: string;
  greeting: string;
  suggestions: string[];
  systemPrompt: string;
};

export const FEATURED_ASSISTANTS: FeaturedAssistant[] = [
  {
    key: "general",
    name: "Lin AI",
    avatar: ASSISTANT_AVATARS.general,
    description: "通用智能助理，帮你梳理问题、制定计划并完成日常工作。",
    greeting: "今天想先完成什么？我可以帮你一起梳理。",
    suggestions: ["帮我制定今天的工作计划", "总结一段内容", "一起分析一个问题"],
    systemPrompt:
      "你是 Lin AI，一位可靠、清晰且友好的通用智能助理。先理解目标，再给出结构化、可执行的回答。",
  },
  {
    key: "writer",
    name: "内容创作助手",
    avatar: ASSISTANT_AVATARS.contentWriter,
    description: "从灵感、大纲到润色，协助完成高质量中文内容。",
    greeting: "告诉我你的主题，我们从一个好点子开始。",
    suggestions: ["为文章生成三个标题", "把想法整理成大纲", "润色这段中文"],
    systemPrompt:
      "你是一位专业中文内容创作助手，擅长选题、结构设计、写作与润色。文字自然、准确，避免空泛套话。",
  },
  {
    key: "developer",
    name: "开发搭档",
    avatar: ASSISTANT_AVATARS.developer,
    description: "分析需求、定位问题并给出可落地的工程实现方案。",
    greeting: "把需求或报错发给我，我们一步步解决。",
    suggestions: ["帮我拆解这个开发需求", "分析一段报错", "设计一个 API"],
    systemPrompt:
      "你是一位资深软件工程师和结对编程搭档。优先澄清约束，提供简洁、可靠、可测试的实现。",
  },
];

export function assistantToMask(assistant: FeaturedAssistant): Mask {
  return {
    id: `featured-${assistant.key}`,
    createdAt: 0,
    avatar: assistant.avatar,
    name: assistant.name,
    context: [
      {
        id: `system-${assistant.key}`,
        role: "system",
        content: assistant.systemPrompt,
        date: "",
      },
    ],
    syncGlobalConfig: true,
    modelConfig: { ...useAppConfig.getState().modelConfig },
    lang: "cn",
    builtin: true,
    plugin: [],
  };
}
