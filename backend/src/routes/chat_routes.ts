import express from "express";
import chatController from "../controllers/chat_controller";
import multer from "multer";
import path from "path";
import auth from "../middlewares/authMiddleware";

const router = express.Router();

// הגדרת אחסון הקובץ עם multer
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

// הודעת טקסט
router.post("/", auth, chatController.chatWithAI);

// העלאת תמונה
router.post("/upload", auth, upload.single("image"), chatController.uploadImage);

export default router;
