import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ServerConfigStreamKeybindingsUpdatedEvent, ServerProvider } from "./server.ts";

const decodeServerProvider = Schema.decodeUnknownSync(ServerProvider);
const decodeKeybindingsUpdatedEvent = Schema.decodeUnknownSync(
  ServerConfigStreamKeybindingsUpdatedEvent,
);

describe("ServerProvider", () => {
  it("defaults capability arrays when decoding provider snapshots", () => {
    const parsed = decodeServerProvider({
      instanceId: "codex",
      driver: "codex",
      enabled: true,
      installed: true,
      version: "1.0.0",
      status: "ready",
      auth: {
        status: "authenticated",
      },
      checkedAt: "2026-04-10T00:00:00.000Z",
      models: [],
    });

    expect(parsed.slashCommands).toEqual([]);
    expect(parsed.skills).toEqual([]);
  });

  it("decodes continuation group metadata", () => {
    const parsed = decodeServerProvider({
      instanceId: "codex_personal",
      driver: "codex",
      continuation: { groupKey: "codex:home:/Users/julius/.codex" },
      enabled: true,
      installed: true,
      version: "1.0.0",
      status: "ready",
      auth: {
        status: "authenticated",
      },
      checkedAt: "2026-04-10T00:00:00.000Z",
      models: [],
    });

    expect(parsed.continuation?.groupKey).toBe("codex:home:/Users/julius/.codex");
  });
});

describe("ServerConfigStreamKeybindingsUpdatedEvent", () => {
  it("requires resolved keybindings in the update payload", () => {
    const parsed = decodeKeybindingsUpdatedEvent({
      version: 1,
      type: "keybindingsUpdated",
      payload: {
        keybindings: [
          {
            command: "terminal.toggle",
            shortcut: {
              key: "j",
              metaKey: false,
              ctrlKey: false,
              shiftKey: false,
              altKey: false,
              modKey: true,
            },
          },
        ],
        issues: [],
      },
    });

    expect(parsed.payload.keybindings).toHaveLength(1);
  });
});
