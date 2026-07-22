import { render, screen, waitFor } from "@testing-library/react";
import { jest } from "@jest/globals";
import { MemoryRouter } from "react-router-dom";

import { AccountDock } from "./account-dock";
import { AccountProvider } from "./account-context";

describe("AccountDock", () => {
  const fetchSpy = jest.spyOn(global, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  test("hides interface settings for an unauthenticated account", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, user: null }),
    } as Response);

    render(
      <MemoryRouter>
        <AccountProvider>
          <AccountDock
            shouldNarrow={false}
            isDarkTheme={true}
            onSettings={jest.fn()}
            onToggleTheme={jest.fn()}
          />
        </AccountProvider>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByTitle("登录或注册")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("group", { name: "界面设置" }),
    ).not.toBeInTheDocument();
  });
});
