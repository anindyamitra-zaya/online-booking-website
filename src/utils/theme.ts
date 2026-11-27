export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export const DEFAULT_CLINIC_THEME_COLOR = '#0f766e';

export function normalizeHexColor(hex?: string | null): string {
  const raw = (hex || '').trim();
  const shortMatch = raw.match(/^#?([0-9a-fA-F]{3})$/);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const fullMatch = raw.match(/^#?([0-9a-fA-F]{6})$/);
  if (fullMatch) {
    return `#${fullMatch[1].toLowerCase()}`;
  }
  return DEFAULT_CLINIC_THEME_COLOR;
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeHexColor(hex).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function mixRgb(a: RgbColor, b: RgbColor, weightA: number): RgbColor {
  const w = Math.max(0, Math.min(1, weightA));
  return {
    r: a.r * w + b.r * (1 - w),
    g: a.g * w + b.g * (1 - w),
    b: a.b * w + b.b * (1 - w),
  };
}

export function getRelativeLuminance(rgb: RgbColor): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function darkenUntilContrast(
  base: RgbColor,
  background: RgbColor,
  minRatio: number
): RgbColor {
  const bgLum = getRelativeLuminance(background);
  if (getContrastRatio(getRelativeLuminance(base), bgLum) >= minRatio) {
    return base;
  }
  const black: RgbColor = { r: 8, g: 12, b: 10 };
  for (let step = 1; step <= 20; step++) {
    const candidate = mixRgb(black, base, step / 20);
    if (getContrastRatio(getRelativeLuminance(candidate), bgLum) >= minRatio) {
      return candidate;
    }
  }
  return black;
}

function lightenUntilContrast(
  base: RgbColor,
  background: RgbColor,
  minRatio: number
): RgbColor {
  const bgLum = getRelativeLuminance(background);
  if (getContrastRatio(getRelativeLuminance(base), bgLum) >= minRatio) {
    return base;
  }
  const white: RgbColor = { r: 248, g: 250, b: 252 };
  for (let step = 1; step <= 20; step++) {
    const candidate = mixRgb(white, base, step / 20);
    if (getContrastRatio(getRelativeLuminance(candidate), bgLum) >= minRatio) {
      return candidate;
    }
  }
  return white;
}

export interface ClinicThemeVariables {
  '--clinic-brand-primary': string;
  '--clinic-brand-hover': string;
  '--clinic-brand-fg': string;
  '--clinic-brand-text': string;
  '--clinic-brand-text-dark': string;
  '--clinic-brand-soft-bg': string;
  '--clinic-brand-soft-bg-dark': string;
  '--clinic-brand-soft-border': string;
  '--clinic-brand-soft-border-dark': string;
  '--clinic-brand-ring': string;
}

export function buildClinicThemeVariables(
  themeColor?: string | null
): ClinicThemeVariables {
  const primaryHex = normalizeHexColor(themeColor);
  const primaryRgb = hexToRgb(primaryHex);
  const primaryLum = getRelativeLuminance(primaryRgb);

  const white: RgbColor = { r: 255, g: 255, b: 255 };
  const slate950: RgbColor = { r: 2, g: 6, b: 23 };
  const slate900: RgbColor = { r: 15, g: 23, b: 42 };
  const black: RgbColor = { r: 0, g: 0, b: 0 };

  // Foreground on filled brand button / node: choose whichever has higher contrast
  const whiteContrast = getContrastRatio(1, primaryLum);
  const darkText = { r: 15, g: 23, b: 42 };
  const darkContrast = getContrastRatio(getRelativeLuminance(darkText), primaryLum);
  const fgHex = whiteContrast >= 4.5 || whiteContrast >= darkContrast ? '#ffffff' : '#0f172a';

  const hoverHex = rgbToHex(mixRgb(black, primaryRgb, 0.12));

  // Readable brand text in light mode (on white/slate-50) and dark mode (on slate-900/950)
  const textLightHex = rgbToHex(darkenUntilContrast(primaryRgb, white, 4.6));
  const textDarkHex = rgbToHex(lightenUntilContrast(primaryRgb, slate900, 5.2));

  const softBgHex = rgbToHex(mixRgb(primaryRgb, white, 0.1));
  const softBgDarkHex = rgbToHex(mixRgb(primaryRgb, slate950, 0.18));

  const softBorderHex = rgbToHex(mixRgb(primaryRgb, white, 0.38));
  const softBorderDarkHex = rgbToHex(mixRgb(primaryRgb, slate900, 0.55));

  return {
    '--clinic-brand-primary': primaryHex,
    '--clinic-brand-hover': hoverHex,
    '--clinic-brand-fg': fgHex,
    '--clinic-brand-text': textLightHex,
    '--clinic-brand-text-dark': textDarkHex,
    '--clinic-brand-soft-bg': softBgHex,
    '--clinic-brand-soft-bg-dark': softBgDarkHex,
    '--clinic-brand-soft-border': softBorderHex,
    '--clinic-brand-soft-border-dark': softBorderDarkHex,
    '--clinic-brand-ring': `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.2)`,
  };
}

export function applyClinicThemeVariables(themeColor?: string | null): void {
  if (typeof document === 'undefined') return;
  const vars = buildClinicThemeVariables(themeColor);
  const rootStyle = document.documentElement.style;
  for (const [key, value] of Object.entries(vars)) {
    rootStyle.setProperty(key, value);
  }
}
