import { describe, expect, it } from "vitest";

import {
  buildReferenceSearchText,
  filterReferenceItems,
  matchesReferenceSearch,
  normalizeReferenceSearchQuery,
} from "./ShortcutsSettingsPanel.logic";

describe("ShortcutsSettingsPanel logic", () => {
  it("normalizes whitespace-delimited search tokens", () => {
    expect(normalizeReferenceSearchQuery("  terminal   split ")).toEqual(["terminal", "split"]);
  });

  it("builds case-insensitive search text from available parts", () => {
    expect(buildReferenceSearchText(["Terminal", null, "Split"])).toBe("terminal split");
  });

  it("requires every search token to match", () => {
    expect(matchesReferenceSearch("terminal split focused", "terminal focused")).toBe(true);
    expect(matchesReferenceSearch("terminal split focused", "terminal model")).toBe(false);
  });

  it("filters reference items by prepared search text", () => {
    const rows = [
      { id: "terminal", searchText: "terminal toggle drawer" },
      { id: "model", searchText: "model picker" },
    ];

    expect(filterReferenceItems(rows, "terminal")).toEqual([rows[0]]);
  });
});
