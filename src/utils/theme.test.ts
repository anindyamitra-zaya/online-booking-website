import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClinicThemeVariables,
  DEFAULT_CLINIC_THEME_COLOR,
  getContrastRatio,
  getRelativeLuminance,
  hexToRgb,
  normalizeHexColor,
} from './theme';

test('normalizeHexColor validates and normalizes 3-digit and 6-digit hex colors', () => {
  assert.equal(normalizeHexColor('#9CAD39'), '#9cad39');
  assert.equal(normalizeHexColor('9CAD39'), '#9cad39');
  assert.equal(normalizeHexColor('#08a'), '#0088aa');
  assert.equal(normalizeHexColor('invalid'), DEFAULT_CLINIC_THEME_COLOR);
  assert.equal(normalizeHexColor(null), DEFAULT_CLINIC_THEME_COLOR);
});

test('buildClinicThemeVariables preserves primary color and ensures accessible contrast', () => {
  const mmcVars = buildClinicThemeVariables('#9CAD39');
  assert.equal(mmcVars['--clinic-brand-primary'], '#9cad39');
  // #9CAD39 has high luminance so dark foreground ensures WCAG AA contrast
  const fgLum = getRelativeLuminance(hexToRgb(mmcVars['--clinic-brand-fg']));
  const bgLum = getRelativeLuminance(hexToRgb(mmcVars['--clinic-brand-primary']));
  assert.ok(getContrastRatio(fgLum, bgLum) >= 4.5);

  // Light-mode text token must have >= 4.5:1 contrast against white
  const textLightLum = getRelativeLuminance(hexToRgb(mmcVars['--clinic-brand-text']));
  assert.ok(getContrastRatio(1, textLightLum) >= 4.5);

  // Dark-mode text token must have >= 4.5:1 contrast against slate-900 (#0f172a)
  const textDarkLum = getRelativeLuminance(hexToRgb(mmcVars['--clinic-brand-text-dark']));
  const slate900Lum = getRelativeLuminance(hexToRgb('#0f172a'));
  assert.ok(getContrastRatio(textDarkLum, slate900Lum) >= 4.5);

  const tealVars = buildClinicThemeVariables('#0f766e');
  assert.equal(tealVars['--clinic-brand-primary'], '#0f766e');
  assert.equal(tealVars['--clinic-brand-fg'], '#ffffff');
});
