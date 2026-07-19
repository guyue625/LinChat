import EmojiPicker, {
  Emoji,
  EmojiStyle,
  Theme as EmojiTheme,
} from "emoji-picker-react";

import { ModelType } from "../store";

import BotIconDefault from "../icons/llm-icons/default.svg";
import BotIconOpenAI from "../icons/llm-icons/openai.svg";
import BotIconGemini from "../icons/llm-icons/gemini.svg";
import BotIconGemma from "../icons/llm-icons/gemma.svg";
import BotIconClaude from "../icons/llm-icons/claude.svg";
import BotIconMeta from "../icons/llm-icons/meta.svg";
import BotIconMistral from "../icons/llm-icons/mistral.svg";
import BotIconDeepseek from "../icons/llm-icons/deepseek.svg";
import BotIconMoonshot from "../icons/llm-icons/moonshot.svg";
import BotIconQwen from "../icons/llm-icons/qwen.svg";
import BotIconWenxin from "../icons/llm-icons/wenxin.svg";
import BotIconGrok from "../icons/llm-icons/grok.svg";
import BotIconHunyuan from "../icons/llm-icons/hunyuan.svg";
import BotIconDoubao from "../icons/llm-icons/doubao.svg";
import BotIconChatglm from "../icons/llm-icons/chatglm.svg";

type LlmIconComponent = typeof BotIconDefault;

function getModelIcon(model?: string, provider?: string): LlmIconComponent {
  const modelName = `${model ?? ""} ${provider ?? ""}`.toLowerCase();

  if (
    /\b(openai|azure)\b/.test(modelName) ||
    /(^|\s)(gpt|chatgpt|dall-e|dalle|o1|o3)/.test(modelName)
  )
    return BotIconOpenAI;
  if (modelName.includes("gemini") || modelName.includes("google"))
    return BotIconGemini;
  if (modelName.includes("gemma")) return BotIconGemma;
  if (modelName.includes("claude") || modelName.includes("anthropic"))
    return BotIconClaude;
  if (modelName.includes("llama") || modelName.includes("meta"))
    return BotIconMeta;
  if (
    modelName.includes("mistral") ||
    modelName.includes("mixtral") ||
    modelName.includes("codestral")
  )
    return BotIconMistral;
  if (modelName.includes("deepseek")) return BotIconDeepseek;
  if (modelName.includes("moonshot") || modelName.includes("kimi"))
    return BotIconMoonshot;
  if (modelName.includes("qwen") || modelName.includes("alibaba"))
    return BotIconQwen;
  if (modelName.includes("ernie") || modelName.includes("baidu"))
    return BotIconWenxin;
  if (modelName.includes("grok") || modelName.includes("xai"))
    return BotIconGrok;
  if (modelName.includes("hunyuan") || modelName.includes("tencent"))
    return BotIconHunyuan;
  if (
    modelName.includes("doubao") ||
    modelName.includes("bytedance") ||
    modelName.includes("ep-")
  )
    return BotIconDoubao;
  if (
    modelName.includes("chatglm") ||
    modelName.includes("glm") ||
    modelName.includes("cogview") ||
    modelName.includes("cogvideox")
  )
    return BotIconChatglm;

  return BotIconDefault;
}

export function ModelIcon(props: {
  model?: string;
  provider?: string;
  size?: number;
  className?: string;
}) {
  const LlmIcon = getModelIcon(props.model, props.provider);
  const size = props.size ?? 18;
  return (
    <LlmIcon
      className={props.className}
      width={size}
      height={size}
      aria-hidden="true"
    />
  );
}

export function getEmojiUrl(unified: string, style: EmojiStyle) {
  // Whoever owns this Content Delivery Network (CDN), I am using your CDN to serve emojis
  // Old CDN broken, so I had to switch to this one
  // Author: https://github.com/H0llyW00dzZ
  return `https://fastly.jsdelivr.net/npm/emoji-datasource-apple/img/${style}/64/${unified}.png`;
}

export function isImageAvatar(avatar?: string) {
  return Boolean(
    avatar &&
      (avatar.startsWith("/") ||
        avatar.startsWith("http://") ||
        avatar.startsWith("https://") ||
        avatar.startsWith("data:image/") ||
        avatar.startsWith("blob:")),
  );
}

export function AvatarPicker(props: {
  onEmojiClick: (emojiId: string) => void;
}) {
  return (
    <EmojiPicker
      width={"100%"}
      lazyLoadEmojis
      theme={EmojiTheme.AUTO}
      getEmojiUrl={getEmojiUrl}
      onEmojiClick={(e) => {
        props.onEmojiClick(e.unified);
      }}
    />
  );
}

const BRAND_AVATAR = "/logo.png";

export function Avatar(props: {
  model?: ModelType;
  avatar?: string;
  size?: number;
}) {
  if (props.model) {
    return (
      <div className="no-dark">
        <ModelIcon
          model={props.model}
          className="user-avatar"
          size={props.size ?? 30}
        />
      </div>
    );
  }

  return (
    <div
      className={`user-avatar${
        isImageAvatar(props.avatar) ? " assistant-avatar" : ""
      }${props.avatar === BRAND_AVATAR ? " brand-avatar" : ""}`}
    >
      {props.avatar && (
        <EmojiAvatar
          avatar={props.avatar}
          size={props.size ?? (isImageAvatar(props.avatar) ? 36 : undefined)}
        />
      )}
    </div>
  );
}

export function EmojiAvatar(props: { avatar: string; size?: number }) {
  const size = props.size ?? 18;

  if (isImageAvatar(props.avatar)) {
    return (
      // Avatars can be local, remote, data, or blob URLs, so Next/Image is not applicable here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={props.avatar}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={`assistant-avatar-image${
          props.avatar === BRAND_AVATAR ? " brand-avatar-image" : ""
        }`}
      />
    );
  }

  return <Emoji unified={props.avatar} size={size} getEmojiUrl={getEmojiUrl} />;
}
