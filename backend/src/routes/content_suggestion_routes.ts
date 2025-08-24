import express from "express";
import auth from "../middlewares/authMiddleware";
import {
  getOrGenerateSuggestions,
  getOrGenerateUserSuggestions,
  refreshSingleSuggestion,
} from "../controllers/content_suggestion_controller";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: AI Content
 *   description: Generate and manage AI-generated content based on business profile
 */

/**
 * @swagger
 * /ai/suggestions:
 *   get:
 *     summary: Get or generate 3 AI content suggestions for the authenticated user
 *     tags: [AI Content]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of up to 3 content suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   content:
 *                     type: string
 *                   hashtags:
 *                     type: array
 *                     items:
 *                       type: string
 *                   imageUrls:
 *                     type: array
 *                     items:
 *                       type: string
 *                   contentType:
 *                     type: string
 *                   refreshed:
 *                     type: boolean
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get("/suggestions", auth, getOrGenerateSuggestions);

/**
 * @swagger
 * /ai/suggestions/{suggestionId}/refresh:
 *   put:
 *     summary: Refresh a specific content suggestion with new AI-generated content
 *     tags: [AI Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: suggestionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the content suggestion to refresh
 *     responses:
 *       200:
 *         description: The refreshed content suggestion
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 *                 hashtags:
 *                   type: array
 *                   items:
 *                     type: string
 *                 imageUrls:
 *                   type: array
 *                   items:
 *                     type: string
 *                 contentType:
 *                   type: string
 *                 refreshed:
 *                   type: boolean
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Suggestion not found
 */
router.put("/suggestions/:suggestionId/refresh", auth, refreshSingleSuggestion);

// מסלול ליצירת הצעות על סמך פרופיל עסקי לפי userId (למקרה שמתבצע מבחוץ עם userId)
router.get("/suggestions/business/:userId", auth, getOrGenerateSuggestions);

// Route for current user's Instagram-enhanced suggestions (must come before parameterized route)
router.get("/suggestions/user/me", auth, async (req, res, next) => {
  try {
    const userId = (req as any).user._id;
    req.params.userId = userId.toString(); // Convert ObjectId to string
    await getOrGenerateUserSuggestions(req, res, next);
  } catch (error) {
    next(error);
  }
});

// ✅ מסלול להצעות לפי ניתוח פרופיל אינסטגרם של המשתמש
router.get("/suggestions/user/:userId", auth, getOrGenerateUserSuggestions);

export default router;
