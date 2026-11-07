import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHighlandsReceipt} from '../src/highlands-insights/receiptOcr.js';
import {STORAGE_KEY,calculatePayable,normalizeTransaction,dripsFor,stampsFor,
  potentialDripsFor,rewardsProgress,monthlySeries,analytics,toCsv} from '../src/highlands-insights/model.js';
import {DRIVE_SYNC_KEY} from '../src/highlands-insights/driveSync.js';

const bauBang=[
 'HIGHLANDS COFFEE',
 'KCN Bau Bang, Duong NC -D13-5A, Tru Van',
 'Tho, TP.HCM',
 'SDT: 027.4730.1511',
 'ShopID: 30799',
 'Hoa Don Thanh Toan',
 'In Store                     Pager: 11',
 'Check: 139154',
 'Ngay: 03-11-2026 17:45             POS01',
 'Thu ngan: Thu Ngan Sang 1',
 '-----------------------------------',
 '1     Banh Tiramisu               39.000',
 '1     Nuoc Tinh Khiet Dasani       15.000',
 '      510ml',
 '-----------------------------------',
 'Thanh tien:                        54.000',
 'Tong tien:                         54.000',
 'Payoo Bank Card                    54.000',
 'Xuat hoa don: Quet QR'
].join('\n');

const make=(fields={})=>normalizeTransaction({
 id:'t1',date:'2026-11-03',store:'KCN Bau Bang',item:'Bánh Tiramisu · Nước Dasani',
 orderId:'139154',baseAmount:54000,extraAmount:0,discountAmount:0,amount:54000,
 fee:0,itemsCount:2,payment:'pos',eligible:true,identified:false,excluded:false,...fields
});

test('Highlands thermal POS receipt parses 2 line items without double counting totals and Payoo',()=>{
 const data=parseHighlandsReceipt(bauBang);
 assert.equal(data.fields.date,'2026-11-03');
 assert.equal(data.time,'17:45');
 assert.equal(data.fields.orderId,'139154');
 assert.equal(data.fields.store,'KCN Bau Bang');
 assert.equal(data.fields.payment,'pos');
 assert.equal(data.fields.itemsCount,'2');
 assert.equal(data.fields.baseAmount,'54000');
 assert.equal(data.fields.amount,'54000');
 assert.equal(data.items.length,2);
 assert.match(data.fields.item,/Banh Tiramisu/);
 assert.match(data.fields.item,/Dasani 510ml/);
 assert.ok(data.warnings.some(w=>/không xác nhận đã tích DRIPS/.test(w)));
});
test('Receipt parser rejects unrelated brands and never interprets QR or telephone as products',()=>{
 const other=parseHighlandsReceipt('STARBUCKS REWARDS\nCheck: 123456\nTong tien: 54000');
 assert.deepEqual(other.fields,{});
 const data=parseHighlandsReceipt(bauBang);
 assert.equal(data.items.length,2);
 assert.equal(data.subtotal,54000);
});
test('DRIPS floor to 10,000 and TemDI only with verified member and >=50k',()=>{
 assert.equal(STORAGE_KEY,'dn-highlands-insights-v1');
 assert.equal(DRIVE_SYNC_KEY,'dn-highlands-drive-sync-v1');
 assert.equal(dripsFor(make()),0);
 assert.equal(potentialDripsFor(make()),5);
 assert.equal(stampsFor(make()),0);
 assert.equal(dripsFor(make({identified:true})),5);
 assert.equal(stampsFor(make({identified:true})),1);
 assert.equal(dripsFor(make({identified:true,amount:29000,baseAmount:29000})),2);
 assert.equal(stampsFor(make({identified:true,amount:29000,baseAmount:29000})),0);
 assert.equal(dripsFor(make({identified:true,excluded:true})),0);
 assert.equal(dripsFor(make({identified:true,date:'2026-08-23'})),0);
});
test('Membership thresholds use monetary spend, not number of DRIPS',()=>{
 const config={cycleStart:'2026-01-01',tier:'gold',membershipAdjustment:0,rewardsAdjustment:0,redeemed:0,stampsRedeemed:0};
 const tx=make({identified:true});
 let progress=rewardsProgress([tx],config,'2026-11-07');
 assert.equal(progress.tier,'gold');assert.equal(progress.membership,54000);
 assert.equal(progress.rewards,5);assert.equal(progress.stamps,1);
 progress=rewardsProgress([make({identified:true,amount:3000000,baseAmount:3000000})],config,'2026-11-07');
 assert.equal(progress.tier,'platinum');
 progress=rewardsProgress([make({identified:true,amount:10000000,baseAmount:10000000})],config,'2026-11-07');
 assert.equal(progress.tier,'black');
});
test('Multi-month analytics, payment filtering and CSV preserve independent Highlands details',()=>{
 const tx=[make({id:'a'}),make({id:'b',date:'2026-10-03',amount:39000,baseAmount:39000,itemsCount:1})];
 const series=monthlySeries(tx,{period:'3',now:'2026-11-07'});
 assert.deepEqual(series.map(row=>row.amount),[0,39000,54000]);
 assert.equal(analytics(tx,series).total,93000);
 assert.match(toCsv(tx),/itemsCount/);
 assert.match(toCsv(tx),/139154/);
 assert.equal(calculatePayable(39000,15000,0),54000);
});
test('Independent Highlands page, route, style, quick link and separate Drive data',()=>{
 const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
 const html=read('../highlands-insights/index.html');
 const entry=read('../src/highlands-insights/HighlandsInsights.jsx');
 const vite=read('../vite.config.js');
 const quick=read('../src/App.jsx');
 const css=read('../src/highlands-insights/highlands.css');
 const google=read('../src/services/googleDriveService.js');
 assert.match(html,/Highlands Rewards/);
 assert.match(html,/\/src\/highlands-insights\/main.jsx/);
 assert.match(vite,/highlandsInsights: resolve\(ROOT, 'highlands-insights\/index.html'\)/);
 assert.match(quick,/href: '\/highlands-insights\/'/);
 assert.match(css,/color-scheme:light/);
 assert.match(entry,/parseHighlandsReceipt\(recognized.text\)/);
 assert.match(entry,/useHighlandsDriveSync/);
 assert.match(google,/dn_highlands/);
 assert.match(google,/readHighlandsState/);
 assert.match(google,/saveHighlandsSnapshot/);
 assert.doesNotMatch(entry,/delete mapped\.baseAmount/);
});
