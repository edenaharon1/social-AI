import { Request, Response } from 'express';
import { google } from 'googleapis';
import User from '../models/user_model';
import dotenv from 'dotenv';

dotenv.config();

const GA4_PROPERTY_ID = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

let isConfigValid = true;

if (!GA4_PROPERTY_ID) {
    console.error('CRITICAL CONFIG ERROR: GOOGLE_ANALYTICS_PROPERTY_ID (GA4 Property ID) is not set in .env file.');
    isConfigValid = false;
}
if (!GOOGLE_CLIENT_EMAIL) {
    console.error('CRITICAL CONFIG ERROR: GOOGLE_CLIENT_EMAIL (Service Account Email) is not set in .env file.');
    isConfigValid = false;
}
if (!GOOGLE_PRIVATE_KEY) {
    console.error('CRITICAL CONFIG ERROR: GOOGLE_PRIVATE_KEY (Service Account Private Key) is not set in .env file.');
    isConfigValid = false;
}

let auth: any;
let analyticsData: any;

if (isConfigValid) {
    try {
        auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: GOOGLE_CLIENT_EMAIL,
                private_key: GOOGLE_PRIVATE_KEY,
            },
            scopes: ['https://www.googleapis.com/auth/analytics.readonly']
        });

        analyticsData = google.analyticsdata({
            version: 'v1beta',
            auth: auth
        });

        console.log("Google Analytics Data API client initialized successfully.");

    } catch (error: any) {
        console.error("CRITICAL CONFIG ERROR: Failed to initialize Google Auth or Analytics client.", error.message);
        isConfigValid = false;
    }

} else {
    console.error("Google Analytics client NOT initialized due to missing environment variables.");
}

const getSiteVisits = async (req: Request, res: Response): Promise<void> => {
    // Check if user has connected Google Analytics
    const userId = (req as any).user._id;
    const user = await User.findById(userId);
    
    if (!user?.googleAnalyticsConnected || !user?.googleAnalyticsAccessToken) {
        console.log(`User ${userId} has not connected Google Analytics or missing access token`);
        console.log('User GA status:', {
            connected: user?.googleAnalyticsConnected,
            hasToken: !!user?.googleAnalyticsAccessToken,
            hasPropertyId: !!user?.googleAnalyticsPropertyId
        });
        res.status(401).json({ error: 'Google Analytics not connected' });
        return;
    }

    // Use the user's own GA property ID instead of hardcoded service account
    const userPropertyId = user.googleAnalyticsPropertyId;
    if (!userPropertyId) {
        console.error(`User ${userId} has no GA property ID configured`);
        res.status(400).json({ 
            error: 'Google Analytics property ID not configured',
            message: 'Please provide your GA4 Property ID in the settings. You can find this in your Google Analytics account under Admin > Property Settings.',
            needsPropertyId: true
        });
        return;
    }

    console.log(`Using user's GA property ID: ${userPropertyId}`);

    // Create OAuth2 client with user's access token
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    // Set the user's access token
    oauth2Client.setCredentials({
        access_token: user.googleAnalyticsAccessToken,
        refresh_token: user.googleAnalyticsRefreshToken
    });

    // Create analytics client with user's credentials
    const userAnalyticsData = google.analyticsdata({
        version: 'v1beta',
        auth: oauth2Client
    });

    const { postTimestamp } = req.query;
    let startDate, endDate;

    if (postTimestamp) {
        // If post timestamp is provided, get visits from that time until now
        startDate = new Date(postTimestamp as string).toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
    } else {
        // Default to last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday.toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
    }

    console.log(`Requesting GA4 data for user property: ${userPropertyId} for date range: ${startDate} to ${endDate}`);

    try {
        const response = await userAnalyticsData.properties.runReport({
            property: `properties/${userPropertyId}`,
            requestBody: {
                dateRanges: [{
                    startDate,
                    endDate
                }],
                metrics: [
                    { name: 'screenPageViews' },
                    { name: 'newUsers' },
                    { name: 'eventCount' }
                ],
                dimensions: [
                    { name: 'date' },
                    { name: 'hour' }
                ]
            }
        });

        if (!response.data.rows) {
            console.log('No data returned from GA4');
            res.json({ 
                pageViews: 0,
                newUsers: 0,
                eventCount: 0,
                hourlyData: []
            });
            return;
        }

        // Process the data
        const hourlyData = response.data.rows.map((row: any) => ({
            date: row.dimensionValues[0].value,
            hour: row.dimensionValues[1].value,
            pageViews: parseInt(row.metricValues[0].value) || 0,
            newUsers: parseInt(row.metricValues[1].value) || 0,
            eventCount: parseInt(row.metricValues[2].value) || 0
        }));

        // Calculate totals
        const totals = hourlyData.reduce((acc: any, curr: any) => ({
            pageViews: acc.pageViews + curr.pageViews,
            newUsers: acc.newUsers + curr.newUsers,
            eventCount: acc.eventCount + curr.eventCount
        }), { pageViews: 0, newUsers: 0, eventCount: 0 });

        console.log(`Successfully fetched GA4 data from user's property. Page Views: ${totals.pageViews}, New Users: ${totals.newUsers}, Events: ${totals.eventCount}`);
        
        res.json({ 
            pageViews: totals.pageViews,
            newUsers: totals.newUsers,
            eventCount: totals.eventCount,
            hourlyData
        });

    } catch (error: any) {
        console.error('Error fetching GA4 data:', error.message);
        if (error.response?.data?.error) {
             console.error('Google API Error Details:', JSON.stringify(error.response.data.error, null, 2));
        } else if (error.errors) {
             console.error('Google API Error Details:', JSON.stringify(error.errors, null, 2));
        }

        if (!res.headersSent) {
            res.status(500).json({
                 error: 'Failed to fetch site visits from GA4',
                 details: error.response?.data?.error?.message || error.message || 'Check server logs for details.'
            });
        }
    }
};

interface GoogleAnalyticsTokenResponse {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

const connectGoogleAnalytics = async (req: Request, res: Response): Promise<void> => {
  const { code, userId } = req.body;

  if (!code || !userId) {
    res.status(400).json({ error: 'Missing code or userId' });
    return;
  }

  try {
    console.log('Starting Google Analytics auth process with:', { 
      code: code.substring(0, 10) + '...',
      userId,
      redirectUri: process.env.GOOGLE_REDIRECT_URI
    });

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    console.log('Making token exchange request with Google credentials');

    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('Token exchange response:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      scope: tokens.scope,
      expiryDate: tokens.expiry_date
    });

    // Set the tokens to get user's GA properties
    oauth2Client.setCredentials(tokens);

    // For Google Analytics Data API, we need the user to provide their property ID
    // The Data API doesn't list properties - it queries data from a specific property
    // We'll store the tokens and let the user provide their property ID
    
    // Find user first to verify they exist
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found:', userId);
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Store the OAuth tokens for future use with the Data API
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          googleAnalyticsAccessToken: tokens.access_token,
          googleAnalyticsRefreshToken: tokens.refresh_token,
          googleAnalyticsPropertyId: null, // User will need to provide this
          googleAnalyticsConnected: true
        }
      },
      { new: true }
    );

    console.log('Updated user with GA credentials:', {
      userId,
      hasGAToken: !!updatedUser?.googleAnalyticsAccessToken,
      hasGARefreshToken: !!updatedUser?.googleAnalyticsRefreshToken,
      gaPropertyId: updatedUser?.googleAnalyticsPropertyId
    });

    res.json({ 
      success: true,
      googleAnalyticsConnected: true,
      message: 'Google Analytics connected successfully. Please provide your GA4 Property ID in settings.',
      needsPropertyId: true
    });
  } catch (error: any) {
    console.error('Google Analytics auth error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json({ 
      error: 'Failed to authenticate with Google Analytics',
      details: error.message 
    });
  }
};

const updateGoogleAnalyticsPropertyId = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user._id;
        const { propertyId } = req.body;

        if (!propertyId) {
            res.status(400).json({ error: 'Property ID is required' });
            return;
        }

        // Validate property ID format (GA4 property IDs are numeric strings)
        if (!/^\d+$/.test(propertyId)) {
            res.status(400).json({ 
                error: 'Invalid property ID format',
                message: 'GA4 Property IDs should be numeric (e.g., 484268560)'
            });
            return;
        }

        // Update user's property ID
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { googleAnalyticsPropertyId: propertyId },
            { new: true }
        );

        if (!updatedUser) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        console.log(`Updated user ${userId} with GA property ID: ${propertyId}`);

        res.json({ 
            success: true,
            message: 'Google Analytics property ID updated successfully',
            propertyId: propertyId
        });

    } catch (error: any) {
        console.error('Error updating GA property ID:', error);
        res.status(500).json({ 
            error: 'Failed to update Google Analytics property ID',
            details: error.message 
        });
    }
};

export default { getSiteVisits, connectGoogleAnalytics, updateGoogleAnalyticsPropertyId };