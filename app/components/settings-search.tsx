import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import styles from "./settings.module.scss";
import {
  searchSettingsEntries,
  type SettingsCategory,
  type SettingsSearchEntry,
  type SettingsSubpage,
} from "./settings-schema";

export type SettingsSearchProps = {
  entries: SettingsSearchEntry[];
  onSelect: (entry: SettingsSearchEntry) => void;
  placeholder?: string;
  ariaLabel?: string;
  closeLabel?: string;
  noResultsLabel?: ReactNode;
  suggestionsLabel?: ReactNode;
  groupLabel?: (
    category: SettingsCategory,
    subpage: SettingsSubpage,
  ) => ReactNode;
};

type SettingsSearchGroup = {
  key: string;
  category: SettingsCategory;
  subpage: SettingsSubpage;
  entries: Array<{ entry: SettingsSearchEntry; index: number }>;
};

const defaultGroupLabel = (
  category: SettingsCategory,
  subpage: SettingsSubpage,
) => `${category} / ${subpage}`;

export function SettingsSearch({
  entries,
  onSelect,
  placeholder = "Search settings",
  ariaLabel = "Search settings",
  closeLabel = "Close search",
  noResultsLabel = "No settings found",
  suggestionsLabel = "Suggestions",
  groupLabel = defaultGroupLabel,
}: SettingsSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const suppressOpenOnFocusRef = useRef(false);
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<string>();
  const matches = useMemo(
    () => searchSettingsEntries(entries, query),
    [entries, query],
  );
  const visibleEntries = matches.results.length
    ? matches.results
    : matches.suggestions;
  const isShowingSuggestions =
    matches.results.length === 0 && matches.suggestions.length > 0;
  const hasQuery = query.trim().length > 0;
  const showLayer = isOpen && hasQuery;
  const showListbox = showLayer && visibleEntries.length > 0;
  const visibleEntryIds = useMemo(
    () => visibleEntries.map((entry) => entry.id),
    [visibleEntries],
  );
  const activeIndex = activeEntryId
    ? visibleEntries.findIndex((entry) => entry.id === activeEntryId)
    : -1;
  const groups = useMemo(() => {
    const grouped = new Map<string, SettingsSearchGroup>();

    visibleEntries.forEach((entry, index) => {
      const key = `${entry.category}:${entry.subpage}`;
      const current = grouped.get(key);
      if (current) {
        current.entries.push({ entry, index });
        return;
      }

      grouped.set(key, {
        key,
        category: entry.category,
        subpage: entry.subpage,
        entries: [{ entry, index }],
      });
    });

    return Array.from(grouped.values());
  }, [visibleEntries]);

  useEffect(() => {
    setActiveEntryId((current) =>
      current && visibleEntryIds.includes(current)
        ? current
        : visibleEntryIds[0],
    );
  }, [visibleEntryIds]);

  useEffect(() => {
    if (!showListbox || activeIndex < 0) return;

    document
      .getElementById(`${listboxId}-option-${activeIndex}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, listboxId, showListbox]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopPropagation();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  const close = (restoreInputFocus = false) => {
    setQuery("");
    setIsOpen(false);
    setActiveEntryId(undefined);

    if (restoreInputFocus) {
      const input = inputRef.current;
      if (input && document.activeElement !== input) {
        suppressOpenOnFocusRef.current = true;
        try {
          input.focus();
        } finally {
          suppressOpenOnFocusRef.current = false;
        }
      } else {
        suppressOpenOnFocusRef.current = false;
      }
    }
  };

  const selectEntry = (entry: SettingsSearchEntry) => {
    onSelect(entry);
    close();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }

    if (!showListbox) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (activeIndex + 1) % visibleEntries.length;
      setActiveEntryId(visibleEntries[nextIndex].id);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex =
        activeIndex <= 0 ? visibleEntries.length - 1 : activeIndex - 1;
      setActiveEntryId(visibleEntries[nextIndex].id);
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectEntry(visibleEntries[activeIndex]);
    }
  };

  const handleFocusBoundary = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !isOpen) return;

    const input = inputRef.current;
    const closeButton = closeButtonRef.current;
    if (
      !input ||
      !closeButton ||
      window.getComputedStyle(closeButton).display === "none"
    ) {
      return;
    }

    if (event.shiftKey && document.activeElement === input) {
      event.preventDefault();
      closeButton.focus();
    } else if (!event.shiftKey && document.activeElement === closeButton) {
      event.preventDefault();
      input.focus();
    }
  };

  return (
    <div
      className={styles["settings-search"]}
      role="combobox"
      aria-label={ariaLabel}
      aria-controls={listboxId}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      data-settings-search=""
      data-open={isOpen ? "true" : undefined}
      onKeyDown={handleFocusBoundary}
    >
      <div className={styles["settings-search-bar"]}>
        <input
          ref={inputRef}
          type="search"
          role="searchbox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-controls={showListbox ? listboxId : undefined}
          aria-activedescendant={
            showListbox && activeIndex >= 0
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          placeholder={placeholder}
          value={query}
          className={styles["settings-search-input"]}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setActiveEntryId(undefined);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (suppressOpenOnFocusRef.current) {
              suppressOpenOnFocusRef.current = false;
              return;
            }
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          ref={closeButtonRef}
          className={styles["settings-search-close"]}
          type="button"
          aria-label={closeLabel}
          title={closeLabel}
          onClick={() => close(true)}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {showLayer && (
        <div className={styles["settings-search-layer"]}>
          {isShowingSuggestions && (
            <div className={styles["settings-search-suggestions"]}>
              {suggestionsLabel}
            </div>
          )}

          {showListbox ? (
            <div
              id={listboxId}
              className={styles["settings-search-results"]}
              role="listbox"
            >
              {groups.map((group, groupIndex) => {
                const groupLabelId = `${listboxId}-group-${groupIndex}`;
                return (
                  <div
                    key={group.key}
                    className={styles["settings-search-group"]}
                    role="group"
                    aria-labelledby={groupLabelId}
                  >
                    <div
                      id={groupLabelId}
                      className={styles["settings-search-group-label"]}
                    >
                      {groupLabel(group.category, group.subpage)}
                    </div>
                    {group.entries.map(({ entry, index }) => (
                      <button
                        key={entry.id}
                        id={`${listboxId}-option-${index}`}
                        className={styles["settings-search-option"]}
                        type="button"
                        role="option"
                        tabIndex={-1}
                        aria-selected={entry.id === activeEntryId}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectEntry(entry)}
                      >
                        <span
                          className={styles["settings-search-option-title"]}
                        >
                          {entry.title}
                        </span>
                        {entry.description && (
                          <span
                            className={
                              styles["settings-search-option-description"]
                            }
                          >
                            {entry.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles["settings-search-empty"]} role="status">
              {noResultsLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
