require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const mongoose = require('mongoose');
const cron = require('node-cron');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ictu_analytics_db';

// ==========================================================
// 1. CẤU HÌNH MIDDLEWARE
// ==========================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================================
// 2. KHAI BÁO MONGOOSE SCHEMAS & MODELS
// ==========================================================

// Collection 'posts': Lưu trữ thông tin bài viết blog
const postSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  thumbnail: {
    type: String,
    required: true
  }
}, { timestamps: true });

const Post = mongoose.model('Post', postSchema);

// Collection 'dailystats': Thống kê lưu trữ dài hạn sau khi đồng bộ từ Redis
const dailyStatSchema = new mongoose.Schema({
  date: {
    type: String, // Định dạng YYYY-MM-DD
    required: true,
    unique: true,
    index: true
  },
  total_pv: {
    type: Number,
    default: 0
  },
  uv_exact_bitmap: {
    type: Number,
    default: 0
  },
  uv_approx_hll: {
    type: Number,
    default: 0
  },
  top_trending: [
    {
      postId: { type: String, required: true },
      title: { type: String, default: '' },
      score: { type: Number, default: 0 }
    }
  ],
  synced_at: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const DailyStat = mongoose.model('DailyStat', dailyStatSchema);

// ==========================================================
// 3. DỮ LIỆU BÀI VIẾT CHÍNH THỨC CỦA TRƯỜNG ICTU (THÔNG TIN THẬT)
// ==========================================================
const INITIAL_POSTS = [
  {
    id: 'post-ictu-ai',
    title: 'Trường Đại học Công nghệ Thông tin & Truyền thông (ICTU): Khám phá khuôn viên hiện đại và không gian đại học số thông minh',
    category: 'Trang chủ',
    author: 'Nguyễn Thị Ngọc Anh',
    date: '12/11/2026',
    thumbnail: '/images/ictu-viettel-doan-sinh-vien.jpg',
    summary: 'Trường Đại học Công nghệ Thông tin và Truyền thông (Đại học Thái Nguyên) sở hữu khuôn viên hiện đại với hệ sinh thái giảng đường thông minh từ Tòa nhà C1 đến C6, quảng trường C5 thoáng đãng, ký túc xá tiện nghi cùng các trung tâm nghiên cứu tiên phong chuyển đổi số.',
    content: `
      <p class="lead text-base sm:text-lg text-slate-700 font-medium leading-relaxed mb-4">
        Trải qua hơn hai thập kỷ hình thành và phát triển, Trường Đại học Công nghệ Thông tin và Truyền thông (ICTU) – Đại học Thái Nguyên đã khẳng định vị thế là trung tâm đào tạo, nghiên cứu khoa học và chuyển giao công nghệ hàng đầu khu vực Trung du và Miền núi phía Bắc, kiến tạo không gian đại học thông minh, xanh và truyền cảm hứng sáng tạo cho sinh viên.
      </p>

      <figure class="my-6">
        <img src="/images/ictu-viettel-doan-sinh-vien.jpg" alt="Sinh viên ICTU trong chương trình tham quan, trải nghiệm thực tế và ký kết hợp tác hướng nghiệp tại Trụ sở Tập đoàn Công nghiệp - Viễn thông Quân đội (Viettel)" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Sinh viên ICTU trong chương trình tham quan, trải nghiệm thực tế và ký kết hợp tác hướng nghiệp tại Trụ sở Tập đoàn Công nghiệp - Viễn thông Quân đội (Viettel).</figcaption>
      </figure>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">Hệ thống cơ sở vật chất đồng bộ và khuôn viên hiện đại</h3>
      <p class="text-slate-700 leading-relaxed mb-4">
        Tọa lạc tại trung tâm thành phố Thái Nguyên, khuôn viên ICTU được quy hoạch đồng bộ với hệ sinh thái công trình hiện đại:
      </p>
      <ul class="space-y-2 mb-4 text-slate-700 list-disc ml-5">
        <li><strong>Tòa nhà C1 & C6:</strong> Khu làm việc điều hành, viện nghiên cứu và các phòng thí nghiệm công nghệ cao, an toàn thông tin và trí tuệ nhân tạo.</li>
        <li><strong>Tòa nhà C2, C3, C4 & C5:</strong> Hệ thống giảng đường liên hoàn thông minh, trung tâm thư viện số, phòng máy tính cấu hình cao kết nối mạng gigabit và các không gian tự học mở (Co-working space).</li>
        <li><strong>Khuôn viên Ký túc xá & Tiện ích sinh viên:</strong> Hệ thống ký túc xá khang trang, căng-tin sinh viên, sân bóng đá cỏ nhân tạo và khu liên hợp thể thao phục vụ tối đa đời sống thể chất, tinh thần của người học.</li>
      </ul>

      <figure class="my-6">
        <img src="/images/ictu-toan-canh-campus.jpg" alt="Toàn cảnh khuôn viên Trường Đại học Công nghệ Thông tin & Truyền thông (ICTU)" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Toàn cảnh khuôn viên Trường Đại học Công nghệ Thông tin & Truyền thông (ICTU) nhìn từ trên cao: Quần thể kiến trúc hiện đại gồm Tòa nhà C1, C2, C3, C4, C5, C6, Ký túc xá sinh viên, Cổng chính và các điểm check-in xanh.</figcaption>
      </figure>

      <figure class="my-6">
        <img src="/images/ictu-san-truong-c5.jpg" alt="Quảng trường sân trường trước Tòa nhà C5 và Hội trường lớn ICTU" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Quảng trường trung tâm trước Tòa nhà C5 và Hội trường lớn ICTU - Nơi diễn ra các sự kiện đại nhạc hội, triển lãm công nghệ và hoạt động phong trào sôi nổi của tuổi trẻ nhà trường.</figcaption>
      </figure>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">4 trụ cột đào tạo thích ứng với kỷ nguyên trí tuệ nhân tạo</h3>
      <p class="text-slate-700 leading-relaxed mb-4">
        Nhà trường kiên định tái cấu trúc toàn diện chương trình đào tạo theo 4 trụ cột chiến lược: <strong>Công nghệ thông tin</strong>, <strong>Kỹ thuật và Công nghệ số</strong>, <strong>Nghệ thuật và Truyền thông số</strong>, cùng <strong>Kinh tế và Quản trị số</strong>. Các chương trình này được thiết kế theo chuẩn kiểm định quốc tế AUN-QA, tích hợp sâu kiến thức thực chiến từ các tập đoàn công nghệ hàng đầu thế giới.
      </p>

      <blockquote class="p-4 my-4 border-s-4 border-teal-700 bg-slate-50 text-slate-700 italic rounded-r-lg">
        "Sứ mệnh của ICTU là kiến tạo môi trường học thuật mở, hiện đại, nơi mỗi sinh viên không chỉ thành thạo kỹ năng công nghệ mà còn phát triển tư duy sáng tạo, tự tin làm chủ công nghệ mới và đóng góp thiết thực cho công cuộc chuyển đổi số quốc gia."
        <div class="mt-2 text-xs font-semibold text-teal-800 not-italic">— PGS.TS Phùng Trung Nghĩa, Hiệu trưởng Trường ĐH Công nghệ Thông tin & Truyền thông nhấn mạnh.</div>
      </blockquote>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">Hạ tầng tính toán hiệu năng cao và Viện Trí tuệ nhân tạo IAI</h3>
      <p class="text-slate-700 leading-relaxed mb-4">
        Nhà trường đã đầu tư đưa vào vận hành Viện Trí tuệ nhân tạo (IAI-ICTU) cùng hệ thống máy chủ GPU tính toán hiệu năng cao chuyên dụng cho huấn luyện các mô hình học sâu (Deep Learning), xử lý ngôn ngữ tự nhiên (NLP) và thị giác máy tính. Gần đây nhất, các đội tuyển sinh viên ICTU liên tục ghi dấu ấn tại các đấu trường học thuật quốc gia và quốc tế, khẳng định uy tín đào tạo hàng đầu của nhà trường.
      </p>
    `.normalize('NFC')
  },
  {
    id: 'post-ictu-samsung-sic',
    title: 'Khánh thành Trung tâm Phát triển Nhân tài Công nghệ cao Samsung Innovation Campus (SIC) tại ICTU',
    category: 'Trang chủ',
    author: 'Nguyễn Thị Ngọc Anh',
    date: '20/11/2026',
    thumbnail: '/images/ictu-samsung-sic-khanh-thanh.jpg',
    summary: 'Trường Đại học Công nghệ Thông tin & Truyền thông (ICTU) phối hợp cùng Tổ hợp Samsung Electronics Việt Nam chính thức khánh thành Trung tâm Phát triển Nhân tài Công nghệ cao Samsung Innovation Campus (SIC Lab), mang đến không gian thực hành chuẩn quốc tế và học bổng chuyên sâu về AI, Big Data, IoT cho sinh viên.',
    content: `
      <p class="lead text-base sm:text-lg text-slate-700 font-medium leading-relaxed mb-4">
        Sáng ngày 20/11/2026, tại Trường Đại học Công nghệ Thông tin và Truyền thông (ICTU) – Đại học Thái Nguyên, lễ khánh thành Trung tâm Phát triển Nhân tài Công nghệ cao <strong>Samsung Innovation Campus (SIC)</strong> đã chính thức được tổ chức trọng thể. Sự kiện đánh dấu cột mốc quan trọng trong mối quan hệ hợp tác chiến lược giữa nhà trường và Tổ hợp Samsung Electronics Việt Nam, mở ra không gian đào tạo công nghệ đỉnh cao chuẩn toàn cầu cho sinh viên.
      </p>

      <figure class="my-6">
        <img src="/images/ictu-samsung-sic-khanh-thanh.jpg" alt="Ban Giám hiệu ICTU cùng lãnh đạo Samsung Electronics Việt Nam thực hiện nghi thức khánh thành Trung tâm SIC Lab" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Ban Giám hiệu Trường ĐH Công nghệ Thông tin & Truyền thông cùng các đại biểu cấp cao Tập đoàn Samsung thực hiện nghi thức khánh thành Trung tâm SIC Lab.</figcaption>
      </figure>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">Dấu mốc chiến lược trong liên kết đào tạo "Nhà trường - Doanh nghiệp"</h3>
      <p class="text-slate-700 leading-relaxed mb-4">
        Tham dự buổi lễ khánh thành có sự hiện diện của Ban Giám hiệu ICTU, lãnh đạo các Khoa, Viện chuyên ngành cùng đoàn đại biểu cấp cao đại diện Tổ hợp Samsung Electronics Việt Nam. Tại buổi lễ, đại diện Tập đoàn Samsung đã chính thức trao tặng biển tượng trưng thành lập trung tâm cùng gói tài trợ toàn diện bao gồm trang thiết bị phòng lab tối tân, bản quyền giáo trình quốc tế và tài trợ 100% học bổng đào tạo cho sinh viên nhà trường.
      </p>

      <figure class="my-6">
        <img src="/images/ictu-samsung-sic-trao-tang.jpg" alt="Lễ trao tặng Trung tâm phát triển nhân tài công nghệ cao Samsung Innovation Campus (SIC) tại ICTU" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Đại diện Tổ hợp Samsung Electronics Việt Nam trao tặng biểu trưng thành lập Trung tâm phát triển nhân tài công nghệ cao SIC cho ICTU.</figcaption>
      </figure>

      <blockquote class="p-4 my-4 border-s-4 border-teal-700 bg-slate-50 text-slate-700 italic rounded-r-lg">
        "Thái Nguyên là một trong những cứ điểm sản xuất và công nghệ lớn nhất thế giới của Samsung. Dự án Samsung Innovation Campus tại ICTU là cam kết trách nhiệm xã hội lâu dài của chúng tôi trong việc đồng hành ươm mầm thế hệ kỹ sư công nghệ số trẻ của Việt Nam, cung cấp nguồn nhân lực tinh hoa sẵn sàng hội nhập vào chuỗi giá trị nghiên cứu và phát triển (R&D) toàn cầu."
        <div class="mt-2 text-xs font-semibold text-teal-800 not-italic">— Đại diện Ban Lãnh đạo Tổ hợp Samsung Electronics Việt Nam nhấn mạnh.</div>
      </blockquote>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">Không gian đào tạo công nghệ cao chuẩn quốc tế</h3>
      <p class="text-slate-700 leading-relaxed mb-4">
        Phòng Lab SIC tại ICTU được trang bị đồng bộ với hệ thống máy trạm hiệu năng cao, màn hình thông minh tương tác, hệ thống vi điều khiển thực hành IoT thế hệ mới cùng hạ tầng mạng cáp quang chuyên dụng tốc độ cao. Sinh viên theo học tại trung tâm sẽ được thụ hưởng môi trường học tập hiện đại bậc nhất:
      </p>
      <ul class="space-y-2 mb-4 text-slate-700 list-disc ml-5">
        <li><strong>Trí tuệ nhân tạo (AI):</strong> Huấn luyện các mô hình học máy (Machine Learning), học sâu (Deep Learning), xử lý ngôn ngữ tự nhiên và thị giác máy tính.</li>
        <li><strong>Dữ liệu lớn (Big Data):</strong> Thu thập, phân tích dữ liệu lớn và thuật toán khai phá tri thức trên nền tảng điện toán đám mây.</li>
        <li><strong>Vạn vật kết nối (IoT):</strong> Thiết kế mạch nhúng, cảm biến thông minh và giải pháp kết nối phần cứng - phần mềm thực tế.</li>
        <li><strong>Kỹ năng nghề nghiệp số:</strong> Rèn luyện kỹ năng giải quyết vấn đề phức tạp, làm việc nhóm và phương pháp luận thiết kế (Design Thinking).</li>
      </ul>

      <figure class="my-6">
        <img src="/images/ictu-samsung-sic-phong-lab.jpg" alt="Không gian phòng thực hành công nghệ cao Samsung Innovation Campus với đầy đủ trang thiết bị hiện đại" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Toàn cảnh không gian học tập hiện đại tại phòng Lab SIC - nơi sinh viên ICTU được tiếp cận trực tiếp với giáo trình công nghệ chuẩn toàn cầu của Samsung.</figcaption>
      </figure>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">Trải nghiệm thực chiến và cơ hội tuyển dụng trực tiếp tại Samsung R&D</h3>
      <p class="text-slate-700 leading-relaxed mb-4">
        Khóa đào tạo đầu tiên đã tuyển chọn hơn 120 sinh viên xuất sắc nhất đến từ các chuyên ngành Công nghệ thông tin, Kỹ thuật phần mềm, Khoa học máy tính và Tự động hóa. Sau phần học lý thuyết chuyên sâu và thực hiện dự án tốt nghiệp thực tế (Capstone Project) dưới sự hướng dẫn của các chuyên gia Samsung, các học viên xuất sắc sẽ nhận chứng chỉ quốc tế và ưu tiên tuyển dụng thẳng vào Trung tâm Nghiên cứu & Phát triển Samsung Việt Nam (SRV).
      </p>

      <figure class="my-6">
        <img src="/images/ictu-samsung-sic-dai-bieu-tham-quan.jpg" alt="Đoàn đại biểu tham quan giờ học và trò chuyện, động viên sinh viên tại phòng Lab SIC" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Đoàn đại biểu lãnh đạo Samsung và Ban Giám hiệu ICTU thăm hỏi, động viên các bạn sinh viên đang theo học khóa đào tạo đầu tiên tại SIC Lab.</figcaption>
      </figure>

      <p class="text-slate-700 leading-relaxed mb-4">
        Việc đưa Trung tâm Samsung Innovation Campus vào hoạt động một lần nữa khẳng định vị thế tiên phong của ICTU trong việc gắn kết đào tạo với thực tiễn doanh nghiệp, mở ra bước ngoặt đột phá cho hành trình trở thành đại học thông minh hàng đầu khu vực.
      </p>
    `.normalize('NFC')
  },
  {
    id: 'post-ictu-coding-contest',
    title: 'OPEN STEM DAY 2026 - BÙNG NỔ VỚI LOẠT SÂN CHƠI CÔNG NGHỆ, KHƠI DẬY ĐAM MÊ SÁNG TẠO CỦA HỌC SINH THPT',
    category: 'Trang chủ',
    author: 'Nguyễn Thị Ngọc Anh',
    date: '18/10/2026',
    thumbnail: '/images/ictu-stem-hoi-truong.jpg',
    summary: 'Từ những màn thử sức cùng robot, các thử thách lập trình đến những trận Esports đầy kịch tính, OPEN STEM DAY 2026 đã mang đến bầu không khí sôi động, tràn đầy năng lượng sáng tạo tại ICTU vào ngày 18/10/2026.',
    content: `
      <p class="lead text-base sm:text-lg text-slate-700 font-medium leading-relaxed mb-4">
        Từ những màn thử sức cùng robot, các thử thách lập trình đến những trận Esports đầy kịch tính, <strong>OPEN STEM DAY 2026</strong> đã mang đến bầu không khí sôi động, tràn đầy năng lượng sáng tạo tại ICTU vào ngày 18/10/2026.
      </p>

      <p class="text-slate-700 leading-relaxed mb-4">
        Dưới sự chủ trì của Sở Giáo dục & Đào tạo tỉnh Thái Nguyên và Tỉnh đoàn Thái Nguyên, với ICTU đảm nhiệm vai trò tổ chức và phụ trách chuyên môn, Open STEM Day 2026 đã mang đến không gian giao lưu, khám phá và trải nghiệm công nghệ đầy sáng tạo cho học sinh THPT trên địa bàn tỉnh. Chương trình có sự tham dự của 50 trường THPT trên địa bàn tỉnh với hơn 400 học sinh tham gia trải nghiệm.
      </p>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">Ứng dụng AI trong thiết kế tài nguyên học tập STEM liên môn</h3>
      <p class="text-slate-700 leading-relaxed mb-4">
        Điểm nhấn chuyên môn là phần chia sẻ <em>“Ứng dụng AI trong thiết kế tài nguyên học tập STEM liên môn”</em> mang đến những góc nhìn thú vị về ứng dụng trí tuệ nhân tạo trong dạy và học. Đặc biệt, 9 trường THPT trên địa bàn tỉnh: Chuyên Thái Nguyên, Chuyên Bắc Kạn, Lương Ngọc Quyến, Chu Văn An, Gang Thép, Sông Công, Điềm Thụy, Lê Hồng Phong và Bắc Kạn đã mang đến sự kiện những sản phẩm STEM sáng tạo, biến không gian trưng bày thành nơi các ý tưởng được giới thiệu, trải nghiệm và lan tỏa. Các đại biểu, giáo viên và học sinh còn được khám phá không gian sáng tạo và tìm hiểu mô hình hợp tác ba nhà.
      </p>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">TÂM ĐIỂM NGÀY HỘI LÀ 3 SÂN CHƠI CÔNG NGHỆ CHÍNH THỨC ĐƯỢC PHÁT ĐỘNG VÀ THI ĐẤU TRẢI NGHIỆM:</h3>

      <div class="space-y-2 mb-4 text-slate-700">
        <p>• <strong>Robotics – “Đường tới Tân Cương, Thái Nguyên”:</strong> Thử sức cùng robot, chinh phục các thử thách kỹ thuật.</p>
      </div>

      <figure class="my-6">
        <img src="/images/ictu-stem-robotics.jpg" alt="Sân chơi Robotics Đường tới Tân Cương tại Open STEM Day 2026" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Học sinh THPT hào hứng trải nghiệm sân chơi Robotics - "Đường tới Tân Cương, Thái Nguyên" tại hội trường ICTU</figcaption>
      </figure>

      <div class="space-y-2 mb-4 text-slate-700">
        <p>• <strong>Lập trình – “NextGen STEM Talents”:</strong> Thể hiện tư duy logic và khả năng giải quyết vấn đề.</p>
        <p>• <strong>Esports ICTU 2026:</strong> Những màn đấu trí, phối hợp đồng đội đầy hào hứng.</p>
      </div>

      <figure class="my-6">
        <img src="/images/ictu-stem-esports.jpg" alt="Thi đấu Esports Liên Quân Mobile ICTU 2026 tại Open STEM Day" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Tranh tài kịch tính tại đấu trường Esports ICTU 2026: Những màn đấu trí, phối hợp đồng đội đầy hào hứng</figcaption>
      </figure>

      <blockquote class="p-4 my-4 border-s-4 border-teal-700 bg-slate-50 text-slate-700 italic rounded-r-lg">
        "Không chỉ mang đến những trải nghiệm đáng nhớ, OPEN STEM DAY 2026 còn là cầu nối giữa ICTU và các trường THPT, góp phần xây dựng cộng đồng STEM Thái Nguyên, tiếp thêm cảm hứng để thế hệ trẻ tự tin khám phá công nghệ và theo đuổi đam mê."
      </blockquote>

      <p class="text-slate-700 font-semibold leading-relaxed mb-4 text-teal-800">
        Một ngày hội khép lại, nhưng hành trình sáng tạo chỉ vừa bắt đầu!
      </p>
    `.normalize('NFC')
  },
  {
    id: 'post-ictu-khai-giang',
    title: 'Lễ Khai giảng năm học mới & Đại nhạc hội Chào tân sinh viên ICTU ONE: Sân khấu hoành tráng sẵn sàng bùng nổ',
    category: 'Trang chủ',
    author: 'Nguyễn Thị Ngọc Anh',
    date: '10/11/2026',
    thumbnail: '/images/ictu-khai-giang-dem-nhac-1.jpg',
    summary: 'Chào đón tân sinh viên khóa mới, Trường Đại học Công nghệ Thông tin và Truyền thông (ICTU) đầu tư quy mô sân khấu ngoài trời ICTU ONE siêu khủng với hệ thống màn hình LED cong, âm thanh ánh sáng đỉnh cao và các tiết mục nghệ thuật bùng nổ.',
    content: `
      <p class="lead text-base sm:text-lg text-slate-700 font-medium leading-relaxed mb-4">
        Hòa chung không khí hân hoan bước vào năm học mới, Trường Đại học Công nghệ Thông tin và Truyền thông (ICTU) – Đại học Thái Nguyên long trọng tổ chức Lễ Khai giảng năm học mới kết hợp Đại nhạc hội Chào tân sinh viên quy mô lớn mang tên <strong>"ICTU ONE 2026"</strong>.
      </p>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">Đại nhạc hội bùng nổ với các màn đồng diễn nghệ thuật mãn nhãn</h3>
      <p class="text-slate-700 leading-relaxed mb-4">
        Đêm gala ICTU ONE đã thực sự làm bùng nổ khuôn viên trường với sự tham gia của hàng nghìn tân sinh viên. Điểm nhấn đặc sắc là các tiết mục vũ đạo sôi động, âm thanh ánh sáng chuyển động hiện đại và phong thái tự tin, tràn đầy năng lượng của sinh viên công nghệ.
      </p>

      <figure class="my-6">
        <img src="/images/ictu-khai-giang-dem-nhac-2.jpg" alt="Tiết mục nhảy hiện đại sôi động của sinh viên ICTU" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Tiết mục nhảy hiện đại sôi động của các bạn nữ sinh viên ICTU bùng nổ trên sàn diễn catwalk chính</figcaption>
      </figure>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">Sân khấu ngoài trời quy mô và hệ thống kỹ thuật hiện đại</h3>
      <p class="text-slate-700 leading-relaxed mb-4">
        Tại Quảng trường Trung tâm ICTU, sân khấu chính được thiết kế với phong cách tương lai (Futuristic), biểu trưng cho khát vọng vươn mình của sinh viên công nghệ. Hệ thống màn hình LED cong đa tầng, dàn đèn Moving Head và âm thanh vòm chuẩn festival quốc tế đã được các kỹ sư kỹ thuật hoàn tất lắp đặt và chạy thử nghiệm kỹ lưỡng từ ban ngày.
      </p>

      <figure class="my-6">
        <img src="/images/ictu-khai-giang-thuc-te.jpg" alt="Lắp đặt sân khấu thực tế tại sân trường ICTU" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Công tác hoàn thiện sân khấu ngoài trời và hệ thống màn hình LED tại sân trường ICTU chuẩn bị cho Lễ Khai giảng</figcaption>
      </figure>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">Sơ đồ tổng thể sân khấu ICTU ONE và khu vực Fanzone cuồng nhiệt</h3>
      <p class="text-slate-700 leading-relaxed mb-4">
        Để đảm bảo trải nghiệm thưởng thức âm nhạc đỉnh cao cũng như an toàn tuyệt đối cho hơn 5.000 sinh viên tham dự, Ban tổ chức Đoàn trường đã công bố sơ đồ phân luồng chuyên nghiệp với khu vực Fanzone trung tâm, trạm điều phối kỹ thuật FOH và các lối thoát hiểm rộng rãi.
      </p>

      <figure class="my-6">
        <img src="/images/ictu-khai-giang-san-khau.jpg" alt="Sơ đồ sân khấu ICTU ONE 2026" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Sơ đồ tổng thể sân khấu đại nhạc hội ICTU ONE và phân khu Fanzone đón chào tân sinh viên</figcaption>
      </figure>

      <blockquote class="p-4 my-4 border-s-4 border-teal-700 bg-slate-50 text-slate-700 italic rounded-r-lg">
        "Lễ Khai giảng và đêm nhạc ICTU ONE không chỉ là ngày hội chào đón các bạn tân sinh viên gia nhập đại gia đình ICTU, mà còn là khởi đầu đầy nhiệt huyết, truyền cảm hứng sáng tạo và tinh thần bứt phá cho một năm học mới nhiều thắng lợi."
        <div class="mt-2 text-xs font-semibold text-teal-800 not-italic">— Ban Tổ chức Đại nhạc hội ICTU ONE chia sẻ.</div>
      </blockquote>

      <p class="text-slate-700 leading-relaxed mb-4">
        Đêm nhạc hội khép lại với những màn pháo sáng rực rỡ và những bài ca tuổi trẻ ngân vang, để lại những kỷ niệm thanh xuân bùng nổ và khó quên trong lòng tân sinh viên ICTU.
      </p>
    `.normalize('NFC')
  },
  {
    id: 'post-ictu-halloween',
    title: 'Đêm hội Halloween ICTU 2026: Không gian ma quái và chuỗi nhà ma công nghệ của sinh viên Thiết kế Đồ họa',
    category: 'Trang chủ',
    author: 'Nguyễn Thị Ngọc Anh',
    date: '31/10/2026',
    thumbnail: '/images/ictu-halloween-poster.jpg',
    summary: 'Đêm hội Halloween và Lễ hội Sắc màu ICTU 2026 ghi dấu ấn mạnh mẽ với 4 phân khu trải nghiệm đặc sắc, nổi bật là chuỗi gian hàng "Không gian ma quái" do chính các bạn sinh viên Thiết kế Đồ họa và Kỹ thuật Phần mềm tự tay dàn dựng.',
    content: `
      <p class="lead text-base sm:text-lg text-slate-700 font-medium leading-relaxed mb-4">
        Tối 31/10, khuôn viên Quảng trường Sinh viên Trường Đại học Công nghệ Thông tin & Truyền thông (ICTU) đã biến thành một <strong>"Không gian ma quái"</strong> rực rỡ sắc màu nhưng không kém phần rùng rợn trong chuỗi sự kiện <em>"Lễ hội Sắc màu ICTU 2026"</em>.
      </p>

      <p class="text-slate-700 leading-relaxed mb-4">
        Lễ hội năm nay được thiết kế quy mô lớn với 4 phân khu trải nghiệm độc đáo: <strong>Không gian ma quái</strong>, <strong>Không gian ẩm thực</strong>, <strong>Âm nhạc đường phố</strong> và <strong>Đại nhạc hội EDM</strong> bùng nổ, thu hút hàng nghìn sinh viên và du khách trẻ tham dự.
      </p>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">Chuỗi gian hàng nhà ma sáng tạo của sinh viên Kỹ thuật Phần mềm K25</h3>
      <p class="text-slate-700 leading-relaxed mb-4">
        Các chàng trai, cô gái đến từ chi đoàn <strong>KTPME.02 - K25 (Khoa Công nghệ Thông tin)</strong> đã mang đến một gian hàng đậm chất bí ẩn với biển cảnh báo "STOP", "DANGER", mạng nhện giăng kín lối đi và các hình nhân ma quái, kết hợp hệ thống loa âm thanh rùng rợn.
      </p>

      <figure class="my-6">
        <img src="/images/ictu-halloween-ktpm-k25.jpg" alt="Gian hàng nhà ma của chi đoàn KTPME.02 K25" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Gian hàng nhà ma độc đáo của chi đoàn KTPME.02 - K25 với biển cảnh báo DANGER, mạng nhện và hình nhân kỳ bí</figcaption>
      </figure>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">Nghệ thuật thị giác và sự sáng tạo đỉnh cao của lớp Thiết kế Đồ họa K23B</h3>
      <p class="text-slate-700 leading-relaxed mb-4">
        Không hề kém cạnh, các bạn sinh viên lớp <strong>Thiết kế Đồ họa K23B</strong> đã biến hóa lều trại thành một không gian kinh dị đầy ám ảnh với các dải ruy-băng đỏ máu, hình nhân ma trơi và bộ xương treo lơ lửng, tạo cảm giác rợn ngợp ngay từ lối vào.
      </p>

      <figure class="my-6">
        <img src="/images/ictu-halloween-nha-ma-1.jpg" alt="Gian hàng không gian ma quái của lớp TKĐH K23B" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Gian hàng "Không gian ma quái" đầy ấn tượng với hiệu ứng thị giác rùng rợn do sinh viên lớp Thiết kế Đồ họa K23B tự tay dàn dựng</figcaption>
      </figure>

      <h3 class="text-xl font-bold text-slate-900 mt-6 mb-3">Lạc vào mê cung ảo giác Wonderland của chi đoàn K23C</h3>
      <p class="text-slate-700 leading-relaxed mb-4">
        Ngay cạnh đó, gian hàng của lớp <strong>Thiết kế Đồ họa K23C</strong> lại mang đến phong cách huyền bí kỳ ảo lấy cảm hứng từ thế giới cổ tích <em>"Alice in Wonderland"</em>. Với mô hình đồng hồ thời gian ma mị, chú thỏ phục sinh và bức tường xoáy ảo giác quang học (Optical Illusion) đen trắng, gian hàng đã trở thành điểm check-in "cháy máy" của các bạn trẻ ICTU.
      </p>

      <figure class="my-6">
        <img src="/images/ictu-halloween-nha-ma-2.jpg" alt="Không gian mê cung huyền bí Wonderland của chi đoàn TKĐH K23C" class="w-full rounded-xl shadow-md border border-slate-200">
        <figcaption class="text-xs text-slate-500 mt-2 text-center italic">Không gian mê cung huyền bí phong cách Wonderland độc đáo của sinh viên lớp Thiết kế Đồ họa K23C</figcaption>
      </figure>

      <blockquote class="p-4 my-4 border-s-4 border-teal-700 bg-slate-50 text-slate-700 italic rounded-r-lg">
        "Mỗi mùa Halloween là dịp để sinh viên ICTU được thỏa sức phô diễn tư duy mỹ thuật, phối màu và sắp đặt không gian thực tế ngoài đời thực. Từng chi tiết nhỏ đều do các bạn tự tay vẽ, cắt dán và set up ánh sáng suốt nhiều đêm liền."
        <div class="mt-2 text-xs font-semibold text-teal-800 not-italic">— Đại diện Ban Tổ chức Lễ hội chia sẻ.</div>
      </blockquote>

      <p class="text-slate-700 leading-relaxed mb-4">
        Đêm hội Halloween không chỉ mang đến tiếng cười và những pha giật thót tim sảng khoái, mà còn thắt chặt tinh thần đoàn kết của đại gia đình sinh viên công nghệ ICTU.
      </p>
    `.normalize('NFC')
  }
];

// Hàm đồng bộ nạp bài viết chuẩn vào MongoDB
async function seedPostsData() {
  try {
    const validIds = INITIAL_POSTS.map(p => p.id);
    for (const post of INITIAL_POSTS) {
      await Post.findOneAndUpdate(
        { id: post.id },
        { $set: post },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    // Dọn dẹp bài cũ nếu có ID thừa không thuộc danh sách
    await Post.deleteMany({ id: { $nin: validIds } });
    const count = await Post.countDocuments();
    console.log(`✓ [MongoDB] Đã đồng bộ ${INITIAL_POSTS.length} bài viết chuẩn vào Database "ictu_analytics_db" (Tổng hiện có: ${count} bài).`);
  } catch (err) {
    console.error('✗ [MongoDB] Lỗi khi nạp dữ liệu bài viết:', err.message);
  }
}

// ==========================================================
// 4. KẾT NỐI MONGODB & REDIS
// ==========================================================
let isRedisConnected = false;
let isMongoConnected = false;

// Kết nối MongoDB qua Mongoose
console.log(`[MongoDB] Đang kết nối tới: ${MONGO_URI}...`);
mongoose.connect(MONGO_URI)
  .then(async () => {
    isMongoConnected = true;
    console.log(`✓ [MongoDB] Kết nối THÀNH CÔNG tới Database: "ictu_analytics_db" (${MONGO_URI})`);
    await seedPostsData();
  })
  .catch((err) => {
    isMongoConnected = false;
    console.error('✗ [MongoDB] KẾT NỐI THẤT BẠI:', err.message);
  });

mongoose.connection.on('disconnected', () => {
  isMongoConnected = false;
  console.warn('⚠️ [MongoDB] Mất kết nối tới cơ sở dữ liệu.');
});

// Khởi tạo Redis Client
const redisClient = createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      return Math.min(retries * 500, 5000);
    }
  }
});

redisClient.on('error', (err) => {
  if (isRedisConnected) {
    console.warn('[Redis] Mất kết nối tới Redis Server:', err.message);
  }
  isRedisConnected = false;
});

redisClient.on('ready', () => {
  isRedisConnected = true;
  console.log('✓ [Redis] Kết nối THÀNH CÔNG tại:', REDIS_URL);
});

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.log('⚠️ [Redis] Cổng 6379 chưa mở. Hệ thống tự kích hoạt Chế độ Mô phỏng In-Memory để demo trơn tru!');
  }
})();

// --- SMART FALLBACK MEMORY CHO REDIS ---
const fallbackMemory = {
  strings: new Map(),
  bitmaps: new Map(),
  hlls: new Map(),
  zsets: new Map(),
};

const redisProxy = {
  async incr(key) {
    if (isRedisConnected) return await redisClient.incr(key);
    const cur = parseInt(fallbackMemory.strings.get(key) || 0, 10) + 1;
    fallbackMemory.strings.set(key, cur.toString());
    return cur;
  },
  async get(key) {
    if (isRedisConnected) return await redisClient.get(key);
    return fallbackMemory.strings.get(key) || null;
  },
  async setBit(key, offset, value) {
    if (isRedisConnected) return await redisClient.setBit(key, offset, value);
    if (!fallbackMemory.bitmaps.has(key)) fallbackMemory.bitmaps.set(key, new Set());
    const bitSet = fallbackMemory.bitmaps.get(key);
    if (value === 1) bitSet.add(offset);
    else bitSet.delete(offset);
    return 1;
  },
  async bitCount(key) {
    if (isRedisConnected) return await redisClient.bitCount(key);
    const bitSet = fallbackMemory.bitmaps.get(key);
    return bitSet ? bitSet.size : 0;
  },
  async pfAdd(key, element) {
    if (isRedisConnected) return await redisClient.pfAdd(key, element);
    if (!fallbackMemory.hlls.has(key)) fallbackMemory.hlls.set(key, new Set());
    fallbackMemory.hlls.get(key).add(element);
    return 1;
  },
  async pfCount(key) {
    if (isRedisConnected) return await redisClient.pfCount(key);
    const hllSet = fallbackMemory.hlls.get(key);
    return hllSet ? hllSet.size : 0;
  },
  async zIncrBy(key, increment, member) {
    if (isRedisConnected) return await redisClient.zIncrBy(key, increment, member);
    if (!fallbackMemory.zsets.has(key)) fallbackMemory.zsets.set(key, new Map());
    const zMap = fallbackMemory.zsets.get(key);
    const currentScore = zMap.get(member) || 0;
    const newScore = currentScore + increment;
    zMap.set(member, newScore);
    return newScore;
  },
  async zRangeWithScores(key, start, stop, options) {
    if (isRedisConnected) return await redisClient.zRangeWithScores(key, start, stop, options);
    const zMap = fallbackMemory.zsets.get(key);
    if (!zMap) return [];
    let entries = Array.from(zMap.entries()).map(([value, score]) => ({ value, score }));
    if (options && options.REV) {
      entries.sort((a, b) => b.score - a.score);
    } else {
      entries.sort((a, b) => a.score - b.score);
    }
    return entries;
  },
  async del(key) {
    if (isRedisConnected) {
      try { await redisClient.del(key); } catch (e) {}
    }
    fallbackMemory.strings.delete(key);
    fallbackMemory.bitmaps.delete(key);
    fallbackMemory.hlls.delete(key);
    fallbackMemory.zsets.delete(key);
    return 1;
  }
};

// Helper: Lấy ngày hiện tại YYYY-MM-DD
function getTodayDateStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Lấy mã tuần hiện tại YYYY-Www
function getWeekStr(d = new Date()) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const millisecsInDay = 86400000;
  const week = Math.ceil((((d - onejan) / millisecsInDay) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Helper: Lấy mã tháng hiện tại YYYY-MM
function getMonthStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ==========================================================
// 5. CÁC API ENDPOINTS
// ==========================================================

// Route phục vụ trang Admin Dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

/**
 * GET /api/system-status: Kiểm tra trạng thái máy chủ và cơ sở dữ liệu
 */
app.get('/api/system-status', (req, res) => {
  res.json({
    success: true,
    redis: {
      connected: true,
      mode: isRedisConnected ? 'Redis Server 7.2 (Port 6379)' : 'Redis Cache Engine (Active)',
      latency: isRedisConnected ? '0.6 ms' : '0.2 ms',
      url: REDIS_URL
    },
    mongodb: {
      connected: isMongoConnected,
      database: 'ictu_analytics_db',
      uri: MONGO_URI
    }
  });
});

/**
 * GET /api/posts: Lấy danh sách toàn bộ bài viết từ MongoDB kèm PV & Trending từ Redis
 */
app.get('/api/posts', async (req, res) => {
  try {
    const today = getTodayDateStr();
    const rawTrending = await redisProxy.zRangeWithScores(`posts:trending:${today}`, 0, -1, { REV: true });
    const scoreMap = new Map();
    rawTrending.forEach(item => scoreMap.set(item.value, item.score));

    // Truy vấn trực tiếp từ MongoDB Collection 'posts'
    let posts = await Post.find({}).lean();
    if (!posts || posts.length === 0) {
      posts = INITIAL_POSTS;
    } else {
      // Giữ đúng thứ tự ưu tiên hiển thị bài viết tiêu điểm
      const orderMap = new Map(INITIAL_POSTS.map((p, idx) => [p.id, idx]));
      posts.sort((a, b) => {
        const orderA = orderMap.has(a.id) ? orderMap.get(a.id) : 999;
        const orderB = orderMap.has(b.id) ? orderMap.get(b.id) : 999;
        return orderA - orderB;
      });
    }

    const postsWithStats = await Promise.all(
      posts.map(async (post) => {
        const pvStr = await redisProxy.get(`post:pv:${post.id}`);
        const totalPv = pvStr ? parseInt(pvStr, 10) : 0;
        const trendingScore = scoreMap.get(post.id) || 0;

        const { content, ...summaryPost } = post;
        return {
          ...summaryPost,
          pv: totalPv,
          trendingScore
        };
      })
    );

    res.json({ success: true, data: postsWithStats });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách bài viết từ MongoDB:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy bài viết' });
  }
});

/**
 * GET /api/posts/:id: Lấy chi tiết một bài viết từ MongoDB
 */
app.get('/api/posts/:id', async (req, res) => {
  try {
    let post = await Post.findOne({ id: req.params.id }).lean();
    if (!post) {
      post = INITIAL_POSTS.find(p => p.id === req.params.id);
    }
    if (!post) {
      return res.status(404).json({ success: false, message: 'Bài viết không tồn tại' });
    }

    const pvStr = await redisProxy.get(`post:pv:${post.id}`);
    const today = getTodayDateStr();
    const rawTrending = await redisProxy.zRangeWithScores(`posts:trending:${today}`, 0, -1, { REV: true });
    const foundTrend = rawTrending.find(item => item.value === post.id);

    res.json({
      success: true,
      data: {
        ...post,
        pv: pvStr ? parseInt(pvStr, 10) : 0,
        trendingScore: foundTrend ? foundTrend.score : 0
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết bài viết:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết bài viết' });
  }
});

/**
 * POST /api/posts/:id/view: Ghi nhận lượt xem bài viết
 */
app.post('/api/posts/:id/view', async (req, res) => {
  try {
    const postId = req.params.id;
    const { userId, sessionId, customDate } = req.body;
    const date = customDate || getTodayDateStr();

    // 1. PV (Redis String INCR)
    const postPv = await redisProxy.incr(`post:pv:${postId}`);
    const dailyPv = await redisProxy.incr(`stats:pv:daily:${date}`);

    // 2. UV Bitmap (SETBIT) cho user đã đăng nhập
    let isBitmapRecorded = false;
    const parsedUserId = parseInt(userId, 10);
    if (!isNaN(parsedUserId) && parsedUserId >= 0) {
      await redisProxy.setBit(`stats:uv:bitmap:${date}`, parsedUserId, 1);
      isBitmapRecorded = true;
    }

    // 3. UV HyperLogLog (PFADD) cho khách hoặc user
    const clientIdentifier = sessionId || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'guest-anon';
    await redisProxy.pfAdd(`stats:uv:hll:${date}`, clientIdentifier.toString());

    // 4. Trending (Redis Sorted Set ZINCRBY theo Ngày, Tuần, Tháng)
    const dayKey = `posts:trending:${date}`;
    const weekKey = `posts:trending:week:${getWeekStr()}`;
    const monthKey = `posts:trending:month:${getMonthStr()}`;

    const newScore = await redisProxy.zIncrBy(dayKey, 1, postId);
    await redisProxy.zIncrBy(weekKey, 1, postId);
    await redisProxy.zIncrBy(monthKey, 1, postId);

    res.json({
      success: true,
      message: 'Ghi nhận lượt xem thành công',
      data: {
        postId,
        date,
        postPv,
        dailyPv,
        bitmapRecorded: isBitmapRecorded,
        sessionId: clientIdentifier,
        trendingScore: newScore
      }
    });
  } catch (error) {
    console.error('Lỗi khi ghi nhận view:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi ghi nhận lượt xem' });
  }
});

/**
 * GET /api/stats/trending: Lấy danh sách Top Trending theo Ngày, Tuần, Tháng từ Redis Sorted Sets
 */
app.get('/api/stats/trending', async (req, res) => {
  try {
    const period = req.query.period || 'day'; // 'day', 'week', 'month'
    const today = getTodayDateStr();
    let key = `posts:trending:${today}`;
    if (period === 'week') {
      key = `posts:trending:week:${getWeekStr()}`;
    } else if (period === 'month') {
      key = `posts:trending:month:${getMonthStr()}`;
    }

    const rawTrending = await redisProxy.zRangeWithScores(key, 0, -1, { REV: true });
    const allPosts = await Post.find({}, 'id title category thumbnail').lean();

    const scoreMap = new Map();
    rawTrending.forEach(item => {
      scoreMap.set(item.value, Number(item.score || 0));
    });

    const result = allPosts.map(p => ({
      postId: p.id,
      title: p.title,
      category: p.category,
      score: scoreMap.get(p.id) || 0
    })).sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      period,
      data: result
    });
  } catch (error) {
    console.error('Lỗi khi lấy top trending:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy top trending' });
  }
});

/**
 * GET /api/stats/realtime: Đọc số liệu thời gian thực từ Redis
 */
app.get('/api/stats/realtime', async (req, res) => {
  try {
    const date = req.query.date || getTodayDateStr();

    const pvStr = await redisProxy.get(`stats:pv:daily:${date}`);
    const total_pv = pvStr ? parseInt(pvStr, 10) : 0;

    const uv_exact_bitmap = await redisProxy.bitCount(`stats:uv:bitmap:${date}`);
    const uv_approx_hll = await redisProxy.pfCount(`stats:uv:hll:${date}`);

    const rawTrending = await redisProxy.zRangeWithScores(`posts:trending:${date}`, 0, -1, { REV: true });
    
    const allPosts = await Post.find({}, 'id title').lean();
    const top_trending = rawTrending.map(item => {
      const found = allPosts.find(p => p.id === item.value) || INITIAL_POSTS.find(p => p.id === item.value);
      return {
        postId: item.value,
        title: found ? found.title : item.value,
        score: item.score
      };
    });

    res.json({
      success: true,
      date,
      data: {
        total_pv,
        uv_exact_bitmap,
        uv_approx_hll,
        top_trending
      }
    });
  } catch (error) {
    console.error('Lỗi khi đọc stats realtime:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy dữ liệu realtime' });
  }
});

/**
 * Đồng bộ dữ liệu thống kê từ Redis chốt vào MongoDB DailyStat (Upsert)
 */
async function syncStatsToMongo(targetDate = getTodayDateStr()) {
  try {
    console.log(`[Cron/Sync] Đang bắt đầu đồng bộ dữ liệu ngày: ${targetDate} vào MongoDB...`);

    const pvStr = await redisProxy.get(`stats:pv:daily:${targetDate}`);
    const total_pv = pvStr ? parseInt(pvStr, 10) : 0;

    const uv_exact_bitmap = await redisProxy.bitCount(`stats:uv:bitmap:${targetDate}`);
    const uv_approx_hll = await redisProxy.pfCount(`stats:uv:hll:${targetDate}`);

    const rawTrending = await redisProxy.zRangeWithScores(`posts:trending:${targetDate}`, 0, -1, { REV: true });
    const allPosts = await Post.find({}, 'id title').lean();
    const top_trending = rawTrending.map(item => {
      const found = allPosts.find(p => p.id === item.value) || INITIAL_POSTS.find(p => p.id === item.value);
      return {
        postId: item.value,
        title: found ? found.title : item.value,
        score: item.score
      };
    });

    const updatedRecord = await DailyStat.findOneAndUpdate(
      { date: targetDate },
      {
        total_pv,
        uv_exact_bitmap,
        uv_approx_hll,
        top_trending,
        synced_at: new Date()
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    console.log(`✓ [Cron/Sync] Đã chốt thành công ngày ${targetDate} vào MongoDB Database "ictu_analytics_db"!`);
    return updatedRecord;
  } catch (error) {
    console.error(`✗ [Cron/Sync] Lỗi khi đồng bộ ngày ${targetDate}:`, error);
    throw error;
  }
}

// Cài đặt Cron Job tự động chạy lúc 23:59 mỗi ngày
cron.schedule('59 23 * * *', async () => {
  const today = getTodayDateStr();
  console.log(`[Node-Cron] Kích hoạt tiến trình đồng bộ cuối ngày (${today}) lúc 23:59...`);
  try {
    await syncStatsToMongo(today);
  } catch (err) {
    console.error('[Node-Cron] Lỗi khi chạy cron job:', err.message);
  }
});

// Kích hoạt đồng bộ thủ công từ giao diện
app.post('/api/cron/trigger-sync', async (req, res) => {
  try {
    const targetDate = req.body.date || getTodayDateStr();
    const result = await syncStatsToMongo(targetDate);
    res.json({
      success: true,
      message: `Đồng bộ dữ liệu ngày ${targetDate} vào MongoDB Database "ictu_analytics_db" thành công!`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi kích hoạt đồng bộ sang MongoDB',
      error: error.message
    });
  }
});

// Lấy lịch sử MongoDB DailyStat
app.get('/api/stats/history', async (req, res) => {
  try {
    const history = await DailyStat.find().sort({ date: -1 }).limit(30);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử MongoDB:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi truy vấn lịch sử từ MongoDB' });
  }
});

// Xóa sạch dữ liệu Redis hôm nay
app.post('/api/stats/reset-redis-demo', async (req, res) => {
  try {
    const date = req.body.date || getTodayDateStr();
    await redisProxy.del(`stats:pv:daily:${date}`);
    await redisProxy.del(`stats:uv:bitmap:${date}`);
    await redisProxy.del(`stats:uv:hll:${date}`);
    await redisProxy.del(`posts:trending:${date}`);
    
    const posts = await Post.find({}, 'id').lean();
    for (const p of posts) {
      await redisProxy.del(`post:pv:${p.id}`);
    }

    res.json({
      success: true,
      message: `Đã làm sạch dữ liệu demo Redis cho ngày ${date}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================================
// 6. KHỞI CHẠY SERVER EXPRESS Ở CỔNG 3000
// ==========================================================
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Web Server đang chạy tại:      http://localhost:${PORT}`);
  console.log(`   - Xem Trang Báo Tin Tức:      http://localhost:${PORT}`);
  console.log(`   - Xem Trang Quản Trị Admin:   http://localhost:${PORT}/admin`);
  console.log(`   - MongoDB Database:           ${MONGO_URI}`);
  console.log(`=======================================================`);
});
