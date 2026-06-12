let allCards = [];
let dueCards = [];
let currentCardIndex = 0;
let statsChart = null;

// Khởi chạy hệ thống khi tải trang xong
document.addEventListener("DOMContentLoaded", () => {
  loadCards();
});

// Chuyển đổi giữa các Menu Tab
function switchTab(tabId) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((el) => el.classList.remove("active"));

  document.getElementById(tabId).classList.add("active");
  event.currentTarget.classList.add("active");

  if (tabId === "stats-tab") {
    renderChart();
  }
}

// Tải tất cả thẻ từ Database
async function loadCards() {
  try {
    const res = await fetch("/api/cards");
    allCards = await res.json();

    // Lọc các thẻ đã đến hạn học (nextReview <= thời gian hiện tại)
    const now = new Date();
    dueCards = allCards.filter((card) => new Date(card.nextReview) <= now);

    // Cập nhật số lượng chuông thông báo
    document.getElementById("bell-count").innerText = dueCards.length;

    initStudySession();
  } catch (err) {
    console.error("Lỗi tải thẻ:", err);
  }
}

// Bắt đầu phiên học
function initStudySession() {
  if (dueCards.length > 0) {
    currentCardIndex = 0;
    document.getElementById("no-cards").style.display = "none";
    document.getElementById("card-container").style.display = "block";
    showCard();
  } else {
    document.getElementById("no-cards").style.display = "block";
    document.getElementById("card-container").style.display = "none";
  }
}

// Hiển thị dữ liệu thẻ hiện tại lên UI
function showCard() {
  const card = dueCards[currentCardIndex];
  const flipCardEl = document.querySelector(".flip-card");
  flipCardEl.classList.remove("flipped"); // Reset mặt trước

  document.getElementById("front-meaning").innerText = card.meaning;
  document.getElementById("back-chinese").innerText = card.chinese;
  document.getElementById("back-pinyin").innerText = card.pinyin;

  // Gợi ý pinyin ẩn dưới mặt trước nếu bạn muốn, hoặc xóa dòng dưới đi
  document.getElementById("front-pinyin-hint").innerText =
    `(${card.pinyin.substring(0, 2)}...)`;

  // Tự động phát âm ngay khi thẻ hiện lần đầu tiên (Học viên cần click tương tác màn hình trước 1 lần để trình duyệt cấp quyền âm thanh)
  setTimeout(() => {
    speakChineseWord(card.chinese);
  }, 400);
}

// Lật thẻ qua lại
function flipCard() {
  document.querySelector(".flip-card").classList.toggle("flipped");
}

// Phát âm Tiếng Trung (Dùng API Trình duyệt Web Speech)
function speakChineseWord(text) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel(); // Ngắt âm thanh cũ đang phát dở
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN"; // Ngôn ngữ Tiếng Trung Quốc phổ thông
    utterance.rate = 0.8; // Tốc độ đọc hơi chậm để nghe rõ
    window.speechSynthesis.speak(utterance);
  }
}

// Nút nghe thủ công trên thẻ
function speakChinese(event) {
  event.stopPropagation(); // Không cho kích hoạt sự kiện lật thẻ khi bấm nút loa
  const card = dueCards[currentCardIndex];
  speakChineseWord(card.chinese);
}

// Đánh giá nút lặp lại ngắt quãng (SM-2) gửi lên Backend
async function submitReview(quality) {
  event.stopPropagation();
  const card = dueCards[currentCardIndex];

  try {
    await fetch(`/api/cards/${card._id}/review`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quality }),
    });

    currentCardIndex++;
    if (currentCardIndex < dueCards.length) {
      showCard();
    } else {
      // Đã hoàn thành hết hàng đợi hiện tại, tải lại dữ liệu tổng
      loadCards();
    }
  } catch (err) {
    console.error("Lỗi cập nhật thẻ:", err);
  }
}

// Nhấn vào quả chuông nhảy thẳng vào phần học từ đến hạn
function jumpToStudyDue() {
  switchTab("study-tab");
  initStudySession();
}

// Xử lý nạp File CSV mẫu
function downloadTemplate() {
  const csvContent =
    "data:text/csv;charset=utf-8,Nghia,Tieng Trung\nVí dụ: Xin chào,你好\nVí dụ: Tạm biệt,再见";
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "mau_nap_tu_vung.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Đọc file CSV người dùng tải lên, tự động thêm Pinyin hàng loạt
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    const text = e.target.result;
    const lines = text.split("\n");
    const cardsToUpload = [];

    // Bỏ qua dòng tiêu đề đầu tiên, duyệt qua các dòng dữ liệu
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const columns = lines[i].split(",");
      if (columns.length >= 2) {
        const meaning = columns[0].trim();
        const chinese = columns[1].trim();

        // Dùng thư viện pinyinPro tích hợp sẵn ở CDN để tự dịch Chữ Hán thành Pinyin hệ thống
        const pinyin = pinyinPro.pinyin(chinese, { toneType: "num" }) || "";
        const prettyPinyin = pinyinPro.pinyin(chinese) || ""; // Dạng có dấu chuẩn

        cardsToUpload.push({ meaning, chinese, pinyin: prettyPinyin });
      }
    }

    if (cardsToUpload.length > 0) {
      // Gửi mảng dữ liệu lên Server lưu trữ
      const res = await fetch("/api/cards/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cardsToUpload),
      });
      const data = await res.json();
      alert(data.message);
      loadCards(); // Tải lại giao diện học mới
    }
  };
  reader.readAsText(file);
}

// Vẽ biểu đồ thống kê Chart.js
function renderChart() {
  const total = allCards.length;
  const now = new Date();
  const dueCount = allCards.filter((c) => new Date(c.nextReview) <= now).length;
  const learnedCount = total - dueCount;

  const ctx = document.getElementById("statsChart").getContext("2d");

  if (statsChart) statsChart.destroy(); // Hủy biểu đồ cũ tránh chồng chéo

  statsChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Từ đã thuộc (Đang đợi hạn)", "Từ đến hạn cần học ngay"],
      datasets: [
        {
          data: [learnedCount, dueCount],
          backgroundColor: ["#10b981", "#ef4444"],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
      },
    },
  });
}
