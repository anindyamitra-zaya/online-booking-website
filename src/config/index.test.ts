import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLINIC_CONFIGS,
  DEFAULT_CLINIC_SLUG,
  listConfiguredClinics,
  resolveClinicRoute,
} from './index';

test('resolveClinicRoute resolves root path to default clinic config', () => {
  const res = resolveClinicRoute('/', '');
  assert.equal(res.slug, DEFAULT_CLINIC_SLUG);
  assert.equal(res.isUnknownPath, false);
  assert.equal(res.bundle?.clinic.id, 'texas-lung');
});

test('resolveClinicRoute resolves clinic config from URL path segment', () => {
  const heart = resolveClinicRoute('/heart-vascular', '');
  assert.equal(heart.slug, 'heart-vascular');
  assert.equal(heart.isUnknownPath, false);
  assert.equal(heart.bundle?.clinic.name, 'Central Heart & Vascular Clinic');
  assert.equal(heart.bundle?.clinic.reschedulePolicy?.lockProvider, true);

  const oakwood = resolveClinicRoute('/oakwood-family/', '');
  assert.equal(oakwood.slug, 'oakwood-family');
  assert.equal(oakwood.isUnknownPath, false);
  assert.equal(oakwood.bundle?.clinic.shortName, 'Oakwood Care');
});

test('resolveClinicRoute supports ?clinic= query fallback and flags unknown paths', () => {
  const query = resolveClinicRoute('/', '?clinic=heart-vascular');
  assert.equal(query.slug, 'heart-vascular');
  assert.equal(query.isUnknownPath, false);

  const unknown = resolveClinicRoute('/unknown-clinic', '');
  assert.equal(unknown.slug, 'unknown-clinic');
  assert.equal(unknown.isUnknownPath, true);
  assert.equal(unknown.bundle, null);
});

test('listConfiguredClinics returns path metadata for every registered clinic', () => {
  const clinics = listConfiguredClinics();
  assert.ok(clinics.length >= 3);
  assert.ok(clinics.some((c) => c.path === '/texas-lung'));
  assert.ok(clinics.some((c) => c.path === '/heart-vascular'));
  assert.ok(clinics.some((c) => c.path === '/oakwood-family'));
});

test('every registered clinic config contains all fixed template data', () => {
  for (const [slug, bundle] of Object.entries(CLINIC_CONFIGS)) {
    assert.equal(bundle.clinic.id, slug);
    assert.ok(bundle.clinic.name.length > 0);
    assert.ok(bundle.clinic.locations.length > 0);
    assert.ok(bundle.providers.length > 0);
    assert.ok(bundle.appointmentTypes.length > 0);
    assert.ok((bundle.clinic.commonVisitReasons?.default?.length ?? 0) > 0);
    assert.ok((bundle.clinic.cancellationReasons?.length ?? 0) > 0);
  }
});
