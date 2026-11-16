#!/usr/bin/env node
/**
 * face-metrics CLI — read a landmark set from a JSON file and print the report.
 *
 *   node bin/face-metrics.mjs landmarks.json
 *   node bin/face-metrics.mjs landmarks.json --json
 *   node bin/face-metrics.mjs landmarks.json --schema dlib68
 *
 * Accepted JSON: a bare array of points, `{ "points": [...] }`, or the raw
 * output of MediaPipe's JavaScript face landmarker (`{ "faceLandmarks": [[...]] }`).
 * Points may be `[x, y]` or `{ "x": ..., "y": ... }`.
 */

import { readFileSync } from 'node:fs';
import { metrics, SCHEMAS } from '../src/index.mjs';

const USAGE = `Usage: face-metrics <landmarks.json> [--json] [--schema <name>]

  --json            print the full result as JSON instead of a table
  --schema <name>   force a landmark schema: ${Object.keys(SCHEMAS).join(', ')}
  --help            show this message`;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  const options = { file: null, json: false, schema: null, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--schema') {
      options.schema = argv[i + 1];
      i += 1;
      if (!options.schema) throw new Error('--schema needs a value');
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}`);
    } else if (options.file) {
      throw new Error(`unexpected extra argument: ${arg}`);
    } else {
      options.file = arg;
    }
  }

  return options;
}

function extractPoints(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.points)) return payload.points;
  if (payload && Array.isArray(payload.faceLandmarks)) {
    const first = payload.faceLandmarks[0];
    if (!Array.isArray(first)) {
      throw new Error('faceLandmarks[0] is not a landmark array');
    }
    return first;
  }
  throw new Error('no landmarks found: expected [], {points: []} or {faceLandmarks: [[...]]}');
}

function round(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function printTable(result) {
  const lines = [];
  const { symmetry } = result;

  lines.push(`schema: ${result.schema} (${result.detector}, ${result.pointCount} points)`);
  lines.push('');
  lines.push('symmetry');
  lines.push(`  index                ${round(symmetry.index, 2)}   percent of centroid size`);
  lines.push(`  midline angle        ${round(symmetry.axis.angleDegrees, 2)}   degrees from +x`);
  lines.push(`  centroid size        ${round(symmetry.centroidSize, 4)}`);
  lines.push(`  formula              ${symmetry.formula}`);
  lines.push('');
  lines.push('  worst pairs');
  for (const pair of symmetry.pairs.slice(0, 5)) {
    lines.push(`    ${pair.label.padEnd(20)} ${round(pair.residual, 5)}  (${round(pair.share, 2)}%)`);
  }

  lines.push('');
  lines.push('ratios');
  const width = Math.max(...result.ratios.measured.map((item) => item.key.length));
  for (const item of result.ratios.measured) {
    lines.push(`  ${item.key.padEnd(width)}  ${round(item.value, 4)}   ${item.formula}`);
  }

  if (result.ratios.unavailable.length) {
    lines.push('');
    lines.push('unavailable');
    for (const item of result.ratios.unavailable) {
      lines.push(`  ${item.key.padEnd(width)}  ${item.reason}`);
    }
  }

  lines.push('');
  lines.push(
    'Ratios are measurements, not grades. Numbers like these vary with lens, pose and',
  );
  lines.push('expression, and there is no published set of "ideal" values worth ranking by.');

  process.stdout.write(`${lines.join('\n')}\n`);
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(error.message);
    fail(USAGE);
    return;
  }

  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  if (!options.file) {
    fail(USAGE);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(readFileSync(options.file, 'utf8'));
  } catch (error) {
    fail(`cannot read ${options.file}: ${error.message}`);
    return;
  }

  let result;
  try {
    result = metrics(extractPoints(payload), options.schema ? { schema: options.schema } : {});
  } catch (error) {
    fail(error.message);
    return;
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printTable(result);
  }
}

main();
