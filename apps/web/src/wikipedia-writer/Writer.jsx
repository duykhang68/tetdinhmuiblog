import React,{useEffect,useRef,useState} from 'react';
import {SHEET_ID,DRIVE_NAME,parseWikiUrl,parseAIJson,normalizeVocabulary,uniqueVocabulary,toSheetRow,validateBackup} from './model.js';
import {discoverExpenseDriveClientId,validClientId,EDITOR_DRIVE_CLIENT_KEY} from '../expenses/driveClientResolver.js';
import {readRememberedAiKeys,persistAiKeys} from './aiKeyStorage.js';
import {generateGemini,generateGroq} from './aiModelDiscovery.js';
const SCOPE='https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.appdata';
const SHEETS='https://sheets.googleapis.com/v4/spreadsheets/'+SHEET_ID+'/values/';
const DRIVE='https://www.googleapis.com/drive/v3/files';
const escapeName=encodeURIComponent("'Sheet1'!A2:F");
const PROMPT=(source,text)=>`You are an experienced Vietnamese journalist and Vietnamese/Korean/English language educator. Using the Wikipedia material below as background, write an ORIGINAL, neutral, factually faithful Vietnamese explainer article with title, short lead, 3-5 topical subsections and a conclusion. NEVER invent events or quotes; separate uncertain information and attribute claims to Wikipedia. Do not copy passages verbatim. From YOUR GENERATED article select 12-25 useful meaningful words or expressions and provide precise translations. The grammar field should explain grammar and contain three short example sentences labelled VI:, KR:, EN:. Category should be a useful English category. Return ONLY one JSON object with keys "title", "article" (plain text, paragraphs separated by newlines), "vocabulary" (array of objects with keys "vi","ko","en","context","grammar","category"). All vocabulary must occur in article; no duplicates. Source: ${source}\nWikipedia background (may be truncated):\n${text.slice(0,16000)}`;
async function responseJSON(response){
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(body.error?.message||body.error||'HTTP '+response.status);
 return body;
}
async function wikiExtract(url){
 const {lang,title,canonical}=parseWikiUrl(url);
 const params=new URLSearchParams({action:'query',prop:'extracts',explaintext:'1',redirects:'1',format:'json',origin:'*',titles:title});
 const data=await responseJSON(await fetch('https://'+lang+'.wikipedia.org/w/api.php?'+params));
 const item=Object.values(data.query?.pages||{})[0];
 if(!item||item.missing!==undefined||!String(item.extract||'').trim())throw Error('Wikipedia không trả về nội dung bài viết. Thử bài khác.');
 return {text:item.extract,canonical,title:item.title};
}
const snapshot=(source,title,article,vocabulary)=>({schema:'wikipedia-writer-v1',source,title,article,vocabulary,savedAt:new Date().toISOString()});
const WRITING_STAGES=[
 {id:'source',label:'Đọc nội dung Wikipedia',detail:'Đang tải và kiểm tra bài nguồn'},
 {id:'model',label:'Xác định model AI',detail:'Kiểm tra quyền sử dụng Gemini / Groq'},
 {id:'generate',label:'Viết bài và tạo từ vựng',detail:'Chờ AI hoàn thành bài báo và dữ liệu ba ngôn ngữ'},
 {id:'validate',label:'Kiểm tra và hiển thị kết quả',detail:'Xác thực nội dung, đưa vào bản thảo'}
];
export default function Writer(){
 const [savedAiKeys]=useState(()=>{try{return readRememberedAiKeys(window.localStorage);}catch{return {remember:false,gemini:'',groq:''};}});
 const [rememberAiKeys,setRememberAiKeys]=useState(savedAiKeys.remember);
 const [url,setUrl]=useState(''),[provider,setProvider]=useState('auto'),[gKey,setGKey]=useState(savedAiKeys.gemini),[qKey,setQKey]=useState(savedAiKeys.groq);
 const [keyStorageError,setKeyStorageError]=useState('');
 function updateRememberAiKeys(checked){
  setRememberAiKeys(checked);
  let saved=false;try{saved=persistAiKeys(window.localStorage,checked,gKey,qKey);}catch{}
  if(!saved){
   setKeyStorageError('Trình duyệt không cho phép lưu trên thiết bị này.');
   setRememberAiKeys(false);
  }else setKeyStorageError('');
 }
 function clearSavedAiKeys(){
  try{persistAiKeys(window.localStorage,false,'','');}catch{}
  setRememberAiKeys(false);setGKey('');setQKey('');setKeyStorageError('');
 }
 useEffect(()=>{
  if(!rememberAiKeys)return;
  let saved=false;try{saved=persistAiKeys(window.localStorage,true,gKey,qKey);}catch{}
  if(!saved)setKeyStorageError('Không thể cập nhật khóa đã lưu trên thiết bị.');
 },[rememberAiKeys,gKey,qKey]);
 const [title,setTitle]=useState(''),[article,setArticle]=useState(''),[rows,setRows]=useState([]);
 const [busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const [sheetWriteSucceeded,setSheetWriteSucceeded]=useState(false);
 const [writingProgress,setWritingProgress]=useState({state:'idle',completed:0,stage:'',detail:'Chưa bắt đầu tạo bài',model:''});
 const [access,setAccess]=useState(''),[driveFile,setDriveFile]=useState(null),[lastSync,setLastSync]=useState(''),[dirty,setDirty]=useState(false);
 const [oauthConfig,setOauthConfig]=useState({clientId:'',loading:true,error:'',source:''});
 useEffect(()=>{
  let active=true;
  let saved='';
  try{saved=localStorage.getItem(EDITOR_DRIVE_CLIENT_KEY)||'';}catch{}
  discoverExpenseDriveClientId({environmentValue:import.meta.env.VITE_GOOGLE_CLIENT_ID,storedValue:saved})
   .then(result=>{if(active)setOauthConfig({...result,loading:false});})
   .catch(()=>{if(active)setOauthConfig({clientId:'',loading:false,error:'Không đọc được cấu hình OAuth chung của Editor.',source:'missing'});});
  return()=>{active=false;};
 },[]);
 const stateRef=useRef({});stateRef.current={url,title,article,rows,driveFile,access,dirty};
 function change(fn){return value=>{fn(value);setDirty(true);};}
 async function auth(){
  if(oauthConfig.loading)throw Error('Đang đọc cấu hình Google OAuth từ Editor, hãy thử lại.');
  if(!validClientId(oauthConfig.clientId))throw Error(oauthConfig.error||'Không tìm thấy Google OAuth Web Client ID đã cấu hình trong Editor.');
  if(!globalThis.google?.accounts?.oauth2)throw Error('Google Identity Services chưa tải.');
  const token=await new Promise((resolve,reject)=>{
   const client=google.accounts.oauth2.initTokenClient({client_id:oauthConfig.clientId,scope:SCOPE,
    callback:result=>result.error?reject(Error(result.error)):resolve(result.access_token),
    error_callback:e=>reject(Error(e.type||'Không thể đăng nhập Google'))});
   client.requestAccessToken({prompt:'consent'});
  });
  setAccess(token);return token;
 }
 async function googleRequest(target,token,options={}){
  const r=await fetch(target,{...options,headers:{Authorization:'Bearer '+token,...options.headers}});
  if(r.status===401){setAccess('');throw Error('Google hết phiên đăng nhập, vui lòng kết nối lại.');}
  return responseJSON(r);
 }
 async function backup(token=stateRef.current.access){
  if(!token)throw Error('Kết nối Google trước khi đồng bộ Drive.');
  const s=stateRef.current;
  const value=JSON.stringify(snapshot(s.url,s.title,s.article,s.rows));
  let f=s.driveFile;
  if(f){
   const remote=await googleRequest(DRIVE+'/'+encodeURIComponent(f.id)+'?fields=id,modifiedTime',token);
   if(remote.modifiedTime!==f.modifiedTime)throw Error('Drive có bản sửa mới ở thiết bị khác. Hãy khôi phục/xử lý xung đột trước khi ghi đè.');
   await googleRequest('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(f.id)+'?uploadType=media',token,{method:'PATCH',headers:{'Content-Type':'application/json'},body:value});
  }else{
   const metadata={name:DRIVE_NAME,mimeType:'application/json',parents:['appDataFolder']};
   const boundary='wikiwriter'+Date.now();
   const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+value+'\r\n--'+boundary+'--';
   const out=await googleRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime',token,{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
   f=out;
  }
  const metadata=await googleRequest(DRIVE+'/'+encodeURIComponent(f.id)+'?fields=id,modifiedTime,webViewLink',token);
  setDriveFile(metadata);setLastSync(new Date().toLocaleString('vi-VN'));setDirty(false);setNotice('Đã sao lưu bản thảo vào Google Drive (appDataFolder).');
 }
 async function restore(token=stateRef.current.access){
  const data=await googleRequest(DRIVE+'?spaces=appDataFolder&q='+encodeURIComponent("name = '"+DRIVE_NAME+"' and trashed = false")+'&fields=files(id,name,modifiedTime),nextPageToken&pageSize=100',token);
  const files=(data.files||[]).sort((a,b)=>String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
  if(!files.length){setNotice('Drive chưa có bản thảo trước đó.');return;}
  if(stateRef.current.dirty&&!confirm('Dữ liệu hiện tại chưa sao lưu. Bạn muốn thay bằng dữ liệu trên Drive?'))return;
  const file=files[0];
  const body=await googleRequest(DRIVE+'/'+encodeURIComponent(file.id)+'?alt=media',token);
  const s=validateBackup(body);
  setUrl(s.source);setTitle(s.title);setArticle(s.article);setRows(s.vocabulary);setSheetWriteSucceeded(false);setDriveFile(file);setDirty(false);
  setNotice('Đã khôi phục bản thảo từ Google Drive.');
 }
 async function connect(){setBusy('google');setError('');try{const token=await auth();await restore(token);setNotice('Google Sheets và Drive đã kết nối.');}catch(e){setError(e.message);}finally{setBusy('');}}
 async function generate(){
  setBusy('ai');setError('');setNotice('');
  setWritingProgress({state:'running',completed:0,stage:'source',detail:'Đang đọc bài Wikipedia…',model:''});
  try{
   const wiki=await wikiExtract(url);
   setWritingProgress({state:'running',completed:1,stage:'model',detail:'Đã đọc bài: '+wiki.title,model:''});
   const prompt=PROMPT(wiki.canonical,wiki.text);
   const attempts=provider==='gemini'?[['Gemini',gKey,generateGemini]]:provider==='groq'?[['Groq',qKey,generateGroq]]:[['Gemini',gKey,generateGemini],['Groq',qKey,generateGroq]];
   let generated,failures=[],usedModel='';
   for(const [name,key,run] of attempts){
    if(!key.trim()){failures.push(name+': chưa nhập API key');continue;}
    try{
     const result=await run(key.trim(),prompt,undefined,event=>{
      if(event.type==='discovery')setWritingProgress({state:'running',completed:1,stage:'model',detail:'Đang kiểm tra model của '+event.provider+'…',model:''});
      if(event.type==='generation')setWritingProgress({state:'running',completed:2,stage:'generate',detail:'Đang tạo bài và trích xuất từ vựng bằng '+event.provider+'…',model:event.model});
      if(event.type==='retry')setWritingProgress({state:'running',completed:1,stage:'model',detail:'Model '+event.model+' không hoàn thành; đang thử model tiếp theo…',model:''});
     });
     setWritingProgress({state:'running',completed:3,stage:'validate',detail:'Đang kiểm tra cấu trúc bài và từ vựng…',model:result.model});
     generated=parseAIJson(result.text);
     usedModel=name+' / '+result.model;
     setNotice('Đã tạo bài bằng '+usedModel+'. Hãy đọc lại và xác minh thông tin trước khi đồng bộ.');
     break;
    }catch(e){
     failures.push(name+': '+e.message);
     setWritingProgress({state:'running',completed:1,stage:'model',detail:name+' không hoàn thành; đang kiểm tra phương án dự phòng…',model:''});
    }
   }
   if(!generated)throw Error(failures.join(' | '));
   setTitle(generated.title);setArticle(generated.article);setRows(generated.vocabulary);setSheetWriteSucceeded(false);setDirty(true);
   setWritingProgress({state:'done',completed:4,stage:'done',detail:'Đã tạo bài và '+generated.vocabulary.length+' mục từ vựng; sẵn sàng biên tập.',model:usedModel});
  }catch(e){
   setWritingProgress(old=>({...old,state:'error',detail:'Không hoàn thành: '+String(e.message||e).slice(0,180)}));
   setError(e.message);
  }finally{setBusy('');}
 }
 async function push(){
  setBusy('sheet');setError('');setNotice('');
  try{
   if(!access)throw Error('Kết nối Google để ghi Google Sheet.');
   if(!rows.length)throw Error('Chưa có từ vựng để đồng bộ.');
   const current=await googleRequest(SHEETS+escapeName+'?majorDimension=ROWS',access);
   const fresh=uniqueVocabulary(normalizeVocabulary(rows),current.values||[]);
   if(!fresh.length){setNotice('Không có từ mới: tất cả đã tồn tại trong Sheet.');return;}
   if(!confirm('Thêm '+fresh.length+' từ mới vào cuối Sheet1 (A:F)? Các dòng hiện có sẽ không bị ghi đè.'))return;
   const dest=encodeURIComponent("'Sheet1'!A:F");
   const result=await googleRequest(SHEETS+dest+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',access,{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({majorDimension:'ROWS',values:fresh.map(toSheetRow)})
   });
   setSheetWriteSucceeded(true);
   setNotice('Đã thêm '+(result.updates?.updatedRows||fresh.length)+' dòng vào Google Sheet. '+(rows.length-fresh.length)+' dòng trùng được bỏ qua. Bạn có thể nhấn “Phiên từ vựng mới” để làm trống Section 4.');
  }catch(e){setError(e.message);}finally{setBusy('');}
 }
 function resetVocabularySession(){
  if(!sheetWriteSucceeded||!rows.length||busy)return;
  if(!confirm('Bắt đầu phiên từ vựng mới? Chỉ xóa danh sách tại Section 4. Các từ đã ghi vào Google Sheets và bài báo hiện tại vẫn được giữ nguyên.'))return;
  setRows([]);
  setSheetWriteSucceeded(false);
  setDirty(true);
  setError('');
  setNotice('Đã bắt đầu phiên từ vựng mới. Google Sheet và bài báo hiện tại không thay đổi.');
 }
 async function save(){setBusy('drive');setError('');try{await backup();}catch(e){setError(e.message);}finally{setBusy('');}}
 useEffect(()=>{
  const timer=setInterval(()=>{const s=stateRef.current;if(!s.access||!s.dirty||!s.article||busy)return;
    backup(s.access).catch(e=>setError('Tự đồng bộ Drive: '+e.message));},180000);
  return ()=>clearInterval(timer);
 },[busy]);
 const running=!!busy;
 return <div className="ww">
  <header className="ww-header"><a href="/" className="ww-brand">◉ DUY NGUYEN <span> / AI WRITER</span></a><span className="ww-chip">WIKIPEDIA → ARTICLE → VI · KR · EN</span></header>
  <main className="ww-main">
   <div className="ww-heading"><span className="ww-eyebrow">AI EDITORIAL WORKSPACE</span><h1>Biến kiến thức thành <em>bài báo.</em></h1><p>Dán một URL Wikipedia, tạo bài viết mới bằng Gemini hoặc Groq, rồi đưa bộ từ vựng 3 ngôn ngữ vào Google Sheets.</p></div>
   <div className="ww-layout"><div className="ww-stack">
    <section className="ww-card"><div className="ww-card-head"><span className="ww-step">01</span><div><h2>Nguồn bài viết</h2><p>Wikipedia · vi / en / ko và các phiên bản khác</p></div></div>
     <label>Đường dẫn Wikipedia<input type="url" placeholder="https://vi.wikipedia.org/wiki/..." value={url} onChange={e=>change(setUrl)(e.target.value)}/></label>
     <div className="ww-grid"><label>Chọn AI<select value={provider} onChange={e=>setProvider(e.target.value)}><option value="auto">Gemini → Groq dự phòng</option><option value="gemini">Chỉ Gemini</option><option value="groq">Chỉ Groq</option></select></label></div>
     <div className="ww-grid"><label>Gemini API key<input type="password" autoComplete="off" value={gKey} onChange={e=>setGKey(e.target.value)} placeholder="AIza..."/></label><label>Groq API key<input type="password" autoComplete="off" value={qKey} onChange={e=>setQKey(e.target.value)} placeholder="gsk_..."/></label></div>
     <div className="ww-key-preference"><label><input type="checkbox" checked={rememberAiKeys} onChange={e=>updateRememberAiKeys(e.target.checked)}/> Lưu API keys trên thiết bị này</label><button type="button" onClick={clearSavedAiKeys}>Xóa khóa đã lưu</button></div>
     <p className="ww-note">Mặc định chỉ lưu khóa trong phiên trang hiện tại. Nếu tích chọn, Gemini và Groq API keys sẽ được giữ trong localStorage của trình duyệt này (không mã hóa), tự điền khi mở lại trên cùng thiết bị và không đồng bộ lên Drive, Sheet hoặc máy chủ. Chỉ bật trên thiết bị cá nhân đáng tin cậy; người có quyền truy cập trình duyệt hoặc tiện ích mở rộng có thể đọc khóa đã lưu.</p>
     {keyStorageError&&<p className="ww-note" role="alert">{keyStorageError}</p>}
     <button disabled={running||!url.trim()} className="ww-primary" onClick={generate}>{busy==='ai'?'Đang đọc và viết…':'✦ Tạo bài báo & trích xuất từ vựng'}</button>
    </section>
    <section className="ww-card"><div className="ww-card-head"><span className="ww-step">02</span><div><h2>Bản thảo bài báo</h2><p>Nội dung có thể chỉnh sửa trước khi sử dụng</p></div></div>
     <label>Tiêu đề<input value={title} onChange={e=>change(setTitle)(e.target.value)} placeholder="Bài viết sẽ xuất hiện ở đây"/></label>
     <label>Nội dung bài báo<textarea rows="15" value={article} onChange={e=>change(setArticle)(e.target.value)} placeholder="Bản thảo AI tạo sẽ được hiển thị tại đây..."/></label>
     <div className="ww-actions"><button disabled={!article} onClick={()=>navigator.clipboard.writeText(title+'\n\n'+article)}>Sao chép bài viết</button><a href={url||'#'} target="_blank" rel="noopener noreferrer">Đọc nguồn Wikipedia ↗</a></div>
    </section>
   </div><div className="ww-stack">
    <section className="ww-card ww-connect"><div className="ww-card-head"><span className="ww-step">☁</span><div><h2>Google Sheets & Drive</h2><p>{access?'Đã kết nối tài khoản Google':'Kết nối OAuth để ghi dữ liệu trực tiếp'}</p></div></div>
     <div className="ww-actions"><button disabled={running||oauthConfig.loading} onClick={connect}>{oauthConfig.loading?'Đang đọc cấu hình Google…':access?'↻ Kết nối lại / Khôi phục':'Kết nối Google'}</button><button disabled={running||!access||!article} onClick={save}>☁ Đồng bộ ngay</button></div>
     {!oauthConfig.loading&&!validClientId(oauthConfig.clientId)&&<p className="ww-note" role="status">{oauthConfig.error||'Chưa tìm thấy OAuth Client ID dùng chung của Editor.'}</p>}
     <p className="ww-note">Sao lưu bản thảo vào Google Drive mỗi 3 phút khi trang mở và đã kết nối. Không ghi đè bản Drive có thay đổi từ thiết bị khác.</p>
     <p className="ww-status">{dirty?'● Có thay đổi chưa đồng bộ':'✓ Bản thảo chưa có thay đổi mới'}{lastSync?' · Lần lưu: '+lastSync:''}</p>
     <a href={'https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/edit?gid=0'} target="_blank" rel="noopener noreferrer">Mở Google Sheet viethananh ↗</a>
    </section>
    <section className="ww-card ww-progress" aria-labelledby="ww-progress-title">
     <div className="ww-card-head"><span className="ww-step">03</span><div><h2 id="ww-progress-title">Thanh tiến độ</h2><p>Theo dõi quá trình tạo bài và trích xuất từ vựng</p></div></div>
     <div className="ww-progress-overview" role="status" aria-live="polite">
      <strong>{writingProgress.state==='done'?'Hoàn thành':writingProgress.state==='error'?'Có lỗi':writingProgress.state==='running'?'Đang xử lý':'Sẵn sàng'}</strong>
      <span>{writingProgress.completed}/4 bước đã hoàn thành</span>
     </div>
     <div className={'ww-progress-track '+(writingProgress.state==='running'?'ww-progress-active':'')} role="progressbar" aria-label="Tiến độ tạo bài" aria-valuemin={0} aria-valuemax={4} aria-valuenow={writingProgress.completed} aria-valuetext={writingProgress.completed+' trên 4 bước hoàn thành'}>
      <span className="ww-progress-fill" style={{width:(writingProgress.completed/4*100)+'%'}}/>
     </div>
     <ol className="ww-progress-steps">{WRITING_STAGES.map((step,i)=>{
      const completed=i<writingProgress.completed;
      const active=writingProgress.state==='running'&&writingProgress.stage===step.id;
      const failed=writingProgress.state==='error'&&writingProgress.stage===step.id;
      return <li key={step.id} className={'ww-progress-step '+(completed?'is-done':active?'is-active':failed?'is-error':'is-waiting')}>
       <span className="ww-progress-marker" aria-hidden="true">{completed?'✓':failed?'!':i+1}</span>
       <span><strong>{step.label}</strong><small>{completed?'Đã hoàn thành':active?'Đang thực hiện':failed?'Gặp lỗi':'Chờ xử lý'}</small></span>
      </li>;
     })}</ol>
     <p className="ww-progress-detail" aria-live="polite">{writingProgress.detail}</p>
     {writingProgress.model&&<p className="ww-progress-model">Model: {writingProgress.model}</p>}
     <p className="ww-note">Thanh hiển thị các bước đã thực sự hoàn thành, không ước lượng thời gian hoặc phần trăm tiến độ nội bộ của nhà cung cấp AI.</p>
    </section>
    <section className="ww-card"><div className="ww-card-head"><span className="ww-step">04</span><div><h2>Từ vựng Việt · Hàn · Anh <span className="ww-count">{rows.length}</span></h2><p>Đã ánh xạ đúng các cột A:F của Sheet1</p></div></div>
     <div className="ww-table-scroll"><table><thead><tr><th>Việt (A)</th><th>Hàn (B)</th><th>Anh (C)</th><th>Context (D)</th><th>Ngữ pháp (E)</th><th>Category (F)</th><th></th></tr></thead><tbody>{rows.map((v,i)=><tr key={i}>{['vi','ko','en','context','grammar','category'].map(k=><td key={k}><textarea rows={k==='grammar'?3:2} aria-label={k+' '+(i+1)} value={v[k]} onChange={e=>{setRows(old=>old.map((x,j)=>j===i?{...x,[k]:e.target.value}:x));setSheetWriteSucceeded(false);setDirty(true);}}/></td>)}<td><button className="ww-remove" aria-label={'Xóa dòng '+(i+1)} onClick={()=>{setRows(old=>old.filter((_,j)=>j!==i));setSheetWriteSucceeded(false);setDirty(true);}}>×</button></td></tr>)}</tbody></table></div>
     {!rows.length&&<p className="ww-empty">Chưa có từ vựng. Hãy tạo bài báo trước.</p>}
     <div className="ww-actions"><button onClick={()=>{setRows(old=>[...old,{vi:'',ko:'',en:'',context:'',grammar:'',category:'General / Everyday Language'}]);setSheetWriteSucceeded(false);setDirty(true);}}>+ Thêm từ</button><button disabled={running||!sheetWriteSucceeded||!rows.length} onClick={resetVocabularySession} title="Chỉ làm trống từ vựng trong Section 4; không xóa Google Sheet">↻ Phiên từ vựng mới</button><button className="ww-primary" disabled={running||!access||!rows.length} onClick={push}>{busy==='sheet'?'Đang ghi Sheet…':'↗ Ghi từ mới vào Google Sheet'}</button></div>
    </section>
   </div></div>
   {error&&<div role="alert" className="ww-alert ww-error">{error}</div>}
   {notice&&<div role="status" className="ww-alert">{notice}</div>}
  </main><footer className="ww-footer">Duy Nguyen · AI-assisted writing · Nội dung cần biên tập, kiểm chứng trước khi công bố.</footer>
 </div>;
}