export const BRAND_ASSET_PATHS = {
  productionMacIconPng: "assets/inth/inth-macos-1024.png",
  productionLinuxIconPng: "assets/inth/inth-universal-1024.png",
  productionWindowsIconIco: "assets/inth/inth-windows.ico",
  productionWebFaviconIco: "assets/inth/inth-web-favicon.ico",
  productionWebFavicon16Png: "assets/inth/inth-web-favicon-16x16.png",
  productionWebFavicon32Png: "assets/inth/inth-web-favicon-32x32.png",
  productionWebAppleTouchIconPng: "assets/inth/inth-web-apple-touch-180.png",

  nightlyMacIconPng: "assets/inth/inth-macos-1024.png",
  nightlyLinuxIconPng: "assets/inth/inth-universal-1024.png",
  nightlyWindowsIconIco: "assets/inth/inth-windows.ico",

  developmentDesktopIconPng: "assets/inth/inth-macos-1024.png",
  developmentWindowsIconIco: "assets/inth/inth-windows.ico",
  developmentWebFaviconIco: "assets/inth/inth-web-favicon.ico",
  developmentWebFavicon16Png: "assets/inth/inth-web-favicon-16x16.png",
  developmentWebFavicon32Png: "assets/inth/inth-web-favicon-32x32.png",
  developmentWebAppleTouchIconPng: "assets/inth/inth-web-apple-touch-180.png",
} as const;

export interface IconOverride {
  readonly sourceRelativePath: string;
  readonly targetRelativePath: string;
}

export const DEVELOPMENT_ICON_OVERRIDES: ReadonlyArray<IconOverride> = [
  {
    sourceRelativePath: BRAND_ASSET_PATHS.developmentWebFaviconIco,
    targetRelativePath: "dist/client/favicon.ico",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.developmentWebFavicon16Png,
    targetRelativePath: "dist/client/favicon-16x16.png",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.developmentWebFavicon32Png,
    targetRelativePath: "dist/client/favicon-32x32.png",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.developmentWebAppleTouchIconPng,
    targetRelativePath: "dist/client/apple-touch-icon.png",
  },
];

export const PUBLISH_ICON_OVERRIDES: ReadonlyArray<IconOverride> = [
  {
    sourceRelativePath: BRAND_ASSET_PATHS.productionWebFaviconIco,
    targetRelativePath: "dist/client/favicon.ico",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.productionWebFavicon16Png,
    targetRelativePath: "dist/client/favicon-16x16.png",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.productionWebFavicon32Png,
    targetRelativePath: "dist/client/favicon-32x32.png",
  },
  {
    sourceRelativePath: BRAND_ASSET_PATHS.productionWebAppleTouchIconPng,
    targetRelativePath: "dist/client/apple-touch-icon.png",
  },
];
