# Website Quản Lý Thư Viện Trường (HTML/CSS/JS + Node/Express + MySQL)

## 1) Công nghệ dùng
- Frontend: HTML + CSS + JavaScript (thuần)
- Backend: Node.js + Express (REST API)
- Database: MySQL
- Giao tiếp: fetch() gọi REST API

## 2) Yêu cầu cài đặt
- Node.js (khuyến nghị v18+)
- MySQL Server (8.x hoặc tương đương)

## 3) Cấu trúc thư mục
- `backend/` : API Node/Express
- `frontend/`: giao diện web thuần (mở bằng Live Server hoặc mở trực tiếp file)

## 4) Chạy dự án từ A-Z

### Bước A — Tạo CSDL + bảng + dữ liệu mẫu
1. Mở MySQL (MySQL Workbench hoặc terminal).
2. Chạy file SQL: `backend/schema.sql`
   - File sẽ tạo database `library_web` và các bảng.
   - Tạo sẵn 2 tài khoản:
     - Manager/Admin: `admin` / `admin123`
     - Librarian/Thủ thư: `librarian` / `lib123`

### Bước B — Chạy Backend
1. Mở terminal tại thư mục `backend`.
2. Cài thư viện:
   ```bash
   npm install
   ```
3. Tạo file `.env` (copy từ `.env.example`) và điền mật khẩu MySQL:
   ```bash
   cp .env.example .env
   ```
4. Chạy server:
   ```bash
   npm start
   ```
5. Test nhanh:
   - Mở trình duyệt: `http://localhost:4000/api/health` → thấy `{ "ok": true }`

### Bước C — Mở Frontend
Cách dễ nhất:
- Dùng VS Code → cài extension **Live Server**
- Mở thư mục `frontend/` → click phải `login.html` → **Open with Live Server**

Hoặc mở trực tiếp file `frontend/login.html` bằng trình duyệt (nếu bị lỗi CORS khi fetch, hãy dùng Live Server).

## 5) Luồng sử dụng chính
- Đăng nhập → vào Dashboard (menu thay đổi theo role)
- Thủ thư:
  - Quản lý độc giả / NXB / Đầu sách / Quyển sách
  - Mượn sách (giới hạn tối đa 5 cuốn / độc giả)
  - Trả sách (chọn lỗi hỏng + phạt trả muộn)
- Quản lý:
  - Thống kê sách theo lượt mượn (theo khoảng thời gian)
  - Thống kê độc giả theo lượt mượn (theo khoảng thời gian)

## 6) Ghi chú
- Phạt trả muộn: nếu trả quá hạn (due_date) → phạt = 20% giá bìa (theo tài liệu tham khảo).
- Due date mặc định = ngày mượn + 120 ngày.
# library-management-web
