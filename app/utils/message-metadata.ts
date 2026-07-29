import { resolveModelDisplayName } from "./model";

export function getAssistantMessageMetadata(input: {
  featuredAssistantName?: string;
  maskName?: string;
  defaultTopicName?: string;
  defaultAssistantName?: string;
  messageModel?: string;
  sessionModel?: string;
}) {
  const maskName =
    input.maskName && input.maskName !== input.defaultTopicName
      ? input.maskName
      : undefined;
  return {
    assistantName:
      input.featuredAssistantName ||
      maskName ||
      input.defaultAssistantName ||
      "Default Assistant",
    modelName: input.messageModel || input.sessionModel || "",
  };
}

export function getMessageModelDisplayName(input: {
  messageModel?: string;
  messageProvider?: string;
  sessionModel?: string;
  sessionProvider?: string;
  models: ReadonlyArray<{
    name: string;
    displayName?: string;
    provider?: { providerName: string };
  }>;
}): string {
  if (input.sessionModel) {
    return resolveModelDisplayName({
      modelName: input.sessionModel,
      providerName: input.sessionProvider,
      models: input.models,
    });
  }

  return resolveModelDisplayName({
    modelName: input.messageModel,
    providerName: input.messageProvider,
    models: input.models,
  });
}
