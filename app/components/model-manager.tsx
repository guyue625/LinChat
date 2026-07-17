import { useEffect, useMemo, useState } from "react";

import { ServiceProvider } from "../constant";
import { useAccessStore } from "../store";
import {
  addCustomModel,
  getCustomModelsForProvider,
  mergeCustomModels,
  removeCustomModelAt,
  updateCustomModelAt,
} from "../utils/custom-models";
import {
  fetchUpstreamModels,
  UpstreamModelSource,
} from "../utils/upstream-models";
import Locale from "../locales";
import AddIcon from "../icons/add.svg";
import CloseIcon from "../icons/close.svg";
import ConfirmIcon from "../icons/confirm.svg";
import DeleteIcon from "../icons/delete.svg";
import EditIcon from "../icons/edit.svg";
import LoadingIcon from "../icons/three-dots.svg";
import ResetIcon from "../icons/reload.svg";
import { IconButton } from "./button";
import { ListItem, showToast } from "./ui-lib";
import styles from "./model-manager.module.scss";

type AccessState = ReturnType<typeof useAccessStore.getState>;

function getUpstreamSource(access: AccessState): UpstreamModelSource {
  const common = { provider: access.provider };

  switch (access.provider) {
    case ServiceProvider.Azure:
      return {
        ...common,
        baseUrl: access.azureUrl,
        apiKey: access.azureApiKey,
        apiVersion: access.azureApiVersion,
      };
    case ServiceProvider.Google:
      return {
        ...common,
        baseUrl: access.googleUrl,
        apiKey: access.googleApiKey,
        apiVersion: access.googleApiVersion,
      };
    case ServiceProvider.Anthropic:
      return {
        ...common,
        baseUrl: access.anthropicUrl,
        apiKey: access.anthropicApiKey,
        apiVersion: access.anthropicApiVersion,
      };
    case ServiceProvider.Baidu:
      return {
        ...common,
        baseUrl: access.baiduUrl,
        apiKey: access.baiduApiKey,
      };
    case ServiceProvider.ByteDance:
      return {
        ...common,
        baseUrl: access.bytedanceUrl,
        apiKey: access.bytedanceApiKey,
      };
    case ServiceProvider.Alibaba:
      return {
        ...common,
        baseUrl: access.alibabaUrl,
        apiKey: access.alibabaApiKey,
      };
    case ServiceProvider.Tencent:
      return {
        ...common,
        baseUrl: access.tencentUrl,
        apiKey: access.tencentSecretId,
      };
    case ServiceProvider.Moonshot:
      return {
        ...common,
        baseUrl: access.moonshotUrl,
        apiKey: access.moonshotApiKey,
      };
    case ServiceProvider.Stability:
      return {
        ...common,
        baseUrl: access.stabilityUrl,
        apiKey: access.stabilityApiKey,
      };
    case ServiceProvider.Iflytek:
      return {
        ...common,
        baseUrl: access.iflytekUrl,
        apiKey: access.iflytekApiKey,
      };
    case ServiceProvider.DeepSeek:
      return {
        ...common,
        baseUrl: access.deepseekUrl,
        apiKey: access.deepseekApiKey,
      };
    case ServiceProvider.XAI:
      return {
        ...common,
        baseUrl: access.xaiUrl,
        apiKey: access.xaiApiKey,
      };
    case ServiceProvider.ChatGLM:
      return {
        ...common,
        baseUrl: access.chatglmUrl,
        apiKey: access.chatglmApiKey,
      };
    case ServiceProvider.SiliconFlow:
      return {
        ...common,
        baseUrl: access.siliconflowUrl,
        apiKey: access.siliconflowApiKey,
      };
    case ServiceProvider["302.AI"]:
      return {
        ...common,
        baseUrl: access.ai302Url,
        apiKey: access.ai302ApiKey,
      };
    default:
      return {
        ...common,
        baseUrl: access.openaiUrl,
        apiKey: access.openaiApiKey,
      };
  }
}

export function ModelManager(props: {
  customModels: string;
  onChange: (customModels: string) => void;
}) {
  const accessStore = useAccessStore();
  const provider = accessStore.provider;
  const [draftName, setDraftName] = useState("");
  const [draftAlias, setDraftAlias] = useState("");
  const [fetching, setFetching] = useState(false);
  const [editing, setEditing] = useState<{
    tokenIndex: number;
    name: string;
    alias: string;
  }>();
  const models = useMemo(
    () => getCustomModelsForProvider(props.customModels, provider),
    [props.customModels, provider],
  );
  const canAdd =
    !!draftName.trim() && !/[,=]/.test(draftName) && !draftAlias.includes(",");
  const canSave =
    !!editing?.name.trim() &&
    !/[,=]/.test(editing.name) &&
    !editing.alias.includes(",");

  useEffect(() => {
    setDraftName("");
    setDraftAlias("");
    setEditing(undefined);
  }, [provider]);

  const addModel = () => {
    if (!canAdd) {
      showToast(Locale.Settings.Access.CustomModel.Invalid);
      return;
    }
    props.onChange(
      addCustomModel(props.customModels, provider, draftName, draftAlias),
    );
    setDraftName("");
    setDraftAlias("");
  };

  const saveModel = () => {
    if (!editing || !canSave) {
      showToast(Locale.Settings.Access.CustomModel.Invalid);
      return;
    }
    props.onChange(
      updateCustomModelAt(
        props.customModels,
        editing.tokenIndex,
        provider,
        editing.name,
        editing.alias,
      ),
    );
    setEditing(undefined);
  };

  const fetchModels = async () => {
    setFetching(true);
    try {
      const upstreamModels = await fetchUpstreamModels(
        getUpstreamSource(accessStore),
      );
      if (upstreamModels.length === 0) {
        throw new Error(Locale.Settings.Access.CustomModel.EmptyResponse);
      }
      props.onChange(
        mergeCustomModels(props.customModels, provider, upstreamModels),
      );
      showToast(
        Locale.Settings.Access.CustomModel.FetchSuccess(upstreamModels.length),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      showToast(Locale.Settings.Access.CustomModel.FetchFailed(reason));
    } finally {
      setFetching(false);
    }
  };

  return (
    <>
      <ListItem
        title={Locale.Settings.Access.CustomModel.Title}
        subTitle={
          <div className={styles.meta}>
            <span className={styles.providerBadge}>{provider}</span>
            <span>
              {Locale.Settings.Access.CustomModel.ModelCount(models.length)}
            </span>
          </div>
        }
      >
        <IconButton
          className={styles.fetchButton}
          icon={fetching ? <LoadingIcon /> : <ResetIcon />}
          text={
            fetching
              ? Locale.Settings.Access.CustomModel.Fetching
              : Locale.Settings.Access.CustomModel.Fetch
          }
          bordered
          disabled={fetching}
          onClick={fetchModels}
        />
      </ListItem>

      <ListItem
        title={Locale.Settings.Access.CustomModel.Name}
        subTitle={Locale.Settings.Access.CustomModel.NameHelp}
      >
        <input
          className={styles.input}
          aria-label={Locale.Settings.Access.CustomModel.Name}
          value={draftName}
          placeholder={Locale.Settings.Access.CustomModel.NamePlaceholder}
          onChange={(event) => setDraftName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addModel();
          }}
        />
      </ListItem>

      <ListItem
        title={Locale.Settings.Access.CustomModel.AliasOptional}
        subTitle={Locale.Settings.Access.CustomModel.AliasHelp}
      >
        <div className={styles.addActions}>
          <input
            className={styles.input}
            aria-label={Locale.Settings.Access.CustomModel.Alias}
            value={draftAlias}
            placeholder={Locale.Settings.Access.CustomModel.AliasPlaceholder}
            onChange={(event) => setDraftAlias(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addModel();
            }}
          />
          <IconButton
            className={styles.addButton}
            icon={<AddIcon />}
            text={Locale.Settings.Access.CustomModel.Add}
            type="primary"
            disabled={!canAdd}
            onClick={addModel}
          />
        </div>
      </ListItem>

      {models.map((model, index) =>
        editing?.tokenIndex === model.tokenIndex ? (
          <ListItem
            className={styles.modelItem}
            key={model.tokenIndex}
            title={`${provider} · ${index + 1}`}
            subTitle={Locale.Settings.Access.CustomModel.Edit}
          >
            <div className={styles.editActions}>
              <input
                className={styles.editInput}
                aria-label={Locale.Settings.Access.CustomModel.Name}
                value={editing.name}
                placeholder={Locale.Settings.Access.CustomModel.Name}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    name: event.currentTarget.value,
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveModel();
                }}
              />
              <input
                className={styles.editInput}
                aria-label={Locale.Settings.Access.CustomModel.Alias}
                value={editing.alias}
                placeholder={Locale.Settings.Access.CustomModel.AliasOptional}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    alias: event.currentTarget.value,
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveModel();
                }}
              />
              <IconButton
                className={styles.saveButton}
                icon={<ConfirmIcon />}
                aria={Locale.Settings.Access.CustomModel.Save}
                title={Locale.Settings.Access.CustomModel.Save}
                type="primary"
                disabled={!canSave}
                onClick={saveModel}
              />
              <IconButton
                className={styles.actionButton}
                icon={<CloseIcon />}
                aria={Locale.Settings.Access.CustomModel.Cancel}
                title={Locale.Settings.Access.CustomModel.Cancel}
                bordered
                onClick={() => setEditing(undefined)}
              />
            </div>
          </ListItem>
        ) : (
          <ListItem
            className={styles.modelItem}
            key={model.tokenIndex}
            title={model.alias || model.name}
            subTitle={model.alias ? model.name : provider}
          >
            <div className={styles.rowActions}>
              <IconButton
                className={styles.actionButton}
                icon={<EditIcon />}
                aria={Locale.Settings.Access.CustomModel.Edit}
                title={Locale.Settings.Access.CustomModel.Edit}
                onClick={() =>
                  setEditing({
                    tokenIndex: model.tokenIndex,
                    name: model.name,
                    alias: model.alias,
                  })
                }
              />
              <IconButton
                className={styles.deleteButton}
                icon={<DeleteIcon />}
                aria={Locale.Settings.Access.CustomModel.Remove}
                title={Locale.Settings.Access.CustomModel.Remove}
                onClick={() =>
                  props.onChange(
                    removeCustomModelAt(props.customModels, model.tokenIndex),
                  )
                }
              />
            </div>
          </ListItem>
        ),
      )}
    </>
  );
}
