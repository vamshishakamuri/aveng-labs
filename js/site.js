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
