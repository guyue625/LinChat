import { ServiceProvider } from "../app/constant";
import {
  getUpstreamModelsHeaders,
  getUpstreamModelsUrl,
  parseUpstreamModels,
} from "../app/utils/upstream-models";

describe("upstream model discovery", () => {
  test("builds OpenAI-compatible model URLs", () => {
    expect(
      getUpstreamModelsUrl({
        baseUrl: "https://api.example.com",
        apiKey: "key",
        provider: ServiceProvider.Anthropic,
      }),
    ).toBe("https://api.example.com/v1/models");
    expect(
      getUpstreamModelsUrl({
        baseUrl: "https://api.example.com/v1/",
        apiKey: "key",
        provider: ServiceProvider.OpenAI,
      }),
    ).toBe("https://api.example.com/v1/models");
  });

  test("builds Google model URLs using the configured API version", () => {
    expect(
      getUpstreamModelsUrl({
        baseUrl: "https://generativelanguage.googleapis.com",
        apiKey: "key",
        apiVersion: "v1beta",
        provider: ServiceProvider.Google,
      }),
    ).toBe("https://generativelanguage.googleapis.com/v1beta/models");
  });

  test("uses provider-specific authentication headers", () => {
    expect(
      getUpstreamModelsHeaders({
        baseUrl: "https://api.anthropic.com",
        apiKey: "secret",
        apiVersion: "2023-06-01",
        provider: ServiceProvider.Anthropic,
      }),
    ).toMatchObject({
      "x-api-key": "secret",
      "anthropic-version": "2023-06-01",
    });
    expect(
      getUpstreamModelsHeaders({
        baseUrl: "https://api.openai.com",
        apiKey: "secret",
        provider: ServiceProvider.OpenAI,
      }).Authorization,
    ).toBe("Bearer secret");
  });

  test("parses OpenAI, Anthropic and Google response shapes", () => {
    expect(
      parseUpstreamModels({
        data: [{ id: "model-a" }, { id: "model-a" }, { id: "model-b" }],
      }),
    ).toEqual([{ name: "model-a" }, { name: "model-b" }]);
    expect(
      parseUpstreamModels({
        models: [{ name: "models/gemini-pro", displayName: "Gemini Pro" }],
      }),
    ).toEqual([{ name: "gemini-pro", alias: "Gemini Pro" }]);
  });
});
