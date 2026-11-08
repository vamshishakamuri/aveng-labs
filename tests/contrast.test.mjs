import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const token = (name) => root.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))[1];

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('white button text on --accent meets AA for normal text', () => {
  assert.ok(ratio('#ffffff', token('accent')) >= 4.5, ratio('#ffffff', token('accent')).toFixed(2));
});

test('--ink-3 captions on --bg meet AA for normal text', () => {
  assert.ok(ratio(token('ink-3'), token('bg')) >= 4.5, ratio(token('ink-3'), token('bg')).toFixed(2));
});

test('--ink-3 captions on --card meet AA for normal text', () => {
  assert.ok(ratio(token('ink-3'), token('card')) >= 4.5, ratio(token('ink-3'), token('card')).toFixed(2));
});
