import { afterEach, describe, expect, it, vi } from "vitest";

const originalWindow = globalThis.window;

afterEach(() => {
  vi.resetModules();

  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
    return;
  }

  globalThis.window = originalWindow;
});

describe("branding", () => {
  it("uses Inth Code as the browser fallback branding", async () => {
    Reflect.deleteProperty(globalThis, "window");

    const branding = await import("./branding");

    expect(branding.APP_BASE_NAME).toBe("Inth Code");
    expect(branding.APP_DISPLAY_NAME).toBe(`Inth Code (${branding.APP_STAGE_LABEL})`);
  });

  it("uses injected desktop branding when available", async () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        desktopBridge: {
          getAppBranding: () => ({
            baseName: "Inth Code",
            stageLabel: "Nightly",
            displayName: "Inth Code (Nightly)",
          }),
        },
      },
    });

    const branding = await import("./branding");

    expect(branding.APP_BASE_NAME).toBe("Inth Code");
    expect(branding.APP_STAGE_LABEL).toBe("Nightly");
    expect(branding.APP_DISPLAY_NAME).toBe("Inth Code (Nightly)");
  });
});
