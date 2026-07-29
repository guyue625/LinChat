import { useCallback, useEffect, useRef, useState } from "react";

import { ClientApi } from "../../client/api";
import { DEFAULT_TTS_ENGINE, ModelProvider } from "../../constant";
import { useAccessStore, useAppConfig } from "../../store";
import { createTTSPlayer, playTTS, type TTSPlayer } from "../../utils/audio";
import { prettyObject } from "../../utils/format";
import { MsEdgeTTS, OUTPUT_FORMAT } from "../../utils/ms_edge_tts";
import { showToast } from "../ui-lib";

export function useChatSpeech() {
  const playerRef = useRef<TTSPlayer | null>(null);
  const speechStatusRef = useRef(false);
  const speechLoadingRef = useRef(false);
  const [speechStatus, setSpeechStatus] = useState(false);
  const [speechLoading, setSpeechLoading] = useState(false);

  if (!playerRef.current) {
    playerRef.current = createTTSPlayer();
  }

  const updateSpeechStatus = useCallback((playing: boolean) => {
    speechStatusRef.current = playing;
    setSpeechStatus(playing);
  }, []);

  useEffect(() => {
    return () => {
      speechStatusRef.current = false;
      speechLoadingRef.current = false;
      playerRef.current?.stop();
    };
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const player = playerRef.current!;

      if (speechStatusRef.current) {
        player.stop();
        updateSpeechStatus(false);
        return;
      }

      if (speechLoadingRef.current) return;

      speechLoadingRef.current = true;
      setSpeechLoading(true);

      try {
        const config = useAppConfig.getState();
        const { markdownToTxt } = require("markdown-to-txt");
        const textContent = markdownToTxt(text);

        await playTTS({
          player,
          loadAudio: async () => {
            if (config.ttsConfig.engine !== DEFAULT_TTS_ENGINE) {
              const tts = new MsEdgeTTS();
              await tts.setMetadata(
                useAccessStore.getState().edgeVoiceName(),
                OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
              );
              return tts.toArrayBuffer(textContent);
            }

            const api = new ClientApi(ModelProvider.GPT);
            return api.llm.speech({
              model: config.ttsConfig.model,
              input: textContent,
              voice: config.ttsConfig.voice,
              speed: config.ttsConfig.speed,
            });
          },
          onStarted: () => updateSpeechStatus(true),
          onEnded: () => updateSpeechStatus(false),
        });
      } catch (error) {
        console.error("[Chat Speech]", error);
        updateSpeechStatus(false);
        showToast(prettyObject(error));
      } finally {
        speechLoadingRef.current = false;
        setSpeechLoading(false);
      }
    },
    [updateSpeechStatus],
  );

  return { speak, speechLoading, speechStatus };
}
