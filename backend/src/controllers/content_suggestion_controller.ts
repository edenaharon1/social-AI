import { Request, Response, NextFunction } from "express";
import BusinessProfile from "../models/business_profile_model";
import ContentSuggestion from "../models/content_suggestion_model";
import InstagramContentSuggestion from "../models/InstagramContentSuggestion";
import User from "../models/user_model";
import { generateContentFromProfile, fetchAndStoreInstagramPosts } from "../services/content_suggestion_service";
import path from "path";
import fs from "fs";
import axios from "axios";
import mongoose from "mongoose";

/**
 * Downloads an image from a public URL and saves it to the local `uploads` directory.
 *
 * Generates a unique filename, streams the remote content to disk, and returns the saved filename.
 * If the file already exists (same generated name), returns the existing filename to avoid duplicates.
 *
 * @param {string} imageUrl - Public URL of the image to download
 * @returns {Promise<string>} The saved filename inside the `uploads` folder
 * @throws Will throw on network or filesystem errors during download/write
 */
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

/**
 * Executes an async function with retry and exponential backoff on rate-limit errors.
 *
 * Retries when the error has HTTP status 429, doubling the delay on each attempt until
 * the maximum number of retries is reached. Non-429 errors are re-thrown immediately.
 *
 * @template T
 * @param {() => Promise<T>} fn - The async function to execute
 * @param {number} [retries=3] - Maximum number of retry attempts
 * @param {number} [delayMs=1000] - Initial delay in milliseconds; doubles on each retry
 * @returns {Promise<T>} The resolved value from `fn`
 * @throws Throws after all retries fail or on non-rate-limit errors
 */
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

/**
 * Middleware that validates user authentication and Instagram token presence.
 *
 * Checks `req.user._id` format, ensures the user exists, and verifies that the user
 * has an Instagram access token. Calls `next()` when validation passes, otherwise
 * responds with the appropriate HTTP error.
 *
 * @param {Request} req - Express request, expects `user._id` populated by auth middleware
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function to continue the middleware chain
 * @returns {Promise<void>} Resolves after sending a response or calling `next()`
 */
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
 * Generates or returns existing content suggestions based on the user's BusinessProfile.
 *
 * Fetches the authenticated user, checks for existing suggestions, and generates new ones
 * if fewer than three exist or if the latest suggestions are older than 24 hours. Downloads
 * images when provided and stores suggestions in the database.
 *
 * @param {Request} req - Express request with `user._id` from auth middleware
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>} Resolves after sending suggestions as JSON
 * @example
 * GET /api/content/suggestions
 * // Response: Array of ContentSuggestion documents
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
 * Refreshes an existing suggestion by generating updated content from the BusinessProfile.
 *
 * Finds the user's profile, generates one new content item, optionally replaces image URLs
 * with locally hosted ones, and updates the specified suggestion as refreshed.
 *
 * @param {Request} req - Express request containing `params.suggestionId` and `user._id`
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>} Resolves after returning the updated suggestion
 * @example
 * PUT /api/content/suggestions/:suggestionId/refresh
 * // Response: Updated ContentSuggestion document
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
 * Generates content suggestions for a user based on Instagram analysis.
 *
 * Validates `userId`, ensures Instagram connection, deletes outdated/insufficient suggestions,
 * generates new items using business and Instagram context, saves them, or returns existing ones
 * if recent and sufficient.
 *
 * @param {Request} req - Express request with `params.userId`
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>} Resolves after sending suggestions or errors
 * @example
 * GET /api/content/users/:userId/suggestions
 * // Response: Array of InstagramContentSuggestion documents
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