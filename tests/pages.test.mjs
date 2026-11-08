import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['index.html', 'apps/super-dog.html', 'apps/front-desk.html'];

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

  test(`${page}: external shop and YouTube links open safely`, () => {
    const bad = [...html.matchAll(/<a\b[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => /href="[^"]*(mellowmeadowbaby\.com|youtube\.com)/.test(tag))
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
  assert.equal((html.match(/<a class="tile /g) || []).length, 4);
  assert.doesNotMatch(html, /id="channels"/);
});

test('apps/front-desk.html: booking, demo and form hooks', () => {
  const html = fs.existsSync(path.join(root, 'apps/front-desk.html')) ? readPage('apps/front-desk.html') : '';
  assert.match(html, /id="book"/);
  assert.match(html, /id="demo"/);
  assert.match(html, /data-form="front-desk"/);
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

test('apps/super-dog.html: menu matches the spec (All products, Voice, Shop, Shows, Buy)', () => {
  const html = readPage('apps/super-dog.html');
  const menu = html.slice(html.indexOf('id="site-menu"'), html.indexOf('</div>', html.indexOf('id="site-menu"')));
  for (const want of ['href="../"', 'href="front-desk.html"', 'mellowmeadowbaby.com', 'youtube.com', 'class="btn btn-dark btn-sm buy"']) {
    assert.ok(menu.includes(want), `menu missing ${want}`);
  }
});

test('styles.css: without JS, the phone header grows to fit the wrapped links', () => {
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.match(css, /html:not\(\.js\) \.nav \.wrap \{[^}]*height: auto/);
});
