import {
  CACHE_URL_PREFIX,
  UPLOAD_URL,
  REQUEST_TIMEOUT_MS,
} from "@/app/constant";
import { MultimodalContent, RequestMessage } from "@/app/client/api";
import Locale from "@/app/locales";
import {
  EventStreamContentType,
  fetchEventSource,
} from "@fortaine/fetch-event-source";
import { prettyObject } from "./format";
import {
  createThinkingChunkFormatter,
  type StreamChunkFormatter,
  type ThinkingStreamChunk,
} from "./chat-stream-core";
import { extractTextToolCalls } from "./text-tool-call";
import { fetch as tauriFetch } from "./stream";

export function compressImage(file: Blob, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent: any) => {
      const image = new Image();
      image.onload = () => {
        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d");
        let width = image.width;
        let height = image.height;
        let quality = 0.9;
        let dataUrl;

        do {
          canvas.width = width;
          canvas.height = height;
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
          ctx?.drawImage(image, 0, 0, width, height);
          dataUrl = canvas.toDataURL("image/jpeg", quality);

          if (dataUrl.length < maxSize) break;

          if (quality > 0.5) {
            // Prioritize quality reduction
            quality -= 0.1;
          } else {
            // Then reduce the size
            width *= 0.9;
            height *= 0.9;
          }
        } while (dataUrl.length > maxSize);

        resolve(dataUrl);
      };
      image.onerror = reject;
      image.src = readerEvent.target.result;
    };
    reader.onerror = reject;

    if (file.type.includes("heic")) {
      try {
        const heic2any = require("heic2any");
        heic2any({ blob: file, toType: "image/jpeg" })
          .then((blob: Blob) => {
            reader.readAsDataURL(blob);
          })
          .catch((e: any) => {
            reject(e);
          });
      } catch (e) {
        reject(e);
      }
    }

    reader.readAsDataURL(file);
  });
}

export async function preProcessImageContentBase(
  content: RequestMessage["content"],
  transformImageUrl: (url: string) => Promise<{ [key: string]: any }>,
) {
  if (typeof content === "string") {
    return content;
  }
  const result = [];
  for (const part of content) {
    if (part?.type == "image_url" && part?.image_url?.url) {
      try {
        const url = await cacheImageToBase64Image(part?.image_url?.url);
        result.push(await transformImageUrl(url));
      } catch (error) {
        console.error("Error processing image URL:", error);
      }
    } else {
      result.push({ ...part });
    }
  }
  return result;
}

export async function preProcessImageContent(
  content: RequestMessage["content"],
) {
  return preProcessImageContentBase(content, async (url) => ({
    type: "image_url",
    image_url: { url },
  })) as Promise<MultimodalContent[] | string>;
}

export async function preProcessImageContentForAlibabaDashScope(
  content: RequestMessage["content"],
) {
  return preProcessImageContentBase(content, async (url) => ({
    image: url,
  }));
}

const imageCaches: Record<string, string> = {};
export function cacheImageToBase64Image(imageUrl: string) {
  if (imageUrl.includes(CACHE_URL_PREFIX)) {
    if (!imageCaches[imageUrl]) {
      const reader = new FileReader();
      return fetch(imageUrl, {
        method: "GET",
        mode: "cors",
        credentials: "include",
      })
        .then((res) => res.blob())
        .then(
          async (blob) =>
            (imageCaches[imageUrl] = await compressImage(blob, 256 * 1024)),
        ); // compressImage
    }
    return Promise.resolve(imageCaches[imageUrl]);
  }
  return Promise.resolve(imageUrl);
}

export function base64Image2Blob(base64Data: string, contentType: string) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

export function uploadImage(file: Blob): Promise<string> {
  if (!window._SW_ENABLED) {
    // if serviceWorker register error, using compressImage
    return compressImage(file, 256 * 1024);
  }
  const body = new FormData();
  body.append("file", file);
  return fetch(UPLOAD_URL, {
    method: "post",
    body,
    mode: "cors",
    credentials: "include",
  })
    .then((res) => res.json())
    .then((res) => {
      // console.log("res", res);
      if (res?.code == 0 && res?.data) {
        return res?.data;
      }
      throw Error(`upload Error: ${res?.msg}`);
    });
}

export function removeImage(imageUrl: string) {
  return fetch(imageUrl, {
    method: "DELETE",
    mode: "cors",
    credentials: "include",
  });
}

type StreamParser<TChunk> = (
  text: string,
  runTools: any[],
) => TChunk | undefined;

type ToolMessageProcessor = (
  requestPayload: any,
  toolCallMessage: any,
  toolCallResult: any[],
) => void;

function runStream<TChunk>(
  chatPath: string,
  requestPayload: any,
  headers: any,
  tools: any[],
  funcs: Record<string, Function>,
  controller: AbortController,
  parseSSE: StreamParser<TChunk>,
  formatChunk: StreamChunkFormatter<TChunk>,
  processToolMessage: ToolMessageProcessor,
  options: any,
) {
  let responseText = "";
  let remainText = "";
  let finished = false;
  let running = false;
  const runTools: any[] = [];
  let responseRes: Response | undefined;

  function animateResponseText() {
    if (finished || controller.signal.aborted) {
      responseText += remainText;
      console.log("[Response Animation] finished");
      if (responseText.length === 0) {
        options.onError?.(new Error("empty response from server"));
      }
      return;
    }

    if (remainText.length > 0) {
      const fetchCount = Math.max(1, Math.round(remainText.length / 60));
      const fetchText = remainText.slice(0, fetchCount);
      responseText += fetchText;
      remainText = remainText.slice(fetchCount);
      options.onUpdate?.(responseText, fetchText);
    }

    requestAnimationFrame(animateResponseText);
  }

  animateResponseText();

  const finish = () => {
    if (finished) return;

    if (!running && runTools.length === 0) {
      const extracted = extractTextToolCalls(responseText + remainText, funcs);
      if (extracted.tools.length > 0) {
        responseText = extracted.content;
        remainText = "";
        runTools.push(...extracted.tools);
        options.onUpdate?.(responseText, "");
      }
    }

    if (!running && runTools.length > 0) {
      const toolCallMessage = {
        role: "assistant",
        tool_calls: [...runTools],
      };
      running = true;
      runTools.splice(0, runTools.length);

      return Promise.all(
        toolCallMessage.tool_calls.map((tool) => {
          options?.onBeforeTool?.(tool);
          return Promise.resolve(
            // @ts-ignore
            funcs[tool.function.name](
              // @ts-ignore
              tool?.function?.arguments
                ? JSON.parse(tool.function.arguments)
                : {},
            ),
          )
            .then((res) => {
              let content = res.data || res?.statusText;
              content =
                typeof content === "string" ? content : JSON.stringify(content);
              if (res.status >= 300) {
                return Promise.reject(content);
              }
              return content;
            })
            .then((content) => {
              options?.onAfterTool?.({
                ...tool,
                content,
                isError: false,
              });
              return content;
            })
            .catch((error) => {
              options?.onAfterTool?.({
                ...tool,
                isError: true,
                errorMsg: error.toString(),
              });
              return error.toString();
            })
            .then((content) => ({
              name: tool.function.name,
              role: "tool",
              content,
              tool_call_id: tool.id,
            }));
        }),
      ).then((toolCallResult) => {
        processToolMessage(requestPayload, toolCallMessage, toolCallResult);
        setTimeout(() => {
          console.debug("[ChatAPI] restart");
          running = false;
          chatApi(chatPath, headers, requestPayload, tools);
        }, 60);
      });
    }

    if (running) return;

    console.debug("[ChatAPI] end");
    finished = true;
    options.onFinish(responseText + remainText, responseRes);
  };

  controller.signal.onabort = finish;

  function chatApi(
    chatPath: string,
    headers: any,
    requestPayload: any,
    tools: any[],
  ) {
    const chatPayload = {
      method: "POST",
      body: JSON.stringify({
        ...requestPayload,
        tools: tools.length ? tools : undefined,
      }),
      signal: controller.signal,
      headers,
    };
    const requestTimeoutId = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    fetchEventSource(chatPath, {
      fetch: tauriFetch as any,
      ...chatPayload,
      async onopen(res) {
        clearTimeout(requestTimeoutId);
        const contentType = res.headers.get("content-type");
        console.log("[Request] response content type: ", contentType);
        responseRes = res;

        if (contentType?.startsWith("text/plain")) {
          responseText = await res.clone().text();
          return finish();
        }

        if (
          !res.ok ||
          !contentType?.startsWith(EventStreamContentType) ||
          res.status !== 200
        ) {
          const responseTexts = [responseText];
          let extraInfo = await res.clone().text();
          try {
            const resJson = await res.clone().json();
            extraInfo = prettyObject(resJson);
          } catch {}

          if (res.status === 401) {
            responseTexts.push(Locale.Error.Unauthorized);
          }

          if (extraInfo) {
            responseTexts.push(extraInfo);
          }

          responseText = responseTexts.join("\n\n");
          return finish();
        }
      },
      onmessage(message) {
        if (message.data === "[DONE]" || finished) {
          return finish();
        }

        const text = message.data;
        if (!text || text.trim().length === 0) return;

        try {
          const chunk = parseSSE(text, runTools);
          if (chunk === undefined) return;
          const nextText = formatChunk(chunk, remainText);
          if (nextText) remainText += nextText;
        } catch (error) {
          console.error("[Request] parse error", text, message, error);
        }
      },
      onclose() {
        finish();
      },
      onerror(error) {
        options?.onError?.(error);
        throw error;
      },
      openWhenHidden: true,
    });
  }

  console.debug("[ChatAPI] start");
  chatApi(chatPath, headers, requestPayload, tools);
}

export function stream(
  chatPath: string,
  requestPayload: any,
  headers: any,
  tools: any[],
  funcs: Record<string, Function>,
  controller: AbortController,
  parseSSE: StreamParser<string>,
  processToolMessage: ToolMessageProcessor,
  options: any,
) {
  return runStream(
    chatPath,
    requestPayload,
    headers,
    tools,
    funcs,
    controller,
    parseSSE,
    (chunk) => chunk,
    processToolMessage,
    options,
  );
}

export function streamWithThink(
  chatPath: string,
  requestPayload: any,
  headers: any,
  tools: any[],
  funcs: Record<string, Function>,
  controller: AbortController,
  parseSSE: StreamParser<ThinkingStreamChunk>,
  processToolMessage: ToolMessageProcessor,
  options: any,
) {
  return runStream(
    chatPath,
    requestPayload,
    headers,
    tools,
    funcs,
    controller,
    parseSSE,
    createThinkingChunkFormatter(),
    processToolMessage,
    options,
  );
}
