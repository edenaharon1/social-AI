import mongoose, { Schema, Document } from "mongoose";

export interface InstagramContentSuggestionDoc extends Document {
    userId: string;
    content: string;
    title?: string; 
    hashtags?: string[];
    contentType?: string;
    imageUrls: string[];
    source: string; 
    createdAt: Date;
    refreshed: boolean;
}

const InstagramContentSuggestionSchema = new Schema<InstagramContentSuggestionDoc>({
    userId: { type: String, required: true, index: true },
    title: { type: String }, // שדה שהגיע מה-AI
    content: { type: String, required: true },
    hashtags: [{ type: String }], // שדה שהגיע מה-AI
    contentType: { type: String }, // שדה שהגיע מה-AI
    imageUrls: [{ type: String }],
    source: { type: String, default: "instagramProfile" },
    refreshed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

const InstagramContentSuggestion = mongoose.model<InstagramContentSuggestionDoc>(
    "InstagramContentSuggestion",
    InstagramContentSuggestionSchema
);

export default InstagramContentSuggestion;