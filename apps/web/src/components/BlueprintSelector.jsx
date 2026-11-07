import React from 'react';

export const SERIES_BLUEPRINTS = [
  {
    id:'tutorial', label:'📚 Hướng dẫn kỹ thuật (Technical Tutorial)',
    markdown:`## Mục tiêu của tập này

Mô tả những gì độc giả sẽ thực hiện được.

### Yêu cầu chuẩn bị

- Công cụ và phiên bản cần thiết
- Kiến thức nền tảng

### Hướng dẫn từng bước

1. Bước thiết lập
2. Bước triển khai
3. Bước kiểm tra

### Ví dụ thực tế

Giải thích đoạn mã hoặc trường hợp sử dụng.

### Sự cố thường gặp và cách khắc phục

- Triệu chứng:
- Nguyên nhân:
- Giải pháp:

### Tóm tắt và tập tiếp theo

Tổng kết kiến thức và dẫn tới tập kế tiếp.`
  },
  {
    id:'journal', label:'🚧 Nhật ký Project (Project Building Journal)',
    markdown:`## Bối cảnh và mục tiêu Sprint

Dự án đang ở giai đoạn nào?

### Tiến độ so với kế hoạch

- Đã hoàn thành:
- Đang thực hiện:
- Chưa bắt đầu:

### Các quyết định kỹ thuật

Mô tả lý do chọn cách triển khai.

### Quá trình xây dựng

1. Thay đổi chính
2. Kiểm thử và nghiệm thu

### Vướng mắc và bài học

- Vấn đề:
- Cách xử lý:

### Kết quả và bước tiếp theo

Ghi lại những gì sẽ làm trong tập kế.`
  },
  {
    id:'review', label:'⚡ Review công nghệ (Tech Stack Review)',
    markdown:`## Tổng quan công nghệ

Công nghệ này giải quyết vấn đề gì?

### Tiêu chí đánh giá

- Hiệu năng
- Trải nghiệm phát triển
- Chi phí vận hành
- Bảo mật và bảo trì

### Cài đặt và thử nghiệm

Môi trường, dữ liệu và cách thử nghiệm.

### Ưu điểm

Những điểm nổi bật có bằng chứng.

### Hạn chế

Nhược điểm và các trường hợp cần cân nhắc.

### So sánh các lựa chọn

So sánh theo các tiêu chí nhất quán.

### Kết luận và tập tiếp theo

Ai nên dùng, khi nào nên dùng.`
  },
  {
    id:'general', label:'🌐 Dàn ý chung cho mọi chủ đề (General Series)',
    markdown:`## Giới thiệu tập này

Giới thiệu câu hỏi hoặc vấn đề chính.

### Bối cảnh

Vì sao chủ đề này quan trọng?

### Nội dung chính

#### Ý chính thứ nhất

Phân tích, ví dụ và dẫn chứng.

#### Ý chính thứ hai

Phân tích, ví dụ và dẫn chứng.

### Bài học thực tế

Cách áp dụng vào thực tiễn.

### Tổng kết

Tóm lược và gợi mở tập kế tiếp.`
  }
];

export default function BlueprintSelector({onInsert,disabled=false}) {
  return <section className="kit-panel blueprint-panel" aria-label="Mẫu dàn ý Series">
    <div className="kit-panel-body">
      <h2>✦ Mẫu dàn ý Series</h2>
      <p>Chọn một mẫu để chèn dàn ý vào nội dung bài hiện tại. Nội dung cũ không bị ghi đè.</p>
      <label htmlFor="series-blueprint">Chọn dàn ý
        <select id="series-blueprint" defaultValue="" disabled={disabled}
          onChange={e=>{
            const blueprint=SERIES_BLUEPRINTS.find(item=>item.id===e.target.value);
            if (blueprint) onInsert(blueprint.markdown);
            e.target.value='';
          }}>
          <option value="" disabled>Chọn một trong 4 mẫu…</option>
          {SERIES_BLUEPRINTS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
    </div>
  </section>;
}
