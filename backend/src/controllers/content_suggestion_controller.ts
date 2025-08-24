import { Request, Response, NextFunction } from "express";
import BusinessProfile from "../models/business_profile_model"; // וודא שהנתיב למודל זה נכון
import ContentSuggestion from "../models/content_suggestion_model"; // וודא שהנתיב למודל זה נכון
import InstagramContentSuggestion from "../models/InstagramContentSuggestion";
import User from "../models/user_model"; // וודא שהנתיב למודל זה נכון
import { generateContentFromProfile, fetchAndStoreInstagramPosts } from "../services/content_suggestion_service"; // וודא שהנתיב נכון
import path from "path";
import fs from "fs";
import axios from "axios";
import mongoose from "mongoose";

// פונקציית עזר: הורדת תמונה ושמירתה בשרת
async function downloadImageToUploads(imageUrl: string): Promise<string> {
    // Generate a unique filename with timestamp and random string
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `img-${randomString}.png`;
    const filepath = path.join(process.cwd(), "uploads", filename);

    if (fs.existsSync(filepath)) {
        console.log(`[downloadImageToUploads] Image already exists: ${filename}`);
        return filename;
    }

    try {
        const response = await axios.get(imageUrl, { responseType: "stream" });
        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(filepath);
            (response.data as NodeJS.ReadableStream).pipe(writer);
            writer.on("finish", () => {
                console.log(`[downloadImageToUploads] Image downloaded and saved: ${filename}`);
                resolve(filename);
            });
            writer.on("error", (err) => {
                console.error(`[downloadImageToUploads] Error writing image file ${filename}:`, err);
                reject(err);
            });
        });
    } catch (error) {
        console.error(`[downloadImageToUploads] Failed to download image from ${imageUrl}:`, error);
        throw error;
    }
}

// פונקציית עזר: retry עם backoff
async function callWithBackoff<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            if (error.response?.status === 429 && i < retries) {
                console.warn(`[callWithBackoff] Rate limited, retrying in ${delayMs}ms...`);
                await new Promise(r => setTimeout(r, delayMs));
                delayMs *= 2;
                continue;
            } else {
                console.error(`[callWithBackoff] Error on retry attempt ${i + 1}/${retries + 1}:`, error.message);
                throw error;
            }
        }
    }
    throw new Error("[callWithBackoff] Failed after retries");
}

// פונקציה: אימות אסימון
const handleTokenAuthentication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        console.log("Body:", req.body);
        const userId = (req as any).user._id;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            res.status(400).json({ error: "Invalid User ID format" });
            return;
        }
        
        const user = await User.findById(userId);
        console.log("User:", user);
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        // Check if user has valid tokens in MongoDB
        if (!user.instagramAccessToken) {
            res.status(401).json({ error: "Instagram authentication required" });
            return;
        }

        // If tokens are valid, proceed with the request
        next();
    } catch (err) {
        console.error("Token authentication error:", err);
        res.status(500).json({ error: "Internal server error during authentication" });
    }
};

/**
 * פונקציה 1: יצירת הצעות תוכן על פי BusinessProfile (userId הוא ObjectId)
 */
export const getOrGenerateSuggestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log("[getOrGenerateSuggestions] Request received.");
    try {
        // Get userId from auth middleware
        const userId = (req as any).user._id;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            console.warn("[getOrGenerateSuggestions] Invalid User ID format:", userId);
            res.status(400).json({ error: "Invalid User ID format" });
            return;
        }

        const userIdAsObjectId = new mongoose.Types.ObjectId(userId);

        // Check if user exists
        const user = await User.findById(userIdAsObjectId);
        if (!user) {
            console.warn("[getOrGenerateSuggestions] User not found:", userId);
            res.status(404).json({ error: "User not found" });
            return;
        }

        const existing = await ContentSuggestion.find({ userId: userIdAsObjectId })
            .sort({ createdAt: -1 });
        const isOutdated = existing.some(s => 
            Date.now() - new Date(s.createdAt).getTime() > 24 * 60 * 60 * 1000
        );

        if (existing.length < 3 || isOutdated) {
            console.log("[getOrGenerateSuggestions] Generating new suggestions: less than 3 or outdated.");
            await ContentSuggestion.deleteMany({ userId: userIdAsObjectId });

            const profile = await BusinessProfile.findOne({ userId: userIdAsObjectId });
            if (!profile) {
                console.error("[getOrGenerateSuggestions] No business profile found");
                res.status(404).json({ error: "No business profile found" });
                return;
            }

            const generated = await callWithBackoff(() => 
                generateContentFromProfile(profile, undefined, undefined, 3)
            );

            for (const item of generated) {
                if (item.imageUrls?.length) {
                    try {
                        const filename = await downloadImageToUploads(item.imageUrls[0]);
                        item.imageUrls = [`https://aisocial.dev/api/uploads/${filename}`];
                    } catch (e) {
                        console.error("[getOrGenerateSuggestions] Error downloading image:", e);
                        item.imageUrls = [];
                    }
                }
            }

            const saved = await ContentSuggestion.insertMany(
                generated.map(item => ({
                    ...item,
                    userId: userIdAsObjectId,
                    source: "businessProfile",
                    refreshed: false,
                    createdAt: new Date()
                }))
            );

            console.log(`[getOrGenerateSuggestions] Saved ${saved.length} new suggestions`);
            res.status(200).json(saved);
            return;
        }

        console.log(`[getOrGenerateSuggestions] Returning ${existing.length} existing suggestions`);
        res.status(200).json(existing);
    } catch (err) {
        console.error("[getOrGenerateSuggestions] Error:", err);
        next(err);
    }
};

/**
 * פונקציה 2: ריענון הצעה ספציפית לפי BusinessProfile (userId ObjectId)
 */
export const refreshSingleSuggestion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log("[refreshSingleSuggestion] Request received.");
    try {
        const { suggestionId } = req.params;
        const userIdStr = (req as any).user._id;

        if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
            console.warn("[refreshSingleSuggestion] Invalid User ID format:", userIdStr);
            res.status(400).json({ error: "Invalid User ID format" });
            return;
        }
        const userId = new mongoose.Types.ObjectId(userIdStr);

        const profile = await BusinessProfile.findOne({ userId });
        if (!profile) {
            console.error("[refreshSingleSuggestion] No business profile found for userId:", userIdStr);
            res.status(404).json({ error: "No business profile found" });
            return;
        }

        // יוצרים הצעה חדשה אחת
        const [newContent] = await callWithBackoff(() => generateContentFromProfile(profile, undefined, undefined, 1));
        console.log("[refreshSingleSuggestion] AI generated 1 new suggestion for refresh.");


        if (newContent.imageUrls?.length) {
            try {
                const filename = await downloadImageToUploads(newContent.imageUrls[0]);
                newContent.imageUrls = [`https://aisocial.dev/api/uploads/${filename}`];
            } catch (e) {
                console.error("[refreshSingleSuggestion] Error downloading image for single suggestion refresh:", e);
                newContent.imageUrls = [];
            }
        }

        console.log(`[refreshSingleSuggestion] Attempting to update suggestionId: ${suggestionId}`);
        const updated = await ContentSuggestion.findByIdAndUpdate(
            suggestionId,
            { ...newContent, refreshed: true, createdAt: new Date() },
            { new: true }
        );

        if (!updated) {
            console.warn(`[refreshSingleSuggestion] Suggestion with ID ${suggestionId} not found for update.`);
            res.status(404).json({ error: "Suggestion not found" });
            return;
        }

        console.log(`[refreshSingleSuggestion] Successfully updated suggestionId: ${suggestionId}`);
        res.status(200).json(updated);
    } catch (err) {
        console.error("[refreshSingleSuggestion] Unhandled error:", err);
        next(err);
    }
};

/**
 * פונקציה 3: יצירת הצעות תוכן לפי ניתוח אינסטגרם (userId הוא string או ObjectId)
 */
export const getOrGenerateUserSuggestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log("[getOrGenerateUserSuggestions] Request received.");
    console.log("Request params:", req.params);
    try {
        const userId = req.params.userId;
        
        if (!userId) {
            console.warn("[getOrGenerateUserSuggestions] No userId provided");
            res.status(400).json({ error: "User ID is required" });
            return;
        }
        
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            console.warn("[getOrGenerateUserSuggestions] Invalid User ID format for Business Profile:", userId);
            res.status(400).json({ error: "Invalid User ID format" });
            return;
        }
        
        const userIdAsObjectId = new mongoose.Types.ObjectId(userId);
        const userIdString = userId;

        // Get user and check Instagram connection
        const user = await User.findById(userIdAsObjectId);
        console.log("User found:", user ? "Yes" : "No");
        if (!user) {
            console.warn("[getOrGenerateUserSuggestions] User not found:", userIdString);
            res.status(404).json({ error: "User not found" });
            return;
        }

        if (!user.instagramConnected || !user.instagramAccessToken) {
            console.log("User:", user);
            console.warn("[getOrGenerateUserSuggestions] Instagram not connected for user:", userIdString);
            res.status(401).json({ error: "Instagram not connected" });
            return;
        }

        // 1. מחפשים הצעות קיימות עבור המשתמש ממקור "userProfile"
        const existingSuggestions = await InstagramContentSuggestion.find({ userId: userIdString, source: "userProfile" })
            .sort({ createdAt: -1 })
            .exec();

        const latestSuggestion = existingSuggestions.length > 0 ? existingSuggestions[0] : null;

        console.log(`[getOrGenerateUserSuggestions] Checking Instagram suggestions for userId: ${userIdString}`);

        let shouldGenerate = false;

        if (!latestSuggestion) {
            console.log("[getOrGenerateUserSuggestions] No existing Instagram content suggestions found. Generating new ones immediately.");
            shouldGenerate = true;
        } else {
            const age = Date.now() - new Date(latestSuggestion.createdAt).getTime();
            console.log(`[getOrGenerateUserSuggestions] Latest Instagram suggestion found. Age: ${age / (1000 * 60 * 60)} hours.`);

            if (age > 24 * 60 * 60 * 1000) {
                console.log("[getOrGenerateUserSuggestions] Existing Instagram suggestions are outdated (>24h). Will generate new ones.");
                shouldGenerate = true;
            } else if (existingSuggestions.length < 3) {
                console.log("[getOrGenerateUserSuggestions] Less than 3 existing Instagram suggestions found. Will generate new ones.");
                shouldGenerate = true;
            } else {
                console.log("[getOrGenerateUserSuggestions] Existing Instagram suggestions are still fresh and sufficient.");
            }
        }

        if (shouldGenerate) {
            console.log(`[getOrGenerateUserSuggestions] Proceeding to generate new suggestions for userId: ${userIdString}.`);

            // --- בדיקה לפני המחיקה ---
            const countBeforeDelete = await InstagramContentSuggestion.countDocuments({ userId: userIdString, source: "userProfile" });
            console.log(`[getOrGenerateUserSuggestions - Before Delete] Found ${countBeforeDelete} existing Instagram suggestions.`);

            const deleteResult = await InstagramContentSuggestion.deleteMany({ userId: userIdString, source: "userProfile" });
            console.log(`[getOrGenerateUserSuggestions - After Delete] Deleted ${deleteResult.deletedCount} old/insufficient Instagram content suggestions.`);

            const profile = await BusinessProfile.findOne({ userId: userIdAsObjectId });
            if (!profile) {
                console.error("[getOrGenerateUserSuggestions] No business profile found for userId:", userIdString);
                res.status(404).json({ error: "No business profile found" });
                return;
            }

            console.log("[getOrGenerateUserSuggestions] Calling AI to generate content from profile and Instagram posts...");
            let generated = await callWithBackoff(() =>
                generateContentFromProfile(profile, userIdString, user.instagramAccessToken, 3, true)
            );
            console.log(`[getOrGenerateUserSuggestions] AI generated ${generated.length} content suggestions.`);

            for (const item of generated) {
                if (item.imageUrls?.length) {
                    try {
                        const filename = await downloadImageToUploads(item.imageUrls[0]);
                        item.imageUrls = [`https://aisocial.dev/api/uploads/${filename}`];
                    } catch (e) {
                        console.error("[getOrGenerateUserSuggestions] Error downloading image for Instagram suggestion:", e);
                        item.imageUrls = [];
                    }
                }
            }

            // --- בדיקה לפני השמירה ---
            console.log(`[getOrGenerateUserSuggestions - Before Save] Attempting to save ${generated.length} new Instagram suggestions.`);
            if (generated.length > 0) {
                console.log("[getOrGenerateUserSuggestions - Before Save] First generated item to be saved:", JSON.stringify(generated[0], null, 2));
            } else {
                console.log("[getOrGenerateUserSuggestions - Before Save] No items generated to save.");
            }


            try {
                const saved = await InstagramContentSuggestion.insertMany(
                    generated.map(item => ({
                        ...item,
                        userId: userIdString,
                        source: "userProfile",
                        refreshed: false,
                        createdAt: new Date(),
                    }))
                );
                console.log(`[getOrGenerateUserSuggestions - After Save SUCCESS] Successfully saved ${saved.length} new Instagram content suggestions.`);
                res.status(200).json(saved);
            } catch (saveError) {
                console.error("❌ [getOrGenerateUserSuggestions - ERROR during insertMany]", saveError);
                // בדוק את סוג השגיאה והצג הודעה מתאימה
                if (saveError instanceof mongoose.Error.ValidationError) {
                    console.error("MongoDB Validation Error:", saveError.message, saveError.errors);
                    res.status(400).json({ error: "Validation failed during save", details: saveError.message });
                } else if ((saveError as any).code === 11000) { // Duplicate key error
                    console.error("MongoDB Duplicate Key Error:", (saveError as any).message);
                    res.status(409).json({ error: "Duplicate content suggestion found (might be an indexing issue)", details: (saveError as any).message });
                } else {
                    res.status(500).json({ error: "Failed to save Instagram suggestions to database", details: (saveError as Error).message });
                }
            }

        } else {
            console.log(`[getOrGenerateUserSuggestions] Returning ${existingSuggestions.length} existing Instagram content suggestions.`);
            res.status(200).json(existingSuggestions);
        }

    } catch (err) {
        console.error("[getOrGenerateUserSuggestions] Unhandled error in controller:", err);
        next(err);
    }
};