import type { KeybindingCommand, ResolvedKeybindingsConfig } from "@t3tools/contracts";
import { KeyboardIcon, SearchIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  getKnownKeybindingCommandPresentations,
  getProjectScriptKeybindingCommandPresentations,
  shortcutLabelOptionsForCommand,
  type KeybindingCommandCategory,
  type KeybindingCommandPresentation,
} from "../../keybindingCommandPresentation";
import { shortcutLabelForCommand } from "../../keybindings";
import { useServerKeybindings, useServerKeybindingsConfigPath } from "../../rpc/serverState";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Kbd } from "../ui/kbd";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";
import { useOpenServerPathInPreferredEditor } from "./settingsOpenInEditor";
import { buildReferenceSearchText, filterReferenceItems } from "./ShortcutsSettingsPanel.logic";

type ShortcutReferenceRow = {
  readonly id: string;
  readonly command: KeybindingCommand;
  readonly category: KeybindingCommandCategory;
  readonly label: string;
  readonly description: string;
  readonly contextLabel: string;
  readonly shortcutLabel: string | null;
  readonly searchText: string;
};

const SHORTCUT_CATEGORIES: readonly KeybindingCommandCategory[] = [
  "General",
  "Chat",
  "Terminal",
  "Threads",
  "Models",
  "Project actions",
];

function makeShortcutRow(
  presentation: KeybindingCommandPresentation,
  keybindings: ResolvedKeybindingsConfig,
): ShortcutReferenceRow | null {
  const shortcutLabel = shortcutLabelForCommand(
    keybindings,
    presentation.command,
    shortcutLabelOptionsForCommand(presentation.command),
  );

  if (!shortcutLabel && !presentation.showWhenUnbound) {
    return null;
  }

  return {
    id: presentation.command,
    command: presentation.command,
    category: presentation.category,
    label: presentation.label,
    description: presentation.description,
    contextLabel: presentation.contextLabel,
    shortcutLabel,
    searchText: buildReferenceSearchText([
      presentation.command,
      presentation.label,
      presentation.description,
      presentation.category,
      presentation.contextLabel,
      shortcutLabel ?? "unassigned",
    ]),
  };
}

function buildShortcutRows(keybindings: ResolvedKeybindingsConfig): ShortcutReferenceRow[] {
  const presentations = [
    ...getKnownKeybindingCommandPresentations(),
    ...getProjectScriptKeybindingCommandPresentations(keybindings),
  ];
  return presentations.flatMap((presentation) => {
    const row = makeShortcutRow(presentation, keybindings);
    return row ? [row] : [];
  });
}

function SearchHeader({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <KeyboardIcon className="size-4 text-muted-foreground/70" />
        <span>Shortcuts</span>
      </div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          type="search"
          nativeInput
          placeholder="Search shortcuts or commands"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          className="rounded-xl pl-7"
        />
      </div>
    </div>
  );
}

function ShortcutRow({ row }: { row: ShortcutReferenceRow }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-medium text-foreground">{row.label}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground/60">{row.contextLabel}</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground/78">{row.description}</p>
      </div>
      <Kbd className={row.shortcutLabel ? "" : "text-muted-foreground/55"}>
        {row.shortcutLabel ?? "Unassigned"}
      </Kbd>
    </div>
  );
}

function EmptyReferenceRow({ message }: { message: string }) {
  return <div className="px-4 py-4 text-xs text-muted-foreground/70 sm:px-5">{message}</div>;
}

function KeyboardShortcutsReference({ rows }: { rows: ReadonlyArray<ShortcutReferenceRow> }) {
  return (
    <>
      {SHORTCUT_CATEGORIES.map((category) => {
        const categoryRows = rows.filter((row) => row.category === category);
        if (categoryRows.length === 0) return null;

        return (
          <SettingsSection key={category} title={category}>
            {categoryRows.map((row) => (
              <ShortcutRow key={row.id} row={row} />
            ))}
          </SettingsSection>
        );
      })}
      {rows.length === 0 ? (
        <SettingsSection title="Keyboard shortcuts">
          <EmptyReferenceRow message="No shortcuts matched your search." />
        </SettingsSection>
      ) : null}
    </>
  );
}

function KeybindingsFileReference() {
  const keybindingsConfigPath = useServerKeybindingsConfigPath();
  const { openPathInPreferredEditor, openingPathByTarget, openPathErrorByTarget } =
    useOpenServerPathInPreferredEditor();
  const isOpeningKeybindings = Boolean(openingPathByTarget.keybindings);
  const openKeybindingsError = openPathErrorByTarget.keybindings ?? null;
  const openKeybindingsFile = useCallback(() => {
    openPathInPreferredEditor(
      "keybindings",
      keybindingsConfigPath,
      "Unable to open keybindings file.",
    );
  }, [keybindingsConfigPath, openPathInPreferredEditor]);

  return (
    <SettingsSection title="Advanced">
      <SettingsRow
        title="Keybindings"
        description="Open the persisted `keybindings.json` file to edit advanced bindings directly."
        status={
          <>
            <span className="block break-all font-mono text-[11px] text-foreground">
              {keybindingsConfigPath ?? "Resolving keybindings path..."}
            </span>
            {openKeybindingsError ? (
              <span className="mt-1 block text-destructive">{openKeybindingsError}</span>
            ) : (
              <span className="mt-1 block">Opens in your preferred editor.</span>
            )}
          </>
        }
        control={
          <Button
            size="xs"
            variant="outline"
            disabled={!keybindingsConfigPath || isOpeningKeybindings}
            onClick={openKeybindingsFile}
          >
            {isOpeningKeybindings ? "Opening..." : "Open file"}
          </Button>
        }
      />
    </SettingsSection>
  );
}

export function ShortcutsSettingsPanel() {
  const [query, setQuery] = useState("");
  const keybindings = useServerKeybindings();
  const shortcutRows = useMemo(() => buildShortcutRows(keybindings), [keybindings]);
  const filteredShortcutRows = useMemo(
    () => filterReferenceItems(shortcutRows, query),
    [query, shortcutRows],
  );

  return (
    <SettingsPageContainer>
      <SearchHeader query={query} onQueryChange={setQuery} />
      <KeyboardShortcutsReference rows={filteredShortcutRows} />
      <KeybindingsFileReference />
    </SettingsPageContainer>
  );
}
