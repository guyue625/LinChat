export interface EditableCustomModel {
  tokenIndex: number;
  name: string;
  alias: string;
  provider?: string;
}

function splitCustomModelTokens(customModels: string): string[] {
  return customModels
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseCustomModelToken(
  token: string,
  tokenIndex: number,
): EditableCustomModel | undefined {
  if (token.startsWith("-")) return;

  const modelConfig = token.startsWith("+") ? token.slice(1) : token;
  const [qualifiedName, alias = ""] = modelConfig.split(/=(.*)/s);
  const separator = qualifiedName.lastIndexOf("@");
  const name = (
    separator >= 0 ? qualifiedName.slice(0, separator) : qualifiedName
  ).trim();
  const provider =
    separator >= 0 ? qualifiedName.slice(separator + 1).trim() : undefined;

  if (!name || name === "all") return;

  return {
    tokenIndex,
    name,
    alias: alias.trim(),
    provider: provider || undefined,
  };
}

function formatCustomModel(
  name: string,
  alias: string,
  provider: string,
): string {
  const normalizedName = name.trim().replace(/[=,]/g, "");
  const normalizedAlias = alias.trim().replaceAll(",", " ");
  return `+${normalizedName}@${provider}${
    normalizedAlias ? `=${normalizedAlias}` : ""
  }`;
}

function sameProvider(left?: string, right?: string): boolean {
  return left?.toLowerCase() === right?.toLowerCase();
}

export function getCustomModelsForProvider(
  customModels: string,
  provider: string,
): EditableCustomModel[] {
  return splitCustomModelTokens(customModels)
    .map(parseCustomModelToken)
    .filter(
      (entry): entry is EditableCustomModel =>
        !!entry && sameProvider(entry.provider, provider),
    );
}

export function addCustomModel(
  customModels: string,
  provider: string,
  name: string,
  alias = "",
): string {
  const tokens = splitCustomModelTokens(customModels);
  const normalizedName = name.trim();
  if (!normalizedName) return tokens.join(",");

  const existingIndex = tokens.findIndex((token, index) => {
    const entry = parseCustomModelToken(token, index);
    return (
      entry?.name === normalizedName && sameProvider(entry.provider, provider)
    );
  });
  const nextToken = formatCustomModel(normalizedName, alias, provider);

  if (existingIndex >= 0) {
    tokens[existingIndex] = nextToken;
  } else {
    tokens.push(nextToken);
  }

  return tokens.join(",");
}

export function updateCustomModelAt(
  customModels: string,
  tokenIndex: number,
  provider: string,
  name: string,
  alias: string,
): string {
  const tokens = splitCustomModelTokens(customModels);
  if (tokenIndex < 0 || tokenIndex >= tokens.length || !name.trim()) {
    return tokens.join(",");
  }

  tokens[tokenIndex] = formatCustomModel(name, alias, provider);
  return tokens.join(",");
}

export function removeCustomModelAt(
  customModels: string,
  tokenIndex: number,
): string {
  const tokens = splitCustomModelTokens(customModels);
  if (tokenIndex >= 0 && tokenIndex < tokens.length) {
    tokens.splice(tokenIndex, 1);
  }
  return tokens.join(",");
}

export function mergeCustomModels(
  customModels: string,
  provider: string,
  models: ReadonlyArray<{ name: string; alias?: string }>,
): string {
  return models.reduce(
    (result, model) =>
      addCustomModel(result, provider, model.name, model.alias),
    customModels,
  );
}
