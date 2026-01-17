import { Request, Response } from "express";
import BusinessProfile from "../models/business_profile_model";

interface AuthRequest extends Request {
  user?: {
    _id: string;
  };
}

/**
 * Retrieves the authenticated user's business profile.
 *
 * Verifies authentication, fetches the profile by `userId`, and returns it.
 * Responds with 404 if no profile exists and 401 if unauthenticated.
 *
 * @param {AuthRequest} req - Express request with `user._id` populated by auth middleware
 * @param {Response} res - Express response
 * @returns {Promise<void>} Resolves after sending JSON response
 * @example
 * GET /api/business/profile
 * // Response: BusinessProfile document
 */
const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = (req as AuthRequest).user?._id;
      if (!userId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }
      
      const profile = await BusinessProfile.findOne({ userId });
  
      if (!profile) {
        res.status(404).json({ message: "Business profile not found" });
        return;
      }
  
      res.status(200).json(profile);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  };
  
/**
 *  updates the authenticated user's business profile.
 *
 * Uses `findOneAndUpdate` with `upsert: true` to create the profile if it doesn't exist,
 * and `runValidators: true` to enforce schema rules. Requires authentication.
 *
 * @param {AuthRequest} req - Express request with `user._id` and profile fields in `body`
 * @param {Response} res - Express response
 * @returns {Promise<void>} Resolves after sending the updated profile as JSON
 * @example
 * PUT /api/business/profile { name, industry, ... }
 * // Response: Updated BusinessProfile document
 */
const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?._id;
    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }
    
    const update = req.body;

    const profile = await BusinessProfile.findOneAndUpdate(
      { userId },
      update,
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json(profile);
  } catch (error) {
    res.status(400).json({ message: "Error updating profile", error });
  }
};

export default { getProfile, updateProfile };