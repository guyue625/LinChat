export type TTSPlayer = {
  init: () => void;
  play: (audioBuffer: ArrayBuffer, onended: () => void | null) => Promise<void>;
  stop: () => void;
};

type TTSPlaybackOptions = {
  player: TTSPlayer;
  loadAudio: () => Promise<ArrayBuffer>;
  onStarted: () => void;
  onEnded: () => void;
};

export function createTTSPlayer(): TTSPlayer {
  let audioContext: AudioContext | null = null;
  let audioBufferSourceNode: AudioBufferSourceNode | null = null;

  const init = () => {
    if (audioContext && audioContext.state !== "closed") return;

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    void audioContext.suspend().catch(() => undefined);
  };

  const play = async (audioBuffer: ArrayBuffer, onended: () => void | null) => {
    if (audioBufferSourceNode) {
      const previousSource = audioBufferSourceNode;
      audioBufferSourceNode = null;
      previousSource.onended = null;
      try {
        previousSource.stop();
      } catch {}
      previousSource.disconnect();
    }

    init();
    const context = audioContext!;
    const buffer = await context.decodeAudioData(audioBuffer);
    const source = context.createBufferSource();
    audioBufferSourceNode = source;
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      if (audioBufferSourceNode === source) {
        audioBufferSourceNode = null;
      }
      source.disconnect();
      onended();
    };

    try {
      await context.resume();
      source.start();
    } catch (error) {
      source.onended = null;
      source.disconnect();
      if (audioBufferSourceNode === source) {
        audioBufferSourceNode = null;
      }
      throw error;
    }
  };

  const stop = () => {
    if (audioBufferSourceNode) {
      const source = audioBufferSourceNode;
      audioBufferSourceNode = null;
      source.onended = null;
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    if (audioContext) {
      const context = audioContext;
      audioContext = null;
      if (context.state !== "closed") {
        void context.close().catch(() => undefined);
      }
    }
  };

  return { init, play, stop };
}

export async function playTTS(options: TTSPlaybackOptions) {
  try {
    options.player.init();
    const audioBuffer = await options.loadAudio();
    await options.player.play(audioBuffer, options.onEnded);
    options.onStarted();
  } catch (error) {
    try {
      options.player.stop();
    } catch {}
    throw error;
  }
}
