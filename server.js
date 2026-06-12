let allCards = [];
let dueCards = [];
let currentCardIndex = 0;
let statsChart = null;

// Tự động chạy khi trang tải xong
document.addEventListener("DOMContentLoaded", () => {
  loadCards();
});

// CHUYỂN TAB (Sửa lỗi khớp hoàn toàn với index.html)
function switchTab(tabId) {
  // Ẩn tất cả các tab nội dung và xóa trạng thái active của nút
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((el) => el.classList.remove("active"));

  // Hiển thị tab được chọn
  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add("active");

  // Kích hoạt màu sáng cho nút tương ứng
  const buttons = document.querySelectorAll(".tab-btn");
  if (tabId === "study-tab" && buttons[0]) buttons[0].classList.add("active");
  if (tabId === "stats-tab" && buttons[1]) {
    buttons[1].classList.add("active");
    // Đợi giao diện mượt rồi vẽ biểu đồ tránh lỗi 0x0
    setTimeout(() => {
      renderChart();
    }, 50);
  }
}

// TẢI DỮ LIỆU TỪ BACKEND
async function loadCards() {
  try {
    const res = await fetch("/api/cards");
    allCards = await res.json();

    // Lọc các từ cần học (Bỏ qua lệch múi giờ hệ thống Render)
    const now = new Date();
    dueCards = allCards.filter(
      (card) => card.repetition === 0 || new Date(card.nextReview) <= now,
    );

    // Cập nhật số lượng hiển thị ở quả chuông thông báo
    const bellCountEl = document.getElementById("bell-count");
    if (bellCountEl) bellCountEl.innerText = dueCards.length;

    initStudySession();
  } catch (err) {
    console.error("Không thể kết nối API lấy dữ liệu từ vựng:", err);
  }
}

// KHỞI TẠO PHIÊN HỌC
function initStudySession() {
  const noCardsEl = document.getElementById("no-cards");
  const cardContainerEl = document.getElementById("card-container");

  if (dueCards.length > 0) {
    currentCardIndex = 0;
    if (noCardsEl) noCardsEl.style.display = "none";
    if (cardContainerEl) cardContainerEl.style.display = "block";
    showCard();
  } else {
    if (noCardsEl) noCardsEl.style.display = "block";
    if (cardContainerEl) cardContainerEl.style.display = "none";
  }
}

// ĐƯA DỮ LIỆU TỪ LÊN FLASHCARD
function showCard() {
  if (currentCardIndex >= dueCards.length) return;

  const card = dueCards[currentCardIndex];

  // Reset mặt thẻ về mặt trước trước khi hiển thị từ mới
  const flipCardEl = document.querySelector(".flip-card");
  if (flipCardEl) flipCardEl.classList.remove("flipped");

  document.getElementById("front-meaning").innerText = card.meaning;
  document.getElementById("back-chinese").innerText = card.chinese;
  document.getElementById("back-pinyin").innerText =
    card.pinyin || "Chưa có phiên âm";

  // Hiển thị gợi ý phiên âm nhẹ ở mặt trước
  const hintEl = document.getElementById("front-pinyin-hint");
  if (hintEl) {
    if (card.pinyin && card.pinyin.length > 2) {
      hintEl.innerText = `Gợi ý phiên âm: (${card.pinyin.substring(0, 2)}...)`;
    } else {
      hintEl.innerText = "";
    }
  }

  // Tự động phát âm tiếng Trung sau 400ms
  setTimeout(() => {
    speakChineseWord(card.chinese);
  }, 400);
}

// LẬT THẺ (Chạm vào thẻ là lật)
function flipCard() {
  const cardInner = document.querySelector(".flip-card");
  if (cardInner) cardInner.classList.toggle("flipped");
}

// ĐỌC CHỮ HÁN
function speakChineseWord(text) {
  if ("speechSynthesis" in window && text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }
}

// NÚT PHÁT ÂM THỦ CÔNG (Sửa lỗi chặn không cho lật thẻ khi bấm nút loa)
function speakChinese(event) {
  if (event) event.stopPropagation();
  const card = dueCards[currentCardIndex];
  if (card) speakChineseWord(card.chinese);
}

// ĐÁNH GIÁ VÀ LƯU TRẠNG THÁI HỌC (Sửa lỗi nhận đúng thang điểm quality từ index.html)
async function submitReview(quality) {
  const card = dueCards[currentCardIndex];
  if (!card) return;

  try {
    // Gửi kết quả lên server để lưu thuật toán lặp lại ngắt quãng
    await fetch(`/api/cards/${card._id}/review`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quality: Number(quality) }),
    });

    currentCardIndex++;
    if (currentCardIndex < dueCards.length) {
      showCard();
    } else {
      await loadCards(); // Học xong hết thì tải lại toàn bộ trạng thái mới
    }
  } catch (err) {
    console.error("Lỗi đồng bộ kết quả lưu từ vựng:", err);
    alert("Không thể lưu trạng thái học, vui lòng kiểm tra mạng!");
  }
}

// CLICK VÀO QUẢ CHUÔNG THÔNG BÁO
function jumpToStudyDue() {
  switchTab("study-tab");
  initStudySession();
}

// TẢI FILE CSV MẪU XUỐNG KHÔNG LỖI FONT
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

// ĐỌC VÀ LƯU FILE CSV TỪ VỰNG TẢI LÊN
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

        let prettyPinyin = "";
        // Tự động chuyển đổi sang bính âm nếu có thư viện pinyinPro tích hợp sẵn ở head
        try {
          if (typeof pinyinPro !== "undefined" && pinyinPro.pinyin) {
            prettyPinyin = pinyinPro.pinyin(chinese);
          }
        } catch (pErr) {
          console.log(pErr);
        }

        cardsToUpload.push({ meaning, chinese, pinyin: prettyPinyin });
      }
    }

    if (cardsToUpload.length > 0) {
      try {
        const res = await fetch("/api/cards/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cardsToUpload),
        });
        const data = await res.json();
        alert(data.message || "Đã nạp file từ vựng thành công!");
        document.getElementById("csv-file").value = ""; // Reset input file
        await loadCards(); // Cập nhật lại kho từ ngay lập tức
      } catch (err) {
        console.error("Lỗi kết nối khi upload file CSV:", err);
        alert("Lưu file thất bại. Vui lòng kiểm tra lại server!");
      }
    }
  };
  reader.readAsText(file, "UTF-8");
}

// VẼ BIỂU ĐỒ THỐNG KÊ (Chart.js)
function renderChart() {
  const total = allCards.length;
  const canvas = document.getElementById("statsChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  if (statsChart) statsChart.destroy();

  // Nếu hệ thống hoàn toàn trống (Chưa nạp file từ vựng nào)
  if (total === 0) {
    statsChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Hệ thống chưa có dữ liệu từ vựng nào"],
        datasets: [
          {
            data: [1],
            backgroundColor: ["#e2e8f0"],
            borderWidth: 0,
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
    return;
  }

  const now = new Date();
  const dueCount = allCards.filter(
    (c) => c.repetition === 0 || new Date(c.nextReview) <= now,
  ).length;
  const learnedCount = total - dueCount;

  statsChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: [
        "Từ đang thuộc vững (Đợi hạn học tiếp)",
        "Từ yếu / Đến hạn cần học ngay",
      ],
      datasets: [
        {
          data: [learnedCount, dueCount],
          backgroundColor: ["#10b981", "#ff4a6b"],
          borderWidth: 3,
          borderColor: "#ffffff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { padding: 15 },
        },
      },
    },
  });
}
