# HOTFIX — Daily Expenses đồng bộ Google Drive (thay cho Cloudflare D1)

**Áp dụng:** \`/expenses/\` tại https://duynguyen-reddit-editor.pages.dev/expenses/  
**Ngày:** 2026-11-07

## 1. Kết luận triển khai

Từ hotfix này, trang chi tiêu chỉ sử dụng **Google Drive API** cho đồng bộ/sao lưu, không gửi snapshot qua \`/api/expenses-state\` của Cloudflare D1 nữa. Không cần tạo database D1 hay binding \`EXPENSES_DB\`.

Hệ thống **tái sử dụng cùng Google Identity Services, OAuth Client ID và scope \`drive.file\`** với component \`Google Drive · Markdown\` đã có ở Editor. Nếu Cloudflare Pages đã cấu hình \`VITE_GOOGLE_CLIENT_ID\`, trang expenses nhận trực tiếp biến đó; nếu người dùng đã lưu Client ID thủ công trước đây trong Editor, trang có fallback cùng localStorage key \`dn-editor-drive-client-id\`.

Lưu ý kỹ thuật: DrivePanel giữ access token **trong RAM JavaScript của trang Editor**, không thể tự chuyển token đó qua một page navigation. Người dùng cần chọn **Kết nối Google Drive** khi mở một phiên mới trên /expenses/. Đây là cơ chế an toàn của GIS; không ghi OAuth access token vào URL, localStorage, GitHub hay file backup. Khi token hết hạn, người dùng phải kết nối lại bằng thao tác trực tiếp.

## 2. Cách sử dụng

1. Mở **Daily Expenses & Insights**.
2. Bấm **Kết nối Google Drive**, chọn tài khoản Google đang dùng trong Editor và chấp thuận quyền \`drive.file\` nếu Google yêu cầu.
3. Sau khi kết nối, bấm **Đồng bộ ngay** để xác nhận bản sao đầu tiên. Nếu lần đầu local đã có dữ liệu, hệ thống tạo một file JSON trên My Drive.
4. Khi trang còn mở, hệ thống chạy kiểm tra mỗi **180 giây (3 phút)**, thêm một lượt sau khoảng **12 giây kể từ thay đổi** (debounce), và khi tab quay lại hoạt động hay mạng kết nối lại.
5. Dữ liệu lưu ngay trong localStorage trước khi lên Drive. Trạng thái **Đã lưu Google Drive** chỉ xuất hiện sau khi Google Drive trả thành công và app tải lại, kiểm tra nội dung file vừa tạo.
6. Mở một thiết bị khác, vào cùng URL rồi **Kết nối Google Drive cùng tài khoản**: nếu local chưa có dữ liệu, bản mới nhất trên Drive sẽ được tải về. Nếu cả hai phía đều có thay đổi khác nhau, ứng dụng yêu cầu chọn phương án, không ghi đè âm thầm.

Không mở trang / không có mạng / token hết hạn: máy không thể tự gửi các thay đổi local chưa upload. Google Drive vẫn giữ những bản đã upload thành công.

## 3. Thiết kế file sao lưu trên Drive

- Scope: \`https://www.googleapis.com/auth/drive.file\` — sử dụng quyền Editor đã có, chỉ truy cập file do ứng dụng tạo hoặc được cấp quyền riêng.
- Mỗi lần dữ liệu **thay đổi thật sự**, tạo một file JSON riêng trong My Drive tên \`DuyNguyen-Expenses-<timestamp>-<short-id>.json\`.
- File được gắn appProperties \`dn_expenses=snapshot_v1\`, cho phép Editor lọc đúng các file backup mà không đọc danh sách toàn bộ Drive.
- JSON chứa mọi **giao dịch, danh mục mặc định/tùy chỉnh, hạn mức và ngân sách theo tháng**, theo schema \`dn-daily-expenses-v1\` hiện hành; metadata có \`baseId\` để so sánh với phiên bản trước.
- Lưu theo kiểu **immutable / append-only**, không tự sửa/xóa bản cũ. Nhờ vậy ngay cả hai thiết bị đồng thời tải bản mới, các file backup trước đó vẫn còn để khôi phục.
- Không tạo file khi dữ liệu đã khớp. Việc mở trang hoặc kiểm tra mỗi 3 phút không tự nhân bản file vô ích.
- Drive list/read/write có kiểm tra JSON và xác nhận nội dung sau upload. Đồng bộ mới nhất có kiểm tra chuỗi \`base_id\`; một nhánh snapshot khác (fork) sẽ được báo conflict.
- Người dùng có thể xem file qua liên kết **Xem file sao lưu trên Drive**, hoặc sử dụng tính năng xuất JSON thủ công trên trang.
- Google Drive có giới hạn quota và dung lượng; phiên bản này giới hạn upload snapshot 4 MiB. Không tự dọn các bản sao cũ để tránh mất lịch sử.

### Quy tắc xung đột

- Thiết bị rỗng: lấy dữ liệu từ Drive sau kết nối.
- Máy có dữ liệu, Drive chưa có file: tạo JSON đầu tiên.
- Chỉ local thay đổi so với lần sync xác nhận: tạo bản snapshot mới, ghi \`baseId\` của file trước.
- Chỉ Drive thay đổi theo tuyến lịch sử xác minh: khôi phục về local.
- Hai phía độc lập thay đổi / tài khoản Drive khác / lịch sử bị rẽ nhánh: **không tự ghi đè**. UI cho phép tải bản JSON dự phòng và chọn bản Drive hoặc bản local.
- Không tự động merge giao dịch vì không thể đảm bảo an toàn khi có cùng ID được sửa/xóa ở cả hai thiết bị. Có thể bổ sung merge theo transaction/tombstone trong feature khác.

## 4. Các file đã hotfix

- \`apps/web/src/services/googleDriveService.js\` — thêm bộ API Drive chỉ cho expense snapshots, giữ nguyên service Markdown.
- \`apps/web/src/expenses/driveSync.js\` — planner Drive và sync metadata riêng \`dn-daily-expenses-drive-sync-v1\`. **Không tái sử dụng** metadata Cloudflare D1 cũ.
- \`apps/web/src/expenses/useExpenseDriveSync.js\` — GIS login, đồng bộ 3 phút, manual, local preservation, conflict backup.
- \`apps/web/src/expenses/Expenses.jsx\` — nút kết nối Drive, nút Đồng bộ ngay, trạng thái timestamp và giải quyết xung đột.
- \`apps/web/expenses/index.html\` — tải GIS \`accounts.google.com/gsi/client\` như Editor.
- \`apps/web/src/expenses/cloudSync.css\` — lớp styling đồng bộ màu Reddit Light/OrangeRed.
- \`apps/web/test/expensesDriveSync.test.mjs\` — test mock Google Drive API, dữ liệu JSON, phiên bản và bảo vệ khi đa thiết bị.

**Không thay đổi** model tính tiền, hạn mức danh mục, dữ liệu localStorage đang có, các route Editor/Starbucks và quyền OAuth scope.

## 5. Cấu hình kiểm tra nếu chưa kết nối được

- Cloudflare Pages Production: biến build-time \`VITE_GOOGLE_CLIENT_ID\` có đúng Google OAuth Web Client ID.
- Authorized JavaScript origins của cùng OAuth Client ID có \`https://duynguyen-reddit-editor.pages.dev\` (chỉ origin, không kèm \`/expenses/\`).
- Google Drive API enabled, consent screen/Test users hợp lệ, quyền \`drive.file\` đã cấp.
- Trình duyệt cho phép popup của Google (token client phải được gọi qua click của người dùng).
- Không cần Cloudflare Worker D1, database, Client Secret ở frontend hoặc API key khác.

Tham khảo Google: [Google Drive files.create](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create), [Drive about.get](https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get).

## 6. Xác nhận phát hành

Chạy \`npm run check\` và \`npm run build\` ở GitHub CI; merge sau khi xanh. Cloudflare Pages production cần deploy commit được merge. PR/CI xanh **chưa đồng nghĩa** một backup JSON đã lưu trong tài khoản Google cụ thể; trạng thái trên /expenses/ mới xác nhận được điều đó.

Nếu trước đó từng dùng D1, những bản D1 chưa được nhập vào local **không được tự động chuyển sang Google Drive**. Hãy phục hồi/xuất JSON trước khi chuyển thiết bị để tránh bỏ sót dữ liệu.
