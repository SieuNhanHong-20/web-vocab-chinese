let allCards = [];
let dueCards = [];
let currentCardIndex = 0;
let statsChart = null;

// Khởi chạy hệ thống khi tải trang xong
document.addEventListener("DOMContentLoaded", () => {
  loadCards();
});

// Chuyển đổi giữa các Menu Tab công thức chuẩn cố định lỗi event
function switchTab(event, tabId) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((el) => el.classList.remove("active"));

  document.getElementById(tabId).classList.add("active");

  if (event && event.currentTarget) {
    event.currentTarget.classList.add("active");
  } else {
    // Trường hợp click gián tiếp từ quả chuông thông báo
    const targetBtn =
      tabId === "study-tab"
        ? document.querySelectorAll(".tab-btn")[0]
        : document.querySelectorAll(".tab-btn")[1];
    if (targetBtn) targetBtn.classList.add("active");
  }

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
    console.error("Lỗi tải thẻ dữ liệu:", err);
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
  if (currentCardIndex >= dueCards.length) return;

  const card = dueCards[currentCardIndex];
  const flipCardEl = document.querySelector(".flip-card");
  if (flipCardEl) flipCardEl.classList.remove("flipped"); // Reset mặt trước

  document.getElementById("front-meaning").innerText = card.meaning;
  document.getElementById("back-chinese").innerText = card.chinese;
  document.getElementById("back-pinyin").innerText = card.pinyin;

  // Gợi ý ký tự Pinyin đầu tiên ở mặt trước để người dùng dễ định hình
  if (card.pinyin && card.pinyin.length > 2) {
    document.getElementById("front-pinyin-hint").innerText =
      `Gợi ý phiên âm: (${card.pinyin.substring(0, 2)}...)`;
  } else {
    document.getElementById("front-pinyin-hint").innerText = "";
  }

  // Tự động đọc chữ Hán
  setTimeout(() => {
    speakChineseWord(card.chinese);
  }, 400);
}

// Lật thẻ qua lại
function flipCard() {
  const cardInner = document.querySelector(".flip-card");
  if (cardInner) cardInner.classList.toggle("flipped");
}

// Phát âm Tiếng Trung (Dùng API Web Speech)
function speakChineseWord(text) {
  if ("speechSynthesis" in window && text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.75; // Đọc chậm rãi để nghe rõ âm điệu chuẩn
    window.speechSynthesis.speak(utterance);
  }
}

// Nút nghe thủ công trên thẻ
function speakChinese(event) {
  if (event) event.stopPropagation(); // Ngăn chặn lật thẻ khi bấm nút loa
  const card = dueCards[currentCardIndex];
  if (card) speakChineseWord(card.chinese);
}

// Đánh giá nút lặp lại ngắt quãng gửi lên Backend
async function submitReview(event, quality) {
  if (event) event.stopPropagation();
  const card = dueCards[currentCardIndex];
  if (!card) return;

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
      loadCards(); // Hoàn thành, tải lại data tổng
    }
  } catch (err) {
    console.error("Lỗi cập nhật thuật toán thẻ:", err);
  }
}

// Xử lý Thêm từ đơn lẻ từ Form nhập liệu công thức mới
async function handleSingleSubmit(event) {
  event.preventDefault();
  const chinese = document.getElementById("input-chinese").value.trim();
  const meaning = document.getElementById("input-meaning").value.trim();

  if (!chinese || !meaning)
    return alert("Vui lòng nhập đầy đủ Chữ Hán và Nghĩa!");

  // Sử dụng thư viện CDN PinyinPro để tự tạo phiên âm chuẩn có dấu tự động
  const prettyPinyin = pinyinPro.pinyin(chinese) || "";

  try {
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chinese, meaning, pinyin: prettyPinyin }),
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      document.getElementById("add-card-form").reset();
      loadCards(); // Cập nhật lại giao diện ngay lập tức
    }
  } catch (err) {
    console.error("Lỗi lưu từ đơn lẻ:", err);
    alert("Không thể lưu từ vựng. Vui lòng thử lại!");
  }
}

// Nhấn vào quả chuông nhảy thẳng vào phần học từ đến hạn
function jumpToStudyDue() {
  switchTab(null, "study-tab");
  initStudySession();
}

// Cố định lỗi tải file mẫu nhờ định dạng Blob UTF-8 không bao giờ lỗi Font Excel
function downloadTemplate() {
  const csvContent =
    "\uFEFFNghia,Tieng Trung\nVí dụ: Xin chào,你好\nVí dụ: Tạm biệt,再见\nCảm ơn bạn,谢谢";
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "mau_nap_tu_vung.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Đọc file CSV người dùng tải lên
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    const text = e.target.result;
    const lines = text.split("\n");
    const cardsToUpload = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const columns = lines[i].split(",");
      if (columns.length >= 2) {
        const meaning = columns[0].trim();
        const chinese = columns[1].trim();
        const prettyPinyin = pinyinPro.pinyin(chinese) || "";

        cardsToUpload.push({ meaning, chinese, pinyin: prettyPinyin });
      }
    }

    if (cardsToUpload.length > 0) {
      const res = await fetch("/api/cards/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cardsToUpload),
      });
      const data = await res.json();
      alert(data.message);
      document.getElementById("csv-file").value = ""; // Reset file input
      loadCards();
    }
  };
  reader.readAsText(file, "UTF-8");
}

// Vẽ biểu đồ thống kê trực quan bằng Chart.js
function renderChart() {
  const total = allCards.length;
  const now = new Date();
  const dueCount = allCards.filter((c) => new Date(c.nextReview) <= now).length;
  const learnedCount = total - dueCount;

  const ctx = document.getElementById("statsChart").getContext("2d");
  if (statsChart) statsChart.destroy();

  statsChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: [
        "Từ đã thuộc vững (Đang đợi hạn)",
        "Từ yếu/Đến hạn cần học ngay",
      ],
      datasets: [
        {
          data: [learnedCount, dueCount],
          backgroundColor: ["#10b981", "#ff4a6b"],
          borderWidth: 4,
          borderColor: "#ffffff",
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: {
              family: "'Plus Jakarta Sans', sans-serif",
              size: 13,
              weight: "500",
            },
            padding: 20,
          },
        },
      },
    },
  });
}
