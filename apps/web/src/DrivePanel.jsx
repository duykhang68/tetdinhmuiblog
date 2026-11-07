import React, {useEffect, useRef, useState} from 'react';
import {googleDrive} from './services/googleDriveService.js';
import {serializeArticle, parseArticle} from './services/markdown.js';
import {seriesValidation} from './services/series.js';
import {resolveDriveClientId} from './services/driveClientId.js';
const clientKey = 'dn-editor-drive-client-id';
export default function DrivePanel({title, labels, html, series, dirty, onOpen, onBusy, externalBusy}) {
  const [manualClientId, setManualClientId] = useState(() => {try {return localStorage.getItem(clientKey) || '';} catch {return '';}});
  const {clientId, configured} = resolveDriveClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID, manualClientId);
  const [connected, setConnected] = useState(googleDrive.connected());
  const [working, setWorking] = useState(false), [files, setFiles] = useState([]), [file, setFile] = useState(null);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [saved, setSaved] = useState('');
  const lock = useRef(false);
  const fingerprint = JSON.stringify({title, labels, html, series});
  useEffect(() => {const timer = setInterval(() => setConnected(googleDrive.connected()), 1000); return () => clearInterval(timer);}, []);
  async function run(action) {
    if (lock.current || externalBusy) return;
    lock.current = true; setWorking(true); onBusy(true); setError('');
    try {await action();} catch (e) {setError(e.message || String(e));}
    finally {setConnected(googleDrive.connected()); lock.current = false; setWorking(false); onBusy(false);}
  }
  const login = () => run(async () => {
    await googleDrive.login(clientId.trim());
    if (!configured) {try {localStorage.setItem(clientKey, clientId.trim());} catch {}}
    setFile(null); setSaved(''); setFiles([]); setMessage('Đã kết nối Drive.');
    setFiles(await googleDrive.listBlogPosts());
  });
  const save = () => run(async () => {
    const issue=seriesValidation(series);
    if(issue) throw new Error('Series: '+issue);
    const result = await googleDrive.saveMarkdownToDrive(title, serializeArticle({title, labels, html, series}), file);
    setFile(result); setSaved(fingerprint); setMessage('Đã lưu ' + result.name + ' lúc ' + new Date().toLocaleTimeString('vi-VN'));
    setFiles(await googleDrive.listBlogPosts());
  });
  const open = item => {
    if ((dirty || saved) && saved !== fingerprint && !confirm('Nội dung hiện tại chưa lưu trên Drive. Vẫn mở bài khác?')) return;
    run(async () => {
      const loaded = await googleDrive.readMarkdown(item.id);
      const article = parseArticle(loaded.content, loaded.name);
      onOpen(article); setFile(loaded); setSaved(JSON.stringify(article)); setMessage('Đã mở ' + loaded.name);
    });
  };
  return <section className="kit-panel drive-panel" aria-label="Google Drive Markdown"><div className="kit-panel-body">
    <h2>Google Drive · Markdown</h2>
    <p>Lưu bài viết thành file .md trong Drive của bạn.</p>
    {configured ? <p className="drive-client-ready">Client ID đã được cấu hình tự động. Nhấn Kết nối Drive để đăng nhập Google.</p> : <><label htmlFor="drive-client-id">OAuth Client ID</label><input id="drive-client-id" value={manualClientId} disabled={externalBusy || working || connected} onChange={e => setManualClientId(e.target.value)} placeholder="…apps.googleusercontent.com" autoComplete="off" /></>}
    <div className="drive-actions"><button className="kit-button" disabled={externalBusy || working} onClick={login}>{connected ? 'Đổi tài khoản Drive' : 'Kết nối Drive'}</button>{connected && <button className="quiet" disabled={externalBusy || working} onClick={() => {googleDrive.disconnect(); setConnected(false); setFile(null); setFiles([]); setSaved(''); setMessage('Đã ngắt phiên Drive trên Editor.');}}>Ngắt Drive</button>}</div>
    <button className="save full" disabled={externalBusy || working || !connected || !title.trim()} onClick={save}>{working ? 'Đang xử lý…' : file ? 'Cập nhật file .md' : 'Lưu .md lên Drive'}</button>
    {file && <a href={'https://drive.google.com/file/d/' + encodeURIComponent(file.id) + '/view'} target="_blank" rel="noopener noreferrer">Xem file trên Drive ↗</a>}
    <div className="drive-message" role="status">{message}{saved && saved !== fingerprint && ' · Có thay đổi mới chưa lưu Drive.'}</div>
    {error && <div className="alert error" role="alert">{error}</div>}
    {connected && <><div className="drive-actions"><strong>Bài viết trên Drive</strong><button className="quiet" disabled={externalBusy || working} onClick={() => run(async () => setFiles(await googleDrive.listBlogPosts()))}>↻ Làm mới</button></div><div className="drive-files">{!files.length && <p>Chưa có file Markdown trong phạm vi ứng dụng.</p>}{files.map(item => <button className="postitem" key={item.id} disabled={externalBusy || working} onClick={() => open(item)}><span>{item.name}</span><small>{new Date(item.modifiedTime).toLocaleString('vi-VN')}</small></button>)}</div></>}
    <small>Chỉ truy cập file ứng dụng được cấp quyền. Kết nối lại khi phiên hết hạn.</small>
  </div></section>;
}
