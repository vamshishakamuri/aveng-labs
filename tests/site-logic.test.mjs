import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS, buyState, formState, submitForm, demoState } from '../js/site.js';

const OK = "Thanks, we'll be in touch.";
const FAIL = 'Something went wrong. Try again in a minute.';

test('settings ship empty', () => {
  assert.deepEqual(SETTINGS, { CHECKOUT_URL: '', FORM_ENDPOINT: '', DEMO_AUDIO_URL: '' });
});

test('buyState without a checkout link scrolls to the Buy section', () => {
  assert.deepEqual(buyState(''), { live: false, href: '#buy', label: 'Checkout opening soon' });
});

test('buyState with a checkout link goes live', () => {
  assert.deepEqual(buyState('https://x.lemonsqueezy.com/buy/1'), { live: true, href: 'https://x.lemonsqueezy.com/buy/1', label: null });
});

test('formState without an endpoint disables the newsletter form', () => {
  assert.deepEqual(formState('', 'newsletter'), { enabled: false, buttonLabel: 'Sign-ups open soon' });
});

test('formState without an endpoint disables the booking form', () => {
  assert.deepEqual(formState('', 'front-desk'), { enabled: false, buttonLabel: 'Booking opens soon' });
});

test('formState with an endpoint enables the form', () => {
  assert.deepEqual(formState('https://formspree.io/f/x', 'newsletter'), { enabled: true, buttonLabel: null });
});

test('demoState without audio shows only the transcript', () => {
  assert.deepEqual(demoState(''), { showPlayer: false, label: 'Sample call transcript' });
});

test('demoState with audio shows the player', () => {
  assert.deepEqual(demoState('../audio/demo.mp3'), { showPlayer: true, label: 'Sample call' });
});

test('submitForm posts once as JSON-accepting and reports success', async () => {
  const calls = [];
  const data = new FormData();
  data.set('email', 'a@b.co');
  const fake = async (url, opts) => { calls.push([url, opts]); return { ok: true, status: 200 }; };
  const result = await submitForm('https://formspree.io/f/x', data, fake);
  assert.deepEqual(result, { ok: true, message: OK });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://formspree.io/f/x');
  assert.equal(calls[0][1].method, 'POST');
  assert.deepEqual(calls[0][1].headers, { Accept: 'application/json' });
  assert.equal(calls[0][1].body, data);
});

test('submitForm reports failure on a non-OK response', async () => {
  const result = await submitForm('https://formspree.io/f/x', new FormData(), async () => ({ ok: false, status: 422 }));
  assert.deepEqual(result, { ok: false, message: FAIL });
});

test('submitForm reports failure when offline and does not throw', async () => {
  const result = await submitForm('https://formspree.io/f/x', new FormData(), async () => { throw new TypeError('Failed to fetch'); });
  assert.deepEqual(result, { ok: false, message: FAIL });
});
