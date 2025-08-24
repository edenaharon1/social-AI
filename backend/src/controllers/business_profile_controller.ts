import { Request, Response } from "express";
import BusinessProfile from "../models/business_profile_model";

interface AuthRequest extends Request {
  user?: {
    _id: string;
  };
}

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