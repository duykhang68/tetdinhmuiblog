# Highlands Rewards & Insights — triển khai 07/11/2026

- **URL:** `/highlands-insights/` (Cloudflare Pages: `https://duynguyen-reddit-editor.pages.dev/highlands-insights/`)
- **Repository:** `duykhang68/tetdinhmuiblog`
- **Nhánh:** `feat/highlands-rewards-insights-20261107`
- **Nguồn:** [Chính sách HighlandsĐI cập nhật 24/08/2026](https://www.highlandscoffee.com.vn/vn/chinh-sach-chuong-trinh-thanh-vien-highlandsdi.html).

## Kiến trúc và phạm vi
- Trang React + Vite multi-page độc lập: `apps/web/highlands-insights/index.html`, `apps/web/src/highlands-insights/`.
- Dashboard sáng theo concept Starbucks Insights, dùng neutral Reddit + accent đỏ Highlands; **Thực trả** có màu xanh lá, **Giảm giá** đỏ, giữ 3 thẻ đối soát dễ đọc.
- Form giao dịch, phân tách giá gốc/phụ thu/giảm/thực trả, lý do ưu đãi, phương thức Payoo/POS, số món, mã Check, ngày/giờ/cửa hàng, sửa/xóa, thống kê tháng, lọc, CSV, JSON.
- OCR **riêng cho hóa đơn nhiệt Highlands**: `receiptOcr.js` (thành tiền/tổng tiền/Payoo, Check, ngày, tên món xuống dòng như 510ml), `receiptOcrBrowser.js` (Tesseract vie+eng; xử lý grayscale/contrast khi lần đầu chưa đủ rõ); OCR ngay trong trình duyệt, không gửi ảnh lên server, không tự lưu giao dịch.
- Dữ liệu lưu `localStorage` riêng `dn-highlands-insights-v1`; Google Drive tùy chọn dùng scope `drive.file`, snapshot append-only gắn tag `dn_highlands`, metadata `dn-highlands-drive-sync-v1`. Tuyệt đối không trộn dữ liệu với Starbucks (`dn_starbucks`) hay Expenses (`dn_expenses`). Sau khi kết nối, tự đồng bộ mỗi **3 phút khi trang đang mở**, có nút đồng bộ thủ công và xử lý conflict an toàn.
- Editor quick link trong `EDITOR_QUICK_LINKS`; Vite cấu hình entry `highlandsInsights` riêng.

## Kiểm thử hóa đơn Bàu Bàng người dùng cung cấp
| Trường | Giá trị |
| --- | --- |
| Ngày/giờ | 03/11/2026 17:45 |
| Cửa hàng | KCN Bàu Bàng |
| Check | 139154 |
| Bánh Tiramisu | 39.000đ |
| Nước tinh khiết Dasani 510ml | 15.000đ |
| Tổng món | 2 |
| Thành tiền / Tổng tiền / Payoo Bank Card | **54.000đ**, chỉ tính **một lần** |
| DRIPS tiềm năng nếu đủ điều kiện và xác nhận thành viên | 5 |
| TemĐI tiềm năng nếu đủ điều kiện và xác nhận thành viên | 1 |

Ảnh giấy POS **không chứng minh giao dịch đã được gắn tài khoản HighlandsĐI**. Vì vậy checkbox `Đã quét/xác nhận tài khoản HighlandsĐI` mặc định tắt. DRIPS thực tế chỉ do ứng dụng Highlands xác nhận; không tự tạo giao dịch thật hay khai báo điểm thực tế.

## Quy tắc HighlandsĐI dùng trong dashboard
- Theo chính sách cập nhật **24/08/2026**, điểm DRIPS được tích theo **1 DRIP / 10.000đ thực trả đủ điều kiện**, làm tròn xuống phần 10.000đ gần nhất. Không tính giao dịch nạp thẻ.
- Một giao dịch đủ điều kiện từ **50.000đ** có thể nhận **1 TemĐI**; 9 tem đủ điều kiện để nhận coupon tùy điều khoản.
- Ngưỡng chi tiêu thành viên trong chu kỳ 12 tháng: **Gold dưới 3 triệu, Platinum từ 3 triệu tới dưới 10 triệu, Black từ 10 triệu**. Chính sách công bố có một số lỗi diễn đạt về tên hạng; dashboard sử dụng đúng bảng mốc và ghi **ước tính**, người dùng đối soát với ứng dụng thật.
- Hết hạn DRIPS: sau 12 tháng không tích/dùng điểm. Dashboard không tự xóa số liệu và không tự mô phỏng quyền lợi không xác minh.
- `POLICY_EFFECTIVE_DATE='2026-08-24'` là mốc thận trọng để không hồi tố công thức từ chính sách hiện tại cho giao dịch trước lần cập nhật công bố; không khẳng định đây là ngày đầu HighlandsĐI vận hành.

## Bảo đảm khi phát hành
- Một tính năng = một nhánh và một PR.
- Chạy `npm run check`, `npm test`, `npm run build`; dùng CI trên PR để xác nhận.
- Người dùng vẫn kiểm tra kết quả OCR thực tế trước khi bấm **Thêm giao dịch**.
- Kiểm thử trực tiếp ảnh trên Chrome sau Cloudflare deploy vẫn cần đối soát riêng vì OCR phụ thuộc ánh sáng, góc chụp và chất lượng giấy in.
