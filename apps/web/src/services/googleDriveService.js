export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3/files';
const FIELDS = 'id,name,modifiedTime,version';

// Tokens live only in this closure, never in localStorage or the backend.
export function createDriveService({fetcher = (...args) => fetch(...args), oauth = () => globalThis.google?.accounts?.oauth2, now = Date.now} = {}) {
  let token = null, expires = 0, pending = false, generation = 0;
  const disconnect = () => { generation++; token = null; expires = 0; pending = false; };
  const connected = () => !!token && now() < expires;
  function login(clientId) {
    if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) return Promise.reject(new Error('Nhập OAuth Client ID hợp lệ từ Google Cloud.'));
    if (!oauth()) return Promise.reject(new Error('Google Identity Services chưa tải. Kiểm tra mạng rồi thử lại.'));
    if (pending) return Promise.reject(new Error('Đang chờ đăng nhập Google.'));
    pending = true;
    const attempt = ++generation;
    return new Promise((resolve, reject) => {
      const fail = error => { if (attempt === generation) pending = false; reject(new Error(error)); };
      try {
        const client = oauth().initTokenClient({
          client_id: clientId, scope: DRIVE_SCOPE, include_granted_scopes: false,
          callback: response => {
            if (attempt !== generation) return fail('Kết nối đã bị hủy.');
            if (response.error || !response.access_token) return fail('Google từ chối quyền Drive: ' + (response.error || 'thiếu token'));
            if (!oauth().hasGrantedAllScopes(response, DRIVE_SCOPE)) return fail('Bạn chưa cấp quyền drive.file. Hãy kết nối lại.');
            token = response.access_token;
            expires = now() + Math.max(0, Number(response.expires_in || 3600) - 30) * 1000;
            pending = false; resolve();
          },
          error_callback: error => fail(error.type === 'popup_closed' ? 'Bạn đã đóng cửa sổ Google.' : 'Không mở được cửa sổ Google. Hãy cho phép popup và thử lại.')
        });
        client.requestAccessToken({prompt: 'select_account'});
      } catch (error) { fail(error.message); }
    });
  }
  async function request(url, options = {}) {
    if (!connected()) { disconnect(); throw new Error('Phiên Drive hết hạn hoặc chưa kết nối. Bấm Kết nối Drive để tiếp tục.'); }
    const response = await fetcher(url, {...options, headers: {...options.headers, Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(30000)});
    if (!response.ok) {
      if (response.status === 401) disconnect();
      const data = await response.json().catch(() => ({}));
      const hint = response.status === 401 ? 'Kết nối Drive lại.' : response.status === 412 ? 'File đã thay đổi trên Drive. Mở lại file trước khi lưu.' : response.status === 403 ? 'Kiểm tra Drive API đã bật và quyền drive.file đã được cấp.' : '';
      throw new Error(`Drive HTTP ${response.status}: ${data.error?.message || response.statusText}. ${hint}`);
    }
    return response;
  }
  async function listBlogPosts() {
    let pageToken = '', files = [];
    do {
      const params = new URLSearchParams({q: "trashed=false and (mimeType='text/markdown' or (mimeType='text/plain' and name contains '.md'))", fields: `nextPageToken,files(${FIELDS})`, orderBy: 'modifiedTime desc', pageSize: '100'});
      if (pageToken) params.set('pageToken', pageToken);
      const data = await (await request(`${API}?${params}`)).json();
      files.push(...(data.files || [])); pageToken = data.nextPageToken || '';
    } while (pageToken);
    return files;
  }
  async function readMarkdown(fileId) {
    const id = encodeURIComponent(fileId);
    const metadataResponse = await request(`${API}/${id}?fields=${FIELDS}`);
    const metadata = await metadataResponse.json();
    const etag = metadataResponse.headers.get('etag');
    const response = await request(`${API}/${id}?alt=media`, {headers: etag ? {'If-Match': etag} : {}});
    return {...metadata, content: await response.text(), etag: metadataResponse.headers.get('etag')};
  }
  async function saveMarkdownToDrive(fileName, content, existing = null) {
    if (new Blob([content]).size > 5 * 1024 * 1024) throw new Error('Bài vượt quá giới hạn 5 MB. Hãy giảm nội dung trước khi lưu.');
    const name = fileName.trim().replace(/[\/\\\u0000-\u001f]/g, '-').slice(0, 200);
    if (!name) throw new Error('Nhập tiêu đề trước khi lưu Drive.');
    const metadata = {name: /\.md$/i.test(name) ? name : name + '.md', mimeType: 'text/markdown'};
    // Drive requires multipart/related, not the multipart/form-data produced by FormData.
    const boundary = 'editor_' + crypto.randomUUID();
    const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`, JSON.stringify(metadata), `\r\n--${boundary}\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n`, content, `\r\n--${boundary}--\r\n`]);
    const suffix = existing ? '/' + encodeURIComponent(existing.id) : '';
    if (existing) {
      if (!existing.version) throw new Error('Chưa có phiên bản file để cập nhật. Hãy mở lại bài từ Drive.');
      const latest = await (await request(`${API}/${encodeURIComponent(existing.id)}?fields=${FIELDS}`)).json();
      if (String(latest.version) !== String(existing.version)) throw new Error('File đã thay đổi trên Drive. Mở lại file trước khi lưu.');
    }
    const response = await request(`https://www.googleapis.com/upload/drive/v3/files${suffix}?uploadType=multipart&fields=${FIELDS}`, {
      method: existing ? 'PATCH' : 'POST', headers: {'Content-Type': `multipart/related; boundary=${boundary}`, ...(existing?.etag ? {'If-Match': existing.etag} : {})}, body
    });
    return {...await response.json(), etag: response.headers.get('etag')};
  }
  return {login, disconnect, connected, listBlogPosts, readMarkdown, saveMarkdownToDrive};
}
export const googleDrive = createDriveService();
