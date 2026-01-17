import OpenAI from "openai";
import { Request, Response } from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import axios from "axios";
import User from "../models/user_model";
import BusinessProfile from "../models/business_profile_model";
import InstagramPost from "../models/InstagramPost_model";

dotenv.config();

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://aisocial.dev';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});


/**
 * Downloads an image from the given URL into the `uploads` directory.
 *
 * Generates a unique filename, streams the remote content to disk, and returns
 * the saved filename. If a file with the generated name already exists, it returns
 * the existing filename without re-downloading.
 *
 * @param {string} imageUrl - Public URL of the image to download
 * @returns {Promise<string>} The saved filename inside the `uploads` folder
 * @throws Network or filesystem errors may be thrown if the download or write fails
 */
async function downloadImageToUploads(imageUrl: string): Promise<string> {
  // Generate a unique filename with timestamp and random string
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const filename = `img-${randomString}.png`;
  const filepath = path.join(process.cwd(), "uploads", filename);

  if (fs.existsSync(filepath)) {
    return filename;
  }

  const response = await axios.get(imageUrl, { responseType: "stream" });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filepath);
    (response.data as NodeJS.ReadableStream).pipe(writer);

    writer.on("finish", () => resolve(filename));
    writer.on("error", reject);
  });
}

/**
 * Generates an image via OpenAI Images API with exponential backoff retries.
 *
 * Retries on HTTP 429 (rate limit) with an increasing delay between attempts.
 * Returns the image URL on success or `null` if generation fails.
 *
 * @param {string} prompt - The textual description for the image
 * @param {number} [retries=3] - Maximum number of retry attempts
 * @param {number} [delayMs=1000] - Initial delay in milliseconds; doubles on each retry
 * @returns {Promise<string|null>} The generated image URL or `null` if unavailable
 */
async function generateImageWithBackoff(prompt: string, retries = 3, delayMs = 1000): Promise<string | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
      });

      if (imageResponse.data && imageResponse.data.length > 0) {
        return imageResponse.data[0].url ?? null;
      }
      return null;
    } catch (error: any) {
      if (error.response?.status === 429) {
        if (i < retries) {
          console.warn(`Rate limited by OpenAI, retrying in ${delayMs}ms...`);
          await new Promise(r => setTimeout(r, delayMs));
          delayMs *= 2;
          continue;
        } else {
          console.error("Rate limit exceeded and max retries reached.");
          return null;
        }
      } else {
        console.error("OpenAI image generation error:", error);
        return null;
      }
    }
  }
  return null;
}

/**
 * Calls OpenAI Chat Completions API with exponential backoff on rate limits.
 *
 * Retries on HTTP 429 (rate limit) with an increasing delay. Non-429 errors are
 * immediately re-thrown. Returns the completion response on success.
 *
 * @param {any[]} messages - Array of chat messages (role/content) per OpenAI schema
 * @param {number} [retries=3] - Maximum number of retry attempts
 * @param {number} [delayMs=1000] - Initial delay in milliseconds; doubles on each retry
 * @returns {Promise<any>} The OpenAI completion response object
 * @throws Error is re-thrown after max retries or on non-rate-limit failures
 */
async function chatWithBackoff(
  messages: any[],
  retries = 3,
  delayMs = 1000
): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
      });
      return completion;
    } catch (error: any) {
      if (error.response?.status === 429) {
        if (i < retries) {
          console.warn(`Rate limited by OpenAI chat, retrying in ${delayMs}ms...`);
          await new Promise(r => setTimeout(r, delayMs));
          delayMs *= 2;
          continue;
        } else {
          console.error("Rate limit exceeded and max retries reached on chat.");
          throw error;
        }
      } else {
        throw error;
      }
    }
  }
}

/**
 * Chat endpoint handler that builds user/business/Instagram context, queries OpenAI,
 * optionally generates an image if requested by the AI, and returns the result.
 *
 * Requires either `message` or `imageUrl` in the request body. Uses the authenticated
 * user's `_id` to fetch context from the database and applies backoff when calling
 * OpenAI services.
 *
 * @param {Request} req - Express request; expects `message` or `imageUrl` in body and `user._id`
 * @param {Response} res - Express response
 * @returns {Promise<void>} Resolves after sending JSON with `response` and optional `imageUrl`
 * @example
 * POST /api/chat { message: "Write a post about..." }
 * // Response: { response: "...", imageUrl: "https://.../api/uploads/..." }
 *
 * @throws Returns 400 for missing input, 500 for OpenAI or server errors
 */
const chatWithAI = async (req: Request, res: Response): Promise<void> => {
  const { message, imageUrl } = req.body;

  if (!message && !imageUrl) {
    res.status(400).json({ message: "Message or image is required" });
    return;
  }

  try {
    // Get user context
    const userId = (req as any).user._id;
    const user = await User.findById(userId);
    const businessProfile = await BusinessProfile.findOne({ userId });
    
    // Get Instagram context if available
    let instagramContext = "";
    if (user?.instagramConnected && user?.instagramAccessToken) {
      try {
        const topPosts = await InstagramPost.find({ userId })
          .sort({ likeCount: -1 })
          .limit(3)
          .lean();
        
        if (topPosts.length > 0) {
          instagramContext = `\n\nYour Instagram Performance Context:
- You have ${topPosts.length} top-performing posts
- Your best post had ${topPosts[0]?.likeCount || 0} likes and ${topPosts[0]?.commentsCount || 0} comments
- Your content style: ${topPosts.map(post => post.caption?.substring(0, 50)).join(', ')}...`;
        }
      } catch (error) {
        console.log('Could not fetch Instagram context:', error);
      }
    }

    // Build business context
    let businessContext = "";
    if (businessProfile) {
      businessContext = `\n\nYour Business Context:
- Business Type: ${businessProfile.businessType}
- Target Audience: ${businessProfile.audienceType}
- Tone of Voice: ${businessProfile.toneOfVoice}
- Content Types: ${businessProfile.contentTypes.join(', ')}
- Marketing Goals: ${businessProfile.marketingGoals.join(', ')}
- Keywords: ${businessProfile.keywords}
- Custom Hashtags: ${businessProfile.customHashtags}
- Emojis Allowed: ${businessProfile.emojisAllowed ? 'Yes' : 'No'}
- Post Length: ${businessProfile.postLength}`;
    }

    const userContent: any[] = [];

    if (message) {
      userContent.push({ type: "text", text: message });
    }

    if (imageUrl) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: imageUrl,
        },
      });
    }

    const messages = [
      {
        role: "system",
        content:
          `את עוזרת אישית יצירתית לרשתות חברתיות. תני מענה קצר וחכם למשתמש. אם יש צורך בתמונות לפוסט, תארי במדויק איזו תמונה יכולה להתאים. למשל: "image: תיאור התמונה."${businessContext}${instagramContext}`,
      },
      {
        role: "user",
        content: userContent,
      },
    ];

    const completion = await chatWithBackoff(messages);

    let aiResponse = completion.choices[0].message?.content;
    let generatedImageUrl = null;

    if (aiResponse && aiResponse.includes("image:")) {
      const imageDescription = aiResponse.match(/image:\s*(.*)/)?.[1]?.trim();

      if (imageDescription) {
        const externalUrl = await generateImageWithBackoff(imageDescription);

        if (externalUrl) {
          const savedFilename = await downloadImageToUploads(externalUrl);
          generatedImageUrl = `${PUBLIC_BASE_URL}/api/uploads/${savedFilename}`;
        } else {
          generatedImageUrl = `${PUBLIC_BASE_URL}/api/uploads/placeholder.png`;
        }
      }
    }

    res.status(200).json({ response: aiResponse, imageUrl: generatedImageUrl });
  } catch (error: any) {
    console.error("OpenAI API error:", error.response?.data || error.message || error);
    res.status(500).json({ message: "Error chatting with AI" });
  }
};

/**
 * Returns a public URL for an uploaded image processed by middleware (e.g., multer).
 *
 * Validates that a file exists on `req.file` and responds with the public URL
 * under `PUBLIC_BASE_URL` and the `uploads` route.
 *
 * @param {Request} req - Express request with `file` populated by upload middleware
 * @param {Response} res - Express response
 * @returns {void} Sends JSON with the `imageUrl` or a 400 error if no file
 * @example
 * POST /api/uploads (multipart/form-data)
 * // Response: { imageUrl: "https://.../api/uploads/<filename>" }
 */
const uploadImage = (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ message: "No image uploaded" });
    return;
  }

  const imageUrl = `${PUBLIC_BASE_URL}/api/uploads/${req.file.filename}`;
  res.status(200).json({ imageUrl });
};

export default { chatWithAI, uploadImage };
