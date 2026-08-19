import { useEffect, useRef, useState } from "react";

import { ServiceProvider } from "../constant";
import Locale from "../locales";
import { fetchUpstreamModels } from "../utils/upstream-models";
import { ProviderConfig } from "./provider-config";
import {
  getProviderCredentialPatch,
  getProviderUpstreamSource,
  isProviderCredentialDirty,
  validateProviderDraft,
  type ProviderCredentialErrors,
  type ProviderCredentialKey,
  type ProviderCredentialPatch,
  type ProviderCredentialSnapshot,
} from "./provider-config-draft";
import styles from "./provider-config-editor.module.scss";
import { showToast } from "./ui-lib";

export type ProviderConfigEditorProps = {
  provider: ServiceProvider;
  initialValues: ProviderCredentialSnapshot;
  onSave: (patch: ProviderCredentialPatch) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export type ConnectionState =
  | { type: "idle" }
  | { type: "testing" }
  | { type: "success"; latencyMs: number; modelCount: number }
  | { type: "error"; message: string };

type EditorState = {
  provider: ServiceProvider;
  baseline: ProviderCredentialSnapshot;
  draft: ProviderCredentialSnapshot;
  errors: ProviderCredentialErrors;
  connection: ConnectionState;
  saveError?: string;
};

function copySnapshot(
  snapshot: ProviderCredentialSnapshot,
): ProviderCredentialSnapshot {
  return { ...snapshot };
}

function createEditorState(
  provider: ServiceProvider,
  initialValues: ProviderCredentialSnapshot,
): EditorState {
  const baseline = copySnapshot(initialValues);
  return {
    provider,
    baseline,
    draft: copySnapshot(baseline),
    errors: {},
    connection: { type: "idle" },
  };
}

function hasErrors(errors: ProviderCredentialErrors) {
  return Object.keys(errors).length > 0;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function connectionMessage(connection: ConnectionState) {
  switch (connection.type) {
    case "testing":
      return Locale.Settings.Status.Testing;
    case "success":
      return Locale.Settings.Status.ConnectionSuccess(
        connection.latencyMs,
        connection.modelCount,
      );
    case "error":
      return Locale.Settings.Status.ConnectionFailed(connection.message);
    default:
      return "";
  }
}

export function ProviderConfigEditor({
  provider,
  initialValues,
  onSave,
  onDirtyChange,
}: ProviderConfigEditorProps) {
  const [editor, setEditor] = useState(() =>
    createEditorState(provider, initialValues),
  );
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const dirty = isProviderCredentialDirty(
    provider,
    editor.baseline,
    editor.draft,
  );
  const testing = editor.connection.type === "testing";
  const busy = testing || saving;

  useEffect(() => {
    setEditor((current) => {
      const wasDirty = isProviderCredentialDirty(
        current.provider,
        current.baseline,
        current.draft,
      );
      if (wasDirty) {
        return current.provider === provider
          ? current
          : { ...current, provider };
      }
      return createEditorState(provider, initialValues);
    });
  }, [initialValues, provider]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const changeDraft = <K extends ProviderCredentialKey>(
    key: K,
    value: ProviderCredentialSnapshot[K],
  ) => {
    setEditor((current) => ({
      ...current,
      provider,
      draft: { ...current.draft, [key]: value },
      errors: { ...current.errors, [key]: undefined },
      connection: { type: "idle" },
      saveError: undefined,
    }));
  };

  const validate = () => {
    const errors = validateProviderDraft(provider, editor.draft);
    if (!hasErrors(errors)) return true;

    setEditor((current) => ({
      ...current,
      errors,
      connection: { type: "idle" },
      saveError: Locale.Settings.Status.ValidationFailed,
    }));
    return false;
  };

  const testConnection = async () => {
    if (busyRef.current || !validate()) return;

    busyRef.current = true;
    const startedAt = performance.now();
    setEditor((current) => ({
      ...current,
      errors: {},
      connection: { type: "testing" },
      saveError: undefined,
    }));

    try {
      const models = await fetchUpstreamModels(
        getProviderUpstreamSource(provider, editor.draft),
      );
      setEditor((current) => ({
        ...current,
        connection: {
          type: "success",
          latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
          modelCount: models.length,
        },
      }));
    } catch (error) {
      setEditor((current) => ({
        ...current,
        connection: { type: "error", message: errorMessage(error) },
      }));
    } finally {
      busyRef.current = false;
    }
  };

  const save = async () => {
    if (busyRef.current || !validate()) return;

    busyRef.current = true;
    setSaving(true);
    setEditor((current) => ({
      ...current,
      errors: {},
      saveError: undefined,
    }));

    const patch = getProviderCredentialPatch(provider, editor.draft);
    try {
      await onSave(patch);
      const savedDraft = {
        ...editor.draft,
        ...patch,
      } as ProviderCredentialSnapshot;
      setEditor((current) => ({
        ...current,
        provider,
        baseline: copySnapshot(savedDraft),
        draft: copySnapshot(savedDraft),
        errors: {},
        saveError: undefined,
      }));
      showToast(Locale.Settings.Status.SaveSuccess);
    } catch (error) {
      setEditor((current) => ({
        ...current,
        saveError: Locale.Settings.Status.SaveFailed(errorMessage(error)),
      }));
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const status = editor.saveError ?? connectionMessage(editor.connection);

  return (
    <div className={styles.editor} data-dirty={dirty ? "true" : "false"}>
      <ProviderConfig
        provider={provider}
        values={editor.draft}
        errors={editor.errors}
        onChange={changeDraft}
      />

      <div className={styles["connection-bar"]}>
        <div
          className={styles.status}
          data-state={editor.saveError ? "error" : editor.connection.type}
          aria-live="polite"
          aria-atomic="true"
        >
          {status}
        </div>
        <button
          className={styles["test-button"]}
          type="button"
          disabled={busy}
          aria-busy={testing}
          onClick={testConnection}
        >
          {testing
            ? Locale.Settings.Status.Testing
            : Locale.Settings.Status.TestConnection}
        </button>
      </div>

      {dirty && (
        <div className={styles["action-bar"]}>
          <span className={styles["dirty-label"]}>
            {Locale.Settings.Status.Unsaved}
          </span>
          <button
            className={styles["save-button"]}
            type="button"
            disabled={busy}
            aria-busy={saving}
            onClick={save}
          >
            {saving
              ? Locale.Settings.Status.Saving
              : Locale.Settings.Status.SaveChanges}
          </button>
        </div>
      )}
    </div>
  );
}
