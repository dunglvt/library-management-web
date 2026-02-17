const API_BASE = "http://localhost:4000/api";

function getToken() {
  return localStorage.getItem("token");
}
function setSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
function getUser() {
  const s = localStorage.getItem("user");
  return s ? JSON.parse(s) : null;
}

async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.message ? data.message : ("HTTP " + res.status);
    throw new Error(msg);
  }
  return data;
}

function requireLogin() {
  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    location.href = "login.html";
  }
  return user;
}

// Thay thế hàm renderNav cũ trong api.js

function renderNav(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const user = requireLogin();

  // Hàm hỗ trợ tạo link
  const link = (href, text, extraClass = '') => {
    const currentFile = location.pathname.split("/").pop() || "dashboard.html";
    const active = currentFile === href ? 'active' : '';
    return `<a href="${href}" class="${active} ${extraClass}">${text}</a>`;
  };

  const group = (title) => `<div class="nav-group">${title}</div>`;

  // --- 1. TẠO NỘI DUNG MENU ---
  let menuHtml = '';

  menuHtml += link('dashboard.html', '🏠 Dashboard');

  // --- QUYỀN MANAGER ---
  if (user.role === 'MANAGER') {
    menuHtml += group('Báo cáo & Quản trị');
    menuHtml += link('stats_revenue.html', '💰 Doanh thu tiền phạt');
    menuHtml += link('stats_books.html', '📊 Thống kê Sách');
    menuHtml += link('stats_readers.html', '👥 Thống kê Độc giả');
    menuHtml += link('damage_types.html', '⚙️ Quản lý Lỗi hỏng');

    menuHtml += group('Nghiệp vụ Thư viện');
    menuHtml += link('borrow.html', '📖 Cho mượn sách');
    menuHtml += link('return.html', '↩️ Nhận trả sách');
    menuHtml += link('readers.html', '📇 Quản lý Độc giả');
    menuHtml += link('book_titles.html', '📚 Đầu sách & Tra cứu');
    menuHtml += link('book_copies.html', '📦 Sách trong kho');
    menuHtml += link('publishers.html', '🏢 Nhà xuất bản');
  }

  // --- QUYỀN LIBRARIAN ---
  if (user.role === 'LIBRARIAN') {
    menuHtml += group('Tác nghiệp');
    menuHtml += link('borrow.html', '📖 Cho mượn sách');
    menuHtml += link('return.html', '↩️ Nhận trả sách');

    menuHtml += group('Quản lý Dữ liệu');
    menuHtml += link('readers.html', '📇 Quản lý Độc giả');
    menuHtml += link('book_titles.html', '📚 Quản lý Đầu sách');
    menuHtml += link('book_copies.html', '📦 Quản lý Sách kho');
    menuHtml += link('publishers.html', '🏢 Quản lý Nhà xuất bản');
  }

  // --- 2. RENDER VÀ GIỮ VỊ TRÍ SCROLL (NEW) ---

  // Thêm id="navScrollContainer" vào div nav-content để JS tìm được nó
  el.innerHTML = `
    <div class="nav-content" id="navScrollContainer">
        ${menuHtml}
    </div>
    <a href="#" onclick="clearSession();location.href='login.html';return false;" class="logout">
        Đăng xuất
    </a>
  `;

  // --- LOGIC GIỮ THANH CUỘN (Magic here) ---
  const scrollBox = document.getElementById("navScrollContainer");

  // Bước 1: Khôi phục vị trí cũ từ bộ nhớ
  const savedPos = localStorage.getItem("navScrollPos");
  if (savedPos) {
    scrollBox.scrollTop = Number(savedPos);
  }

  // Bước 2: Lưu vị trí mỗi khi người dùng cuộn
  scrollBox.addEventListener("scroll", () => {
    localStorage.setItem("navScrollPos", scrollBox.scrollTop);
  });
}