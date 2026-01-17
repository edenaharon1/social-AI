// ב-src/models/InstagramPost_model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IInstagramPost extends Document {
  userId: string;
  instagramId: string; 
  caption: string;
  mediaType: string;
  mediaUrl: string;
  timestamp: Date;
  likeCount: number;
  commentsCount: number;

}

const InstagramPostSchema: Schema = new Schema({
  userId: { type: String, required: true },
  instagramId: { type: String, required: true, unique: true }, // <-- שנה את זה מ-postId ל-instagramId
  caption: { type: String },
  mediaType: { type: String },
  mediaUrl: { type: String },
  timestamp: { type: Date },
  likeCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
 
  content: { type: String },
  contentType: { type: String, enum: ["Post", "Story", "Reel"], default: "Post" },
  imageUrls: [String],
  hashtags: [String],
  engagement: {
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
  },
  createdAt: { type: Date, required: true, default: Date.now },
});

const InstagramPost = mongoose.model<IInstagramPost>("InstagramPost", InstagramPostSchema);
export default InstagramPost;