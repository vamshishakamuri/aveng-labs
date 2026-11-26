// Aveng Labs site behavior. Fill these in when the services are ready;
// every page behaves honestly while a setting is empty.
export const SETTINGS = {
  CHECKOUT_URL: 'https://buy.stripe.com/4gM4gyfP44b7dpN80S93y01', // Stripe payment link for Super Dog (live, Managed Payments on)
  KEYS_API_URL: 'https://keys.avenglabs.com', // Super Dog key service
  FORM_ENDPOINT: 'https://formspree.io/f/xbgozlnd', // Formspree: sign-ups and demo requests, one form (each post carries its source)
  DEMO_AUDIO_URL: '', // Front Desk sample call, e.g. '../audio/front-desk-demo.mp3'
};

const SUCCESS = "Thanks, we'll be in touch.";
const FAILURE = 'Something went wrong. Try again in a minute.';

export function buyState(checkoutUrl) {
  return checkoutUrl
    ? { live: true, href: checkoutUrl, label: null }
    : { live: false, href: '#buy', label: 'Checkout opening soon' };
}

export function formState(endpoint, kind) {
  if (endpoint) return { enabled: true, buttonLabel: null };
  return { enabled: false, buttonLabel: ['front-desk', 'insurance-check'].includes(kind) ? 'Booking opens soon' : 'Sign-ups open soon' };
}

export async function submitForm(endpoint, data, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body: data });
    return res.ok ? { ok: true, message: SUCCESS } : { ok: false, message: FAILURE };
  } catch {
    return { ok: false, message: FAILURE };
  }
}

export function demoState(audioUrl) {
  return audioUrl
    ? { showPlayer: true, label: 'Sample call' }
    : { showPlayer: false, label: 'Sample call transcript' };
}

// Wraps submitForm so a second submit while one is in flight is ignored (returns null).
export function makeSubmitter(endpoint, fetchImpl = fetch) {
  let busy = false;
  return async (data) => {
    if (busy) return null;
    busy = true;
    try {
      return await submitForm(endpoint, data, fetchImpl);
    } finally {
      busy = false;
    }
  };
}

export function initMenu(doc) {
  const btn = doc.querySelector('.menu-btn');
  const menu = doc.getElementById('site-menu');
  if (!btn || !menu) return;
  const set = (open) => {
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', () => set(!menu.classList.contains('open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) { set(false); btn.focus(); }
  });
  const wide = doc.defaultView.matchMedia('(min-width: 681px)');
  wide.addEventListener('change', (e) => { if (e.matches) set(false); });
}

export function initCheckout(doc, settings) {
  const state = buyState(settings.CHECKOUT_URL);
  const buttons = doc.querySelectorAll('a.buy');
  if (!buttons.length) return;
  if (!state.live) {
    buttons.forEach((a) => { a.textContent = state.label; a.href = state.href; });
    doc.querySelectorAll('[data-checkout-note]').forEach((n) => { n.hidden = false; });
    return;
  }
  // Stripe's payment page opens as an ordinary page; it sends the buyer back to the thank-you page.
  buttons.forEach((a) => { a.href = state.href; });
}

// The thank-you page: Stripe adds ?session_id=... to its address after payment.
export function orderUrl(apiUrl, search) {
  const id = new URLSearchParams(search || '').get('session_id') || '';
  if (!apiUrl || !/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) return null;
  return `${apiUrl.replace(/\/+$/, '')}/order?session_id=${id}`;
}

export async function fetchOrder(url, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return { ok: false };
    const body = await res.json();
    return body && body.key ? { ok: true, key: body.key, downloadUrl: body.download_url || null } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function initThanks(doc, settings, fetchImpl) {
  const box = doc.querySelector('[data-order]');
  if (!box) return;
  const show = (state) => { box.dataset.order = state; };
  const url = orderUrl(settings.KEYS_API_URL, doc.defaultView.location.search);
  if (!url) { show('missing'); return; }
  const order = await fetchOrder(url, fetchImpl);
  if (!order.ok) { show('error'); return; }
  box.querySelector('[data-key]').textContent = order.key;
  const dl = box.querySelector('[data-download]');
  if (dl && order.downloadUrl) dl.href = order.downloadUrl;
  const copy = box.querySelector('[data-copy]');
  if (copy) copy.addEventListener('click', async () => {
    try { await doc.defaultView.navigator.clipboard.writeText(order.key); copy.textContent = 'Copied'; } catch { copy.textContent = 'Select the key and copy it'; }
  });
  show('ready');
}

export function initForms(doc, settings) {
  doc.querySelectorAll('form[data-form]').forEach((form) => {
    const kind = form.dataset.form;
    const state = formState(settings.FORM_ENDPOINT, kind);
    const button = form.querySelector('button');
    const msg = form.querySelector('.form-msg');
    const fields = form.querySelectorAll('input, select, textarea, button');
    if (!state.enabled) {
      fields.forEach((f) => { f.disabled = true; });
      if (button) button.textContent = state.buttonLabel;
      return;
    }
    fields.forEach((f) => { f.disabled = false; });
    const idle = button ? (button.dataset.liveLabel || button.textContent) : '';
    if (button) button.textContent = idle;
    const submit = makeSubmitter(settings.FORM_ENDPOINT);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      data.set('source', kind);
      if (button) { button.disabled = true; button.textContent = 'Sending…'; }
      const result = await submit(data);
      if (result === null) return;
      if (button) { button.disabled = false; button.textContent = idle; }
      if (msg) {
        msg.textContent = result.message;
        msg.classList.toggle('error', !result.ok);
      }
      if (result.ok) form.reset();
    });
  });
}

export function initDemo(doc, settings) {
  const state = demoState(settings.DEMO_AUDIO_URL);
  const label = doc.querySelector('#demo [data-demo-label]');
  if (label) label.textContent = state.label;
  const player = doc.querySelector('#demo [data-player]');
  if (!player || !state.showPlayer) return;
  const audio = player.querySelector('audio');
  if (audio) audio.src = state.showPlayer ? settings.DEMO_AUDIO_URL : '';
  player.hidden = false;
}

if (typeof document !== 'undefined') {
  document.documentElement.classList.add('js');
  initMenu(document);
  initCheckout(document, SETTINGS);
  initForms(document, SETTINGS);
  initDemo(document, SETTINGS);
  initThanks(document, SETTINGS);
  const nav = document.querySelector('.nav');
  if (nav) addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 8), { passive: true });
}
