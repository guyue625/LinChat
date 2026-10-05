import { mergeServerChat } from "./merge-server-chat";

const message = (id: string, content: string) => ({ id, content });
const session = (messages = [message("m1", "original")]) => ({
  id: "s1",
  topic: "chat",
  messages,
});

describe("server-authoritative chat merge", () => {
  it("replaces an unchanged cache with the server, including deletions", () => {
    const base = { sessions: [session()] };
    expect(
      mergeServerChat(base, JSON.parse(JSON.stringify(base)), { sessions: [] }),
    ).toEqual({ sessions: [] });
  });

  it("preserves local deletions when another device adds a conversation", () => {
    const base = { sessions: [session()] };
    const remote = { sessions: [session(), { ...session(), id: "s2" }] };
    expect(
      mergeServerChat(base, { sessions: [] }, remote).sessions.map((s) => s.id),
    ).toEqual(["s2"]);
  });

  it("merges concurrent messages and independent edits without resurrecting deleted messages", () => {
    const base = {
      sessions: [
        session([message("m1", "original"), message("m2", "delete me")]),
      ],
    };
    const local = {
      sessions: [session([message("m1", "edited"), message("m3", "local")])],
    };
    const remote = {
      sessions: [
        {
          ...session([
            message("m1", "original"),
            message("m2", "delete me"),
            message("m4", "remote"),
          ]),
          topic: "renamed",
        },
      ],
    };
    const result = mergeServerChat(base, local, remote);
    expect(result.sessions[0].topic).toBe("renamed");
    expect(result.sessions[0].messages).toEqual([
      message("m1", "edited"),
      message("m4", "remote"),
      message("m3", "local"),
    ]);
    expect(base.sessions[0].messages).toHaveLength(2);
  });
});
