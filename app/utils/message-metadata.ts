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
  const modelName = input.messageModel || input.sessionModel || "";
  if (!modelName) return "";

  const providerName =
    input.messageProvider ||
    (input.messageModel === input.sessionModel
      ? input.sessionProvider
      : undefined);
  const exactMatch = input.models.find(
    (model) =>
      model.name === modelName &&
      (!providerName || model.provider?.providerName === providerName),
  );
  const nameMatch = input.models.find((model) => model.name === modelName);
  const resolvedModel = exactMatch || nameMatch;

  return resolvedModel?.displayName || resolvedModel?.name || modelName;
}
