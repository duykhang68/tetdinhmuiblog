# Auto-Merge Collector · Evidence & Smart Insights

> Dashboard được tạo tự động bằng `collector.py`. Chỉ phân loại **AUTO-MERGED** khi có bằng chứng được ghi từ workflow merge, xác thực SHA hiện tại và CI xanh. Các lần merge lịch sử thiếu bằng chứng sẽ hiển thị **chưa xác minh**.

## 📊 Dashboard

Chưa chạy collector lần đầu. Workflow `Auto-Merge Collector · Visual Insights` sẽ xây dựng bảng thống kê từ GitHub API sau khi PR này được merge và sau mỗi lần auto-merge kế tiếp; đồng thời có lịch đồng bộ mỗi ngày.

## ✅ Vì sao auto-merge?

- CI `Test and build (Node 22)` thành công trên commit HEAD được merge.
- GitHub API chấp nhận merge với SHA chính xác, không bị conflict/branch rules chặn.
- Đối với PR thay đổi workflow, token phải có quyền `Workflows: write`.

## 🧠 Smart Insights

Chưa đủ bằng chứng sự kiện để thống kê; collector sẽ cập nhật biểu đồ Mermaid, lịch sử merge, bài học và giới hạn dữ liệu.
