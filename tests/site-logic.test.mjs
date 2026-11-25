import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS, buyState, formState, submitForm, demoState, orderUrl, fetchOrder } from '../js/site.js';

const OK = "Thanks, we'll be in touch.";
const FAIL = 'Something went wrong. Try again in a minute.';

test('settings: forms go to Formspree; checkout and demo audio still ship empty', () => {
  assert.deepEqual(SETTINGS, { CHECKOUT_URL: '', KEYS_API_URL: 'https://keys.avenglabs.com', FORM_ENDPOINT: 'https://formspree.io/f/xbgozlnd', DEMO_AUDIO_URL: '' });
  assert.match(SETTINGS.FORM_ENDPOINT, /^https:\/\/formspree\.io\/f\/[a-z0-9]+$/i);
});

test('buyState without a checkout link scrolls to the Buy section', () => {
  assert.deepEqual(buyState(''), { live: false, href: '#buy', label: 'Checkout opening soon' });
});

test('buyState with a checkout link goes live', () => {
  assert.deepEqual(buyState('https://buy.stripe.com/abc'), { live: true, href: 'https://buy.stripe.com/abc', label: null });
});

test('orderUrl needs the key service address and a real-looking Stripe checkout id', () => {
  assert.equal(orderUrl('https://keys.example/', '?session_id=cs_test_a1B2c3D4e5F6'), 'https://keys.example/order?session_id=cs_test_a1B2c3D4e5F6');
  assert.equal(orderUrl('', '?session_id=cs_test_a1B2c3D4e5F6'), null);
  assert.equal(orderUrl('https://keys.example', ''), null);
  assert.equal(orderUrl('https://keys.example', '?session_id=../../etc'), null);
  assert.equal(orderUrl('https://keys.example', '?session_id=cs_x%26admin%3D1'), null);
});

test('fetchOrder returns the key, and fails quietly on any problem', async () => {
  const good = async () => ({ ok: true, json: async () => ({ key: 'SD-A-B', download_url: 'https://d' }) });
  assert.deepEqual(await fetchOrder('https://keys.example/order', good), { ok: true, key: 'SD-A-B', downloadUrl: 'https://d' });
  assert.deepEqual(await fetchOrder('u', async () => ({ ok: false, json: async () => ({}) })), { ok: false });
  assert.deepEqual(await fetchOrder('u', async () => ({ ok: true, json: async () => ({}) })), { ok: false });
  assert.deepEqual(await fetchOrder('u', async () => { throw new TypeError('offline'); }), { ok: false });
});

test('formState without an endpoint disables the newsletter form', () => {
  assert.deepEqual(formState('', 'newsletter'), { enabled: false, buttonLabel: 'Sign-ups open soon' });
});

test('formState without an endpoint disables the booking form', () => {
  assert.deepEqual(formState('', 'front-desk'), { enabled: false, buttonLabel: 'Booking opens soon' });
});

test('formState without an endpoint disables the insurance booking form', () => {
  assert.deepEqual(formState('', 'insurance-check'), { enabled: false, buttonLabel: 'Booking opens soon' });
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

test('makeSubmitter ignores a second submit while the first is in flight', async () => {
  const { makeSubmitter } = await import('../js/site.js');
  let calls = 0;
  let release;
  const slow = () => { calls++; return new Promise((r) => { release = () => r({ ok: true, status: 200 }); }); };
  const submit = makeSubmitter('https://formspree.io/f/x', slow);
  const first = submit(new FormData());
  const second = await submit(new FormData());
  assert.equal(second, null);
  release();
  assert.deepEqual(await first, { ok: true, message: OK });
  assert.equal(calls, 1);
  const third = submit(new FormData());
  release();
  assert.deepEqual(await third, { ok: true, message: OK });
  assert.equal(calls, 2);
});
