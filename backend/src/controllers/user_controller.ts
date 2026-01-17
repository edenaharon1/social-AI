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
    /**
     * Retrieves the connection status for Instagram and Google Analytics for the authenticated user.
     *
     * Fetches the user's external service connection flags (Instagram and Google Analytics)
     * and returns them in a JSON response. Used to display connection status in the UI.
     *
     * @param {Request} req - Express request with `user._id` from auth middleware
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function for error handling
     * @returns {Promise<void>} Resolves after sending connection status as JSON
     * @example
     * GET /api/users/connections
     * // Response: { instagramConnected: true, googleAnalyticsConnected: false }
     *
     * @throws Returns 404 if user not found, passes errors to error handler middleware
     */
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

    /**
     * Retrieves a user by their ID with populated posts and comments.
     *
     * Fetches a single user document excluding sensitive fields (password, refreshTokens)
     * and populates related posts and comments for a complete user profile view.
     *
     * @param {Request} req - Express request with `params.id` containing the user ID
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function for error handling
     * @returns {Promise<void>} Resolves after sending user data as JSON
     * @example
     * GET /api/users/:id
     * // Response: { success: true, data: { _id, username, email, posts, comments, ... } }
     *
     * @throws Returns 404 if user not found, passes errors to error handler middleware
     */
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

    /**
     * Retrieves all users from the database with populated posts and comments.
     *
     * Fetches all user documents excluding sensitive fields (password, refreshTokens)
     * and populates related posts and comments. Useful for admin panels or user listings.
     *
     * @param {Request} req - Express request
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function for error handling
     * @returns {Promise<void>} Resolves after sending array of users as JSON
     * @example
     * GET /api/users
     * // Response: { success: true, data: [{ _id, username, email, posts, comments, ... }] }
     *
     * @throws Passes errors to error handler middleware
     */
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

    /**
     * Updates a user's profile information including username, email, and profile picture.
     *
     * Validates that the new username/email are not already in use by other users,
     * updates the specified fields, and handles optional profile picture upload via multer.
     *
     * @param {Request} req - Express request with `params.id`, `body` containing username/email, and optional `file` for profile picture
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function for error handling
     * @returns {Promise<void>} Resolves after sending updated user data as JSON
     * @example
     * PUT /api/users/:id
     * Content-Type: multipart/form-data
     * { username: "newname", email: "new@email.com", profilePicture: File }
     * // Response: { success: true, data: { _id, username, email, profilePicture, ... } }
     *
     * @throws Returns 400 if username/email already in use, 404 if user not found, passes errors to error handler
     */
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

    /**
     * Deletes a user from the database by their ID.
     *
     * Permanently removes the user document from the database. This action cannot be undone.
     *
     * @param {Request} req - Express request with `params.id` containing the user ID to delete
     * @param {Response} res - Express response
     * @param {NextFunction} next - Express next function for error handling
     * @returns {Promise<void>} Resolves after sending deletion confirmation as JSON
     * @example
     * DELETE /api/users/:id
     * // Response: { message: "User deleted successfully" }
     *
     * @throws Returns 404 if user not found, passes errors to error handler middleware
     */
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