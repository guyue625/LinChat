import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { SettingsSearch } from "./settings-search";
import type { SettingsSearchEntry } from "./settings-schema";

const entries = [
  {
    id: "provider-openai-api-key",
    category: "model",
    subpage: "model-providers",
    title: "API Key",
    description: "OpenAI interface credential",
    keywords: ["credential", "openai", "shared"],
  },
  {
    id: "appearance-theme",
    category: "appearance",
    subpage: "appearance",
    title: "Theme",
    description: "Choose a light or dark theme",
    keywords: ["appearance", "dark", "light", "shared"],
  },
] satisfies SettingsSearchEntry[];

const defaultProps = {
  entries,
  placeholder: "Search settings",
  ariaLabel: "Search settings",
  closeLabel: "Close search",
  noResultsLabel: "No settings found",
  suggestionsLabel: "Suggestions",
};

const longEntries = Array.from({ length: 12 }, (_, index) => ({
  id: `general-item-${index}`,
  category: "general" as const,
  subpage: "general" as const,
  title: `General item ${index}`,
  description: `General setting ${index}`,
  keywords: ["common"],
}));

describe("SettingsSearch", () => {
  it("groups results and returns the selected target", () => {
    const onSelect = jest.fn();
    render(
      <SettingsSearch
        {...defaultProps}
        onSelect={onSelect}
        groupLabel={(category, subpage) => `${category}:${subpage}`}
      />,
    );
    const searchbox = screen.getByRole("searchbox", {
      name: "Search settings",
    });
    const search = searchbox.closest("[data-settings-search]");

    fireEvent.change(searchbox, { target: { value: "API Key" } });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("model:model-providers")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /API Key/ }));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "provider-openai-api-key" }),
    );
    expect(search).not.toHaveAttribute("data-open");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps the results layer hidden for an empty query", () => {
    render(<SettingsSearch {...defaultProps} onSelect={jest.fn()} />);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText("No settings found")).not.toBeInTheDocument();
  });

  it("shows loose suggestions when there are no strict results", () => {
    const onSelect = jest.fn();
    render(<SettingsSearch {...defaultProps} onSelect={onSelect} />);

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search settings" }),
      {
        target: { value: "tme" },
      },
    );

    expect(screen.getByText("Suggestions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /Theme/ }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "appearance-theme" }),
    );
  });

  it("uses the injected no-results label when nothing matches", () => {
    render(<SettingsSearch {...defaultProps} onSelect={jest.fn()} />);

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search settings" }),
      {
        target: { value: "unfindable-value" },
      },
    );

    expect(screen.getByRole("status")).toHaveTextContent("No settings found");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes the results with Escape without selecting", () => {
    const onSelect = jest.fn();
    render(<SettingsSearch {...defaultProps} onSelect={onSelect} />);
    const searchbox = screen.getByRole("searchbox", {
      name: "Search settings",
    });

    fireEvent.change(searchbox, { target: { value: "API Key" } });
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    const settingsExitListener = jest.fn();
    document.addEventListener("keydown", settingsExitListener);
    try {
      fireEvent.keyDown(searchbox, { key: "Escape" });
    } finally {
      document.removeEventListener("keydown", settingsExitListener);
    }

    expect(searchbox).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    expect(settingsExitListener).not.toHaveBeenCalled();
  });

  it("exposes its open state on focus and clears it with Escape", () => {
    render(<SettingsSearch {...defaultProps} onSelect={jest.fn()} />);
    const searchbox = screen.getByRole("searchbox", {
      name: "Search settings",
    });
    const search = searchbox.closest("[data-settings-search]");

    fireEvent.focus(searchbox);
    expect(search).toHaveAttribute("role", "combobox");
    expect(search).toHaveAttribute("aria-expanded", "true");
    expect(search).toHaveAttribute("data-open", "true");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.keyDown(searchbox, { key: "Escape" });
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(search).not.toHaveAttribute("data-open");
  });

  it("closes from the mobile close control without selecting", () => {
    const onSelect = jest.fn();
    render(<SettingsSearch {...defaultProps} onSelect={onSelect} />);
    const searchbox = screen.getByRole("searchbox", {
      name: "Search settings",
    });
    const search = searchbox.closest("[data-settings-search]");

    fireEvent.change(searchbox, { target: { value: "API Key" } });
    expect(search).toHaveAttribute("data-open", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "Close search" });
    closeButton.focus();
    expect(closeButton).toHaveFocus();
    fireEvent.click(closeButton);

    expect(search).not.toHaveAttribute("data-open");
    expect(searchbox).toHaveValue("");
    expect(searchbox).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not consume the next real focus when programmatic close keeps the input focused", () => {
    render(
      <>
        <button type="button">Outside</button>
        <SettingsSearch {...defaultProps} onSelect={jest.fn()} />
      </>,
    );
    const outside = screen.getByRole("button", { name: "Outside" });
    const searchbox = screen.getByRole("searchbox", {
      name: "Search settings",
    });
    const search = searchbox.closest("[data-settings-search]");
    const closeButton = screen.getByRole("button", {
      name: "Close search",
    });

    act(() => searchbox.focus());
    expect(search).toHaveAttribute("data-open", "true");
    expect(searchbox).toHaveFocus();

    fireEvent.click(closeButton);
    expect(search).not.toHaveAttribute("data-open");
    expect(searchbox).toHaveFocus();

    act(() => outside.focus());
    act(() => searchbox.focus());
    expect(search).toHaveAttribute("data-open", "true");
  });

  it("keeps focus within the open mobile search controls", () => {
    render(<SettingsSearch {...defaultProps} onSelect={jest.fn()} />);
    const searchbox = screen.getByRole("searchbox", {
      name: "Search settings",
    });
    const closeButton = screen.getByRole("button", {
      name: "Close search",
    });
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    const getComputedStyle = jest
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element) => {
        const style = originalGetComputedStyle(element);
        if (element === closeButton) {
          Object.defineProperty(style, "display", {
            configurable: true,
            value: "grid",
          });
        }
        return style;
      });
    try {
      act(() => searchbox.focus());
      fireEvent.keyDown(searchbox, { key: "Tab", shiftKey: true });
      expect(closeButton).toHaveFocus();

      fireEvent.keyDown(closeButton, { key: "Tab" });
      expect(searchbox).toHaveFocus();
    } finally {
      getComputedStyle.mockRestore();
    }
  });

  it("focuses the searchbox for Ctrl+K and Meta+K", () => {
    render(
      <>
        <button type="button">Outside</button>
        <SettingsSearch {...defaultProps} onSelect={jest.fn()} />
      </>,
    );
    const outside = screen.getByRole("button", { name: "Outside" });
    const searchbox = screen.getByRole("searchbox", {
      name: "Search settings",
    });

    outside.focus();
    const ctrlShortcut = createEvent.keyDown(document, {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(document, ctrlShortcut);
    expect(ctrlShortcut.defaultPrevented).toBe(true);
    expect(searchbox).toHaveFocus();

    outside.focus();
    const metaShortcut = createEvent.keyDown(document, {
      key: "K",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(document, metaShortcut);
    expect(metaShortcut.defaultPrevented).toBe(true);
    expect(searchbox).toHaveFocus();
  });

  it("stops Ctrl+K before a global window shortcut can handle it", () => {
    const windowShortcut = jest.fn();
    window.addEventListener("keydown", windowShortcut);
    try {
      render(<SettingsSearch {...defaultProps} onSelect={jest.fn()} />);
      const shortcut = createEvent.keyDown(document, {
        key: "k",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      fireEvent(document, shortcut);

      expect(shortcut.defaultPrevented).toBe(true);
      expect(windowShortcut).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", windowShortcut);
    }
  });

  it("moves the active option with arrows and selects it with Enter", () => {
    const onSelect = jest.fn();
    render(<SettingsSearch {...defaultProps} onSelect={onSelect} />);
    const searchbox = screen.getByRole("searchbox", {
      name: "Search settings",
    });

    fireEvent.change(searchbox, { target: { value: "shared" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options.every((option) => option.tabIndex === -1)).toBe(true);
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(searchbox, { key: "ArrowDown" });
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(searchbox, { key: "ArrowUp" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(searchbox, { key: "ArrowDown" });
    fireEvent.keyDown(searchbox, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(entries[1]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("scrolls the active option into view while navigating a long list", () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = jest.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      render(
        <SettingsSearch
          {...defaultProps}
          entries={longEntries}
          onSelect={jest.fn()}
        />,
      );
      const searchbox = screen.getByRole("searchbox", {
        name: "Search settings",
      });

      fireEvent.change(searchbox, { target: { value: "common" } });
      scrollIntoView.mockClear();
      for (let index = 0; index < 10; index += 1) {
        fireEvent.keyDown(searchbox, { key: "ArrowDown" });
      }

      expect(
        screen.getByRole("option", { name: /General item 10/ }),
      ).toHaveAttribute("aria-selected", "true");
      expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest" });
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
          configurable: true,
          value: originalScrollIntoView,
        });
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    }
  });

  it("keeps the active entry stable when equal-length results reorder", () => {
    const onSelect = jest.fn();
    const { rerender } = render(
      <SettingsSearch {...defaultProps} onSelect={onSelect} />,
    );
    const searchbox = screen.getByRole("searchbox", {
      name: "Search settings",
    });

    fireEvent.change(searchbox, { target: { value: "shared" } });
    fireEvent.keyDown(searchbox, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /Theme/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    rerender(
      <SettingsSearch
        {...defaultProps}
        entries={[...entries].reverse()}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("option", { name: /Theme/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(searchbox, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(entries[1]);
  });

  it("renders results in category and subpage groups", () => {
    render(
      <SettingsSearch
        {...defaultProps}
        onSelect={jest.fn()}
        groupLabel={(category, subpage) => `${category}:${subpage}`}
      />,
    );

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search settings" }),
      {
        target: { value: "shared" },
      },
    );

    expect(
      screen.getByRole("group", { name: "model:model-providers" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "appearance:appearance" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /API Key/ })).toHaveTextContent(
      "OpenAI interface credential",
    );
  });

  it("removes its global shortcut listener on unmount", () => {
    const { unmount } = render(
      <SettingsSearch {...defaultProps} onSelect={jest.fn()} />,
    );
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();

    unmount();
    const shortcut = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(shortcut);

    expect(shortcut.defaultPrevented).toBe(false);
    expect(outside).toHaveFocus();
    outside.remove();
  });
});
