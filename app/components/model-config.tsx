import { ServiceProvider } from "@/app/constant";
import {
  DEFAULT_CONFIG,
  ModalConfigValidator,
  ModelConfig,
  useAccessStore,
} from "../store";

import Locale from "../locales";
import { InputRange } from "./input-range";
import { Select } from "./ui-lib";
import { SettingRow, SettingSwitch } from "./settings-controls";
import { useAllModels } from "../utils/hooks";
import { groupBy } from "lodash-es";
import styles from "./model-config.module.scss";
import { filterModelsByProviders, getModelProvider } from "../utils/model";
import { useEffect } from "react";
import { useAccount } from "./account-context";
import { shouldExposeModelWorkspace } from "../utils/account-workspace";

export function ModelConfigList(props: {
  modelConfig: ModelConfig;
  updateConfig: (updater: (config: ModelConfig) => void) => void;
}) {
  const { modelConfig, updateConfig } = props;
  const allModels = useAllModels();
  const { enabled, loading, modelWorkspaceReady, user } = useAccount();
  const showModels = shouldExposeModelWorkspace({
    enabled,
    loading,
    modelWorkspaceReady,
    user,
  });
  const accessStore = useAccessStore();
  // Offer models from every provider that has usable credentials; fall back
  // to the single global provider switch when none are configured locally.
  const configuredProviders = accessStore.useCustomConfig
    ? accessStore.configuredProviders()
    : [];
  const selectedProviders = !accessStore.useCustomConfig
    ? undefined
    : configuredProviders.length > 0
    ? configuredProviders
    : [accessStore.provider];
  const selectableModels = filterModelsByProviders(
    allModels,
    selectedProviders,
  );
  const groupModels = groupBy(selectableModels, "provider.providerName");
  const value = `${modelConfig.model}@${modelConfig?.providerName}`;
  const compressModelValue = `${modelConfig.compressModel}@${modelConfig?.compressProviderName}`;

  useEffect(() => {
    if (!showModels) return;
    const nextModel = selectableModels[0];
    const hasCurrentModel = selectableModels.some(
      (model) =>
        model.name === modelConfig.model &&
        model.provider?.providerName === modelConfig.providerName,
    );
    const hasCurrentCompressModel =
      !modelConfig.compressModel ||
      selectableModels.some(
        (model) =>
          model.name === modelConfig.compressModel &&
          model.provider?.providerName === modelConfig.compressProviderName,
      );

    if (!nextModel) {
      if (!modelConfig.model && !modelConfig.compressModel) return;
      updateConfig((config) => {
        config.model = "";
        config.providerName = "" as ServiceProvider;
        config.compressModel = "";
        config.compressProviderName = "";
      });
      return;
    }

    if (hasCurrentModel && hasCurrentCompressModel) return;

    updateConfig((config) => {
      if (!hasCurrentModel) {
        config.model = ModalConfigValidator.model(nextModel.name);
        config.providerName = nextModel.provider
          ?.providerName as ServiceProvider;
      }
      if (!hasCurrentCompressModel) {
        config.compressModel = ModalConfigValidator.model(nextModel.name);
        config.compressProviderName = nextModel.provider
          ?.providerName as ServiceProvider;
      }
    });
  }, [
    modelConfig.compressModel,
    modelConfig.compressProviderName,
    modelConfig.model,
    modelConfig.providerName,
    showModels,
    updateConfig,
    selectableModels,
  ]);

  if (!showModels) return null;

  return (
    <>
      <SettingRow id="model-default" title={Locale.Settings.Model}>
        <Select
          aria-label={Locale.Settings.Model}
          value={value}
          align="left"
          onChange={(e) => {
            const [model, providerName] = getModelProvider(
              e.currentTarget.value,
            );
            props.updateConfig((config) => {
              config.model = ModalConfigValidator.model(model);
              config.providerName = providerName as ServiceProvider;
            });
          }}
        >
          {Object.keys(groupModels).map((providerName, index) => (
            <optgroup label={providerName} key={index}>
              {groupModels[providerName].map((v, i) => (
                <option value={`${v.name}@${v.provider?.providerName}`} key={i}>
                  {v.displayName}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </SettingRow>
      <SettingRow
        id="model-temperature"
        title={Locale.Settings.Temperature.Title}
        description={Locale.Settings.Temperature.SubTitle}
      >
        <InputRange
          aria={Locale.Settings.Temperature.Title}
          value={props.modelConfig.temperature?.toFixed(1)}
          defaultValue={DEFAULT_CONFIG.modelConfig.temperature}
          min="0"
          max="1" // lets limit it to 0-1
          step="0.1"
          onReset={() => {
            props.updateConfig(
              (config) =>
                (config.temperature = DEFAULT_CONFIG.modelConfig.temperature),
            );
          }}
          onChange={(e) => {
            props.updateConfig(
              (config) =>
                (config.temperature = ModalConfigValidator.temperature(
                  e.currentTarget.valueAsNumber,
                )),
            );
          }}
        ></InputRange>
      </SettingRow>
      <SettingRow
        id="model-top-p"
        title={Locale.Settings.TopP.Title}
        description={Locale.Settings.TopP.SubTitle}
      >
        <InputRange
          aria={Locale.Settings.TopP.Title}
          value={(
            props.modelConfig.top_p ?? DEFAULT_CONFIG.modelConfig.top_p
          ).toFixed(1)}
          defaultValue={DEFAULT_CONFIG.modelConfig.top_p}
          min="0"
          max="1"
          step="0.1"
          onReset={() => {
            props.updateConfig(
              (config) => (config.top_p = DEFAULT_CONFIG.modelConfig.top_p),
            );
          }}
          onChange={(e) => {
            props.updateConfig(
              (config) =>
                (config.top_p = ModalConfigValidator.top_p(
                  e.currentTarget.valueAsNumber,
                )),
            );
          }}
        ></InputRange>
      </SettingRow>
      <SettingRow
        id="model-max-tokens"
        title={Locale.Settings.MaxTokens.Title}
        description={Locale.Settings.MaxTokens.SubTitle}
      >
        <input
          aria-label={Locale.Settings.MaxTokens.Title}
          type="number"
          min={1024}
          max={512000}
          value={props.modelConfig.max_tokens}
          onChange={(e) =>
            props.updateConfig(
              (config) =>
                (config.max_tokens = ModalConfigValidator.max_tokens(
                  e.currentTarget.valueAsNumber,
                )),
            )
          }
        ></input>
      </SettingRow>

      {props.modelConfig?.providerName == ServiceProvider.Google ? null : (
        <>
          <SettingRow
            id="model-presence-penalty"
            title={Locale.Settings.PresencePenalty.Title}
            description={Locale.Settings.PresencePenalty.SubTitle}
          >
            <InputRange
              aria={Locale.Settings.PresencePenalty.Title}
              value={props.modelConfig.presence_penalty?.toFixed(1)}
              defaultValue={DEFAULT_CONFIG.modelConfig.presence_penalty}
              min="-2"
              max="2"
              step="0.1"
              onReset={() => {
                props.updateConfig(
                  (config) =>
                    (config.presence_penalty =
                      DEFAULT_CONFIG.modelConfig.presence_penalty),
                );
              }}
              onChange={(e) => {
                props.updateConfig(
                  (config) =>
                    (config.presence_penalty =
                      ModalConfigValidator.presence_penalty(
                        e.currentTarget.valueAsNumber,
                      )),
                );
              }}
            ></InputRange>
          </SettingRow>

          <SettingRow
            id="model-frequency-penalty"
            title={Locale.Settings.FrequencyPenalty.Title}
            description={Locale.Settings.FrequencyPenalty.SubTitle}
          >
            <InputRange
              aria={Locale.Settings.FrequencyPenalty.Title}
              value={props.modelConfig.frequency_penalty?.toFixed(1)}
              defaultValue={DEFAULT_CONFIG.modelConfig.frequency_penalty}
              min="-2"
              max="2"
              step="0.1"
              onReset={() => {
                props.updateConfig(
                  (config) =>
                    (config.frequency_penalty =
                      DEFAULT_CONFIG.modelConfig.frequency_penalty),
                );
              }}
              onChange={(e) => {
                props.updateConfig(
                  (config) =>
                    (config.frequency_penalty =
                      ModalConfigValidator.frequency_penalty(
                        e.currentTarget.valueAsNumber,
                      )),
                );
              }}
            ></InputRange>
          </SettingRow>

          <SettingRow
            id="model-system-prompt"
            title={Locale.Settings.InjectSystemPrompts.Title}
            description={Locale.Settings.InjectSystemPrompts.SubTitle}
          >
            <SettingSwitch
              label={Locale.Settings.InjectSystemPrompts.Title}
              checked={props.modelConfig.enableInjectSystemPrompts}
              onChange={(checked) =>
                props.updateConfig(
                  (config) => (config.enableInjectSystemPrompts = checked),
                )
              }
            />
          </SettingRow>

          <SettingRow
            id="model-input-template"
            title={Locale.Settings.InputTemplate.Title}
            description={Locale.Settings.InputTemplate.SubTitle}
          >
            <input
              aria-label={Locale.Settings.InputTemplate.Title}
              type="text"
              value={props.modelConfig.template}
              onChange={(e) =>
                props.updateConfig(
                  (config) => (config.template = e.currentTarget.value),
                )
              }
            ></input>
          </SettingRow>
        </>
      )}
      <SettingRow
        id="model-history-count"
        title={Locale.Settings.HistoryCount.Title}
        description={Locale.Settings.HistoryCount.SubTitle}
      >
        <InputRange
          aria={Locale.Settings.HistoryCount.Title}
          title={props.modelConfig.historyMessageCount.toString()}
          value={props.modelConfig.historyMessageCount}
          defaultValue={DEFAULT_CONFIG.modelConfig.historyMessageCount}
          min="0"
          max="64"
          step="1"
          onReset={() => {
            props.updateConfig(
              (config) =>
                (config.historyMessageCount =
                  DEFAULT_CONFIG.modelConfig.historyMessageCount),
            );
          }}
          onChange={(e) =>
            props.updateConfig(
              (config) => (config.historyMessageCount = e.target.valueAsNumber),
            )
          }
        ></InputRange>
      </SettingRow>

      <SettingRow
        id="model-compress-threshold"
        title={Locale.Settings.CompressThreshold.Title}
        description={Locale.Settings.CompressThreshold.SubTitle}
      >
        <input
          aria-label={Locale.Settings.CompressThreshold.Title}
          type="number"
          min={500}
          max={4000}
          value={props.modelConfig.compressMessageLengthThreshold}
          onChange={(e) =>
            props.updateConfig(
              (config) =>
                (config.compressMessageLengthThreshold =
                  e.currentTarget.valueAsNumber),
            )
          }
        ></input>
      </SettingRow>
      <SettingRow
        id="model-memory"
        title={Locale.Memory.Title}
        description={Locale.Memory.Send}
      >
        <SettingSwitch
          label={Locale.Memory.Title}
          checked={props.modelConfig.sendMemory}
          onChange={(checked) =>
            props.updateConfig((config) => (config.sendMemory = checked))
          }
        />
      </SettingRow>
      <SettingRow
        id="model-compress-model"
        title={Locale.Settings.CompressModel.Title}
        description={Locale.Settings.CompressModel.SubTitle}
      >
        <Select
          className={styles["select-compress-model"]}
          aria-label={Locale.Settings.CompressModel.Title}
          value={compressModelValue}
          onChange={(e) => {
            const [model, providerName] = getModelProvider(
              e.currentTarget.value,
            );
            props.updateConfig((config) => {
              config.compressModel = ModalConfigValidator.model(model);
              config.compressProviderName = providerName as ServiceProvider;
            });
          }}
        >
          {selectableModels.map((v, i) => (
            <option value={`${v.name}@${v.provider?.providerName}`} key={i}>
              {v.displayName}({v.provider?.providerName})
            </option>
          ))}
        </Select>
      </SettingRow>
    </>
  );
}
