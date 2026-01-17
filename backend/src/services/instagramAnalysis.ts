import InstagramPost from "../models/InstagramPost_model";

/**
 * Retrieves captions from the most engaging Instagram posts for a given user.
 *
 * Calculates engagement as the sum of likes and comments, then returns the captions
 * from the top posts formatted as a numbered list. Used to analyze successful content
 * patterns and inform content generation.
 *
 * @param {string} userId - The user ID to fetch Instagram posts for
 * @param {number} [limit=5] - Maximum number of top posts to retrieve (default: 5)
 * @returns {Promise<string>} Formatted string with numbered captions, or empty string if no posts found
 * @throws Does not throw; returns empty string on error
 *
 * @example
 * const captions = await getTopInstagramCaptions('507f1f77bcf86cd799439011', 10);
 * // Returns: "#1: First caption\n\n#2: Second caption\n\n..."
 */
export async function getTopInstagramCaptions(userId: string, limit: number = 5): Promise<string> {
  try {
    const topPosts = await InstagramPost.aggregate([
      { $match: { userId } },
      { $addFields: { engagement: { $add: ["$likeCount", "$commentsCount"] } } },
      { $sort: { engagement: -1 } },
      { $limit: limit }
    ]);

    if (topPosts.length === 0) {
      return "";
    }

    const result = topPosts
      .map((post, index) => `#${index + 1}: ${post.caption}`)
      .join("\n\n");

    return result;
  } catch (error) {
    console.error("⚠️ Error fetching top Instagram captions:", error);
    return "";
  }
}

/**
 * Retrieves the top Instagram posts for a user sorted by like count.
 *
 * Fetches Instagram posts from the database, sorts them by the number of likes in
 * descending order, and returns the specified number of top posts as plain objects.
 * Useful for analyzing high-performing content.
 *
 * @param {string} userId - The user ID to fetch Instagram posts for
 * @param {number} [limit=5] - Maximum number of top posts to retrieve (default: 5)
 * @returns {Promise<any[]>} Array of top Instagram post documents
 *
 * @example
 * const topPosts = await getTopInstagramPosts('507f1f77bcf86cd799439011', 10);
 * // Returns: [{ instagramId, caption, likeCount, commentsCount, ... }, ...]
 */
export async function getTopInstagramPosts(userId: string, limit: number = 5) {
  return InstagramPost.find({ userId })
    .sort({ likeCount: -1 })
    .limit(limit)
    .lean()
    .exec();
}