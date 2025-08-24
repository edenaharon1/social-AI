import express from "express";
import { Request, Response } from "express";
import authController from "../controllers/auth_controller";
import authMiddleware from "../middlewares/authMiddleware";
import axios from "axios";
import User from "../models/user_model";

interface AuthRequest extends Request {
  user?: {
    _id: string;
  };
}

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication routes
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: Email already exists
 */
router.post("/register", authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User logged in successfully
 *       400:
 *         description: Invalid credentials
 */
router.post("/login", authController.login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout a user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post("/logout", authController.logout);

router.post("/google-login", authController.googleLogin);

interface InstagramTokenResponse {
  access_token: string;
  user_id: string;
}

interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

router.post("/instagram/callback", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { code } = req.body;

  if (!req.user || !req.user._id) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const userId = req.user._id;

  if (!code) {
    res.status(400).json({ error: 'Missing code' });
    return;
  }

  try {
    console.log('Starting Instagram auth process with:', { 
      code: code.substring(0, 10) + '...',
      userId,
      redirectUri: process.env.INSTAGRAM_REDIRECT_URI
    });

    // Find user first to verify they exist
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found:', userId);
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Exchange code for access token using Meta App credentials
    const tokenUrl = 'https://api.instagram.com/oauth/access_token';
    const formData = new URLSearchParams({
      client_id: process.env.INSTAGRAM_CLIENT_ID || '665994033060068',
      client_secret: process.env.META_APP_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
      code: code
    });

    const tokenResponse = await axios.post<InstagramTokenResponse>(
      tokenUrl,
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('Token exchange response:', {
      status: tokenResponse.status,
      hasAccessToken: !!tokenResponse.data.access_token,
      hasUserId: !!tokenResponse.data.user_id,
      userId: tokenResponse.data.user_id
    });

    const { access_token, user_id } = tokenResponse.data;

    if (!user_id) {
      console.error('No user_id received from Instagram');
      res.status(500).json({ error: 'Failed to get Instagram user ID' });
      return;
    }

    // Get long-lived access token
    const longLivedTokenUrl = 'https://graph.instagram.com/access_token';
    console.log('Requesting long-lived token from:', longLivedTokenUrl);

    const longLivedTokenResponse = await axios.get<LongLivedTokenResponse>(longLivedTokenUrl, {
      params: {
        grant_type: 'ig_exchange_token',
        client_secret: process.env.META_APP_SECRET,
        access_token
      }
    });

    console.log('Long-lived token response:', {
      status: longLivedTokenResponse.status,
      hasToken: !!longLivedTokenResponse.data.access_token,
      expiresIn: longLivedTokenResponse.data.expires_in
    });

    // Log the update operation details
    console.log('Attempting to update user with:', {
      userId,
      tokenLength: longLivedTokenResponse.data.access_token.length,
      userIdLength: user_id.length,
      actualUserId: user_id
    });

    // Update user with Instagram credentials
    const updateResult = await User.findOneAndUpdate(
      { _id: userId },
      {
        instagramAccessToken: longLivedTokenResponse.data.access_token,
        instagramUserId: user_id,
        instagramConnected: true
      },
      { new: true, runValidators: true }
    );

    if (!updateResult) {
      console.error('Update operation failed - no document was updated');
      res.status(500).json({ error: 'Failed to update user with Instagram credentials' });
      return;
    }

    // Verify the update by fetching the user again
    const verifyUser = await User.findById(userId);
    console.log('Verification after update:', {
      hasToken: !!verifyUser?.instagramAccessToken,
      hasUserId: !!verifyUser?.instagramUserId,
      isConnected: verifyUser?.instagramConnected,
      actualUserId: verifyUser?.instagramUserId
    });

    console.log('MongoDB update result:', {
      success: !!updateResult,
      userId: updateResult._id,
      hasToken: !!updateResult.instagramAccessToken,
      hasUserId: !!updateResult.instagramUserId,
      isConnected: updateResult.instagramConnected,
      actualUserId: updateResult.instagramUserId
    });

    res.json({ 
      success: true,
      instagramConnected: true
    });

  } catch (error: any) {
    console.error('Instagram auth error details:', error);
    res.status(500).json({ 
      error: 'Failed to authenticate with Instagram', 
      details: error.response?.data || error.message 
    });
  }
});

export default router;