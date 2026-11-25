# Ứng Dụng Redis & MongoDB Thống Kê PV, UV và Xác Định Bài Viết Thịnh Hành (Trending)

Dự án Fullstack hoàn chỉnh kết hợp sức mạnh của **Redis (In-Memory Database)** và **MongoDB (Document-Oriented Database)**, kết hợp cùng **node-cron** để giải quyết bài toán phân tích lượt truy cập thời gian thực và lưu trữ lịch sử dài hạn với hiệu năng cao.

---

## 📌 1. Kiến Trúc & Cấu Trúc Dữ Liệu Redis Ứng Dụng

| Mục tiêu | Cấu trúc dữ liệu Redis | Lệnh Redis áp dụng | Ưu điểm & Đặc điểm kỹ thuật |
| :--- | :--- | :--- | :--- |
| **Page Views (PV)** | **Redis String** | `INCR post:pv:<postId>`<br>`INCR stats:pv:daily:<date>` | Thao tác nguyên tử (Atomic operation) O(1), an toàn khi có hàng nghìn lượt truy cập đồng thời, không bị race condition. |
| **UV Đăng nhập (Exact)** | **Redis Bitmap** | `SETBIT stats:uv:bitmap:<date> <userId> 1`<br>`BITCOUNT stats:uv:bitmap:<date>` | Độ chính xác **100%**. Cực kỳ tiết kiệm RAM: 1 triệu User ID chỉ tốn xấp xỉ **~120 KB RAM**; 100 triệu User chỉ tốn **~12 MB RAM**. |
| **UV Khách (Approx)** | **Redis HyperLogLog** | `PFADD stats:uv:hll:<date> <sessionId>`<br>`PFCOUNT stats:uv:hll:<date>` | Thống kê số lượng phần tử duy nhất (Cardinality) của lượng lớn khách vãng lai (Session/IP). Chiếm bộ nhớ cố định tối đa chỉ **~12 KB RAM**, sai số chuẩn lý thuyết chỉ **~0.81%**. |
| **Bài viết Trending** | **Redis Sorted Set (ZSET)** | `ZINCRBY posts:trending:<date> 1 <postId>`<br>`ZRANGE ... WITHSCORES REV` | Sắp xếp theo thứ tự điểm số giảm dần với độ phức tạp $O(\log N)$, hỗ trợ lấy Top bài viết thịnh hành thời gian thực tức thì. |
| **Lưu trữ Lịch sử (Cold Storage)** | **MongoDB Collection** | `findOneAndUpdate({ date }, ..., { upsert: true })` | Đảm bảo tính toàn vẹn (Idempotency). Định kỳ cuối ngày lúc **23:59**, Cron Job đọc số liệu từ Redis chốt vào MongoDB để lưu trữ vĩnh viễn. |

---

## 📂 2. Cấu Trúc Thư Mục Dự Án

```
NoSQL/
├── public/
│   └── index.html         # Giao diện trực quan Dashboard (TailwindCSS, Vanilla JS)
├── .env                   # Biến môi trường kết nối cổng và database
├── .env.example           # File mẫu biến môi trường
├── package.json           # Danh sách thư viện: express, redis, mongoose, node-cron, cors...
├── server.js              # Toàn bộ Backend API, kết nối Redis, MongoDB và Cron Job
└── README.md              # Tài liệu chi tiết và hướng dẫn sử dụng
```

---

## 🚀 3. Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### Bước 1: Khởi động Redis và MongoDB trên máy tính

#### Cách 1: Sử dụng Docker (Nhanh & Tiện nhất)
```bash
# Khởi chạy Redis
docker run -d --name redis-demo -p 6379:6379 redis:latest

# Khởi chạy MongoDB
docker run -d --name mongo-demo -p 27017:27017 mongo:latest
```

#### Cách 2: Khởi chạy Native hoặc Service trên Windows
- **Redis**: Chạy file `redis-server.exe` hoặc service Redis trên Windows (mặc định port `6379`).
- **MongoDB**: Đảm bảo dịch vụ MongoDB Server đang chạy (mặc định port `27017`).

---

### Bước 2: Cài đặt thư viện Node.js

Mở Terminal tại thư mục dự án và chạy:
```bash
npm install
```

---

### Bước 3: Khởi chạy Server

```bash
# Chạy ở chế độ thông thường:
npm start

# Hoặc chế độ xem thay đổi tự động (Node.js 18+):
npm run dev
```

Khi chạy thành công, console sẽ hiển thị:
```
✓ [Redis] Kết nối thành công tại: redis://127.0.0.1:6379
✓ [MongoDB] Kết nối thành công tại: mongodb://127.0.0.1:27017/analytics_db
🚀 Server đang chạy tại: http://localhost:3000
   - Giao diện Demo:     http://localhost:3000
   - API Realtime:       http://localhost:3000/api/stats/realtime
   - API Lịch sử Mongo:  http://localhost:3000/api/stats/history
```

---

### Bước 4: Mở trình duyệt Web

Truy cập: **[http://localhost:3000](http://localhost:3000)**

---

## 🎯 4. Kịch Bản Demo Chuẩn Để Báo Cáo / Thuyết Trình

### Kịch bản 1: Phân biệt Page Views (PV) và Unique Visitors (UV)
1. Chọn vai trò **User ID = 1 (Alice)**.
2. Bấm nút **"Đọc bài viết"** của Bài viết số 1 **ba lần liên tiếp**.
   - **Kết quả:**
     - **PV tăng 3** (mỗi lượt click đều được tính: `INCR`).
     - **UV Bitmap giữ nguyên là 1** (vì cùng là bit thứ 1 của Alice: `SETBIT ... 1 1`).
     - **UV HyperLogLog giữ nguyên là 1** (vì cùng Session ID: `PFADD`).
3. Chuyển sang **User ID = 2 (Bob)** và click 1 lần:
   - **PV tăng lên 4**.
   - **UV Bitmap tăng lên 2** (bit số 2 được bật).

---

### Kịch bản 2: Khách vãng lai (Guest) và HyperLogLog
1. Chọn vai trò **"Khách vãng lai"**.
2. Bấm "Đọc bài viết" bất kỳ:
   - **PV tăng lên**.
   - **UV Bitmap KHÔNG TĂNG** (vì khách vãng lai không có User ID nguyên bản).
   - **UV HyperLogLog TĂNG LÊN** (dựa theo Session ID của khách).
3. Bấm icon **"Đổi Session ID mới"** (mô phỏng người dùng đổi sang trình duyệt Chrome khác):
   - Bấm đọc bài viết -> **UV HyperLogLog tiếp tục tăng thêm 1**.

---

### Kịch bản 3: Bảng xếp hạng Trending (Sorted Set)
1. Thử click bài viết "Kỹ thuật Bitmap và HyperLogLog" nhiều lần.
2. Quan sát bảng **Top Trending**: Điểm số bài viết tăng lên ngay lập tức và tự động nhảy lên vị trí **#1 (Huy chương vàng)** nhờ lệnh `ZINCRBY`.

---

### Kịch bản 4: Giả lập lưu lượng nhanh (Traffic Simulator)
- Bấm nút **"Bắn 5 Views ngẫu nhiên"** hoặc **"Bắn 20 Views nhanh"**.
- Hệ thống sẽ tự động phối hợp nhiều User ID và khách vãng lai ngẫu nhiên truy cập các bài viết khác nhau. Quan sát các con số nhảy múa theo thời gian thực!

---

### Kịch bản 5: Chốt số liệu sang MongoDB với Cron Job
1. Thông thường, tiến trình `node-cron` sẽ tự động kích hoạt vào lúc **23:59** hàng ngày theo cấu hình:
   ```javascript
   cron.schedule('59 23 * * *', async () => { ... });
   ```
2. Để demo nhanh cho giảng viên xem kết quả ngay, bấm nút màu xanh: **"Chạy Cron Job Đồng Bộ Ngay"**.
3. Quan sát:
   - Dữ liệu ngày hôm nay được chốt an toàn vào MongoDB qua lệnh `findOneAndUpdate` (`upsert: true`).
   - Bảng **"Lịch sử lưu trữ trong MongoDB DailyStat"** ở bên dưới sẽ xuất hiện bản ghi mới chứa đầy đủ: Ngày, Tổng PV, UV Bitmap, UV HLL, và danh sách Top bài viết thịnh hành.
   - Bấm vào nút **"X bài"** trong bảng lịch sử để xem popup chi tiết các bài viết thịnh hành đã lưu trong MongoDB.

---

## 🛠️ 5. Chi Tiết Các API Endpoints

| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/posts` | Lấy danh sách 5 bài viết mẫu kèm số lượt PV thời gian thực từ Redis |
| `POST` | `/api/posts/:id/view` | Ghi nhận lượt xem: Tăng PV (INCR), bật Bitmap (SETBIT), nạp HLL (PFADD), tăng Trending (ZINCRBY) |
| `GET` | `/api/stats/realtime` | Đọc số liệu thống kê thời gian thực từ Redis (`GET`, `BITCOUNT`, `PFCOUNT`, `ZRANGE WITHSCORES REV`) |
| `POST` | `/api/cron/trigger-sync` | Kích hoạt tác vụ đồng bộ chốt dữ liệu từ Redis sang MongoDB ngay lập tức |
| `GET` | `/api/stats/history` | Truy vấn các bản ghi thống kê lịch sử đã lưu trữ trong MongoDB `DailyStat` |
| `POST` | `/api/stats/reset-redis-demo` | Xóa sạch các key Redis trong ngày để phục vụ việc demo lại từ đầu |

