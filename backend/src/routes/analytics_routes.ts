import express from 'express';
import analyticsController from '../controllers/analytics_controller';
import authMiddleware from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/site-visits', authMiddleware, analyticsController.getSiteVisits);
router.post('/google-analytics/callback', authMiddleware, analyticsController.connectGoogleAnalytics);
router.put('/google-analytics/property-id', authMiddleware, analyticsController.updateGoogleAnalyticsPropertyId);

export default router;