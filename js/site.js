// Aveng Labs site behavior. Fill these in when the services are ready;
// every page behaves honestly while a setting is empty.
export const SETTINGS = {
  CHECKOUT_URL: '',   // Lemon Squeezy product share link for Super Dog
  FORM_ENDPOINT: '',  // Formspree (or similar) form URL for sign-ups and demo requests
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
  return { enabled: false, buttonLabel: kind === 'front-desk' ? 'Booking opens soon' : 'Sign-ups open soon' };
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
  buttons.forEach((a) => { a.href = state.href; a.classList.add('lemonsqueezy-button'); });
  const s = doc.createElement('script');
  s.src = 'https://app.lemonsqueezy.com/js/lemon.js';
  s.defer = true;
  s.onload = () => doc.defaultView.createLemonSqueezy?.();
  doc.head.appendChild(s);
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
    const submit = makeSubmitter(settings.FORM_ENDPOINT);
    const idle = button ? button.textContent : '';
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
  const nav = document.querySelector('.nav');
  if (nav) addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 8), { passive: true });
}
