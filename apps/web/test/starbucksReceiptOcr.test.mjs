import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { parseStarbucksReceipt } from '../src/starbucks-insights/receiptOcr.js';

const sora = [
  'STARBUCKS REWARDS',
  'Mã đơn hàng O200147006',
  'Ngày & Giờ 01/11/2026 11:34',
  'Điểm Ngôi Sao đã tích lũy 1',
  'Điểm Ngôi Sao thưởng 0',
  'Giao dịch tại cửa hàng',
  'Sora Mall',
  'Vị trí 102, Tầng 1, Lô C19',
  'Pure Matcha Latte ₫80,000',
  'Lựa chọn Sữa: Sữa Half & Half ₫5,000',
  'Độ ngọt: Không ngọt',
  'x1',
  'Personal Cup ₫0',
  'x1',
  'Tổng số món 2',
  'Tạm tính ₫85,000',
  'Giảm giá -₫10,000',
  'Tổng đơn hàng ₫75,000',
  'PHƯƠNG THỨC THANH TOÁN',
  'VISA(437841******8921) ₫75,000'
].join('\n');

test('Starbucks Rewards screenshot fills transaction without double-counting extras', () => {
  const result = parseStarbucksReceipt(sora);
  assert.equal(result.fields.orderId, 'O200147006');
  assert.equal(result.fields.date, '2026-11-01');
  assert.equal(result.time, '11:34');
  assert.equal(result.fields.store, 'Sora Mall');
  assert.equal(result.fields.item, 'Pure Matcha Latte');
  assert.equal(result.fields.baseAmount, '80000');
  assert.equal(result.fields.extraAmount, '5000');
  assert.match(result.fields.extraReason, /Half & Half/);
  assert.equal(result.fields.discountAmount, '10000');
  assert.equal(result.fields.discountReason, undefined); // Lý do giảm không có trên ảnh.
  assert.equal(result.fields.amount, '75000');
  assert.equal(result.fields.cups, '1'); // Personal Cup không phải đồ uống thứ hai.
  assert.equal(result.fields.payment, 'pos');
  assert.equal(result.warnings.length, 0);
});

test('OCR supports accentless labels, price on next line, and unknown discount reason', () => {
  const result = parseStarbucksReceipt([
    'Ma don hang', '0123456789',
    'Ngay & Gio 07/11/2026 08:09',
    'Giao dich tai cua hang', 'Landmark 81',
    'Caffe Latte', 'd80,000',
    'Lua chon sua: Sữa Half & Half', 'd5,000',
    'Tam tinh', 'd85,000',
    'Giam gia', '-d10,000',
    'Tong don hang', 'd75,000',
    'VISA'
  ].join('\n'));
  assert.equal(result.fields.orderId, '0123456789');
  assert.equal(result.fields.date, '2026-11-07');
  assert.equal(result.fields.baseAmount, '80000');
  assert.equal(result.fields.extraAmount, '5000');
  assert.equal(result.fields.discountAmount, '10000');
  assert.equal(result.fields.amount, '75000');
  assert.equal(result.fields.store, 'Landmark 81');
  assert.equal(result.fields.discountReason, undefined);
});

test('Inconsistent or partial OCR warns instead of inventing payment totals', () => {
  const result = parseStarbucksReceipt([
    'Mã đơn hàng O123456789',
    'Ngày & Giờ 01/11/2026 11:34',
    'Giao dịch tại cửa hàng',
    'Sora Mall',
    'Matcha Latte ₫80,000',
    'Tạm tính ₫80,000',
    'Giảm giá -₫10,000',
    'Tổng đơn hàng ₫75,000',
    'VISA(123456789) ₫75,000'
  ].join('\n'));
  assert.equal(result.fields.amount, '75000');
  assert.ok(result.warnings.some(text => /không khớp/i.test(text)));
  const missing = parseStarbucksReceipt('VISA(123456******7890) ₫75,000\nSTARBUCKS REWARDS');
  assert.equal(missing.fields.amount, undefined);
  assert.ok(missing.warnings.some(text => /Chưa đọc được tổng thực trả/.test(text)));
});

test('Upload remains opt-in, browser-only and does not save an OCR result', () => {
  const component = readFileSync(new URL('../src/starbucks-insights/StarbucksInsights.jsx', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../src/starbucks-insights/receiptOcrBrowser.js', import.meta.url), 'utf8');
  assert.match(component, /parseStarbucksReceipt\(recognized\.text\)/);
  assert.match(component, /setForm\(\{ \.\.\.initialForm\(\), \.\.\.mapped \}\)/);
  assert.match(component, /onChange=\{importReceiptImage\}/);
  assert.match(component, /Chọn ảnh hóa đơn/);
  assert.match(component, /Chỉ lưu khi bạn bấm Thêm giao dịch/);
  assert.match(worker, /worker\.recognize\(file\)/);
  assert.doesNotMatch(worker, /fetch\(file|FormData|XMLHttpRequest|upload\.php/i);
});
