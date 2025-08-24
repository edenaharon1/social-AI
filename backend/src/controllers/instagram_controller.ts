import { Request, Response } from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import User from "../models/user_model";

// Ensure these are set in your .env file
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://aisocial.dev';

// Add interfaces for type safety
interface InstagramPost {
  id: string;
  caption?: string;
  media_type: string;
  media_url: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

interface InstagramResponse {
  data: InstagramPost[];
}

// Add interface to extend Express Request
interface AuthRequest extends Request {
  user?: {
    _id: string;
  };
}

/**
 * Fetches the latest Instagram posts (images with captions) for the connected user.
 */
export const getInstagramPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get current user from auth middleware
    const userId = req.user?._id;
    const user = await User.findById(userId);

    if (!user?.instagramAccessToken) {
      res.status(401).json({ message: "Instagram not connected" });
      return;
    }

    const fields = "id,caption,media_type,media_url,timestamp";
    const url = `https://graph.instagram.com/me/media?fields=${fields}&access_token=${user.instagramAccessToken}`;

    const response = await axios.get<InstagramResponse>(url);
    const rawPosts = response.data.data;

    const posts = rawPosts
      .filter((post: InstagramPost) => post.media_type === "IMAGE" && post.caption)
      .slice(0, 10)
      .map((post: InstagramPost) => ({
        id: post.id,
        caption: post.caption,
        media_url: post.media_url,
        timestamp: post.timestamp
      }));

    res.status(200).json({ posts });
  } catch (error: any) {
    console.error("Error fetching Instagram posts:", error.response?.data || error.message);
    res.status(500).json({ message: "Failed to fetch Instagram posts", error: error.message });
  }
};

/**
 * Uploads an image with caption to Instagram for the connected user.
 */
export const postToInstagram = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { caption, scheduledAt } = req.body;
    const imageFile = req.file;
    
    console.log('Instagram post request received:', {
      hasCaption: !!caption,
      caption: caption,
      hasScheduledAt: !!scheduledAt,
      scheduledAt: scheduledAt,
      hasImageFile: !!imageFile,
      imageFileName: imageFile?.originalname,
      imageFileType: imageFile?.mimetype,
      imageFileSize: imageFile?.size,
      userId: req.user?._id
    });
    
    // Get userId from auth middleware
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    // Find user and check Instagram connection
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    console.log('User Instagram connection status:', {
      userId: user._id,
      instagramConnected: user.instagramConnected,
      hasAccessToken: !!user.instagramAccessToken,
      hasUserId: !!user.instagramUserId,
      instagramUserId: user.instagramUserId
    });

    if (!user.instagramConnected || !user.instagramAccessToken || !user.instagramUserId) {
      res.status(401).json({ message: "Instagram account not connected" });
      return;
    }

    if (!imageFile) {
      res.status(400).json({ message: "Image is required" });
      return;
    }

    // Validate file type
    if (!imageFile.mimetype || !imageFile.mimetype.startsWith('image/')) {
      res.status(400).json({ 
        message: "Invalid file type. Only images are supported." 
      });
      return;
    }

    const publishPost = async () => {
      try {
        const imagePath = path.join(process.cwd(), imageFile.path);
        
        // Convert image to JPEG using Sharp
        const jpegPath = imagePath + '.jpg';
        await sharp(imagePath)
          .jpeg({ quality: 90 })
          .toFile(jpegPath);

        const imageUrl = `${PUBLIC_BASE_URL}/api/uploads/${path.basename(jpegPath)}`;

        console.log('Attempting to create media container with:', {
          userId: user.instagramUserId,
          hasToken: !!user.instagramAccessToken,
          imageUrl
        });

        // Use Instagram Graph API endpoint
        const mediaRes = await axios.post(
          `https://graph.instagram.com/me/media`,
          {
            image_url: imageUrl,
            caption: caption || '',
            access_token: user.instagramAccessToken,
          }
        );

        console.log('Media container created:', mediaRes.data);

        const creationId = (mediaRes.data as { id: string }).id;

        console.log('Attempting to publish media with creation ID:', creationId);

        const publishRes = await axios.post(
          `https://graph.instagram.com/me/media_publish`,
          {
            creation_id: creationId,
            access_token: user.instagramAccessToken,
          }
        );

        console.log('Media published successfully:', publishRes.data);

        // Clean up files
        fs.unlinkSync(imagePath);
        fs.unlinkSync(jpegPath);

        return publishRes.data;
      } catch (error: any) {
        console.error("Error during posting:", error.response?.data || error);
        throw new Error(error.response?.data?.error?.message || error.message);
      }
    };

    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      const now = new Date();

      if (isNaN(scheduledDate.getTime())) {
        res.status(400).json({ message: "Invalid scheduledAt date" });
        return;
      }
      if (scheduledDate <= now) {
        res.status(400).json({ message: "scheduledAt must be a future date/time" });
        return;
      }

      const delay = scheduledDate.getTime() - now.getTime();

      setTimeout(() => {
        publishPost();
      }, delay);

      res.status(200).json({ message: `Post scheduled for ${scheduledDate.toISOString()}` });
      return;
    }

    await publishPost();
    res.status(200).json({ message: "Posted to Instagram successfully" });

  } catch (error: any) {
    console.error("Instagram post error:", error);
    res.status(500).json({ 
      message: "Failed to post to Instagram", 
      error: error.response?.data?.error?.message || error.message 
    });
  }
};

/**
 * Fetches the most popular Instagram posts for the connected user.
 */
export const getPopularInstagramPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?._id) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (!user.instagramAccessToken || !user.instagramUserId) {
      res.status(401).json({ message: "Instagram not connected" });
      return;
    }

    console.log('Fetching popular posts for user:', {
      userId: user._id,
      hasToken: !!user.instagramAccessToken,
      hasUserId: !!user.instagramUserId
    });

    try {
      // Get all posts from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const url = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,timestamp,like_count,comments_count&access_token=${user.instagramAccessToken}`;
      console.log('Requesting Instagram API:', url.substring(0, url.indexOf('access_token')) + 'access_token=***');
      
      const response = await axios.get<InstagramResponse>(url);
      
      if (!response.data?.data) {
        console.error('Invalid response from Instagram API:', response.data);
        res.status(500).json({ message: "Invalid response from Instagram API" });
        return;
      }

      // Filter posts from last 30 days and sort by engagement
      const posts = response.data.data
        .filter(post => new Date(post.timestamp) >= thirtyDaysAgo)
        .sort((a, b) => {
          const aEngagement = (a.like_count || 0) + (a.comments_count || 0);
          const bEngagement = (b.like_count || 0) + (b.comments_count || 0);
          return bEngagement - aEngagement;
        })
        .slice(0, 10); // Get top 10 posts

      console.log('Retrieved popular posts:', { 
        count: posts.length,
        dateRange: `${thirtyDaysAgo.toISOString()} to ${new Date().toISOString()}`
      });
      
      res.status(200).json({ posts });
    } catch (apiError: any) {
      console.error('Instagram API error:', apiError.response?.data || apiError);
      if (apiError.response?.data?.error?.code === 190) {
        await User.findByIdAndUpdate(req.user._id, {
          $set: {
            instagramConnected: false,
            instagramAccessToken: null,
            instagramUserId: null
          }
        });
        res.status(401).json({ message: "Instagram authorization expired. Please reconnect your account." });
        return;
      }
      throw apiError;
    }
  } catch (error: any) {
    console.error("Error in getPopularInstagramPosts:", error);
    res.status(500).json({ 
      message: error.response?.data?.error?.message || "Failed to fetch Instagram data",
      error: error.response?.data?.error || error.message
    });
  }
};

/**
 * Fetches the monthly statistics of Instagram posts for the connected user.
 */
export const getMonthlyStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (!user?.instagramAccessToken || !user?.instagramUserId) {
      res.status(401).json({ message: "Instagram not connected" });
      return;
    }

    console.log('Fetching monthly stats for user:', {
      userId: user._id,
      hasToken: !!user.instagramAccessToken,
      hasUserId: !!user.instagramUserId
    });

    const url = `https://graph.instagram.com/me/media?fields=id,timestamp,like_count,comments_count,media_type&access_token=${user.instagramAccessToken}`;
    console.log('Requesting Instagram API:', url.substring(0, url.indexOf('access_token')) + 'access_token=***');

    const response = await axios.get<InstagramResponse>(url);
    
    if (!response.data?.data) {
      console.error('Invalid response from Instagram API:', response.data);
      res.status(500).json({ message: "Invalid response from Instagram API" });
      return;
    }

    const posts = response.data.data;
    console.log('Retrieved posts for stats:', { count: posts.length });

    // Calculate monthly statistics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    const monthlyPosts = posts.filter(post => {
      const postDate = new Date(post.timestamp);
      return postDate >= thirtyDaysAgo;
    });

    // Calculate daily stats
    const dailyStats: Record<string, { likes: number; comments: number; posts: number }> = {};
    
    monthlyPosts.forEach(post => {
      const date = post.timestamp.split('T')[0]; // Get YYYY-MM-DD
      if (!dailyStats[date]) {
        dailyStats[date] = { likes: 0, comments: 0, posts: 0 };
      }
      dailyStats[date].likes += post.like_count || 0;
      dailyStats[date].comments += post.comments_count || 0;
      dailyStats[date].posts += 1;
    });

    // Convert to array and sort by date
    const dailyStatsArray = Object.entries(dailyStats)
      .map(([date, stats]) => ({
        date,
        ...stats
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const stats = {
      totalPosts: monthlyPosts.length,
      totalLikes: monthlyPosts.reduce((sum, post) => sum + (post.like_count || 0), 0),
      totalComments: monthlyPosts.reduce((sum, post) => sum + (post.comments_count || 0), 0),
      averageLikes: monthlyPosts.length ? monthlyPosts.reduce((sum, post) => sum + (post.like_count || 0), 0) / monthlyPosts.length : 0,
      averageComments: monthlyPosts.length ? monthlyPosts.reduce((sum, post) => sum + (post.comments_count || 0), 0) / monthlyPosts.length : 0,
      dailyStats: dailyStatsArray
    };

    console.log('Calculated monthly stats:', {
      totalPosts: stats.totalPosts,
      totalLikes: stats.totalLikes,
      totalComments: stats.totalComments,
      dailyStatsCount: stats.dailyStats.length
    });
    
    res.status(200).json(stats);
  } catch (error: any) {
    console.error("Error in getMonthlyStats:", error);
    res.status(500).json({ 
      message: error.response?.data?.error?.message || "Failed to fetch Instagram statistics",
      error: error.response?.data?.error || error.message
    });
  }
};

