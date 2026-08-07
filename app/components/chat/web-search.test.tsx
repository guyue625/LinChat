import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("../../locales", () => ({
  __esModule: true,
  default: {
    Chat: {
      WebSearch: {
        Enabled: "联网搜索：已开启",
        Disabled: "联网搜索：已关闭",
        Sources: "来源",
      },
    },
  },
}));

import { WebSearchSources, WebSearchToggle } from "./web-search";

describe("chat web search UI", () => {
  it("shows and toggles the per-session search state", () => {
    const onChange = jest.fn();
    render(<WebSearchToggle enabled={true} onChange={onChange} />);
    const button = screen.getByRole("button", { name: "联网搜索：已开启" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("renders safe source links", () => {
    render(
      <WebSearchSources
        results={[
          {
            title: "Next.js",
            url: "https://nextjs.org",
            snippet: "React framework",
          },
        ]}
      />,
    );
    const link = screen.getByRole("link", { name: /Next\.js/ });
    expect(link).toHaveAttribute("href", "https://nextjs.org");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
