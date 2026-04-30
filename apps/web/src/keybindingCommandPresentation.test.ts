import type { ResolvedKeybindingsConfig } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import {
  getKnownKeybindingCommandPresentations,
  getKeybindingCommandPresentation,
  getProjectScriptKeybindingCommandPresentations,
  shortcutLabelOptionsForCommand,
} from "./keybindingCommandPresentation";

describe("keybindingCommandPresentation", () => {
  it("includes the expected static command groups", () => {
    const commands = getKnownKeybindingCommandPresentations().map((entry) => entry.command);

    expect(commands).toContain("terminal.toggle");
    expect(commands).toContain("commandPalette.toggle");
    expect(commands).toContain("thread.jump.9");
    expect(commands).toContain("modelPicker.jump.9");
  });

  it("derives project script rows from resolved keybindings only", () => {
    const keybindings: ResolvedKeybindingsConfig = [
      {
        command: "script.lint.run",
        shortcut: {
          key: "l",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          modKey: true,
        },
      },
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
    ];

    expect(getProjectScriptKeybindingCommandPresentations(keybindings)).toEqual([
      {
        command: "script.lint.run",
        label: "Run lint",
        description: 'Run the project action "lint".',
        category: "Project actions",
        contextLabel: "Global",
        showWhenUnbound: false,
      },
    ]);
    expect(getKeybindingCommandPresentation("script.test.run")?.label).toBe("Run test");
  });

  it("uses command-specific shortcut contexts", () => {
    expect(shortcutLabelOptionsForCommand("terminal.split")).toEqual({
      context: { terminalFocus: true, terminalOpen: true },
    });
    expect(shortcutLabelOptionsForCommand("modelPicker.jump.1")).toEqual({
      context: { terminalFocus: false, terminalOpen: false, modelPickerOpen: true },
    });
    expect(shortcutLabelOptionsForCommand("diff.toggle")).toEqual({
      context: { terminalFocus: false, terminalOpen: false },
    });
  });
});
