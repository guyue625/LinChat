import { materializeAccountMedia } from "./account-media";

describe("cloud attachments", () => {
  beforeEach(() => (global.fetch as jest.Mock).mockReset());
  it("embeds cached attachments once and retains external URLs", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["image"], { type: "image/png" }),
    });
    const input = {
      images: [
        "/api/cache/test.png",
        "/api/cache/test.png",
        "https://example.com/p.png",
      ],
    };
    const saved = await materializeAccountMedia(input);
    expect(saved.images[0]).toBe("data:image/png;base64,aW1hZ2U=");
    expect(saved.images[1]).toBe(saved.images[0]);
    expect(saved.images[2]).toBe(input.images[2]);
    expect(input.images[0]).toBe("/api/cache/test.png");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it("does not report a missing local attachment as successfully saved", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    await expect(
      materializeAccountMedia({ audio: "/api/cache/missing.wav" }),
    ).rejects.toThrow("本地附件无法读取");
  });
});
