// Cloudflare Pages Functions implementation of the Blogger Editor API.
// No Node HTTP server or local filesystem dependencies.
import sanitizeHtml from 'sanitize-html';
import { loadResearchInsights } from '../src/services/researchInsights.mjs';
import { makeOutboundBudget, googleQuotaError } from '../src/services/freeQuotaPolicy.mjs';

const SCOPE = 'https://www.googleapis.com/auth/blogger';
const BLOGGER_BASE = 'https://www.googleapis.com/blogger/v3';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const TE = new TextEncoder();
const TD = new TextDecoder();
const allowedMethods = ['GET','POST','PATCH'];
function failure(status, message) { return Object.assign(new Error(message), { status }); }
function base64url(bytes) {
  let str=''; for (const n of new Uint8Array(bytes)) str += String.fromCharCode(n);
  return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function unbase64url(s) { const b=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)); return Uint8Array.from(b, c=>c.charCodeAt(0)); }
function randomToken(n=32) { const b=new Uint8Array(n); crypto.getRandomValues(b); return base64url(b); }
async function sessionKey(secret) { const hash=await crypto.subtle.digest('SHA-256',TE.encode('duynguyen-editor-cookie-v1:'+secret)); return crypto.subtle.importKey('raw',hash,'AES-GCM',false,['encrypt','decrypt']); }
async function seal(session,key) { const iv=new Uint8Array(12); crypto.getRandomValues(iv); const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,TE.encode(JSON.stringify(session)));return base64url(new Uint8Array([...iv,...new Uint8Array(ciphertext)])); }
async function unseal(raw,key) { try {const b=unbase64url(raw);if(b.length<29)return null;const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},key,b.slice(12));const s=JSON.parse(TD.decode(plaintext));return s?.expires>Date.now()?s:null;}catch{return null;} }
function cookies(header='') {return Object.fromEntries(header.split(';').map(x=>{const i=x.indexOf('=');return i<0?[]:[x.slice(0,i).trim(),x.slice(i+1).trim()]}).filter(x=>x.length===2));}
function setCookie(value) {return `dn_editor_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;}
function clearCookie() {return 'dn_editor_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';}
function response(body,status=200,more={}) {return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',...more}});}
function redirect(location,more={}) {return new Response(null,{status:302,headers:{Location:location,'Cache-Control':'no-store','Referrer-Policy':'no-referrer',...more}});}
function equals(a,b) {const x=TE.encode(String(a||'')),y=TE.encode(String(b||''));if(x.length!==y.length)return false;let n=0;for(let i=0;i<x.length;i++)n|=x[i]^y[i];return n===0;}
function numericId(x) {if(!/^\d{1,30}$/.test(String(x||'')))throw failure(400,'ID không hợp lệ');return String(x);}
function safePost(p) {return {id:String(p.id),title:p.title||'',content:p.content||'',labels:p.labels||[],updated:p.updated||'',published:p.published||'',status:p.status||'',url:p.url||''};}
function normalizeInput(b) {const title=String(b?.title||'').trim(),content=String(b?.content||'');if(!title||title.length>200)throw failure(400,'Tiêu đề phải có 1–200 ký tự');if(content.length>250000)throw failure(400,'Bài viết vượt quá 250.000 ký tự HTML');if(!Array.isArray(b?.labels))throw failure(400,'labels phải là một danh sách');const labels=[...new Set(b.labels.map(x=>String(x).trim()).filter(Boolean))];if(labels.length>20||labels.some(x=>x.length>80))throw failure(400,'Nhãn tối đa 20 mục, mỗi nhãn 80 ký tự');return {title,content,labels};}
function sanitizeContent(html) {return sanitizeHtml(html,{allowedTags:[...new Set([...sanitizeHtml.defaults.allowedTags,'img','h1','h2','figure','figcaption','aside','details','summary','hr','s','u','table','thead','tbody','tr','th','td'])],allowedAttributes:{a:['href','title','target','rel'],img:['src','alt','title','width','height','loading'],'*':['class'],td:['colspan','rowspan'],th:['colspan','rowspan','scope'],aside:['data-kind'],details:['open']},allowedSchemes:['http','https','mailto'],allowedSchemesByTag:{img:['http','https']},allowProtocolRelative:false,disallowedTagsMode:'discard',transformTags:{a:sanitizeHtml.simpleTransform('a',{rel:'noopener noreferrer'},true)}});}
async function readBody(req) {const n=Number(req.headers.get('content-length')||0);if(n>300000)throw failure(413,'Yêu cầu quá lớn');const text=await req.text();if(TE.encode(text).length>300000)throw failure(413,'Yêu cầu quá lớn');try{return text?JSON.parse(text):{};}catch{throw failure(400,'Dữ liệu JSON không hợp lệ');}}
async function tokenRequest(cfg,form,charge) {charge();const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(form),signal:AbortSignal.timeout(15000)});const data=await r.json().catch(()=>({}));const quota=googleQuotaError(r.status,data);if(quota)throw quota;if(!r.ok)throw failure(401,'Google từ chối token: '+String(data.error||'Không xác định').slice(0,150));return data;}
function configuration(env) {const get=k=>String(env[k]||'').trim();const c={clientId:get('GOOGLE_CLIENT_ID'),clientSecret:get('GOOGLE_CLIENT_SECRET'),redirect:get('GOOGLE_REDIRECT_URI'),frontend:get('FRONTEND_ORIGIN'),secret:get('APP_SECRET'),blogId:get('BLOGGER_BLOG_ID')};if(!c.clientId||!c.clientSecret||!c.redirect||!c.frontend||!c.secret||c.secret.length<48)throw failure(503,'Thiếu cấu hình Google OAuth/APP_SECRET trên Cloudflare');if(!c.redirect.startsWith(c.frontend+'/auth/google/callback'))throw failure(503,'OAuth callback phải thuộc frontend origin');return c;}
export async function onRequest({request,env}) {
  const pathname=new URL(request.url).pathname;
  if(!pathname.startsWith('/api/')&&!pathname.startsWith('/auth/'))return response({error:'Not found'},404);
  try {
    if(!allowedMethods.includes(request.method))throw failure(405,'Phương thức không được hỗ trợ');
    if(pathname==='/api/health'&&request.method==='GET')return response({ok:true,service:'DuyNguyen Blogger Editor Cloudflare',revision:'cf-pages-auth-v1'});
    const cfg=configuration(env),key=await sessionKey(cfg.secret),url=new URL(request.url);
    // Request-local cap; Cloudflare Free is the account-level hard ceiling.
    const charge=makeOutboundBudget();
    const oldCookie=cookies(request.headers.get('cookie')||'').dn_editor_session;
    let s=oldCookie?await unseal(oldCookie,key):null;
    function fresh(){return {csrf:randomToken(),created:Date.now(),expires:Date.now()+SESSION_SECONDS,token:null,flow:null};}
    async function withSession(result){const sealed=await seal(s,key);if(sealed.length>3800)throw failure(500,'Phiên đăng nhập vượt giới hạn cookie');result.headers.set('Set-Cookie',setCookie(sealed));return result;}
    function mustAuth(){if(!s?.token)throw failure(401,'Chưa kết nối Google. Hãy nhấn Kết nối Blogger.');}
    function verifyWrite(){if(request.headers.get('Origin')!==cfg.frontend)throw failure(403,'Nguồn yêu cầu không được phép');if(!equals(request.headers.get('x-csrf-token'),s.csrf))throw failure(403,'Thiếu hoặc sai CSRF token; hãy tải lại trang');}
    async function accessToken(){if(s.token?.access&&s.token.expires>Date.now()+60000)return s.token.access;if(!s.token?.refresh)throw failure(401,'Phiên đăng nhập hết hạn. Kết nối Google lại.');const v=await tokenRequest(cfg,{client_id:cfg.clientId,client_secret:cfg.clientSecret,refresh_token:s.token.refresh,grant_type:'refresh_token'},charge);s.token.access=v.access_token;s.token.expires=Date.now()+(v.expires_in||3600)*1000;return s.token.access;}
    async function googleApi(method,route,query={},body){const u=new URL(BLOGGER_BASE+route);for(const [k,v] of Object.entries(query))if(v!==undefined&&v!=='')u.searchParams.set(k,v);const call=async token=>{charge();return fetch(u,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});};let r=await call(await accessToken());if(r.status===401&&s.token.refresh){s.token.expires=0;r=await call(await accessToken());}const data=await r.json().catch(()=>({}));const quota=googleQuotaError(r.status,data);if(quota)throw quota;if(!r.ok){const msg=String(data?.error?.message||r.statusText||'Google API error').slice(0,350);throw failure([401,403,404].includes(r.status)?r.status:502,`Blogger API: ${msg} (${method} ${route}, HTTP ${r.status})`);}return data;}
    function checkedBlog(id){id=numericId(id);if(cfg.blogId&&id!==cfg.blogId)throw failure(403,'Blog ID không khớp BLOGGER_BLOG_ID');return id;}
    async function getPost(blog,id){return googleApi('GET',`/blogs/${blog}/posts/${numericId(id)}`,{view:'ADMIN'});}
    function draftOnly(post){if(String(post.status||'').toLowerCase()!=='draft')throw failure(409,'Bài viết đã xuất bản hoặc không phải bản nháp. Không ghi đè bài đang công khai.');}
    let out;
    if(request.method==='GET'&&pathname==='/api/status') {if(!s)s=fresh();out=response({connected:!!s.token,csrf:s.csrf,defaultBlogId:cfg.blogId||null});}
    else if(request.method==='GET'&&pathname==='/auth/google/start') {if(!s)s=fresh();const state=randomToken(),verifier=randomToken(48);s.flow={state,verifier,expires:Date.now()+600000,returnTo:url.searchParams.get('return_to')==='research-insights'?'/research-insights.html':'/'};const digest=await crypto.subtle.digest('SHA-256',TE.encode(verifier));const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');for(const [k,v] of Object.entries({client_id:cfg.clientId,redirect_uri:cfg.redirect,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',state,code_challenge:base64url(digest),code_challenge_method:'S256'}))auth.searchParams.set(k,v);out=redirect(auth.toString());}
    else if(request.method==='GET'&&pathname==='/auth/google/callback') {if(!s?.flow||s.flow.expires<Date.now()||!equals(s.flow.state,url.searchParams.get('state')))throw failure(400,'OAuth state không khớp hoặc đã hết hạn. Hãy kết nối lại.');const verifier=s.flow.verifier,returnTo=s.flow.returnTo==='/research-insights.html'?'/research-insights.html':'/';s.flow=null;if(url.searchParams.has('error'))throw failure(400,'Google từ chối truy cập');const code=url.searchParams.get('code');if(!code)throw failure(400,'Google không trả authorization code');const result=await tokenRequest(cfg,{client_id:cfg.clientId,client_secret:cfg.clientSecret,code,code_verifier:verifier,redirect_uri:cfg.redirect,grant_type:'authorization_code'},charge);const refresh=result.refresh_token||s.token?.refresh;if(!refresh)throw failure(401,'Chưa có refresh token. Hãy thu hồi quyền app trong Google Account rồi kết nối lại.');s=fresh();s.token={access:result.access_token,refresh,expires:Date.now()+(result.expires_in||3600)*1000};out=redirect(cfg.frontend+returnTo+'?connected=1');}
    else if(request.method==='POST'&&pathname==='/api/logout') {mustAuth();verifyWrite();return response({ok:true},200,{'Set-Cookie':clearCookie()});}
    else {
      mustAuth();
      if(request.method==='GET'&&pathname==='/api/research-insights'){await accessToken();out=response(await loadResearchInsights({fetcher:fetch,token:String(env.RESEARCH_GITHUB_TOKEN||''),charge}));}
      else if(request.method==='GET'&&pathname==='/api/blogs'){const r=await googleApi('GET','/users/self/blogs');out=response({blogs:(r.items||[]).map(b=>({id:String(b.id),name:b.name,url:b.url})),defaultBlogId:cfg.blogId||null});}
      else if(request.method==='GET'&&pathname==='/api/posts'){const blog=checkedBlog(url.searchParams.get('blogId'));const status=url.searchParams.get('status')||'draft';if(!['draft','live'].includes(status))throw failure(400,'status phải là draft hoặc live');const r=await googleApi('GET',`/blogs/${blog}/posts`,{status:status.toUpperCase(),view:'ADMIN',fetchBodies:'false',orderBy:'UPDATED',maxResults:'30',pageToken:(url.searchParams.get('pageToken')||'').slice(0,800)});out=response({posts:(r.items||[]).map(p=>{const x=safePost(p);delete x.content;return x;}),nextPageToken:r.nextPageToken||null});}
      else if(request.method==='GET'&&/^\/api\/posts\/\d+$/.test(pathname)){const blog=checkedBlog(url.searchParams.get('blogId'));out=response({post:safePost(await getPost(blog,pathname.split('/').pop()))});}
      else if(request.method==='POST'&&pathname==='/api/drafts'){verifyWrite();const body=await readBody(request),blog=checkedBlog(body.blogId),payload=normalizeInput(body);payload.content=sanitizeContent(payload.content);out=response({post:safePost(await googleApi('POST',`/blogs/${blog}/posts`,{isDraft:'true'},payload))},201);}
      else if(request.method==='PATCH'&&/^\/api\/drafts\/\d+$/.test(pathname)){verifyWrite();const body=await readBody(request),blog=checkedBlog(body.blogId),id=pathname.split('/').pop(),current=await getPost(blog,id);draftOnly(current);if(!body.expectedUpdated||body.expectedUpdated!==current.updated)throw failure(409,'Bản nháp đã thay đổi. Hãy tải lại bài trước khi lưu.');const payload=normalizeInput(body);payload.content=sanitizeContent(payload.content);out=response({post:safePost(await googleApi('PATCH',`/blogs/${blog}/posts/${id}`,{},payload))});}
      else if(request.method==='POST'&&/^\/api\/publish\/\d+$/.test(pathname)){verifyWrite();const body=await readBody(request),blog=checkedBlog(body.blogId),id=pathname.split('/').pop(),current=await getPost(blog,id);draftOnly(current);if(!body.expectedUpdated||body.expectedUpdated!==current.updated)throw failure(409,'Bản nháp thay đổi trước khi Publish. Hãy tải lại trước.');out=response({post:safePost(await googleApi('POST',`/blogs/${blog}/posts/${id}/publish`))});}
      else throw failure(404,'Không tìm thấy endpoint');
    }
    return withSession(out);
  } catch(e) {const status=Number.isInteger(e.status)?e.status:500;if(status>=500)console.error('[cf-editor]',e.name,e.message);return response({error:status===500?'Lỗi máy chủ. Kiểm tra Cloudflare logs.':e.message},status,e.retryAfter?{'Retry-After':e.retryAfter}:{});}
}
