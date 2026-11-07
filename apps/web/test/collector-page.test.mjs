import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync(new URL('../public/collector/index.html', import.meta.url), 'utf8');

test('collector page is a self-contained, independently reachable HTML entry', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<title>Collector Insights/);
  assert.match(html, /<article id="markdown"/);
  assert.doesNotMatch(html, /<div id="root"/);
  assert.doesNotMatch(html, /\/src\/main\.jsx/);
});

test('collector page fetches the exact main-branch source and refreshes periodically', () => {
  assert.match(html, /raw\.githubusercontent\.com/);
  assert.match(html, /'\/main\/collector\.md'/);
  assert.match(html, /contents\/collector\.md\?ref=main/);
  assert.match(html, /const refreshMs = 60000/);
  assert.match(html, /cache: 'no-store'/);
  assert.match(html, /id="refresh"/);
});

test('collector page supports sanitized GFM, source parity and Mermaid fallback', () => {
  assert.match(html, /window\.marked\.parse\(markdownText\)/);
  assert.match(html, /window\.DOMPurify\.sanitize\(unsafeHtml/);
  assert.match(html, /gfm: true/);
  assert.match(html, /querySelectorAll\('table'\)/);
  assert.match(html, /querySelectorAll\('pre > code\.language-mermaid'\)/);
  assert.match(html, /id="raw-source"/);
  assert.match(html, /textContent = markdownText/);
  assert.match(html, /setMode\('source'\)/);
});

test('collector page always uses bright light mode including Mermaid diagrams', () => {
  assert.match(html, /<meta name="theme-color" content="#f6f8fc"/);
  assert.match(html, /color-scheme: light/);
  assert.doesNotMatch(html, /color-scheme: dark/);
  assert.match(html, /COLLECTOR LIGHT MODE/);
  assert.match(html, /--bg: #f6f8fc/);
  assert.match(html, /\.document \{[\s\S]*?background: #ffffff/);
  assert.match(html, /theme: 'base'/);
  assert.doesNotMatch(html, /theme: 'dark'/);
  assert.match(html, /background: '#ffffff'/);
});
