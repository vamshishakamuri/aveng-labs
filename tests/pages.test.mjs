import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['index.html', 'apps/super-dog.html', 'apps/front-desk.html', 'apps/insurance-check.html', 'apps/memory-keeper.html', 'apps/super-dog-thanks.html'];

export function readPage(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

export function localRefs(html) {
  const refs = [];
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const v = m[1];
    if (!v || /^(https?:|mailto:|tel:|data:|#)/.test(v)) continue;
    refs.push(v.split('#')[0].split('?')[0]);
  }
  return refs.filter(Boolean);
}

for (const page of PAGES) {
  const exists = fs.existsSync(path.join(root, page));
  const html = exists ? readPage(page) : '';

  test(`${page}: exists`, () => assert.ok(exists, `${page} is missing`));

  test(`${page}: every local href and src resolves to a file`, () => {
    const dir = path.dirname(path.join(root, page));
    const missing = localRefs(html).filter((ref) => {
      let p = path.resolve(dir, ref);
      if (ref.endsWith('/')) p = path.join(p, 'index.html');
      return !fs.existsSync(p);
    });
    assert.deepEqual(missing, []);
  });

  test(`${page}: has favicon links`, () => {
    for (const f of ['img/brand/favicon.svg', 'img/brand/favicon-32.png', 'img/brand/apple-touch-icon.png']) {
      assert.ok(html.includes(f), `missing ${f}`);
    }
  });

  test(`${page}: has no private GitHub link`, () => {
    assert.doesNotMatch(html, /github\.com\/Aveng3r80/);
  });

  test(`${page}: external shop links open safely`, () => {
    const bad = [...html.matchAll(/<a\b[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => /href="[^"]*(mellowmeadowbaby\.com)/.test(tag))
      .filter((tag) => !/target="_blank"/.test(tag) || !/rel="noopener"/.test(tag));
    assert.deepEqual(bad, []);
  });

  test(`${page}: menu button is wired`, () => {
    assert.match(html, /<button class="menu-btn"[^>]*aria-expanded="false"[^>]*aria-controls="site-menu"/);
    assert.match(html, /id="site-menu"/);
  });

  test(`${page}: loads site.js as a module`, () => {
    assert.match(html, /<script type="module" src="(\.\.\/)?js\/site\.js">/);
  });
}

test('index.html: studio shelf structure', () => {
  const html = readPage('index.html');
  assert.match(html, /id="shelf"/);
  assert.equal((html.match(/<a class="tile /g) || []).length, 5);
  assert.match(html, /href="apps\/insurance-check\.html"/);
  assert.match(html, /href="apps\/memory-keeper\.html"/);
  assert.doesNotMatch(html, /id="channels"/);
});

test('apps/front-desk.html: booking, demo and form hooks', () => {
  const html = fs.existsSync(path.join(root, 'apps/front-desk.html')) ? readPage('apps/front-desk.html') : '';
  assert.match(html, /id="book"/);
  assert.match(html, /id="demo"/);
  assert.match(html, /data-form="front-desk"/);
});

test('apps/insurance-check.html: booking, sample note and form hooks', () => {
  const html = readPage('apps/insurance-check.html');
  assert.match(html, /id="book"/);
  assert.match(html, /id="note"/);
  assert.match(html, /data-form="insurance-check"/);
  assert.match(html, /fictional/);
});

test('apps/insurance-check.html: copy stays within the allowed claims', () => {
  const html = readPage('apps/insurance-check.html');
  // What an electronic check can't promise: no compliance badge, no guarantee, no network status.
  assert.doesNotMatch(html, /HIPAA[- ]compliant/i);
  assert.doesNotMatch(html, /guarantee(?!s? of payment)/i);
  assert.match(html, /not a guarantee of payment/);
  assert.match(html, /whether this office is in network/);
  assert.doesNotMatch(html, /\$\d+\s*(?:\/|a |per )\s*mo/i);
});

test('every page footer links to Memory Keeper', () => {
  for (const page of PAGES) assert.match(readPage(page), /memory-keeper\.html">Memory Keeper<\/a>/, page);
});

test('apps/memory-keeper.html: waitlist, sample and form hooks', () => {
  const html = readPage('apps/memory-keeper.html');
  assert.match(html, /id="waitlist"/);
  assert.match(html, /id="sample"/);
  assert.match(html, /data-form="memory-keeper"/);
  assert.match(html, /fictional/);
});

test('memory keeper copy stays within the allowed claims', () => {
  // Not open yet: no price, no launch date, nothing a visitor could take as "buy it today".
  for (const page of ['index.html', 'apps/memory-keeper.html']) {
    const html = readPage(page);
    const part = page === 'index.html' ? html.slice(html.indexOf('tile c-keep'), html.indexOf('</a>', html.indexOf('tile c-keep'))) : html;
    assert.match(part, /Coming soon/, page);
    assert.doesNotMatch(part, /\$\d/, page);
    assert.doesNotMatch(part, /available now|buy now|order now|Mother's Day|Father's Day|Christmas/i, page);
  }
  const html = readPage('apps/memory-keeper.html');
  const text = html.slice(html.indexOf('<header'), html.indexOf('<footer>'));
  assert.match(text, /The price isn't set yet/);
  assert.match(text, /isn't open to the public/);
  // The opening story is an illustration, never a testimonial, and uses no real family's names.
  assert.match(text, /Kiran and Ammamma are fictional/);
  assert.doesNotMatch(text, /\b(Arvind|Vamshi|Rose)\b/);
  // Unverified security claims, and things that are not built or not proven.
  assert.doesNotMatch(text, /secure|encrypt|HIPAA|private by design/i);
  assert.doesNotMatch(text, /play ?back|hear them|gift|shipped|schedul|Tamil|Kannada|Malayalam|StoryWorth|Remento/i);
  assert.match(text, /Hindi coming next/);
  // The two other companies are named, with no retention figures quoted for them.
  assert.match(text, /Twilio carries the phone call/);
  assert.match(text, /Anthropic, the maker of Claude/);
  assert.match(text, /cannot reach into their systems/);
  assert.doesNotMatch(text, /\d+\s*(days?|hours?|months?)/i);
});

test('every page footer links to Insurance Check', () => {
  for (const page of PAGES) assert.match(readPage(page), /insurance-check\.html">Insurance Check<\/a>/, page);
});

test('apps/super-dog.html: more-from row and buy buttons', () => {
  const html = readPage('apps/super-dog.html');
  assert.match(html, /class="more"/);
  assert.ok((html.match(/class="[^"]*\bbuy\b/g) || []).length >= 3);
});

// ---- Final review fixes ----
for (const page of PAGES) {
  const html = fs.existsSync(path.join(root, page)) ? readPage(page) : '';

  test(`${page}: menu button comes before the menu so focus reaches the links`, () => {
    assert.ok(html.indexOf('class="menu-btn"') < html.indexOf('id="site-menu"'));
  });

  test(`${page}: forms post and ship disabled until site.js enables them`, () => {
    for (const m of html.matchAll(/<form data-form[^>]*>[\s\S]*?<\/form>/g)) {
      const form = m[0];
      assert.match(form, /^<form data-form="[^"]+" method="post"/);
      const controls = form.match(/<(input|select|button)\b[^>]*>/g);
      assert.ok(controls.every((c) => /\sdisabled\b/.test(c)), controls.filter((c) => !/\sdisabled\b/.test(c)).join('\n'));
      assert.match(form, /<button[^>]*data-live-label="[^"]+"/);
    }
  });
}

test('apps/front-desk.html: copy stays within the allowed claims', () => {
  const html = readPage('apps/front-desk.html');
  assert.doesNotMatch(html, /before you pay anything/);
  assert.doesNotMatch(html, /right away/);
  assert.doesNotMatch(html, /every word/);
});

test('apps/super-dog.html: menu matches the spec (All products, Voice, Shop, Buy)', () => {
  const html = readPage('apps/super-dog.html');
  const menu = html.slice(html.indexOf('id="site-menu"'), html.indexOf('</div>', html.indexOf('id="site-menu"')));
  for (const want of ['href="../"', 'href="front-desk.html"', 'mellowmeadowbaby.com', 'class="btn btn-dark btn-sm buy"']) {
    assert.ok(menu.includes(want), `menu missing ${want}`);
  }
});

test('styles.css: without JS, the phone header grows to fit the wrapped links', () => {
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.match(css, /html:not\(\.js\) \.nav \.wrap \{[^}]*height: auto/);
});

test('apps/super-dog.html: describes license activation honestly', () => {
  const html = readPage('apps/super-dog.html');
  assert.doesNotMatch(html, /no internet needed/i);
  assert.match(html, /License key for one computer/);
  assert.doesNotMatch(html, /3 computers/);
  assert.match(html, /<summary>How do I activate Super Dog\?<\/summary>/);
  assert.match(html, /once to activate/);
});

test('super dog: no page mentions Lemon Squeezy, which has closed', () => {
  for (const page of PAGES) assert.doesNotMatch(readPage(page), /lemon ?squeezy/i, page);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'js/site.js'), 'utf8'), /lemonsqueezy\.com/);
});

test('apps/super-dog-thanks.html: shows the key only through site.js, with a fallback for every outcome', () => {
  const html = readPage('apps/super-dog-thanks.html');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /data-order="loading"/);
  for (const part of ['when-ready', 'when-error', 'when-missing', 'data-key', 'data-copy', 'data-download', '<noscript>']) assert.ok(html.includes(part), part);
  assert.doesNotMatch(html, /class="[^"]*\bbuy\b/);
  assert.doesNotMatch(html, /SD-[A-Za-z0-9]/);
});

test('super dog: no page promises a key email until an email service is connected', () => {
  for (const page of ['apps/super-dog.html', 'apps/super-dog-thanks.html']) {
    assert.doesNotMatch(readPage(page), /emailed|by email|email we sent|receipt email/i, page);
  }
});
