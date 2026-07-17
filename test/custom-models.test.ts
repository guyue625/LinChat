import {
  addCustomModel,
  getCustomModelsForProvider,
  mergeCustomModels,
  removeCustomModelAt,
  updateCustomModelAt,
} from "../app/utils/custom-models";

describe("custom model editor", () => {
  test("adds provider-qualified models without losing existing directives", () => {
    const result = addCustomModel(
      "-all,+gpt-4@OpenAI",
      "Anthropic",
      "claude-custom",
      "Claude Custom",
    );

    expect(result).toBe(
      "-all,+gpt-4@OpenAI,+claude-custom@Anthropic=Claude Custom",
    );
  });

  test("lists, edits and removes only the selected provider models", () => {
    const source =
      "+gpt-4@OpenAI,+claude-a@Anthropic=Claude A,+claude-b@Anthropic";
    const anthropic = getCustomModelsForProvider(source, "Anthropic");

    expect(anthropic.map((model) => model.name)).toEqual([
      "claude-a",
      "claude-b",
    ]);

    const edited = updateCustomModelAt(
      source,
      anthropic[0].tokenIndex,
      "Anthropic",
      "claude-a-new",
      "New Alias",
    );
    expect(edited).toContain("+claude-a-new@Anthropic=New Alias");
    expect(removeCustomModelAt(edited, anthropic[1].tokenIndex)).toBe(
      "+gpt-4@OpenAI,+claude-a-new@Anthropic=New Alias",
    );
  });

  test("keeps fetched values compatible with comma-separated storage", () => {
    expect(addCustomModel("", "OpenAI", "model,one", "Alias, One")).toBe(
      "+modelone@OpenAI=Alias  One",
    );
  });

  test("merges fetched models and updates duplicates", () => {
    const result = mergeCustomModels("+claude-a@Anthropic=Old", "Anthropic", [
      { name: "claude-a", alias: "New" },
      { name: "claude-b" },
    ]);

    expect(result).toBe("+claude-a@Anthropic=New,+claude-b@Anthropic");
  });
});
