# Instagram OAuth Setup Guide

## Problem: "Invalid platform app" Error

The "Invalid platform app" error occurs when there's a mismatch between your Instagram app configuration and the OAuth request parameters.

## Root Causes

1. **Redirect URI Mismatch**: The redirect URI in your OAuth request doesn't match what's configured in the Meta Developer Console
2. **App Configuration**: The Instagram app is not properly configured for your production domain
3. **Environment Variables**: Missing or incorrect environment variables
4. **API Type Mismatch**: Using Business API scopes with Basic Display API configuration (or vice versa)

## Solution Steps

### 1. Meta Developer Console Configuration

1. Go to [Meta Developer Console](https://developers.facebook.com/)
2. Find your Instagram app (ID: `665994033060068`)
3. Navigate to **Instagram Basic Display** → **Basic Display** → **Client OAuth Settings**
4. Add the following redirect URIs:
   - `https://aisocial.dev/instagram-callback.html` (production)
   - `http://localhost:3000/instagram-callback.html` (development)
5. Save the changes

### 2. Environment Variables Setup

#### Frontend (.env file in new-frontend/elevate-social-kit-main/)
```env
# API Configuration
VITE_API_BASE_URL=https://aisocial.dev

# Instagram OAuth Configuration
VITE_INSTAGRAM_CLIENT_ID=665994033060068

# API Type Configuration (choose one)
# For Basic Display API (default):
VITE_USE_INSTAGRAM_BUSINESS_API=false

# For Business API:
# VITE_USE_INSTAGRAM_BUSINESS_API=true
```

#### Backend (.env file in backend/)
```env
# Instagram OAuth Configuration
INSTAGRAM_CLIENT_ID=665994033060068
INSTAGRAM_REDIRECT_URI=https://aisocial.dev/instagram-callback.html
META_APP_SECRET=your_meta_app_secret_here

# For development, you might also want:
# INSTAGRAM_REDIRECT_URI=http://localhost:3000/instagram-callback.html
```

### 3. API Type Configuration

The code now supports both Instagram API types:

#### Instagram Basic Display API (Default)
- **Scopes**: `user_profile,user_media`
- **Use Case**: Read user profile and media
- **Configuration**: Set `VITE_USE_INSTAGRAM_BUSINESS_API=false` or omit the variable

#### Instagram Business API
- **Scopes**: `instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights`
- **Use Case**: Post content, manage business features
- **Configuration**: Set `VITE_USE_INSTAGRAM_BUSINESS_API=true`

**Important**: Your app must be configured for the correct API type in Meta Developer Console.

### 4. Verify App Status

1. In Meta Developer Console, ensure your app is in **Live** mode (not Development)
2. Check that the app has the necessary permissions for your chosen API type
3. Verify the app is approved for the correct Instagram API

### 5. Test the Configuration

1. **Development Testing**:
   - Use `http://localhost:3000/instagram-callback.html` as redirect URI
   - Test the OAuth flow locally

2. **Production Testing**:
   - Use `https://aisocial.dev/instagram-callback.html` as redirect URI
   - Ensure the callback file exists at the correct path

### 6. Common Issues and Fixes

#### Issue: "Invalid platform app"
- **Cause**: Redirect URI mismatch or API type mismatch
- **Fix**: Update redirect URIs in Meta Developer Console and ensure correct API configuration

#### Issue: "App not in live mode"
- **Cause**: App is in development mode
- **Fix**: Switch app to live mode in Meta Developer Console

#### Issue: "Invalid client_id"
- **Cause**: Wrong client ID or app not configured
- **Fix**: Verify client ID and app configuration

#### Issue: "Missing permissions"
- **Cause**: App doesn't have required scopes for the chosen API type
- **Fix**: Add required scopes based on your API choice

### 7. Debugging Steps

1. **Check Browser Console**: Look for any JavaScript errors
2. **Check Network Tab**: Verify the OAuth request URL and scopes
3. **Check Backend Logs**: Look for authentication errors
4. **Verify Environment Variables**: Ensure all required variables are set
5. **Verify API Type**: Ensure your app is configured for the correct Instagram API

### 8. Production Checklist

- [ ] App is in Live mode
- [ ] Production redirect URI is configured (`https://aisocial.dev/instagram-callback.html`)
- [ ] Environment variables are set correctly
- [ ] Callback file exists at the correct path
- [ ] HTTPS is enabled (required for production)
- [ ] App has necessary permissions for chosen API type
- [ ] Client ID matches in frontend and backend
- [ ] API type configuration matches app setup

## Code Changes Made

The following files have been updated to use environment variables and support both API types:

1. `new-frontend/elevate-social-kit-main/src/pages/Onboarding.tsx`
2. `new-frontend/elevate-social-kit-main/src/components/ui/settings-dialog.tsx`
3. `backend/src/routes/auth_routes.ts`

These changes allow for better configuration management and easier deployment to different environments.

## Current Issue Resolution

Based on the OAuth URL you provided, you're currently using Business API scopes but your app might be configured for Basic Display API. To fix this:

1. **Option A**: Keep using Business API
   - Set `VITE_USE_INSTAGRAM_BUSINESS_API=true` in your frontend environment
   - Ensure your app is configured for Instagram Business API in Meta Developer Console

2. **Option B**: Switch to Basic Display API
   - Set `VITE_USE_INSTAGRAM_BUSINESS_API=false` or omit the variable
   - Ensure your app is configured for Instagram Basic Display API in Meta Developer Console
