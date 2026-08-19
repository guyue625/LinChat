import { DEFAULT_CONFIG, RealtimeConfig } from "@/app/store";

import Locale from "@/app/locales";
import { Select, PasswordInput } from "@/app/components/ui-lib";

import { InputRange } from "@/app/components/input-range";
import { SettingRow, SettingSwitch } from "@/app/components/settings-controls";
import { Voice } from "rt-client";
import { ServiceProvider } from "@/app/constant";

const providers = [ServiceProvider.OpenAI, ServiceProvider.Azure];

const models = ["gpt-4o-realtime-preview-2024-10-01"];

const voice = ["alloy", "shimmer", "echo"];

export function RealtimeConfigList(props: {
  realtimeConfig: RealtimeConfig;
  updateConfig: (updater: (config: RealtimeConfig) => void) => void;
}) {
  const azureConfigComponent = props.realtimeConfig.provider ===
    ServiceProvider.Azure && (
    <>
      <SettingRow
        id="voice-realtime-azure-endpoint"
        title={Locale.Settings.Realtime.Azure.Endpoint.Title}
        description={Locale.Settings.Realtime.Azure.Endpoint.SubTitle}
      >
        <input
          aria-label={Locale.Settings.Realtime.Azure.Endpoint.Title}
          value={props.realtimeConfig?.azure?.endpoint}
          type="text"
          placeholder={Locale.Settings.Realtime.Azure.Endpoint.Title}
          onChange={(e) => {
            props.updateConfig(
              (config) => (config.azure.endpoint = e.currentTarget.value),
            );
          }}
        />
      </SettingRow>
      <SettingRow
        id="voice-realtime-azure-deployment"
        title={Locale.Settings.Realtime.Azure.Deployment.Title}
        description={Locale.Settings.Realtime.Azure.Deployment.SubTitle}
      >
        <input
          aria-label={Locale.Settings.Realtime.Azure.Deployment.Title}
          value={props.realtimeConfig?.azure?.deployment}
          type="text"
          placeholder={Locale.Settings.Realtime.Azure.Deployment.Title}
          onChange={(e) => {
            props.updateConfig(
              (config) => (config.azure.deployment = e.currentTarget.value),
            );
          }}
        />
      </SettingRow>
    </>
  );

  return (
    <>
      <SettingRow
        id="voice-realtime-enable"
        title={Locale.Settings.Realtime.Enable.Title}
        description={Locale.Settings.Realtime.Enable.SubTitle}
      >
        <SettingSwitch
          label={Locale.Settings.Realtime.Enable.Title}
          checked={props.realtimeConfig.enable}
          onChange={(checked) =>
            props.updateConfig((config) => (config.enable = checked))
          }
        />
      </SettingRow>

      {props.realtimeConfig.enable && (
        <>
          <SettingRow
            id="voice-realtime-provider"
            title={Locale.Settings.Realtime.Provider.Title}
            description={Locale.Settings.Realtime.Provider.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.Realtime.Provider.Title}
              value={props.realtimeConfig.provider}
              onChange={(e) => {
                props.updateConfig(
                  (config) =>
                    (config.provider = e.target.value as ServiceProvider),
                );
              }}
            >
              {providers.map((v, i) => (
                <option value={v} key={i}>
                  {v}
                </option>
              ))}
            </Select>
          </SettingRow>
          <SettingRow
            id="voice-realtime-model"
            title={Locale.Settings.Realtime.Model.Title}
            description={Locale.Settings.Realtime.Model.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.Realtime.Model.Title}
              value={props.realtimeConfig.model}
              onChange={(e) => {
                props.updateConfig((config) => (config.model = e.target.value));
              }}
            >
              {models.map((v, i) => (
                <option value={v} key={i}>
                  {v}
                </option>
              ))}
            </Select>
          </SettingRow>
          <SettingRow
            id="voice-realtime-api-key"
            title={Locale.Settings.Realtime.ApiKey.Title}
            description={Locale.Settings.Realtime.ApiKey.SubTitle}
          >
            <PasswordInput
              aria={Locale.Settings.ShowPassword}
              aria-label={Locale.Settings.Realtime.ApiKey.Title}
              value={props.realtimeConfig.apiKey}
              type="text"
              placeholder={Locale.Settings.Realtime.ApiKey.Placeholder}
              onChange={(e) => {
                props.updateConfig(
                  (config) => (config.apiKey = e.currentTarget.value),
                );
              }}
            />
          </SettingRow>
          {azureConfigComponent}
          <SettingRow
            id="voice-realtime-voice"
            title={Locale.Settings.TTS.Voice.Title}
            description={Locale.Settings.TTS.Voice.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.TTS.Voice.Title}
              value={props.realtimeConfig.voice}
              onChange={(e) => {
                props.updateConfig(
                  (config) => (config.voice = e.currentTarget.value as Voice),
                );
              }}
            >
              {voice.map((v, i) => (
                <option value={v} key={i}>
                  {v}
                </option>
              ))}
            </Select>
          </SettingRow>
          <SettingRow
            id="voice-realtime-temperature"
            title={Locale.Settings.Realtime.Temperature.Title}
            description={Locale.Settings.Realtime.Temperature.SubTitle}
          >
            <InputRange
              aria={Locale.Settings.Realtime.Temperature.Title}
              value={props.realtimeConfig?.temperature?.toFixed(1)}
              defaultValue={DEFAULT_CONFIG.realtimeConfig.temperature}
              min="0.6"
              max="1"
              step="0.1"
              onReset={() => {
                props.updateConfig(
                  (config) =>
                    (config.temperature =
                      DEFAULT_CONFIG.realtimeConfig.temperature),
                );
              }}
              onChange={(e) => {
                props.updateConfig(
                  (config) =>
                    (config.temperature = e.currentTarget.valueAsNumber),
                );
              }}
            ></InputRange>
          </SettingRow>
        </>
      )}
    </>
  );
}
