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
