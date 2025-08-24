import express from "express";
import multer from "multer";
import authMiddleware from "../middlewares/authMiddleware";
import { 
  postToInstagram, 
  getInstagramPosts, 
  getPopularInstagramPosts, 
  getMonthlyStats 
} from "../controllers/instagram_controller";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Add authMiddleware to all routes
router.post("/post", authMiddleware, upload.single("image"), postToInstagram);
router.get("/posts", authMiddleware, getInstagramPosts);
router.get("/popular", authMiddleware, getPopularInstagramPosts);
router.get("/monthly", authMiddleware, getMonthlyStats);

export default router;
