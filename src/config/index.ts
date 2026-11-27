import type { ClinicBundleConfig } from '../types/clinic';
import { heartVascularConfig } from './clinics/heartVascular';
import { mmcConfig } from './clinics/mmc';
import { oakwoodFamilyConfig } from './clinics/oakwoodFamily';
import { texasLungConfig } from './clinics/texasLung';

/**
 * Clinic Template Registry.
 * To deploy a new clinic at a new URL path (e.g. /sunrise-pediatrics),
 * create a config module under src/config/clinics/ and register its slug here.
 */
export const CLINIC_CONFIGS: Record<string, ClinicBundleConfig> = {
  'texas-lung': texasLungConfig,
  mmc: mmcConfig,
  'heart-vascular': heartVascularConfig,
  'oakwood-family': oakwoodFamilyConfig,
};

export const DEFAULT_CLINIC_SLUG = 'texas-lung';

export type ClinicBundle = ClinicBundleConfig;

export interface ResolvedClinicRoute {
  slug: string;
  bundle: ClinicBundleConfig | null;
  isUnknownPath: boolean;
}

const RESERVED_ROOT_SEGMENTS = new Set([
  '',
  'index.html',
  'api',
  'src',
  'assets',
  'node_modules',
  '@vite',
  '@react-refresh',
]);

export function resolveClinicRoute(
  pathname: string,
  search = '',
  envDefaultSlug = DEFAULT_CLINIC_SLUG
): ResolvedClinicRoute {
  const params = new URLSearchParams(search);
  const queryClinic = (params.get('clinic') || '').trim().toLowerCase();

  const segments = pathname
    .split('/')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const firstSegment = segments[0] || '';

  if (firstSegment && !RESERVED_ROOT_SEGMENTS.has(firstSegment)) {
    const matched = CLINIC_CONFIGS[firstSegment];
    if (matched) {
      return {
        slug: firstSegment,
        bundle: matched,
        isUnknownPath: false,
      };
    }
    if (queryClinic && CLINIC_CONFIGS[queryClinic]) {
      return {
        slug: queryClinic,
        bundle: CLINIC_CONFIGS[queryClinic],
        isUnknownPath: false,
      };
    }
    return {
      slug: firstSegment,
      bundle: null,
      isUnknownPath: true,
    };
  }

  if (queryClinic) {
    const matched = CLINIC_CONFIGS[queryClinic];
    if (matched) {
      return {
        slug: queryClinic,
        bundle: matched,
        isUnknownPath: false,
      };
    }
    return {
      slug: queryClinic,
      bundle: null,
      isUnknownPath: true,
    };
  }

  const fallbackSlug = CLINIC_CONFIGS[envDefaultSlug]
    ? envDefaultSlug
    : DEFAULT_CLINIC_SLUG;

  return {
    slug: fallbackSlug,
    bundle: CLINIC_CONFIGS[fallbackSlug],
    isUnknownPath: false,
  };
}

export function getClinicBundle(slug?: string): ClinicBundleConfig {
  const normalized = (slug || DEFAULT_CLINIC_SLUG).trim().toLowerCase();
  return CLINIC_CONFIGS[normalized] || CLINIC_CONFIGS[DEFAULT_CLINIC_SLUG];
}

export function listConfiguredClinics(): Array<{
  slug: string;
  name: string;
  shortName: string;
  specialty: string;
  path: string;
}> {
  return Object.entries(CLINIC_CONFIGS).map(([slug, bundle]) => ({
    slug,
    name: bundle.clinic.name,
    shortName: bundle.clinic.shortName,
    specialty: bundle.clinic.specialty,
    path: `/${slug}`,
  }));
}
