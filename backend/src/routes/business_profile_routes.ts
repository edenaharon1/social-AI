import express from "express";
import businessProfileController from "../controllers/business_profile_controller";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: BusinessProfile
 *   description: User business profile management
 */

/**
 * @swagger
 * /business-profile:
 *   get:
 *     summary: Get the current user's business profile
 *     tags: [BusinessProfile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The business profile of the user
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Business profile not found
 */
router.get("/", authMiddleware, businessProfileController.getProfile);

/**
 * @swagger
 * /business-profile:
 *   put:
 *     summary: Update or create the user's business profile
 *     tags: [BusinessProfile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BusinessProfile'
 *     responses:
 *       200:
 *         description: Business profile updated or created successfully
 *       401:
 *         description: Unauthorized
 */
router.put("/", authMiddleware, businessProfileController.updateProfile);

export default router;
