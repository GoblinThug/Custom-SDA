export type ColorScheme = "dark" | "light";

export type ColorPalette = "steam" | "violet" | "emerald" | "rose" | "amber" | "cyan";

export type Appearance = {
  scheme: ColorScheme;
  palette: ColorPalette;
};

const STORAGE_KEY = "csda-appearance";
const LEGACY_STORAGE_KEY = "csda-theme";

export const COLOR_SCHEMES: ColorScheme[] = ["dark", "light"];

export const COLOR_PALETTES: ColorPalette[] = [
  "steam",
  "violet",
  "emerald",
  "rose",
  "amber",
  "cyan",
];

export const PALETTE_LABELS: Record<ColorPalette, string> = {
  steam: "Steam (синий)",
  violet: "Фиолетовый",
  emerald: "Изумрудный",
  rose: "Розовый",
  amber: "Янтарный",
  cyan: "Бирюзовый",
};

export const SCHEME_LABELS: Record<ColorScheme, string> = {
  dark: "Тёмный",
  light: "Светлый",
};

export function isColorScheme(value: string): value is ColorScheme {
  return value === "dark" || value === "light";
}

export function isColorPalette(value: string): value is ColorPalette {
  return (COLOR_PALETTES as string[]).includes(value);
}

/** @deprecated use isColorScheme */
export function isAppTheme(value: string): value is ColorScheme {
  return isColorScheme(value);
}

/** @deprecated use ColorScheme */
export type AppTheme = ColorScheme;

export function parseAppearance(settings?: {
  theme?: string;
  palette?: string;
}): Appearance {
  const rawTheme = settings?.theme ?? "";
  const scheme: ColorScheme = isColorScheme(rawTheme) ? rawTheme : "dark";
  const rawPalette = settings?.palette ?? "";
  const palette: ColorPalette = isColorPalette(rawPalette) ? rawPalette : "steam";
  return { scheme, palette };
}

export function loadStoredAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Appearance>;
      const rawScheme = parsed.scheme ?? "";
      const scheme: ColorScheme = isColorScheme(rawScheme) ? rawScheme : "dark";
      const rawPalette = parsed.palette ?? "";
      const palette: ColorPalette = isColorPalette(rawPalette)
        ? rawPalette
        : "steam";
      return { scheme, palette };
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && isColorScheme(legacy)) {
      return { scheme: legacy, palette: "steam" };
    }
  } catch {
    /* ignore */
  }
  return { scheme: "dark", palette: "steam" };
}

export function applyAppearance(appearance: Appearance) {
  document.documentElement.dataset.scheme = appearance.scheme;
  document.documentElement.dataset.palette = appearance.palette;
  delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    /* ignore */
  }
}

/** @deprecated use applyAppearance */
export function applyTheme(scheme: ColorScheme) {
  applyAppearance({ scheme, palette: loadStoredAppearance().palette });
}

/** @deprecated use loadStoredAppearance */
export function loadStoredTheme(): ColorScheme {
  return loadStoredAppearance().scheme;
}
