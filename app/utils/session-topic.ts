const TRAILING_TOPIC_PUNCTUATION = /[，。！？”“"、,.!?*]*$/g;
const SURROUNDING_TOPIC_MARKS = /^["“”*]+|["“”*]+$/g;

export function deriveSessionTopic(content: string, defaultTopic = "新的聊天") {
  const normalized = content
    .trim()
    .replace(SURROUNDING_TOPIC_MARKS, "")
    .replace(TRAILING_TOPIC_PUNCTUATION, "")
    .trim();

  return normalized || defaultTopic;
}

type TopicMessage = {
  role?: string;
  content?: unknown;
};

function getTopicText(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .filter(
      (part): part is { type?: string; text?: string } =>
        Boolean(part) && typeof part === "object",
    )
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join(" ");
}

export function deriveTopicFromMessages(
  messages: TopicMessage[],
  defaultTopic = "新的聊天",
) {
  const firstUserText = messages.find((message) => {
    return message.role === "user" && getTopicText(message.content).trim();
  });

  return deriveSessionTopic(
    firstUserText ? getTopicText(firstUserText.content) : "",
    defaultTopic,
  );
}

export function shouldApplyAutomaticTopic(options: {
  currentTopic: string;
  defaultTopic: string;
  maskName: string;
  manuallyEdited?: boolean;
}) {
  if (options.manuallyEdited) return false;

  return (
    options.currentTopic === options.defaultTopic ||
    options.currentTopic === options.maskName
  );
}
