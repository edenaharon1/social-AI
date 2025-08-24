import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import userRoutes from "./routes/user_routes";
import authRoutes from "./routes/auth_routes";
import chatRoutes from "./routes/chat_routes";
import analyticsRoutes from './routes/analytics_routes';
import instagramRoutes from "./routes/instagram_routes";
import businessProfileRoutes from "./routes/business_profile_routes";
import contentSuggestionRoutes from "./routes/content_suggestion_routes";
import bodyParser from "body-parser";
import setupSwagger from "./swagger";
import cors from "cors";
import path from "path";
import fs from "fs";


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
   origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
   allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

app.use("/users", userRoutes);
app.use("/auth", authRoutes);
app.use("/analytics", analyticsRoutes);
app.get("/", (req, res) => {
  res.send("Hello world!");
});
app.use("/business-profile", businessProfileRoutes);
app.use("/api/chat", chatRoutes);

// Enhanced static file serving with debugging
app.use("/api/uploads", (req, res, next) => {
  console.log(`[Static Files] Request for: ${req.url}`);
  console.log(`[Static Files] Full path: ${path.join(uploadsDir, req.url)}`);
  
  // Check if file exists
  const filePath = path.join(uploadsDir, req.url);
  if (fs.existsSync(filePath)) {
    console.log(`[Static Files] File exists: ${filePath}`);
  } else {
    console.log(`[Static Files] File not found: ${filePath}`);
  }
  
  next();
}, express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    console.log(`[Static Files] Serving: ${filePath}`);
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
  }
}));

// Add a test endpoint for debugging
app.get("/api/test-images", (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    res.json({
      uploadsDir,
      fileCount: files.length,
      files: files.slice(0, 10), // Show first 10 files
      placeholderExists: fs.existsSync(path.join(uploadsDir, 'placeholder.png'))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.use("/ai", contentSuggestionRoutes);
app.use("/api/instagram", instagramRoutes);



setupSwagger(app);

if (!process.env.DB_URL_ENV) {
  console.error('DB_URL_ENV environment variable is not defined');
  process.exit(1);
}

mongoose.connect(process.env.DB_URL_ENV)
  .then(() => {
    console.log('Connected to MongoDB');
    if (require.main === module) {
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`Uploads directory: ${uploadsDir}`);
        console.log(`Static files available at: http://localhost:${PORT}/api/uploads/`);
      });
    }
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });

export { app };