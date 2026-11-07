import {calculatePayable,validDate} from './model.js';

// Parser riêng cho hóa đơn nhiệt Highlands (không dùng các nhãn Starbucks Rewards).
// Chỉ lấy số tiền trong vùng món hàng / nhãn thanh toán, không nhầm mã QR, số điện thoại, máy POS.
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const ascii=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/đ/gi,'d').toLowerCase();
// Hóa đơn nhiệt thường bị OCR tách/thay ký tự trong logo; chỉ dùng logo như
// một tín hiệu, không phải điều kiện bắt buộc để giữ các trường đã nhận diện.
const brandPattern=/(?:h\s*i\s*g\s*h\s*l\s*a\s*n\s*d\s*s|h[i1l][gqc]h?lands)\s*(?:co[fep]{2,3}e?)?/i;
const isBrand=line=>brandPattern.test(ascii(line));
const moneyAtEnd=line=>{
  const match=clean(line).match(/(?:^|[\s:])[-−]?\s*(?:₫|đ|d)?\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,8})(?:\s*(?:₫|đ|vnd))?\s*$/iu);
  if(!match)return null;
  const number=Number(match[1].replace(/\D/g,''));
  return Number.isSafeInteger(number)&&number>=0?number:null;
};
const withoutMoney=line=>clean(line).replace(/\s*[-−]?\s*(?:₫|đ|d)?\s*(?:\d{1,3}(?:[.,]\d{3})+|\d{4,8})(?:\s*(?:₫|đ|vnd))?\s*$/iu,'').trim();
const labels={
  subtotal:/^(?:thanh tien|tam tinh|cong tien hang|subtotal)\b/,
  total:/^(?:tong tien|tong thanh toan|thuc thu|grand total|total)\b/,
  discount:/(?:giam gia|chiet khau|discount|voucher|uu dai)/,
  extra:/(?:phu thu|topping|them mon|them sua|upsize|nang size|extra shot)/,
  fee:/(?:phi giao hang|delivery fee|phi dich vu)/
};
const labelAmount=(lines,pattern)=>{
  const i=lines.findIndex(line=>pattern.test(ascii(line)));
  if(i<0)return null;
  return moneyAtEnd(lines[i])??moneyAtEnd(lines[i+1]||'');
};
const parseDate=lines=>{
  for(const line of lines){
    const m=line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
    if(!m)continue;
    const date=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
    if(validDate(date))return {date,time:m[4]&&Number(m[4])<=23&&Number(m[5])<=59?m[4].padStart(2,'0')+':'+m[5]:''};
  }
  return {date:'',time:''};
};
const parseStore=lines=>{
  const brand=lines.findIndex(isBrand);
  if(brand<0){
    // Khi Tesseract bỏ mất logo, biển tên cửa hàng vẫn thường còn trên đầu hóa đơn.
    const candidate=lines.find(line=>/^(?:kcn|cn\b|chi nhanh|cua hang)\s+[a-z]/.test(ascii(line)));
    return candidate?clean(candidate.split(/,\s*/)[0]).slice(0,120):'';
  }
  for(let i=brand+1;i<Math.min(brand+5,lines.length);i++){
    const line=lines[i];
    const key=ascii(line);
    if(!line||/^(?:shopid|sdt|phone|hoa don|check|in store|ngay|pos|thu ngan)/.test(key))continue;
    const store=clean(line.split(/,\s*/)[0]).replace(/^(?:chi nhanh|cua hang)\s*:?\s*/i,'');
    if(store&&/[a-zA-ZÀ-ỹ]/.test(store))return store.slice(0,120);
  }
  return '';
};
const parseOrder=lines=>{
  const found=lines.map(line=>line.match(/\b(?:check|check\s*no|so\s*hoa\s*don|ma\s*don)\s*[:#]?\s*([A-Z0-9-]{4,25})/i)).find(Boolean);
  return found?.[1]||'';
};
const qtyItem=line=>{
  const match=clean(line).match(/^(\d{1,3})\s+(.+?)\s+([₫đ]?\s*\d{1,3}(?:[.,]\d{3})+|[₫đ]?\s*\d{4,8})\s*$/iu);
  if(!match)return null;
  const qty=Number(match[1]),amount=moneyAtEnd(line);
  if(!qty||qty>100||amount===null||amount===0)return null;
  const name=clean(match[2]);
  if(!/[a-zA-ZÀ-ỹ]/u.test(name)||labels.subtotal.test(ascii(name))||labels.total.test(ascii(name)))return null;
  return {name,quantity:qty,amount};
};
function parseItems(lines){
  const firstTotal=lines.findIndex(line=>labels.subtotal.test(ascii(line))||labels.total.test(ascii(line)));
  const end=firstTotal<0?lines.length:firstTotal;
  const check=lines.findIndex(line=>/^(?:check\s*:|hoa don thanh toan|thu ngan\s*:)/.test(ascii(line)));
  const start=check<0?0:check+1;
  const items=[],options=[];
  for(let i=start;i<end;i++){
    const line=lines[i],key=ascii(line);
    if(labels.extra.test(key)){
      const amount=moneyAtEnd(line);
      options.push({name:withoutMoney(line),amount});
      continue;
    }
    let item=qtyItem(line);
    // Các cách OCR tách cột: "1 Tiramisu" rồi "39.000", hoặc
    // "1" / "Bánh Tiramisu" / "39.000"; không thu thập dòng tổng tiền.
    if(!item&&/^\d{1,2}\s+[^\d].+/.test(line)&&i+1<end&&moneyAtEnd(lines[i+1])!==null){
      item=qtyItem(line+' '+lines[i+1]);
      if(item)i+=1;
    }
    if(!item&&/^\d{1,2}$/.test(line)&&i+2<end&&moneyAtEnd(lines[i+2])!==null){
      item=qtyItem(line+' '+lines[i+1]+' '+lines[i+2]);
      if(item)i+=2;
    }
    if(!item&&i>start&&/^\d{1,2}$/.test(lines[i-1])&&moneyAtEnd(line)!==null){
      item=qtyItem(lines[i-1]+' '+line);
    }
    if(!item)continue;
    // Những tên dài có dòng phụ "510ml" ngay dưới giá.
    if(i+1<end&&/^(?:\d{2,4}\s?ml|size\s*[a-z0-9]+)$/i.test(clean(lines[i+1]))){
      item.name+=' '+clean(lines[++i]);
    }
    items.push(item);
  }
  return {items,options};
}
const parsePayment=lines=>{
  const section=ascii(lines.join(' '));
  if(/(?:payoo bank card|bank card|mastercard|\bvisa\b|\bnapas\b)/.test(section))return 'pos';
  if(/(?:highlands\s*card|the highlands)/.test(section))return 'highlands-card';
  if(/(?:momo|zalopay|shopeepay|vi dien tu|chuyen khoan|qr payment)/.test(section))return 'wallet';
  if(/(?:tien mat|\bcash\b)/.test(section))return 'cash';
  if(/(?:highlandsdi|highlands di app)/.test(section))return 'app';
  return '';
};
export function parseHighlandsReceipt(text){
  const lines=String(text??'').split(/\r?\n/).map(clean).filter(Boolean);
  const warnings=[],fields={};
  const branded=lines.some(isBrand);
  const combined=ascii(lines.join(' '));
  // Các tín hiệu POS kết hợp cho phép nhận hóa đơn khi logo bị nhận sai.
  const signals=[
    /\b(?:shop\s*id|shopid)\s*[:#]?\s*\d{3,}/.test(combined),
    /\bcheck\s*[:#]?\s*\d{4,}/.test(combined),
    /(?:hoa don thanh toan|hoa don tinh tien)/.test(combined),
    /(?:payoo|pager\s*:|\bpos0\d\b)/.test(combined),
    /(?:thanh tien|tong tien)/.test(combined)
  ].filter(Boolean).length;
  // Không nhận hóa đơn của thương hiệu khác dù có Check và Tổng tiền.
  if((/(?:starbucks|phuc long|the coffee house)/i.test(combined)&&!branded)||
    (!branded&&signals<2)){
    warnings.push('Chưa xác nhận đúng mẫu hóa đơn Highlands: cần logo hoặc ít nhất hai dấu hiệu POS (Check/ShopID/Thành tiền/Payoo).');
    return {fields,warnings,lines,items:[],time:'',recognizedBrand:false};
  }
  if(!branded)warnings.push('Logo Highlands đọc chưa rõ; đã nhận diện từ dấu hiệu hóa đơn POS. Hãy đối chiếu cửa hàng trước khi lưu.');
  const {date,time}=parseDate(lines);
  if(date)fields.date=date;
  const store=parseStore(lines);if(store)fields.store=store;
  const orderId=parseOrder(lines);if(orderId)fields.orderId=orderId;
  const {items,options}=parseItems(lines);
  if(items.length){
    fields.item=items.map(x=>x.name).join(' · ').slice(0,120);
    fields.itemsCount=String(items.reduce((sum,x)=>sum+x.quantity,0));
    fields.baseAmount=String(items.reduce((sum,x)=>sum+x.amount,0));
  }
  const extra=labelAmount(lines,labels.extra);
  const discount=labelAmount(lines,labels.discount);
  const subtotal=labelAmount(lines,labels.subtotal);
  const total=labelAmount(lines,labels.total);
  const fee=labelAmount(lines,labels.fee);
  // Giữ giá món đã đọc; khi mất tên món, có thể khôi phục giá gốc từ
  // Thành tiền nếu không có phụ thu chưa nhận diện. Luôn gắn cảnh báo.
  if(!fields.baseAmount&&subtotal!==null&&extra===null){
    fields.baseAmount=String(subtotal);
    warnings.push('Chưa đọc đủ dòng món; giá gốc tạm lấy từ Thành tiền. Hãy kiểm tra phụ thu, số món và giá gốc trên ảnh.');
  }
  if(extra!==null)fields.extraAmount=String(extra);
  if(options.length)fields.extraReason=options.map(x=>x.name).join(' · ').slice(0,200);
  if(discount!==null)fields.discountAmount=String(discount);
  const discountLine=lines.find(line=>labels.discount.test(ascii(line)));
  if(discountLine){
    const description=withoutMoney(discountLine).replace(/^(?:giảm giá|giam gia|discount|ưu đãi|voucher|chiết khấu)\s*[:\-]?\s*/i,'').trim();
    if(description&&ascii(description)!==ascii(withoutMoney(discountLine)))fields.discountReason=description.slice(0,200);
  }
  if(fee!==null)fields.fee=String(fee);
  const payment=parsePayment(lines);if(payment)fields.payment=payment;
  if(total!==null)fields.amount=String(total);
  else if(subtotal!==null&&discount!==null&&subtotal>=discount){
    fields.amount=String(subtotal-discount);
    warnings.push('Không thấy nhãn Tổng tiền; thực trả đang được suy từ thành tiền trừ giảm giá.');
  }else if(subtotal!==null){
    fields.amount=String(subtotal);
    warnings.push('Không thấy nhãn Tổng tiền; vui lòng kiểm tra Thành tiền trên ảnh.');
  }
  if(subtotal!==null&&total!==null&&subtotal-(discount||0)!==total)
    warnings.push('Thành tiền, giảm giá và tổng tiền không khớp; hãy kiểm tra trước khi lưu.');
  if(fields.baseAmount&&fields.amount&&
      calculatePayable(fields.baseAmount,fields.extraAmount||0,fields.discountAmount||0)!==Number(fields.amount))
    warnings.push('Cộng các dòng sản phẩm không khớp tổng hóa đơn; giữ nguyên số OCR để bạn đối chiếu.');
  if(!fields.orderId)warnings.push('Chưa đọc được Check No. / mã hóa đơn.');
  if(!items.length)warnings.push('Chưa đọc được danh sách món; cần xem lại vùng sản phẩm trên ảnh.');
  if(!fields.amount)warnings.push('Chưa đọc được tổng thanh toán.');
  warnings.push('Hóa đơn POS không xác nhận đã tích DRIPS; chỉ chọn "Đã quét tài khoản HighlandsĐI" khi bạn thực sự đã quét.');
  return {fields,warnings,lines,items,subtotal,time,recognizedBrand:branded,signals};
}
