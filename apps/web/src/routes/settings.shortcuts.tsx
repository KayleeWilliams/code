import { createFileRoute } from "@tanstack/react-router";

import { ShortcutsSettingsPanel } from "../components/settings/ShortcutsSettingsPanel";

export const Route = createFileRoute("/settings/shortcuts")({
  component: ShortcutsSettingsPanel,
});
