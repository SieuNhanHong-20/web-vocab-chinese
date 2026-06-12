const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Kết nối Database (Thay URL này bằng URL MongoDB Atlas của bạn khi deploy)
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/spaced_repetition";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("⚡ Đã kết nối Database thành công!"))
  .catch((err) => console.error("Lỗi kết nối DB:", err));

// Định nghĩa cấu trúc dữ liệu Thẻ từ vựng (Thuật toán SM-2)
const CardSchema = new mongoose.Schema({
  meaning: String, // Nghĩa tiếng Việt
  chinese: String, // Chữ Hán
  pinyin: String, // Phiên âm tự động sinh
  interval: { type: Number, default: 1 }, // Khoảng cách ngày lặp lại tiếp theo
  repetition: { type: Number, default: 0 }, // Số lần đã nhớ liên tiếp
  easeFactor: { type: Number, default: 2.5 }, // Hệ số dễ/khó của từ
  nextReview: { type: Date, default: Date.now }, // Ngày đến hạn học tiếp theo
});

const Card = mongoose.model("Card", CardSchema);

// API: Lấy tất cả các từ để làm thống kê
app.get("/api/cards", async (req, res) => {
  try {
    const cards = await Card.find();
    res.json(cards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Nạp từ vựng hàng loạt (Bulk Upload từ file CSV/Excel dạng JSON)
app.post("/api/cards/upload", async (req, res) => {
  try {
    const items = req.body; // Mảng các object {meaning, chinese, pinyin}
    await Card.insertMany(items);
    res.json({
      success: true,
      message: `Đã nạp thành công ${items.length} từ!`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Cập nhật thẻ theo thuật toán lặp lại ngắt quãng SM-2
app.put("/api/cards/:id/review", async (req, res) => {
  const { id } = req.params;
  const { quality } = req.body; // Mức độ nhớ: 1 (Quên hoàn toàn), 3 (Nhớ mang máng), 5 (Thuộc làu)

  try {
    const card = await Card.findById(id);
    if (!card) return res.status(404).json({ error: "Không tìm thấy thẻ" });

    let { interval, repetition, easeFactor } = card;

    if (quality >= 3) {
      if (repetition === 0) interval = 1;
      else if (repetition === 1) interval = 6;
      else interval = Math.round(interval * easeFactor);
      repetition++;
    } else {
      repetition = 0;
      interval = 1;
    }

    // Cập nhật Hệ số dễ (Ease Factor) công thức chuẩn SM-2
    easeFactor =
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    card.interval = interval;
    card.repetition = repetition;
    card.easeFactor = easeFactor;

    // Tính toán ngày học tiếp theo
    const now = new Date();
    now.setDate(now.getDate() + interval);
    card.nextReview = now;

    await card.save();
    res.json(card);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`),
);
