import { DEFAULT_CONFIG, TTSConfig, TTSConfigValidator } from "../store";

import Locale from "../locales";
import { Select } from "./ui-lib";
import {
  DEFAULT_TTS_ENGINE,
  DEFAULT_TTS_ENGINES,
  DEFAULT_TTS_MODELS,
  DEFAULT_TTS_VOICES,
} from "../constant";
import { InputRange } from "./input-range";
import { SettingRow, SettingSwitch } from "./settings-controls";

export function TTSConfigList(props: {
  ttsConfig: TTSConfig;
  updateConfig: (updater: (config: TTSConfig) => void) => void;
}) {
  return (
    <>
      <SettingRow
        id="voice-tts-enable"
        title={Locale.Settings.TTS.Enable.Title}
        description={Locale.Settings.TTS.Enable.SubTitle}
      >
        <SettingSwitch
          label={Locale.Settings.TTS.Enable.Title}
          checked={props.ttsConfig.enable}
          onChange={(checked) =>
            props.updateConfig((config) => (config.enable = checked))
          }
        />
      </SettingRow>
      <SettingRow id="voice-tts-engine" title={Locale.Settings.TTS.Engine}>
        <Select
          aria-label={Locale.Settings.TTS.Engine}
          value={props.ttsConfig.engine}
          onChange={(e) => {
            props.updateConfig(
              (config) =>
                (config.engine = TTSConfigValidator.engine(
                  e.currentTarget.value,
                )),
            );
          }}
        >
          {DEFAULT_TTS_ENGINES.map((v, i) => (
            <option value={v} key={i}>
              {v}
            </option>
          ))}
        </Select>
      </SettingRow>
      {props.ttsConfig.engine === DEFAULT_TTS_ENGINE && (
        <>
          <SettingRow id="voice-tts-model" title={Locale.Settings.TTS.Model}>
            <Select
              aria-label={Locale.Settings.TTS.Model}
              value={props.ttsConfig.model}
              onChange={(e) => {
                props.updateConfig(
                  (config) =>
                    (config.model = TTSConfigValidator.model(
                      e.currentTarget.value,
                    )),
                );
              }}
            >
              {DEFAULT_TTS_MODELS.map((v, i) => (
                <option value={v} key={i}>
                  {v}
                </option>
              ))}
            </Select>
          </SettingRow>
          <SettingRow
            id="voice-tts-voice"
            title={Locale.Settings.TTS.Voice.Title}
            description={Locale.Settings.TTS.Voice.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.TTS.Voice.Title}
              value={props.ttsConfig.voice}
              onChange={(e) => {
                props.updateConfig(
                  (config) =>
                    (config.voice = TTSConfigValidator.voice(
                      e.currentTarget.value,
                    )),
                );
              }}
            >
              {DEFAULT_TTS_VOICES.map((v, i) => (
                <option value={v} key={i}>
                  {v}
                </option>
              ))}
            </Select>
          </SettingRow>
          <SettingRow
            id="voice-tts-speed"
            title={Locale.Settings.TTS.Speed.Title}
            description={Locale.Settings.TTS.Speed.SubTitle}
          >
            <InputRange
              aria={Locale.Settings.TTS.Speed.Title}
              value={props.ttsConfig.speed?.toFixed(1)}
              defaultValue={DEFAULT_CONFIG.ttsConfig.speed}
              min="0.3"
              max="4.0"
              step="0.1"
              onReset={() => {
                props.updateConfig(
                  (config) => (config.speed = DEFAULT_CONFIG.ttsConfig.speed),
                );
              }}
              onChange={(e) => {
                props.updateConfig(
                  (config) =>
                    (config.speed = TTSConfigValidator.speed(
                      e.currentTarget.valueAsNumber,
                    )),
                );
              }}
            ></InputRange>
          </SettingRow>
        </>
      )}
    </>
  );
}
