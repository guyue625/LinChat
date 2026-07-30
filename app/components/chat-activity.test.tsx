import { act, fireEvent, render, screen } from "@testing-library/react";

import { ChatActivity } from "./chat-activity";

const tools = [
  {
    id: "search",
    function: { name: "search_docs" },
    isError: false,
  },
  {
    id: "fetch",
    function: { name: "fetch_page" },
  },
];

describe("ChatActivity", () => {
  it("keeps active tool details open and reports progress", () => {
    render(<ChatActivity running tools={tools} />);

    const toggle = screen.getByRole("button", { name: /正在调用工具/ });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("search_docs")).toBeVisible();
    expect(screen.getByText("fetch_page")).toBeVisible();
  });

  it("collapses completed tools into a summary until requested", () => {
    render(
      <ChatActivity
        tools={tools.map((tool) => ({ ...tool, isError: false }))}
      />,
    );

    const toggle = screen.getByRole("button", { name: "已调用 2 个工具" });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("search_docs")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("search_docs")).toBeVisible();
  });

  it("shows a live thinking timer without a disclosure button", () => {
    jest.useFakeTimers();
    render(<ChatActivity running tools={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent("正在思考");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("2s");
    jest.useRealTimers();
  });
});
