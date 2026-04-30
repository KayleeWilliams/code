import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  ClientSettingsPatch,
  ClientSettingsSchema,
  DEFAULT_CLIENT_SETTINGS,
  DEFAULT_SERVER_SETTINGS,
  ServerSettings,
  ServerSettingsPatch,
} from "./settings.ts";

describe("settings defaults", () => {
  it("decodes appearance defaults", () => {
    expect(DEFAULT_CLIENT_SETTINGS.appearance).toEqual({
      accent: "neutral",
      font: "default",
      customFontFamily: "",
    });
    expect(Schema.decodeUnknownSync(ClientSettingsSchema)({}).appearance).toEqual(
      DEFAULT_CLIENT_SETTINGS.appearance,
    );
  });

  it("decodes workspace defaults", () => {
    expect(DEFAULT_SERVER_SETTINGS.workspaceDefaults).toEqual({
      worktreeBaseRef: "origin/main",
      worktreeBranchPrefix: "work",
      generatedBranchNamespace: "feature",
      fetchBeforeWorktreeCreate: true,
    });
    expect(Schema.decodeUnknownSync(ServerSettings)({}).workspaceDefaults).toEqual(
      DEFAULT_SERVER_SETTINGS.workspaceDefaults,
    );
  });

  it("accepts appearance patch fields", () => {
    expect(
      Schema.decodeUnknownSync(ClientSettingsPatch)({
        appearance: {
          accent: "pink",
          font: "custom",
          customFontFamily: "Monocraft",
        },
      }),
    ).toEqual({
      appearance: {
        accent: "pink",
        font: "custom",
        customFontFamily: "Monocraft",
      },
    });
  });

  it("decodes notification sound defaults", () => {
    expect(DEFAULT_CLIENT_SETTINGS.notificationSounds).toEqual({
      enabled: true,
      playbackPolicy: "background",
      attentionSoundId: "minecrat-click",
      completionSoundId: "note-block-pling",
      customSounds: [],
    });
    expect(Schema.decodeUnknownSync(ClientSettingsSchema)({}).notificationSounds).toEqual(
      DEFAULT_CLIENT_SETTINGS.notificationSounds,
    );
  });

  it("accepts legacy client settings without notification sounds", () => {
    expect(
      Schema.decodeUnknownSync(ClientSettingsSchema)({
        appearance: {
          accent: "pink",
          font: "system",
          customFontFamily: "",
        },
      }).notificationSounds,
    ).toEqual(DEFAULT_CLIENT_SETTINGS.notificationSounds);
  });

  it("round-trips custom notification sounds", () => {
    const decoded = Schema.decodeUnknownSync(ClientSettingsSchema)({
      notificationSounds: {
        enabled: false,
        playbackPolicy: "always",
        attentionSoundId: "custom-click",
        completionSoundId: "note-block-pling",
        customSounds: [
          {
            id: "custom-click",
            label: "Custom Click",
            source: "custom",
            mimeType: "audio/mpeg",
            dataUrl: "data:audio/mpeg;base64,AAAA",
            sizeBytes: 4,
            createdAt: "2026-04-30T00:00:00.000Z",
          },
        ],
      },
    });

    expect(decoded.notificationSounds).toEqual({
      enabled: false,
      playbackPolicy: "always",
      attentionSoundId: "custom-click",
      completionSoundId: "note-block-pling",
      customSounds: [
        {
          id: "custom-click",
          label: "Custom Click",
          source: "custom",
          mimeType: "audio/mpeg",
          dataUrl: "data:audio/mpeg;base64,AAAA",
          sizeBytes: 4,
          createdAt: "2026-04-30T00:00:00.000Z",
        },
      ],
    });
  });

  it("accepts workspace default patch fields", () => {
    expect(
      Schema.decodeUnknownSync(ServerSettingsPatch)({
        workspaceDefaults: {
          worktreeBaseRef: "origin/main",
          worktreeBranchPrefix: "team",
          generatedBranchNamespace: "work",
          fetchBeforeWorktreeCreate: false,
        },
      }),
    ).toEqual({
      workspaceDefaults: {
        worktreeBaseRef: "origin/main",
        worktreeBranchPrefix: "team",
        generatedBranchNamespace: "work",
        fetchBeforeWorktreeCreate: false,
      },
    });
  });
});
