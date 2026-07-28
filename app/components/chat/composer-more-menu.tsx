import { useEffect, useState } from "react";
import {
  Bot as MaskIcon,
  Command as PromptIcon,
  Eraser as BreakIcon,
  History as BrainIcon,
  ImagePlus as ImageIcon,
  Keyboard as ShortcutkeyIcon,
  Plus as AddIcon,
  Settings2 as SettingsIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import LoadingButtonIcon from "../../icons/loading.svg";
import SizeIcon from "../../icons/size.svg";
import QualityIcon from "../../icons/hd.svg";
import StyleIcon from "../../icons/palette.svg";
import PluginIcon from "../../icons/plugin.svg";
import McpToolIcon from "../../icons/tool.svg";
import { useChatStore, usePluginStore } from "../../store";
import {
  getModelSizes,
  isDalle3,
  isVisionModel,
  showPlugins,
  supportsCustomSize,
  useMobileScreen,
} from "../../utils";
import { DalleQuality, DalleStyle, ModelSize } from "../../typing";
import { Path, ServiceProvider } from "../../constant";
import type { Mask } from "../../store/mask";
import { getAvailableClientsCount, isMcpEnabled } from "../../mcp/actions";
import Locale from "../../locales";
import { Selector, showToast } from "../ui-lib";
import styles from "../chat.module.scss";
import { ComposerMenuItem, ComposerToolButton } from "./composer-controls";

export function ComposerMoreMenu(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadImage: () => void;
  uploading: boolean;
  mask: Mask;
  updateMask: (updater: (mask: Mask) => void) => void;
  homeMode?: boolean;
  showPromptModal?: () => void;
  showPromptHints?: () => void;
  setShowShortcutKeyModal?: (show: boolean) => void;
}) {
  const navigate = useNavigate();
  const chatStore = useChatStore();
  const pluginStore = usePluginStore();
  const session = chatStore.currentSession();
  const currentModel = props.mask.modelConfig.model;
  const currentProviderName =
    props.mask.modelConfig.providerName || ServiceProvider.OpenAI;
  const plugins = pluginStore.getAll();
  const selectedPluginCount = props.mask.plugin?.length ?? 0;
  const modelSizes = getModelSizes(currentModel);
  const currentSize = props.mask.modelConfig.size ?? ("1024x1024" as ModelSize);
  const currentQuality = props.mask.modelConfig.quality ?? "standard";
  const currentStyle = props.mask.modelConfig.style ?? "vivid";
  const isMobileScreen = useMobileScreen();
  const [showPluginSelector, setShowPluginSelector] = useState(false);
  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [mcpState, setMcpState] = useState({ enabled: false, count: 0 });

  useEffect(() => {
    let alive = true;
    (async () => {
      const enabled = await isMcpEnabled();
      const count = enabled ? await getAvailableClientsCount() : 0;
      if (alive) setMcpState({ enabled, count });
    })();
    return () => {
      alive = false;
    };
  }, []);

  const close = () => props.onOpenChange(false);
  const toggleMemory = () => {
    props.updateMask((mask) => {
      mask.modelConfig.sendMemory = !mask.modelConfig.sendMemory;
      mask.syncGlobalConfig = false;
    });
  };
  const clearContext = () => {
    chatStore.updateTargetSession(session, (target) => {
      if (target.clearContextIndex === target.messages.length) {
        target.clearContextIndex = undefined;
      } else {
        target.clearContextIndex = target.messages.length;
        target.memoryPrompt = "";
      }
    });
    close();
  };
  const openPluginSelector = () => {
    close();
    plugins.length === 0 ? navigate(Path.Plugins) : setShowPluginSelector(true);
  };

  return (
    <div className={styles["composer-anchor"]}>
      <ComposerToolButton
        icon={<AddIcon />}
        label={Locale.ChatItem.MoreActions}
        active={props.open}
        onClick={() => props.onOpenChange(!props.open)}
      />
      {props.open && (
        <div className={styles["composer-more-menu"]}>
          {isVisionModel(currentModel) && (
            <ComposerMenuItem
              icon={props.uploading ? <LoadingButtonIcon /> : <ImageIcon />}
              label={Locale.Chat.InputActions.UploadImage}
              onClick={() => {
                close();
                props.uploadImage();
              }}
            />
          )}
          <ComposerMenuItem
            icon={<BrainIcon />}
            label={Locale.Memory.Title}
            checked={props.mask.modelConfig.sendMemory}
            onClick={toggleMemory}
          />
          {!props.homeMode && (
            <ComposerMenuItem
              icon={<PromptIcon />}
              label={Locale.Chat.InputActions.Prompt}
              onClick={() => {
                close();
                props.showPromptHints?.();
              }}
            />
          )}
          <ComposerMenuItem
            icon={<MaskIcon />}
            label={Locale.Chat.InputActions.Masks}
            onClick={() => navigate(Path.Masks)}
          />
          {showPlugins(currentProviderName, currentModel) && (
            <ComposerMenuItem
              icon={<PluginIcon />}
              label={Locale.Plugin.Name}
              trailing={
                selectedPluginCount > 0 ? (
                  <span className={styles["composer-menu-count"]}>
                    {selectedPluginCount}
                  </span>
                ) : undefined
              }
              onClick={openPluginSelector}
            />
          )}
          {mcpState.enabled && (
            <ComposerMenuItem
              icon={<McpToolIcon />}
              label={`MCP${mcpState.count ? ` (${mcpState.count})` : ""}`}
              onClick={() => navigate(Path.McpMarket)}
            />
          )}
          {(supportsCustomSize(currentModel) || isDalle3(currentModel)) && (
            <div className={styles["composer-menu-divider"]} />
          )}
          {supportsCustomSize(currentModel) && (
            <ComposerMenuItem
              icon={<SizeIcon />}
              label={currentSize}
              onClick={() => {
                close();
                setShowSizeSelector(true);
              }}
            />
          )}
          {isDalle3(currentModel) && (
            <>
              <ComposerMenuItem
                icon={<QualityIcon />}
                label={currentQuality}
                onClick={() => {
                  close();
                  setShowQualitySelector(true);
                }}
              />
              <ComposerMenuItem
                icon={<StyleIcon />}
                label={currentStyle}
                onClick={() => {
                  close();
                  setShowStyleSelector(true);
                }}
              />
            </>
          )}
          {!props.homeMode && (
            <>
              <div className={styles["composer-menu-divider"]} />
              <ComposerMenuItem
                icon={<SettingsIcon />}
                label={Locale.Chat.InputActions.Settings}
                onClick={() => {
                  close();
                  props.showPromptModal?.();
                }}
              />
              <ComposerMenuItem
                icon={<BreakIcon />}
                label={Locale.Chat.InputActions.Clear}
                onClick={clearContext}
              />
              {!isMobileScreen && (
                <ComposerMenuItem
                  icon={<ShortcutkeyIcon />}
                  label={Locale.Chat.ShortcutKey.Title}
                  onClick={() => {
                    close();
                    props.setShowShortcutKeyModal?.(true);
                  }}
                />
              )}
            </>
          )}
        </div>
      )}

      {showSizeSelector && (
        <Selector
          defaultSelectedValue={currentSize}
          items={modelSizes.map((size) => ({ title: size, value: size }))}
          onClose={() => setShowSizeSelector(false)}
          onSelection={(selection) => {
            if (selection.length === 0) return;
            const size = selection[0];
            props.updateMask((mask) => {
              mask.modelConfig.size = size;
            });
            showToast(size);
          }}
        />
      )}
      {showQualitySelector && (
        <Selector
          defaultSelectedValue={currentQuality}
          items={["standard", "hd"].map((quality) => ({
            title: quality,
            value: quality as DalleQuality,
          }))}
          onClose={() => setShowQualitySelector(false)}
          onSelection={(selection) => {
            if (selection.length === 0) return;
            const quality = selection[0];
            props.updateMask((mask) => {
              mask.modelConfig.quality = quality;
            });
            showToast(quality);
          }}
        />
      )}
      {showStyleSelector && (
        <Selector
          defaultSelectedValue={currentStyle}
          items={["vivid", "natural"].map((style) => ({
            title: style,
            value: style as DalleStyle,
          }))}
          onClose={() => setShowStyleSelector(false)}
          onSelection={(selection) => {
            if (selection.length === 0) return;
            const style = selection[0];
            props.updateMask((mask) => {
              mask.modelConfig.style = style;
            });
            showToast(style);
          }}
        />
      )}
      {showPluginSelector && (
        <Selector
          multiple
          defaultSelectedValue={props.mask.plugin}
          items={plugins.map((plugin) => ({
            title: `${plugin.title}@${plugin.version}`,
            value: plugin.id,
          }))}
          onClose={() => setShowPluginSelector(false)}
          onSelection={(selection) => {
            props.updateMask((mask) => {
              mask.plugin = selection as string[];
            });
          }}
        />
      )}
    </div>
  );
}
