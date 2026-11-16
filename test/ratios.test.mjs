import test from 'node:test';
import assert from 'node:assert/strict';

import { metrics, analyzeRatios, SCHEMAS, detectSchema } from '../src/index.mjs';
import { makeFace, makeFace68 } from './fixtures.mjs';

function near(actual, expected, tolerance = 1e-9, message = '') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message} expected ${expected}, got ${actual}`,
  );
}

function byKey(measured) {
  return Object.fromEntries(measured.map((item) => [item.key, item.value]));
}

test('dlib68 ratios match the hand-computed values', () => {
  const { measured, unavailable } = analyzeRatios(makeFace68(), SCHEMAS.dlib68);
  const values = byKey(measured);

  near(values['eye-spacing'], 0.5, 1e-12, 'inner 2 / outer 4:');
  near(values['nose-mouth'], 0.5, 1e-12, 'nose 1 / mouth 2:');
  near(values['mouth-jaw'], 0.2, 1e-12, 'mouth 2 / jaw 10:');
  near(values['face-index'], 30, 1e-12, '100 * 3 / 10:');

  assert.deepEqual(
    unavailable.map((item) => item.key).sort(),
    ['interocular-outer', 'jaw-cheek', 'midface'],
  );
  for (const item of unavailable) {
    assert.ok(item.reason.length > 10, 'every unavailable ratio needs a reason');
  }
});

test('mediapipe ratios match the hand-computed values', () => {
  const { measured, unavailable } = analyzeRatios(makeFace(), SCHEMAS['mediapipe-478']);
  const values = byKey(measured);

  near(values['interocular-outer'], 0.4 / 0.76, 1e-12);
  near(values['interocular-inner'], 0.2 / 0.76, 1e-12);
  near(values['eye-spacing'], 0.5, 1e-12);
  near(values['nose-mouth'], 0.12 / 0.16, 1e-12);
  near(values['mouth-face'], 0.16 / 0.76, 1e-12);
  near(values['jaw-cheek'], 0.6 / 0.76, 1e-12);
  near(values['face-index'], (100 * 0.48) / 0.76, 1e-12);
  near(values.midface, 0.3 / 0.225, 1e-12, 'pupils 0.30 apart, 0.225 above the upper lip:');

  assert.deepEqual(unavailable, []);
});

test('the 468-point mesh reports the iris ratio as unavailable', () => {
  const { measured, unavailable } = analyzeRatios(makeFace({ size: 468 }), SCHEMAS['mediapipe-468']);

  assert.equal(measured.length, 7);
  assert.deepEqual(unavailable.map((item) => item.key), ['midface']);
  assert.ok(!measured.some((item) => item.key === 'midface'));
});

test('a schema is chosen from the point count', () => {
  assert.equal(detectSchema(makeFace()).id, 'mediapipe-478');
  assert.equal(detectSchema(makeFace({ size: 468 })).id, 'mediapipe-468');
  assert.equal(detectSchema(makeFace68()).id, 'dlib68');
  assert.throws(() => detectSchema(new Array(99).fill([0, 0])), TypeError);
  assert.throws(() => detectSchema('nope'), TypeError);
});

test('every formula names the landmarks the code reads', () => {
  for (const schema of Object.values(SCHEMAS)) {
    for (const item of schema.ratios) {
      for (const index of item.anchors) {
        assert.ok(
          item.formula.includes(`p${index}`),
          `${schema.id}/${item.key}: formula "${item.formula}" does not mention p${index}`,
        );
      }
    }
    for (const [label, left, right] of schema.pairs) {
      assert.equal(typeof label, 'string');
      assert.ok(Number.isInteger(left) && Number.isInteger(right), 'pair indices must be integers');
      assert.ok(left < schema.pointCount && right < schema.pointCount, 'pair index out of range');
    }
  }
});

test('metrics() ties symmetry and ratios together', () => {
  const result = metrics(makeFace());

  assert.equal(result.schema, 'mediapipe-478');
  assert.equal(result.pointCount, 478);
  assert.equal(result.symmetry.pairs.length, 13);
  assert.equal(result.ratios.measured.length, 8);

  // The fixture is exactly symmetric, so there is nothing to measure.
  near(result.symmetry.index, 0, 1e-9);

  for (const item of result.ratios.measured) {
    assert.ok(item.formula.length > 0, `${item.key} is missing its formula`);
    assert.ok(item.landmarks.length >= 3);
  }
});

test('one moved landmark shows up in the symmetry index', () => {
  const moved = metrics(makeFace({ displace: { index: 291, dx: 0.02 } }));
  assert.ok(moved.symmetry.index > 0.5, `expected a visible index, got ${moved.symmetry.index}`);
  assert.equal(moved.symmetry.pairs[0].label, 'mouth corner');
});

test('a schema that does not fit the data is rejected', () => {
  assert.throws(() => metrics(makeFace({ size: 468 }), { schema: 'mediapipe-478' }), RangeError);
  assert.throws(() => metrics(makeFace(), { schema: 'unknown' }), TypeError);
  assert.throws(() => metrics(makeFace(), { schema: 42 }), TypeError);
});
