// Highlands dùng hóa đơn giấy in nhiệt, ảnh nghiêng / nền gỗ: OCR hai lượt khi cần.
// File chỉ xử lý trong trình duyệt. Không upload ảnh, không gọi OCR server.
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
function textScore(text){
  const value=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return [/highlands/,/check\s*:?\s*\d+/,/tong\s*tien/,/thanh\s*tien/,/\d{1,3}[.,]\d{3}/,
    /\d{2}[-/]\d{2}[-/]\d{4}/].reduce((n,re)=>n+Number(re.test(value)),0);
}
async function enhance(file){
  const image=await createImageBitmap(file);
  try{
    const scale=Math.min(2,2000/image.width,4000/image.height);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.width*scale));
    canvas.height=Math.max(1,Math.round(image.height*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('Không khởi tạo được canvas tăng tương phản.');
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    for(let i=0;i<pixels.data.length;i+=4){
      const v=pixels.data[i]*.299+pixels.data[i+1]*.587+pixels.data[i+2]*.114;
      const level=Math.max(0,Math.min(255,(v-128)*1.7+155));
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=level;
    }
    ctx.putImageData(pixels,0,0);
    return canvas;
  }finally{image.close();}
}
export async function recognizeReceiptImage(file,onProgress=()=>{}){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Chỉ nhận JPG, PNG hoặc WebP.');
  if(file.size<=0||file.size>10*1024*1024)throw new Error('Ảnh phải có dung lượng từ 1 byte đến 10 MB.');
  onProgress({label:'Đang khởi tạo OCR Highlands…',percent:0});
  const {createWorker}=await loadTesseract();
  let worker;
  try{
    worker=await createWorker(['vie','eng'],1,{logger:p=>onProgress({
      label:p.status||'Đang đọc ảnh Highlands',
      percent:Math.round(100*Math.max(0,Math.min(1,p.progress||0)))
    })});
    await worker.setParameters({preserve_interword_spaces:'1'});
    const original=await worker.recognize(file);
    let best=original.data;
    if(textScore(best.text)<5||Number(best.confidence||0)<88){
      try{
        onProgress({label:'Đang tăng tương phản hóa đơn giấy và đọc lại…',percent:0});
        const second=await worker.recognize(await enhance(file));
        const left=textScore(best.text),right=textScore(second.data.text);
        if(right>left||(right===left&&Number(second.data.confidence)>Number(best.confidence)))best=second.data;
      }catch{/* Không hủy kết quả OCR đầu nếu canvas xử lý ảnh không hỗ trợ. */}
    }
    return {text:best.text||'',confidence:best.confidence??null};
  }finally{if(worker)await worker.terminate();}
}
