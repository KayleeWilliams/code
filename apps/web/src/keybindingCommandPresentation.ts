import {
  MODEL_PICKER_JUMP_KEYBINDING_COMMANDS,
  THREAD_JUMP_KEYBINDING_COMMANDS,
  type KeybindingCommand,
  type ResolvedKeybindingsConfig,
} from "@t3tools/contracts";

import { projectScriptIdFromCommand } from "./projectScripts";

export type KeybindingCommandCategory =
  | "General"
  | "Chat"
  | "Terminal"
  | "Threads"
  | "Models"
  | "Project actions";

export interface KeybindingCommandPresentation {
  readonly command: KeybindingCommand;
  readonly label: string;
  readonly description: string;
  readonly category: KeybindingCommandCategory;
  readonly contextLabel: string;
  readonly showWhenUnbound: boolean;
}

export interface ShortcutLabelContextOptions {
  readonly context: {
    readonly terminalFocus?: boolean;
    readonly terminalOpen?: boolean;
    readonly modelPickerOpen?: boolean;
  };
}

const TERMINAL_CONTEXT = {
  context: {
    terminalFocus: true,
    terminalOpen: true,
  },
} satisfies ShortcutLabelContextOptions;

const NON_TERMINAL_CONTEXT = {
  context: {
    terminalFocus: false,
    terminalOpen: false,
  },
} satisfies ShortcutLabelContextOptions;

const MODEL_PICKER_CONTEXT = {
  context: {
    terminalFocus: false,
    terminalOpen: false,
    modelPickerOpen: true,
  },
} satisfies ShortcutLabelContextOptions;

function makeThreadJumpPresentation(
  command: KeybindingCommand,
  index: number,
): KeybindingCommandPresentation {
  const position = index + 1;
  return {
    command,
    label: `Jump to thread ${position}`,
    description: `Select the thread in position ${position} from the visible thread list.`,
    category: "Threads",
    contextLabel: "Global",
    showWhenUnbound: true,
  };
}

function makeModelJumpPresentation(
  command: KeybindingCommand,
  index: number,
): KeybindingCommandPresentation {
  const position = index + 1;
  return {
    command,
    label: `Select model ${position}`,
    description: `Choose the model in position ${position} while the model picker is open.`,
    category: "Models",
    contextLabel: "Model picker",
    showWhenUnbound: true,
  };
}

const STATIC_COMMAND_PRESENTATIONS = [
  {
    command: "commandPalette.toggle",
    label: "Open command palette",
    description: "Open or close the global command palette.",
    category: "General",
    contextLabel: "Outside terminal",
    showWhenUnbound: true,
  },
  {
    command: "editor.openFavorite",
    label: "Open in editor",
    description: "Open the current project or worktree in your preferred editor.",
    category: "General",
    contextLabel: "Global",
    showWhenUnbound: true,
  },
  {
    command: "diff.toggle",
    label: "Toggle diff",
    description: "Open or close the current thread diff view.",
    category: "General",
    contextLabel: "Outside terminal",
    showWhenUnbound: true,
  },
  {
    command: "chat.new",
    label: "New chat",
    description: "Create a new chat preserving the active thread branch or worktree state.",
    category: "Chat",
    contextLabel: "Outside terminal",
    showWhenUnbound: true,
  },
  {
    command: "chat.newLocal",
    label: "New local chat",
    description: "Create a new chat in the active project using the default environment mode.",
    category: "Chat",
    contextLabel: "Outside terminal",
    showWhenUnbound: true,
  },
  {
    command: "terminal.toggle",
    label: "Toggle terminal",
    description: "Open or close the terminal drawer for the active thread.",
    category: "Terminal",
    contextLabel: "Global",
    showWhenUnbound: true,
  },
  {
    command: "terminal.split",
    label: "Split terminal",
    description: "Split the focused terminal pane.",
    category: "Terminal",
    contextLabel: "Terminal focused",
    showWhenUnbound: true,
  },
  {
    command: "terminal.new",
    label: "New terminal",
    description: "Create a new terminal in the terminal drawer.",
    category: "Terminal",
    contextLabel: "Terminal focused",
    showWhenUnbound: true,
  },
  {
    command: "terminal.close",
    label: "Close terminal",
    description: "Close the focused terminal pane.",
    category: "Terminal",
    contextLabel: "Terminal focused",
    showWhenUnbound: true,
  },
  {
    command: "thread.previous",
    label: "Previous thread",
    description: "Move to the previous visible thread.",
    category: "Threads",
    contextLabel: "Global",
    showWhenUnbound: true,
  },
  {
    command: "thread.next",
    label: "Next thread",
    description: "Move to the next visible thread.",
    category: "Threads",
    contextLabel: "Global",
    showWhenUnbound: true,
  },
  {
    command: "modelPicker.toggle",
    label: "Open model picker",
    description: "Open or close the active thread model picker.",
    category: "Models",
    contextLabel: "Outside terminal",
    showWhenUnbound: true,
  },
  ...THREAD_JUMP_KEYBINDING_COMMANDS.map(makeThreadJumpPresentation),
  ...MODEL_PICKER_JUMP_KEYBINDING_COMMANDS.map(makeModelJumpPresentation),
] satisfies ReadonlyArray<KeybindingCommandPresentation>;

const PRESENTATION_BY_COMMAND = new Map<KeybindingCommand, KeybindingCommandPresentation>(
  STATIC_COMMAND_PRESENTATIONS.map((presentation) => [presentation.command, presentation]),
);

export function getKnownKeybindingCommandPresentations(): ReadonlyArray<KeybindingCommandPresentation> {
  return STATIC_COMMAND_PRESENTATIONS;
}

export function getProjectScriptKeybindingCommandPresentations(
  keybindings: ResolvedKeybindingsConfig,
): ReadonlyArray<KeybindingCommandPresentation> {
  const seen = new Set<string>();
  const presentations: KeybindingCommandPresentation[] = [];

  for (const binding of keybindings) {
    const scriptId = projectScriptIdFromCommand(binding.command);
    if (!scriptId || seen.has(binding.command)) {
      continue;
    }
    seen.add(binding.command);
    presentations.push({
      command: binding.command,
      label: `Run ${scriptId}`,
      description: `Run the project action "${scriptId}".`,
      category: "Project actions",
      contextLabel: "Global",
      showWhenUnbound: false,
    });
  }

  return presentations;
}

export function getKeybindingCommandPresentation(
  command: KeybindingCommand,
): KeybindingCommandPresentation | null {
  const known = PRESENTATION_BY_COMMAND.get(command);
  if (known) return known;

  const scriptId = projectScriptIdFromCommand(command);
  if (!scriptId) return null;

  return {
    command,
    label: `Run ${scriptId}`,
    description: `Run the project action "${scriptId}".`,
    category: "Project actions",
    contextLabel: "Global",
    showWhenUnbound: false,
  };
}

export function shortcutLabelOptionsForCommand(
  command: KeybindingCommand,
): ShortcutLabelContextOptions {
  if (command.startsWith("terminal.")) {
    return TERMINAL_CONTEXT;
  }
  if (command.startsWith("modelPicker.jump.")) {
    return MODEL_PICKER_CONTEXT;
  }
  return NON_TERMINAL_CONTEXT;
}
