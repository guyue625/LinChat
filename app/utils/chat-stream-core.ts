export type ThinkingStreamChunk = {
  isThinking: boolean;
  content: string | undefined;
};

export type StreamChunkFormatter<T> = (
  chunk: T,
  pendingText: string,
) => string | undefined;

export function createThinkingChunkFormatter(): StreamChunkFormatter<ThinkingStreamChunk> {
  let isInThinkingMode = false;
  let lastIsThinking = false;
  let lastIsThinkingTagged = false;

  return (chunk, pendingText) => {
    if (!chunk.content || chunk.content.length === 0) return;

    let { content, isThinking } = chunk;

    if (!isThinking) {
      if (content.startsWith("<think>")) {
        isThinking = true;
        content = content.slice(7).trim();
        lastIsThinkingTagged = true;
      } else if (content.endsWith("</think>")) {
        isThinking = false;
        content = content.slice(0, -8).trim();
        lastIsThinkingTagged = false;
      } else if (lastIsThinkingTagged) {
        isThinking = true;
      }
    }

    const isThinkingChanged = lastIsThinking !== isThinking;
    lastIsThinking = isThinking;

    if (isThinking) {
      if (!isInThinkingMode || isThinkingChanged) {
        isInThinkingMode = true;
        const separator = pendingText.length > 0 ? "\n" : "";
        return `${separator}> ${content}`;
      }

      if (content.includes("\n\n")) {
        return content.split("\n\n").join("\n\n> ");
      }

      return content;
    }

    if (isInThinkingMode || isThinkingChanged) {
      isInThinkingMode = false;
      return `\n\n${content}`;
    }

    return content;
  };
}
