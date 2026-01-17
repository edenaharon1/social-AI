import OpenAI from "openai";
import axios from "axios";
import { IBusinessProfile } from "../models/business_profile_model";
import InstagramPost from "../models/InstagramPost_model"; // Make sure this path is correct

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Fetches Instagram posts for a given user and stores them in the database.
 *
 * Retrieves media data from the Instagram Graph API including captions, media types,
 * URLs, timestamps, likes, and comments. Stores new posts in MongoDB, skipping duplicates.
 * Maps Instagram fields to the application's schema and extracts hashtags from captions.
 *
 * @param {string} userId - The user ID from the application's database (MongoDB ObjectId string)
 * @param {string} accessToken - Instagram access token for API authentication
 * @returns {Promise<void>} Resolves after fetching and storing posts
 * @throws Will throw if Instagram API returns an error or if database operations fail
 *
 * @example
 * await fetchAndStoreInstagramPosts('507f1f77bcf86cd799439011', 'IGQVJ...');
 */
export async function fetchAndStoreInstagramPosts(userId: string, accessToken: string): Promise<void> {
    try {
        console.log(`[fetchAndStoreInstagramPosts] Attempting to fetch posts for userId: ${userId}`);
        const url = `https://graph.instagram.com/me/media`;
        // Request additional fields like comments_count if you need them for engagement calculations
        const fields = "id,caption,media_type,media_url,timestamp,like_count,comments_count";

        const requestUrl = `${url}?fields=${fields}&access_token=${accessToken}`;
        console.log(`[fetchAndStoreInstagramPosts] Instagram API URL: ${requestUrl.substring(0, 100)}...`); // Log part of the URL (without full token for security)

        const response = await axios.get(requestUrl);
        const data = response.data as { data: any[] };
        const posts = data.data;

        if (!posts || posts.length === 0) {
            console.warn(`[fetchAndStoreInstagramPosts] No posts found for user ${userId} or empty data array from Instagram API.`);
            return; // No posts found, not a critical error
        }

        let savedCount = 0;
        for (const post of posts) {
            // Ensure post.id exists before use
            if (!post.id) {
                console.warn("[fetchAndStoreInstagramPosts] Instagram post missing ID, skipping:", post);
                continue;
            }

            // Check if post already exists using the correct field `instagramId`
            const existing = await InstagramPost.findOne({ instagramId: post.id });
            if (existing) {
                // console.log(`[fetchAndStoreInstagramPosts] Post ${post.id} already exists, skipping.`);
                continue;
            }

            // Map Instagram API data to your InstagramPost model schema
            await InstagramPost.create({
                userId,
                instagramId: post.id,
                caption: post.caption || "",
                mediaType: post.media_type || "UNKNOWN",
                mediaUrl: post.media_url || "",
                timestamp: new Date(post.timestamp),
                likeCount: post.like_count || 0,
                commentsCount: post.comments_count || 0,
                // Map Instagram fields to your existing schema fields for content, contentType, imageUrls, hashtags, engagement
                content: post.caption || "", // Using caption as content
                contentType: post.media_type === 'VIDEO' ? 'Reel' : (post.media_type === 'IMAGE' ? 'Post' : 'Story'), // Mapping media_type to your contentType enum
                imageUrls: post.media_url ? [post.media_url] : [], // Mapping media_url to imageUrls array
                hashtags: post.caption ? (post.caption.match(/#\w+/g) || []).map((tag: string) => tag.substring(1)) : [], // Extracting hashtags from caption
                engagement: {
                    likes: post.like_count || 0,
                    comments: post.comments_count || 0,
                }
            });
            savedCount++;
        }

        console.log(`[fetchAndStoreInstagramPosts] Saved ${savedCount} new posts for user ${userId}. Total posts from API: ${posts.length}`);
    } catch (err: any) {
        console.error("❌ Error fetching or saving Instagram posts:", err);
        if (err.response) {
            // Instagram API returned an error (e.g., 400, 401, 403)
            console.error("Instagram API Response Error - Status:", err.response.status);
            console.error("Instagram API Response Data:", err.response.data);
            console.error("Instagram API Response Headers:", err.response.headers);
        } else if (err.request) {
            // Request was sent but no response was received (e.g., network issues)
            console.error("Instagram API Request Error - No response received:", err.request);
        } else {
            // Something else happened in setting up the request
            console.error("Instagram API General Error:", err.message);
        }
        throw err; // Re-throw the error for the controller to handle
    }
}

/**
 * Generates social media content suggestions based solely on the business profile.
 *
 * Uses OpenAI GPT-4 to create content suggestions tailored to the business type, tone,
 * audience, and marketing goals. Does not use Instagram data. Generates images for each
 * suggestion using DALL-E. Handles JSON parsing with fallback mechanisms for malformed responses.
 *
 * @param {IBusinessProfile} profile - Business profile containing preferences and settings
 * @param {number} count - Number of content suggestions to generate
 * @returns {Promise<any[]>} Array of content suggestions with titles, content, hashtags, and image URLs
 * @throws Will throw if OpenAI API fails or if response cannot be parsed
 *
 * @example
 * const suggestions = await generateContentBasedOnProfileOnly(profile, 3);
 * // Returns: [{ title, content, hashtags, contentType, imageUrls }, ...]
 */
async function generateContentBasedOnProfileOnly(
    profile: IBusinessProfile,
    count: number
): Promise<any[]> {
    const prompt = `
Create ${count} social media content suggestions in JSON format.
Each item should include:
- title (string)
- content (string)
- hashtags (array of strings) based on: "${profile.hashtagsStyle}", "${profile.keywords}", "${profile.customHashtags}"
- contentType (one of: ${profile.contentTypes.join(", ") || "Post"})

Business Info:
Business Type: ${profile.businessType}
Tone: ${profile.toneOfVoice}
Audience: ${profile.audienceType}
Marketing Goals: ${profile.marketingGoals.join(", ")}
Post Length: ${profile.postLength}
Use Emojis: ${profile.emojisAllowed ? "Yes" : "No"}, Favorites: ${profile.favoriteEmojis.join(" ")}

IMPORTANT: Return ONLY a valid JSON array. Do not include any markdown formatting, explanations, or additional text. The response must be parseable JSON.

Example format:
[
  {
    "title": "Example Title",
    "content": "Example content with emojis 🎉",
    "hashtags": ["example", "hashtag"],
    "contentType": "Post"
  }
]

Return only the JSON array:
`;

    try {
        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
        });

        const raw = chatCompletion.choices[0].message?.content ?? "[]";
        console.log("[generateContentBasedOnProfileOnly] Raw AI response:", raw.substring(0, Math.min(raw.length, 500)) + (raw.length > 500 ? '...' : '')); // Log part of the response

        // Try to clean the response before parsing
        let cleanedRaw = raw.trim();
        
        // Remove any markdown code blocks if present
        if (cleanedRaw.startsWith('```json')) {
            cleanedRaw = cleanedRaw.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedRaw.startsWith('```')) {
            cleanedRaw = cleanedRaw.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        let suggestions;
        try {
            suggestions = JSON.parse(cleanedRaw);
        } catch (parseError) {
            console.error("⚠️ JSON parse error, attempting to fix malformed JSON:", parseError);
            console.error("Raw response that failed to parse:", raw);
            
            // Try to extract JSON from the response using regex
            const jsonMatch = raw.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    suggestions = JSON.parse(jsonMatch[0]);
                    console.log("✅ Successfully extracted JSON using regex fallback");
                } catch (regexError) {
                    console.error("⚠️ Regex fallback also failed:", regexError);
                    throw new Error("Unable to parse AI response as valid JSON");
                }
            } else {
                throw new Error("No valid JSON array found in AI response");
            }
        }

        // Validate that suggestions is an array
        if (!Array.isArray(suggestions)) {
            console.error("⚠️ AI response is not an array:", suggestions);
            throw new Error("AI response is not a valid array");
        }

        return await generateImagesForSuggestions(profile, suggestions);
    } catch (err: any) {
        console.error("⚠️ Failed to parse AI response (profile only) or AI generation error:", err);
        if (err.response) {
            console.error("OpenAI API Response Error - Status:", err.response.status);
            console.error("OpenAI API Response Data:", err.response.data);
        } else if (err.message) {
            console.error("OpenAI API General Error:", err.message);
        }
        throw err; // Re-throw to propagate error
    }
}

/**
 * Generates social media content suggestions based on business profile and Instagram performance data.
 *
 * Retrieves top-performing Instagram posts by engagement, analyzes their patterns, and uses this
 * data along with the business profile to generate AI-powered content suggestions. Optionally updates
 * Instagram posts before generating suggestions. Uses OpenAI GPT-4 for content and DALL-E for images.
 *
 * @param {IBusinessProfile} profile - Business profile containing preferences and settings
 * @param {string} userId - Application user ID for fetching Instagram posts from database
 * @param {string} accessToken - Instagram access token for API authentication
 * @param {number} count - Number of content suggestions to generate
 * @param {boolean} updateInstagramPosts - Whether to fetch fresh Instagram data before generating
 * @returns {Promise<any[]>} Array of content suggestions with titles, content, hashtags, and image URLs
 * @throws Will throw if Instagram API, OpenAI API, or database operations fail
 *
 * @example
 * const suggestions = await generateContentBasedOnProfileAndInstagram(
 *   profile, '507f1f77bcf86cd799439011', 'IGQVJ...', 3, true
 * );
 */
async function generateContentBasedOnProfileAndInstagram(
    profile: IBusinessProfile,
    userId: string,
    accessToken: string,
    count: number,
    updateInstagramPosts: boolean
): Promise<any[]> {
    if (updateInstagramPosts) {
        await fetchAndStoreInstagramPosts(userId, accessToken);
    }

    // Retrieve top 5 posts by engagement from MongoDB
    const topPosts = await InstagramPost.find({ userId })
        .sort({ likeCount: -1 }) // Sorting by likeCount as primary engagement metric
        .limit(5)
        .lean()
        .exec() as Array<{ caption?: string; likeCount?: number; commentsCount?: number; mediaUrl?: string }>;

    let topPostsSummary = "No top performing posts found to learn from.";
    if (topPosts.length > 0) {
        topPostsSummary = topPosts
            .map(
                (post, idx) =>
                    `${idx + 1}. "${post.caption?.substring(0, 100).replace(/\n/g, " ")}" (Likes: ${post.likeCount || 0}, Comments: ${post.commentsCount || 0})`
            )
            .join("\n");
    }
    console.log("[generateContentBasedOnProfileAndInstagram] Top posts summary sent to AI:\n", topPostsSummary);


    const topImageUrls = topPosts
        .map(post => post.mediaUrl)
        .filter(Boolean)
        .slice(0, 3);

    const imageSection = topImageUrls.length
        ? `\nHere are image URLs of the top performing posts:\n${topImageUrls.join("\n")}`
        : "";

    const prompt = `
Create ${count} social media content suggestions in JSON format.
Each item should include:
- title (string)
- content (string)
- hashtags (array of strings) based on: "${profile.hashtagsStyle}", "${profile.keywords}", "${profile.customHashtags}"
- contentType (one of: ${profile.contentTypes.join(", ") || "Post"})

Business Info:
Business Type: ${profile.businessType}
Tone: ${profile.toneOfVoice}
Audience: ${profile.audienceType}
Marketing Goals: ${profile.marketingGoals.join(", ")}
Post Length: ${profile.postLength}
Use Emojis: ${profile.emojisAllowed ? "Yes" : "No"}, Favorites: ${profile.favoriteEmojis.join(" ")}

Based on these top performing Instagram posts by the user:
${topPostsSummary}
${imageSection}

IMPORTANT: Return ONLY a valid JSON array. Do not include any markdown formatting, explanations, or additional text. The response must be parseable JSON.

Example format:
[
  {
    "title": "Example Title",
    "content": "Example content with emojis 🎉",
    "hashtags": ["example", "hashtag"],
    "contentType": "Post"
  }
]

Return only the JSON array:
`;

    try {
        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
        });

        const raw = chatCompletion.choices[0].message?.content ?? "[]";
        console.log("[generateContentBasedOnProfileAndInstagram] Raw AI response:", raw.substring(0, Math.min(raw.length, 500)) + (raw.length > 500 ? '...' : '')); // Log part of the response

        // Try to clean the response before parsing
        let cleanedRaw = raw.trim();
        
        // Remove any markdown code blocks if present
        if (cleanedRaw.startsWith('```json')) {
            cleanedRaw = cleanedRaw.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedRaw.startsWith('```')) {
            cleanedRaw = cleanedRaw.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        let suggestions;
        try {
            suggestions = JSON.parse(cleanedRaw);
        } catch (parseError) {
            console.error("⚠️ JSON parse error, attempting to fix malformed JSON:", parseError);
            console.error("Raw response that failed to parse:", raw);
            
            // Try to extract JSON from the response using regex
            const jsonMatch = raw.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    suggestions = JSON.parse(jsonMatch[0]);
                    console.log("✅ Successfully extracted JSON using regex fallback");
                } catch (regexError) {
                    console.error("⚠️ Regex fallback also failed:", regexError);
                    throw new Error("Unable to parse AI response as valid JSON");
                }
            } else {
                throw new Error("No valid JSON array found in AI response");
            }
        }

        // Validate that suggestions is an array
        if (!Array.isArray(suggestions)) {
            console.error("⚠️ AI response is not an array:", suggestions);
            throw new Error("AI response is not a valid array");
        }

        return await generateImagesForSuggestions(profile, suggestions);
    } catch (err: any) {
        console.error("⚠️ Failed to parse AI response (profile + instagram) or AI generation error:", err);
        if (err.response) {
            console.error("OpenAI API Response Error - Status:", err.response.status);
            console.error("OpenAI API Response Data:", err.response.data);
        } else if (err.message) {
            console.error("OpenAI API General Error:", err.message);
        }
        throw err; // Re-throw to propagate error
    }
}

/**
 * Generates images for content suggestions using OpenAI DALL-E.
 *
 * Creates image prompts based on business type and suggestion titles, then generates
 * images via DALL-E API. Validates content types and handles image generation failures
 * gracefully by returning empty arrays. Each suggestion receives up to 2 images.
 *
 * @param {IBusinessProfile} profile - Business profile containing business type for image prompts
 * @param {any[]} suggestions - Array of content suggestions to generate images for
 * @returns {Promise<any[]>} Same suggestions array with imageUrls field populated
 * @throws Does not throw; handles errors by setting empty imageUrls arrays
 *
 * @example
 * const withImages = await generateImagesForSuggestions(profile, suggestions);
 * // Each suggestion now has imageUrls: [url1, url2] or []
 */
async function generateImagesForSuggestions(profile: IBusinessProfile, suggestions: any[]): Promise<any[]> {
    const validTypes = ["Post", "Story", "Reel", "Newsletter"];

    for (const suggestion of suggestions) {
        if (!validTypes.includes(suggestion.contentType)) {
            suggestion.contentType = "Post"; // Default to 'Post' if invalid type
        }

        const imagePrompt = `${profile.businessType} - ${suggestion.title}`;
        try {
            // Add a check to ensure the prompt is not empty or too short for image generation
            if (!imagePrompt || imagePrompt.trim().length < 5) {
                console.warn(`[generateImagesForSuggestions] Skipping image generation due to invalid or too short prompt: "${imagePrompt}"`);
                suggestion.imageUrls = [];
                continue;
            }

            const imageResponse = await openai.images.generate({
                prompt: imagePrompt,
                n: 2,
                size: "512x512",
            });

            suggestion.imageUrls = Array.isArray(imageResponse.data)
                ? imageResponse.data.map((img: any) => img.url)
                : [];
        } catch (imageError: any) {
            console.warn("🔁 Failed to generate image, fallback to empty array.", imageError);
            if (imageError.response) {
                console.error("OpenAI Image API Response Error - Status:", imageError.response.status);
                console.error("OpenAI Image API Response Data:", imageError.response.data);
            } else if (imageError.message) {
                console.error("OpenAI Image API General Error:", imageError.message);
            }
            suggestion.imageUrls = []; // Always return an empty array in case of error
        }
    }

    return suggestions;
}

/**
 * Main function to generate social media content suggestions.
 *
 * Routes to either profile-only or profile+Instagram generation logic based on provided parameters.
 * If userId and accessToken are provided, uses Instagram performance data to inform suggestions.
 * Otherwise, generates suggestions based solely on business profile data.
 *
 * @param {IBusinessProfile} profile - Business profile containing preferences and settings
 * @param {string} [userId] - Optional user ID for fetching Instagram posts
 * @param {string} [accessToken] - Optional Instagram access token
 * @param {number} [count=3] - Number of content suggestions to generate (default: 3)
 * @param {boolean} [updateInstagramPosts=false] - Whether to fetch fresh Instagram data before generating
 * @returns {Promise<any[]>} Array of content suggestions with titles, content, hashtags, contentType, and imageUrls
 * @throws Will throw if underlying API calls or database operations fail
 *
 * @example
 * // Generate without Instagram data
 * const suggestions = await generateContentFromProfile(profile);
 *
 * @example
 * // Generate with Instagram data
 * const suggestions = await generateContentFromProfile(
 *   profile, userId, accessToken, 5, true
 * );
 */
export async function generateContentFromProfile(
    profile: IBusinessProfile,
    userId?: string,
    accessToken?: string,
    count: number = 3,
    updateInstagramPosts: boolean = false
): Promise<any[]> {
    if (userId && accessToken) {
        if (updateInstagramPosts) {
            await fetchAndStoreInstagramPosts(userId, accessToken);
        }
        // Otherwise, use Instagram data and update posts as needed
        return generateContentBasedOnProfileAndInstagram(profile, userId, accessToken, count, updateInstagramPosts);
    } else {
        // If no userId or accessToken, use only profile data
        return generateContentBasedOnProfileOnly(profile, count);
    }
}