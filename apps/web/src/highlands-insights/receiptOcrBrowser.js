import {parseHighlandsReceipt} from './receiptOcr.js';

// OCR hoàn toàn trong browser: không gửi ảnh lên backend.
// Hai chiến lược: đọc ảnh gốc, sau đó tự khoanh vùng giấy trắng / tăng tương phản
// để tránh nền bàn gỗ và QR code làm mất các dòng tài chính.
const TESSERACT_URL='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
let libraryPromise;
function loadTesseract(){
  if(typeof window==='undefined')return Promise.reject(new Error('OCR chỉ hỗ trợ trên trình duyệt.'));
  if(window.Tesseract?.createWorker)return Promise.resolve(window.Tesseract);
  if(!libraryPromise){
    libraryPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=TESSERACT_URL;script.async=true;script.crossOrigin='anonymous';
      script.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(new Error('Không khởi tạo được OCR.'));
      script.onerror=()=>reject(new Error('Không tải được OCR. Kiểm tra mạng hoặc CDN.'));
      document.head.appendChild(script);
    }).catch(error=>{libraryPromise=null;throw error;});
  }
  return libraryPromise;
}
function quality(result){
  let parsed;
  try{parsed=parseHighlandsReceipt(result.text||'');}
  catch{return 0;}
  const fields=parsed.fields||{};
  const score=(fields.amount?40:0)+(fields.baseAmount?18:0)+(fields.item?22:0)+
    (fields.date?9:0)+(fields.orderId?9:0)+(fields.payment?5:0)+(fields.store?5:0)+
    (parsed.items?.length||0)*4+(parsed.recognizedBrand?3:0);
  // Độ tin cậy Tesseract là chỉ số phụ; không nên ưu tiên chữ rác "đẹp"
  // hơn văn bản có đủ dòng thanh toán được parser xác nhận.
  return score+Math.min(100,Math.max(0,Number(result.confidence)||0))*.02+
    Math.min(4,String(result.text||'').length/2000);
}
export function shouldRetryReceiptOcr(result){
  const p=parseHighlandsReceipt(result?.text||'');
  return !(p.fields?.amount&&p.fields?.item&&p.fields?.date&&p.items?.length);
}
function receiptCrop(image){
  const probe=document.createElement('canvas');
  const probeWidth=256;
  probe.width=probeWidth;probe.height=Math.max(200,Math.round(image.height*probeWidth/image.width));
  const ctx=probe.getContext('2d',{willReadFrequently:true});
  if(!ctx)return {x:0,y:0,width:image.width,height:image.height};
  ctx.drawImage(image,0,0,probe.width,probe.height);
  const {data}=ctx.getImageData(0,0,probe.width,probe.height);
  const top=Math.round(probe.height*.08),bottom=Math.round(probe.height*.72);
  const found=[];
  for(let x=0;x<probe.width;x++){
    let matches=0,total=0;
    for(let y=top;y<bottom;y+=3){
      const i=(y*probe.width+x)*4,r=data[i],g=data[i+1],b=data[i+2];
      const max=Math.max(r,g,b),min=Math.min(r,g,b);
      // Giấy in nhiệt màu trắng/xám, khác nền gỗ nâu có độ bão hòa cao.
      if(max-min<49&&(r+g+b)/3>102)matches++;
      total++;
    }
    if(matches/Math.max(1,total)>.46)found.push(x);
  }
  const left=found[0],right=found[found.length-1];
  if(found.length<probe.width*.27||right-left<probe.width*.27){
    return {x:0,y:0,width:image.width,height:image.height};
  }
  const ratio=image.width/probe.width;
  const x=Math.max(0,Math.floor((left-9)*ratio));
  const x2=Math.min(image.width,Math.ceil((right+9)*ratio));
  return {x,y:0,width:x2-x,height:image.height};
}
function enhanceImage(image,focusTop){
  const bounds=receiptCrop(image);
  const y=Math.floor(bounds.height*(focusTop?.045:.035));
  const height=Math.max(1,Math.floor(bounds.height*(focusTop?.58:.86)));
  const cropHeight=Math.min(image.height-y,height);
  const scale=Math.max(.75,Math.min(2.7,1900/bounds.width,3600/cropHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bounds.width*scale));
  canvas.height=Math.max(1,Math.round(cropHeight*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('Không tạo được canvas tiền xử lý hóa đơn.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,bounds.x,y,bounds.width,cropHeight,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<pixels.data.length;i+=4){
    const v=pixels.data[i]*.299+pixels.data[i+1]*.587+pixels.data[i+2]*.114;
    const level=Math.max(0,Math.min(255,(v-132)*(focusTop?1.75:1.45)+170));
    pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=level;
  }
  ctx.putImageData(pixels,0,0);
  return canvas;
}
export async function recognizeReceiptImage(file,onProgress=()=>{}){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))
    throw new Error('Chỉ nhận JPG, PNG hoặc WebP.');
  if(file.size<=0||file.size>10*1024*1024)
    throw new Error('Ảnh phải có dung lượng từ 1 byte đến 10 MB.');
  onProgress({label:'Đang khởi tạo OCR Highlands…',percent:0});
  const {createWorker}=await loadTesseract();
  let worker,image;
  try{
    worker=await createWorker(['vie','eng'],1,{logger:p=>onProgress({
      label:p.status||'Đang đọc ảnh Highlands',
      percent:Math.round(100*Math.max(0,Math.min(1,p.progress||0)))
    })});
    await worker.setParameters({preserve_interword_spaces:'1'});
    const initial=await worker.recognize(file);
    let best={text:initial.data.text||'',confidence:initial.data.confidence??0},bestScore=quality(best);
    if(shouldRetryReceiptOcr(best)){
      try{
        image=await createImageBitmap(file);
        onProgress({label:'Đang tách giấy hóa đơn khỏi nền và làm rõ chữ…',percent:0});
        const cropped=await worker.recognize(enhanceImage(image,true));
        const candidate={text:cropped.data.text||'',confidence:cropped.data.confidence??0};
        const candidateScore=quality(candidate);
        if(candidateScore>bestScore){best=candidate;bestScore=candidateScore;}
        if(shouldRetryReceiptOcr(best)){
          onProgress({label:'Đang đọc lại toàn bộ giấy in nhiệt…',percent:0});
          const full=await worker.recognize(enhanceImage(image,false));
          const wider={text:full.data.text||'',confidence:full.data.confidence??0};
          if(quality(wider)>bestScore)best=wider;
        }
      }catch{
        // Giữ văn bản OCR đầu tiên và đưa cho người dùng đối chiếu; không tạo dữ liệu giả.
      }
    }
    return best;
  }finally{
    if(image)image.close();
    if(worker)await worker.terminate();
  }
}
