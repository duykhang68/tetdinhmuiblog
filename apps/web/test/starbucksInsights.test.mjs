import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  POLICY_EFFECTIVE_DATE, analytics, membershipPeriod, monthlySeries, normalizeTransaction,
  rewardsProgress, starsFor, toCsv, todayVietnam, validDate
} from '../src/starbucks-insights/model.js';

const base = {
  id: 'receipt-1', date: '2026-10-15', store: 'Landmark 81',
  item: 'Caffè Latte', amount: 90000, cups: 2, fee: 0,
  payment: 'starbucks-card', eligible: true, identified: true, linked: false, excluded: false
};
const make = overrides => normalizeTransaction({ ...base, ...overrides });

test('Vietnam policy effective date, fractional stars, and 3 payment rates', () => {
  assert.equal(POLICY_EFFECTIVE_DATE, '2026-08-18');
  assert.equal(starsFor(make({ amount: 90000 })), 2.25);
  assert.equal(starsFor(make({ amount: 90000, payment: 'wallet' })), 1.5);
  assert.equal(starsFor(make({ amount: 90000, payment: 'pos' })), 1.5);
  assert.equal(starsFor(make({ amount: 90000, payment: 'voucher' })), 1.5);
  assert.equal(starsFor(make({ amount: 90000, payment: 'third-party', linked: true })), 1.125);
});

test('Stars exclude disqualified, fee, unidentified, pre-policy and third party cash payments', () => {
  assert.equal(starsFor(make({ payment: 'third-party-cash', linked: true })), 0);
  assert.equal(starsFor(make({ payment: 'third-party', linked: false })), 0);
  assert.equal(starsFor(make({ identified: false })), 0);
  assert.equal(starsFor(make({ eligible: false })), 0);
  assert.equal(starsFor(make({ excluded: true })), 0);
  assert.equal(starsFor(make({ date: '2026-08-17' })), 0);
  assert.equal(starsFor(make({ amount: 90000, fee: 10000 })), 2);
  assert.equal(starsFor(make({ date: '2026-08-18' })), 2.25);
});

test('Invalid dates, amounts, cups, payment and fees are rejected', () => {
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2026-02-28'), true);
  assert.throws(() => make({ date: '2026-02-30' }), /Ngày giao dịch/);
  assert.throws(() => make({ amount: -1 }), /Số tiền/);
  assert.throws(() => make({ amount: 30000, fee: 30001 }), /Phí/);
  assert.throws(() => make({ cups: -1 }), /Số ly/);
  assert.throws(() => make({ payment: 'unknown' }), /Phương thức/);
});

test('Monthly grouping works across years, zero fills and separates visits from cups', () => {
  const transactions = [
    make({ id: 'a', date: '2025-12-12', amount: 85000, cups: 2 }),
    make({ id: 'b', date: '2026-02-01', amount: 125000, cups: 1 }),
    make({ id: 'c', date: '2026-02-20', amount: 50000, cups: 3 })
  ];
  const rows = monthlySeries(transactions, { period: '4', now: '2026-03-02' });
  assert.deepEqual(rows.map(row => row.key), ['2025-12', '2026-01', '2026-02', '2026-03']);
  assert.deepEqual(rows.map(row => row.amount), [85000, 0, 175000, 0]);
  const stat = analytics(transactions, rows);
  assert.equal(stat.total, 260000);
  assert.equal(stat.visits, 3);
  assert.equal(stat.cups, 6);
  assert.equal(stat.averageVisit, 260000 / 3);
  assert.equal(stat.peak.key, '2026-02');
  assert.equal(stat.low.key, '2025-12');
  assert.equal(stat.current, 0);
});

test('Year filter and payment filter are scoped independently', () => {
  const transactions = [
    make({ id: 'a', date: '2026-06-03', amount: 50000, payment: 'starbucks-card' }),
    make({ id: 'b', date: '2026-06-04', amount: 40000, payment: 'cash' }),
    make({ id: 'c', date: '2025-06-04', amount: 40000, payment: 'cash' })
  ];
  const rows = monthlySeries(transactions, { year: '2026', payment: 'cash', now: '2026-11-07' });
  assert.equal(rows.length, 12);
  assert.equal(rows[5].amount, 40000);
  assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), 40000);
});

test('Membership cycle resets at anniversary and Green/Gold goals stay separate from reward Stars', () => {
  assert.deepEqual(membershipPeriod('2025-08-01', '2026-11-07'), {
    start: '2026-08-01', end: '2027-08-01', upcoming: false
  });
  const transactions = [
    make({ id: 'old', date: '2026-07-28', amount: 80000 }),
    make({ id: 'new', date: '2026-09-30', amount: 80000 })
  ];
  const green = rewardsProgress(transactions, { cycleStart: '2025-08-01', tier: 'green', redeemed: 1 }, '2026-11-07');
  assert.equal(green.membership, 2);
  assert.equal(green.rewards, 3);
  assert.equal(green.remaining, 98);
  assert.equal(green.redemptionGoal, 20);
  const gold = rewardsProgress(transactions, { cycleStart: '2025-08-01', tier: 'gold' }, '2026-11-07');
  assert.equal(gold.redemptionGoal, 10);
});

test('CSV exports fields and escapes quotes', () => {
  const csv = toCsv([make({ item: 'Latte "Size L"' })]);
  assert.match(csv, /^\uFEFFid,date,store,item,/);
  assert.match(csv, /"Latte ""Size L"""/);
});

test('Independent page and Editor shortcut are wired to Vite multi-page build', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
  const html = read('../starbucks-insights/index.html');
  const vite = read('../vite.config.js');
  const editor = read('../src/App.jsx');
  const css = read('../src/starbucks-insights/starbucks.css');
  assert.match(html, /Starbucks Rewards/);
  assert.match(html, /\/src\/starbucks-insights\/main\.jsx/);
  assert.match(vite, /starbucksInsights: resolve\(ROOT, 'starbucks-insights\/index.html'\)/);
  assert.match(editor, /href: '\/starbucks-insights\/'/);
  assert.match(editor, /EDITOR_QUICK_LINKS\.length\.toString\(\)\.padStart/);
  assert.match(css, /color-scheme:light/);
  assert.doesNotMatch(css, /slate-900|slate-950|color-scheme:dark/);
});
