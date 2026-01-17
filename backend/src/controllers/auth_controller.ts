// src/controllers/auth_controller.ts
import dotenv from "dotenv";
dotenv.config();
import { Request, Response, RequestHandler } from 'express'; // <--- השאירי את זה!
import jwt from 'jsonwebtoken';
import userModel from '../models/user_model';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// סמן כל פונקציה כ-RequestHandler
/**
 * Registers a new user.
 *
 * Validates required fields, checks duplicates by email and username,
 * hashes the password with bcrypt, creates the user, and returns a JWT
 * along with basic user information.
 *
 * @param {Request} req - Express request containing `username`, `email`, `password` in the body
 * @param {Response} res - Express response object
 * @returns {Promise<void>} Resolves after sending a JSON response to the client
 * @example
 * POST /api/auth/register { username, email, password }
 * // Response: { message, RegisteredUser: { username, email, id }, token }
 *
 * @throws Returns 400 for missing fields, 409 for duplicates, 500 for server/config errors
 */
const register: RequestHandler = async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
         res.status(400).json({ message: "Username, email, and password are required" });
         return; // <--- הוספת return כדי למנוע המשך ביצוע הקוד
    }

    try {
        // בדיקה קודם כל של קיום משתמש עם אימייל או שם משתמש לפני ניסיון יצירה
        const existingUserByEmail = await userModel.findOne({ email });
        if (existingUserByEmail) {
             res.status(409).json({ message: "Email already exists" });
             return; // <--- הוספת return כדי למנוע המשך ביצוע הקוד
        }

        const existingUserByUsername = await userModel.findOne({ username });
        if (existingUserByUsername) {
             res.status(409).json({ message: "Username already exists" });
             return; // <--- הוספת return כדי למנוע המשך ביצוע הקוד
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await userModel.create({
            username,
            email,
            password: hashedPassword,
        });

        // ודא שהמשתמש נוצר בהצלחה לפני יצירת טוקן
        if (!user) { // זה אמור לקרות רק אם יש בעיה פנימית ב-Mongoose שאינה נזרקת כ-error
             res.status(500).json({ message: "Failed to create user." });
             return; 
        }

        if (!process.env.TOKEN_SECRET) {
            console.error("TOKEN_SECRET environment variable is not defined for register function.");
             res.status(500).json({ message: "Server configuration error (TOKEN_SECRET missing)" });
             return; 
        }

        const token = jwt.sign(
            { _id: user._id },
            process.env.TOKEN_SECRET,
            { expiresIn: process.env.TOKEN_EXPIRATION || '1h' }
        );

        res.status(201).json({
            message: "User registered successfully",
            RegisteredUser: {
                username: user.username,
                email: user.email,
                id: user._id,
            },
            token: token,
        });
    } catch (err: any) {
        console.error("Error in register:", err);
        // טיפול בשגיאת ייחודיות (Duplicate key error)
        if (err.code === 11000) {
            if (err.keyPattern && err.keyPattern.email) {
                 res.status(409).json({ message: "Email already exists." });
                 return; // <--- הוספת return כדי למנוע המשך ביצוע הקוד
            }
            if (err.keyPattern && err.keyPattern.username) {
                 res.status(409).json({ message: "Username already exists." });
                 return; 
            }
        }
        // טיפול בשגיאות אחרות (לדוגמה, שגיאות ולידציה של Mongoose)
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map((val: any) => val.message);
             res.status(400).json({ message: messages.join(', ') });
              return;
        }
         res.status(500).json({ message: "Error registering user." });
          return;
    }
};

/**
 * Logs in a user with email and password.
 *
 * Validates input, checks user existence and password match, creates a JWT,
 * and returns user information along with external service connection statuses
 * (Instagram/Google Analytics).
 *
 * @param {Request} req - Express request with `email` and `password` in the body
 * @param {Response} res - Express response object
 * @returns {Promise<void>} Resolves after sending a JSON response
 * @example
 * POST /api/auth/login { email, password }
 * // Response: { RegisteredUser, token, instagramConnected, googleAnalyticsConnected }
 *
 * @throws Returns 400 for invalid input/credentials, 500 for server errors
 */
const login: RequestHandler = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ message: "Email and password are required" });
        return;
    }

    try {
        const user = await userModel.findOne({ email });
        if (!user) {
            res.status(400).json({ message: "Invalid credentials" });
            return;
        };

        const validPassword = await bcrypt.compare(password, user.password!);
        if (!validPassword) {
            res.status(400).json({ message: "Invalid credentials" });
            return;
        };

        if (!process.env.TOKEN_SECRET) {
            res.status(500).json({ message: "Server Error" });
            return;
        };

        const token = jwt.sign({ _id: user._id }, process.env.TOKEN_SECRET, { expiresIn: process.env.TOKEN_EXPIRATION });
        const responseData = {
            RegisteredUser: {
                username: user.username,
                email: user.email,
                id: user._id
            },
            token: token,
            instagramConnected: user.instagramConnected || false,
            googleAnalyticsConnected: user.googleAnalyticsConnected || false
        };

        console.log('Regular login response:', JSON.stringify(responseData, null, 2));
        res.status(200).json(responseData);
    } catch (err) {
        res.status(500).json({ message: "Error logging in" });
        return;
    }
};

/**
 * Logs in via Google (OAuth 2.0) using an ID token.
 *
 * Verifies the ID token with Google, creates or updates a user by `googleId`/`email`,
 * and returns a JWT along with user info and connection statuses.
 *
 * @param {Request} req - Express request with `token` (Google ID token) in the body
 * @param {Response} res - Express response object
 * @returns {Promise<void>} Resolves after sending a JSON response
 * @example
 * POST /api/auth/google-login { token }
 * // Response: { RegisteredUser, token, instagramConnected, googleAnalyticsConnected }
 *
 * @throws Returns 400 for invalid token, 500 for Google auth/config errors
 */
const googleLogin: RequestHandler = async (req, res) => {
    const { token } = req.body;

    if (!process.env.GOOGLE_CLIENT_ID) {
        res.status(500).json({ message: "Google Client ID not configured" });
        return;
    }

    try {
        const client = new OAuth2Client({
            clientId: process.env.GOOGLE_CLIENT_ID,
        });

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            res.status(400).json({ message: 'Invalid Google token' });
            return;
        }

        const { sub, email, name } = payload;
        let user = await userModel.findOne({
            $or: [
                { googleId: sub },
                { email: email }
            ]
        });

        if (!user) {
            user = new userModel({
                username: name,
                email: email,
                googleId: sub,
            });
            await user.save();
        } else if (!user.googleId) {
            user.googleId = sub;
            await user.save();
        }

        if (!process.env.TOKEN_SECRET) {
            res.status(500).json({ message: "Token secret not configured" });
            return;
        }

        const jwtToken = jwt.sign(
            { _id: user._id },
            process.env.TOKEN_SECRET,
            { expiresIn: process.env.TOKEN_EXPIRATION }
        );

        const responseData = {
            RegisteredUser: {
                username: user.username,
                email: user.email,
                id: user._id
            },
            token: jwtToken,
            instagramConnected: user.instagramConnected || false,
            googleAnalyticsConnected: user.googleAnalyticsConnected || false
        };

        console.log('Google login response:', JSON.stringify(responseData, null, 2));
        res.status(200).json(responseData);
    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({ message: 'Error logging in with Google' });
        return;
    }
};

/**
 * Stateless logout.
 *
 * Does not revoke tokens on the server; simply returns a success message.
 * The client is responsible for clearing any stored tokens.
 *
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @returns {void} Sends a success message response
 * @example
 * POST /api/auth/logout
 * // Response: { message: "Logged out successfully" }
 */
const logout: RequestHandler = (req, res) => {
    res.status(200).json({ message: "Logged out successfully" }); // <--- הוסר return
};

export default { register, login, googleLogin, logout };