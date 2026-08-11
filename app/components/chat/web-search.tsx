import { Globe2 as WebSearchIcon } from "lucide-react";
import type { WebSearchResult } from "../../typing";
import Locale from "../../locales";
import styles from "../chat.module.scss";
import { ComposerToolButton } from "./composer-controls";

export function WebSearchToggle(props: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const label = props.enabled
    ? Locale.Chat.WebSearch.Enabled
    : Locale.Chat.WebSearch.Disabled;
  return (
    <ComposerToolButton
      icon={<WebSearchIcon />}
      label={label}
      active={props.enabled}
      pressed={props.enabled}
      onClick={() => props.onChange(!props.enabled)}
    >
      {props.enabled
        ? Locale.Chat.WebSearch.ActiveLabel
        : Locale.Chat.WebSearch.Label}
    </ComposerToolButton>
  );
}

export function WebSearchSources(props: { results: WebSearchResult[] }) {
  if (props.results.length === 0) return null;
  return (
    <aside className={styles["web-search-sources"]}>
      <div className={styles["web-search-sources-title"]}>
        {Locale.Chat.WebSearch.Sources}
      </div>
      <div className={styles["web-search-source-list"]}>
        {props.results.map((result, index) => (
          <a
            key={`${result.url}-${index}`}
            className={styles["web-search-source"]}
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            title={result.snippet}
          >
            <span>{index + 1}</span>
            {result.title}
          </a>
        ))}
      </div>
    </aside>
  );
}
