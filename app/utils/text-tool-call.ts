import type { ChatMessageTool } from "../store/chat/session";

const TOOL_CALL_START = /(?:\u00abtool_call\u00bb|<<tool_call>>|<tool_call>)/g;
const TOOL_CALL_END = "</tool_call>";

function parseArgumentValue(value: string) {
  const normalized = value.replace(/<\/parameter>\s*$/, "").trim();
  if (!normalized) return "";

  try {
    return JSON.parse(normalized);
  } catch {
    return normalized;
  }
}

function parseArguments(block: string) {
  const args: Record<string, unknown> = {};
  const namedParameter =
    /<parameter\s+name=["']([^"']+)["']>\s*([\s\S]*?)<\/parameter>/g;
  let match: RegExpExecArray | null;

  while ((match = namedParameter.exec(block))) {
    args[match[1].trim()] = parseArgumentValue(match[2]);
  }

  const legacyParameter =
    /<parameter>\s*([^<]+?)\s*<\/parameter>\s*([\s\S]*?)(?=<parameter>|<\/tool_call>)/g;
  while ((match = legacyParameter.exec(block))) {
    args[match[1].trim()] = parseArgumentValue(match[2]);
  }

  return args;
}

function getRemovalRange(text: string, start: number, end: number) {
  let removalStart = start;
  let removalEnd = end;
  const openingFence = text.slice(0, start).match(/```[^\r\n]*\r?\n\s*$/);
  const closingFence = text.slice(end).match(/^\s*```(?:\r?\n|$)/);

  if (openingFence) removalStart -= openingFence[0].length;
  if (closingFence) removalEnd += closingFence[0].length;

  return { removalStart, removalEnd };
}

export function extractTextToolCalls(
  source: string,
  availableFunctions: Record<string, Function>,
) {
  const tools: ChatMessageTool[] = [];
  let content = source;
  let searchFrom = 0;

  while (searchFrom < content.length) {
    TOOL_CALL_START.lastIndex = searchFrom;
    const startMatch = TOOL_CALL_START.exec(content);
    if (!startMatch) break;

    const blockStart = startMatch.index;
    const blockEnd = content.indexOf(TOOL_CALL_END, TOOL_CALL_START.lastIndex);
    if (blockEnd < 0) break;

    const fullBlockEnd = blockEnd + TOOL_CALL_END.length;
    const block = content.slice(TOOL_CALL_START.lastIndex, fullBlockEnd);
    const toolName = block.match(/<tool_name>\s*([^<]+?)\s*<\/tool_name>/)?.[1];

    if (
      !toolName ||
      !Object.prototype.hasOwnProperty.call(availableFunctions, toolName)
    ) {
      searchFrom = fullBlockEnd;
      continue;
    }

    tools.push({
      id: `text-tool-${Date.now()}-${tools.length}`,
      type: "function",
      function: {
        name: toolName,
        arguments: JSON.stringify(parseArguments(block)),
      },
    });

    const { removalStart, removalEnd } = getRemovalRange(
      content,
      blockStart,
      fullBlockEnd,
    );
    content = content.slice(0, removalStart) + content.slice(removalEnd);
    searchFrom = removalStart;
  }

  return { content, tools };
}
