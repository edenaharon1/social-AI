import { Request, Response, NextFunction } from 'express';
import UserModel from '../models/user_model';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

class UserController {
    async getConnectionStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user._id;
            console.log('Getting connection status for user:', userId);
            
            const user = await UserModel.findById(userId)
                .select('instagramConnected googleAnalyticsConnected');
            
            if (!user) {
                console.log('User not found for ID:', userId);
                res.status(404).json({ message: 'User not found' });
                return;
            }
            
            const connectionStatus = {
                instagramConnected: user.instagramConnected || false,
                googleAnalyticsConnected: user.googleAnalyticsConnected || false
            };
            
            console.log('Connection status for user:', userId, connectionStatus);
            
            res.status(200).json(connectionStatus);
        } catch (error: any) {
            console.error('Error getting connection status:', error);
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const user = await UserModel.findById(req.params.id)
                .select('-password -refreshTokens')
                .populate('posts')
                .populate('comments');
            
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }
            
            res.status(200).json({
                success: true,
                data: user
            });
        } catch (error: any) {
            next(error);
        }
    }

    async getAllUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const users = await UserModel.find()
                .select('-password -refreshTokens')
                .populate('posts')
                .populate('comments');

            res.status(200).json({
                success: true,
                data: users
            });
        } catch (error: any) {
            next(error);
        }
    }

    async updateUser(req: Request, res: Response, next: NextFunction) {
        const userId = req.params.id;
        const { username, email } = req.body;
        try {
            const existingUser = await UserModel.findOne({ 
                $or: [
                    { email, _id: { $ne: userId } },
                    { username, _id: { $ne: userId } }
                ]
            });

            if (existingUser) {
                res.status(400).json({ message: 'Username or email already in use' });
                return;
            }

            const user = await UserModel.findById(userId);
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }

            if (username) user.username = username;
            if (email) user.email = email;
            if (req.file) user.profilePicture = req.file.path;
            await user.save();
            
            res.status(200).json({
                success: true,
                data: user
            });
        } catch (error: any) {
            next(error);
        }
    }

    async deleteUser(req: Request, res: Response, next: NextFunction) {
        const userId = req.params.id;
        try {
            const user = await UserModel.findById(userId);
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }

            await user.deleteOne();
            
            res.status(200).json({ message: 'User deleted successfully' });
        } catch (error: any) {
            next(error);
        }
    }
}

export default new UserController();