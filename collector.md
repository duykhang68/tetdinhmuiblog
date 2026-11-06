# Auto-Merge Collector · Evidence & Smart Insights

> Dữ liệu GitHub API; chỉ đánh dấu **AUTO-MERGED (verified)** khi collector
> nhận tín hiệu từ workflow auto-merge và xác thực PR, SHA cùng CI xanh.
> Các PR lịch sử không có bằng chứng được ghi **chưa xác minh nguồn merge**,
> không tự suy đoán là merge thủ công hay tự động.

Cập nhật: **2026-11-06 16:18 UTC** · Repository: `duykhang68/tetdinhmuiblog`

## 📊 Dashboard

| Chỉ số | Giá trị |
|---|---:|
| PR đã merge (tối đa 300 PR gần đây) | 23 |
| AUTO-MERGED có bằng chứng | 1 |
| Auto-merge PR thường | 0 |
| Auto-merge PR thay đổi workflow | 1 |
| Nguồn merge chưa xác minh | 22 |

### Phân bố bằng chứng

```mermaid
pie showData
    "Auto-merge verified" : 1
    "Chưa xác minh" : 22
```

`Auto-merge ` █░░░░░░░░░░░░░░░░░ **1/23**

## ✅ Vì sao từng PR được auto-merge?

| PR | Thời điểm UTC | Loại | CI HEAD | Bằng chứng & lý do |
|---|---|---|---|---|
| [#23](https://github.com/duykhang68/tetdinhmuiblog/pull/23) feat(ci): process auto-merges in separate 60-second PR  | 2026-11-06T16:17:55Z | Workflow/config | ✅ | CI green trên HEAD `950063a2`; GitHub chấp nhận merge; [Run #42251027089](https://github.com/duykhang68/tetdinhmuiblog/actions/runs/42251027089) |

## 🧠 Smart Insights

- **Tỷ lệ workflow trong các auto-merge đã xác minh:** 100.0% (1/1).
- **Quality gate:** 1 auto-merge có bằng chứng CI thành công trên SHA chính xác.
- **Bài học:** Kiểm tra SHA hiện tại giúp tránh dùng kết quả CI của commit cũ.
- **Bài học:** PR thay đổi GitHub Actions cần credential đủ quyền `Workflows: write`; CI xanh không tự cấp quyền.
- **Bài học:** Branch protection và khả năng merge do GitHub thực thi; collector chỉ phản ánh kết quả đã xảy ra.
- **Khoảng trống dữ liệu:** 22 PR đã merge chưa có bằng chứng collector; không tính là auto-merge.

## 🛡️ Giới hạn và phương pháp

- Chỉ tính những PR đã merge trong tối đa 300 PR đóng gần đây; dữ liệu tổng hợp không phải toàn bộ lịch sử.
- Collector ghi nhận sự kiện do workflow gửi, xác thực tên run, PR merged, exact SHA và CI check thành công.
- Trạng thái không conflict / branch rules được GitHub thực thi lúc merge thành công; không lưu ảnh chụp ruleset lịch sử.
- CI xanh là điều kiện cần, không phải bảo đảm thay đổi không có lỗi. Insights là quy tắc phân tích, không phải nhận định AI sinh tự động.
- Tệp sự kiện: `data/collector-events.json`; script tạo báo cáo: `collector.py`.
