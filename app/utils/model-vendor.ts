export const MODEL_VENDOR_OTHER = "Other";

type VendorMatcher = {
  label: string;
  pattern: RegExp;
};

// These match model ids and aliases, not the API transport used to reach them.
// A single OpenAI-compatible or Anthropic-compatible gateway can expose models
// from many vendors, so the model name is the source of truth for UI grouping.
const vendorMatchers: VendorMatcher[] = [
  {
    label: "OpenAI",
    pattern: /(?:^|[^a-z])(gpt|chatgpt|dall-?e|o[134])(?:[^a-z]|$)/i,
  },
  { label: "Anthropic", pattern: /claude/i },
  { label: "Google", pattern: /(?:gemini|gemma|learnlm|palm|veo)/i },
  { label: "Meta", pattern: /(?:llama|meta-llama)/i },
  { label: "Mistral", pattern: /(?:mistral|mixtral|codestral|pixtral)/i },
  { label: "DeepSeek", pattern: /deepseek/i },
  { label: "Moonshot / Kimi", pattern: /(?:moonshot|kimi)/i },
  { label: "Alibaba / Qwen", pattern: /(?:qwen|alibaba)/i },
  { label: "Baidu / ERNIE", pattern: /(?:ernie|wenxin|baidu)/i },
  { label: "xAI / Grok", pattern: /(?:grok|xai)/i },
  { label: "Tencent / Hunyuan", pattern: /(?:hunyuan|tencent)/i },
  {
    label: "ByteDance / Doubao",
    pattern: /(?:doubao|bytedance|(?:^|[^a-z])seed(?:[^a-z]|$)|ep-)/i,
  },
  {
    label: "Zhipu / GLM",
    pattern: /(?:chatglm|cogview|cogvideox|(?:^|[^a-z])glm(?:[-_/]|$))/i,
  },
  { label: "MiniMax", pattern: /(?:minimax|abab)/i },
  { label: "Cohere", pattern: /(?:cohere|command-r|command-light)/i },
  { label: "AI21 Labs", pattern: /(?:jamba|jurassic)/i },
  { label: "Microsoft / Phi", pattern: /(?:^|[^a-z])phi(?:[-_/]|$)/i },
  { label: "NVIDIA", pattern: /nemotron/i },
  { label: "01.AI / Yi", pattern: /(?:^|[^a-z])yi(?:[-_/]|\d)/i },
  { label: "InternLM", pattern: /internlm/i },
  { label: "Baichuan", pattern: /baichuan/i },
  { label: "Stability AI", pattern: /(?:stable-diffusion|stable-image)/i },
  { label: "Perplexity", pattern: /(?:sonar|perplexity)/i },
];

function findVendor(modelName?: string) {
  const normalizedModelName = modelName?.trim() ?? "";
  return vendorMatchers.find(({ pattern }) => pattern.test(normalizedModelName))
    ?.label;
}

export function getModelVendor(
  modelName?: string,
  transportProvider?: string,
  displayName?: string,
) {
  // Prefer a user-facing alias when it identifies the vendor. Gateways often
  // expose an internal id containing a different vendor's compatibility name.
  const matchedVendor = findVendor(displayName) || findVendor(modelName);

  return matchedVendor || transportProvider?.trim() || MODEL_VENDOR_OTHER;
}
