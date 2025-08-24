import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user_model';

interface AuthRequest extends Request {
  user?: {
    _id: string;
    instagramAccessToken?: string;
    instagramUserId?: string;
    instagramConnected?: boolean;
  };
}

const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authorization = req.header('authorization');
  const token = authorization && authorization.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (!process.env.TOKEN_SECRET) {
    res.status(500).json({ message: 'Server Error' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET) as { _id: string };
    const user = await User.findById(decoded._id).select('-password -refreshTokens') as any;
    
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }

    (req as AuthRequest).user = {
      _id: user._id,
      instagramAccessToken: user.instagramAccessToken,
      instagramUserId: user.instagramUserId,
      instagramConnected: user.instagramConnected
    };
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

export default authMiddleware;