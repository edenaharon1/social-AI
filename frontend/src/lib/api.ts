import axios from 'axios';

// Define the base URL for API requests
// Use a subdomain for API calls to avoid routing conflicts
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? "http://localhost:3000" : "https://api.aisocial.dev");

console.log('API Base URL configured as:', BASE_URL);
console.log('Environment variable VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
console.log('Environment mode:', import.meta.env.MODE);
console.log('Is development:', import.meta.env.DEV);

// Create axios instance with default config
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      if (userData.token) {
        config.headers.Authorization = `Bearer ${userData.token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    // Check if we're getting HTML instead of JSON (wrong endpoint)
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('text/html') && !response.config.url?.includes('/uploads')) {
      console.error('Received HTML response instead of JSON. This usually means the API endpoint is wrong.');
      console.error('Response URL:', response.config.url);
      console.error('Response status:', response.status);
      console.error('Expected API endpoint, but got HTML page');
      
      // Throw a more descriptive error
      const error = new Error('API endpoint returned HTML instead of JSON. Please check the API configuration.');
      error.name = 'HTMLResponseError';
      throw error;
    }
    return response;
  },
  (error) => {
    // Check if we're getting HTML error responses
    if (error.response?.headers?.['content-type']?.includes('text/html')) {
      console.error('Received HTML error response. This usually means the API endpoint is wrong.');
      console.error('Error URL:', error.config?.url);
      console.error('Error status:', error.response?.status);
      
      // Provide a more helpful error message
      error.message = 'API endpoint returned HTML error page. Please check the API configuration and ensure the backend server is running.';
    }
    
    // Only redirect on 401 Unauthorized for auth-related endpoints
    // Don't log out user for 401 errors on other endpoints (like Instagram when not connected)
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/');
      
      if (isAuthEndpoint) {
        console.log('Auth endpoint returned 401, logging out user');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        console.log('Non-auth endpoint returned 401, not logging out user:', url);
      }
    }
    return Promise.reject(error);
  }
);

// Types for API responses
export interface LoginResponse {
  token: string;
  RegisteredUser: {
    id: string;
    username: string;
    email: string;
  };
}

export interface RegisterResponse {
  message: string;
  RegisteredUser: {
    id: string;
    username: string;
    email: string;
  };
}

export interface SiteVisitsData {
  pageViews: number;
  newUsers: number;
  eventCount: number;
  hourlyData: Array<{
    date: string;
    hour: string;
    pageViews: number;
    newUsers: number;
    eventCount: number;
  }>;
}

export interface InstagramStats {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  averageLikes: number;
  averageComments: number;
  dailyStats: Array<{
    date: string;
    likes: number;
    comments: number;
    posts: number;
  }>;
}

export interface InstagramPost {
  id: string;
  caption?: string;
  media_type: string;
  media_url: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface ContentSuggestion {
  _id: string;
  title: string;
  content: string;
  hashtags: string[];
  imageUrls: string[];
  contentType: string;
  refreshed: boolean;
  createdAt: string;
}

export interface BusinessProfile {
  _id: string;
  userId: string;
  businessName: string;
  businessType: string;
  platforms: string[];
  contentTypes: string[];
  marketingGoals: string[];
  audienceType: string;
  toneOfVoice: string;
  postLength: "short" | "medium" | "long";
  mainColors: string[];
  emojisAllowed: boolean;
  favoriteEmojis: string[];
  hashtagsStyle: "none" | "fewRelevant" | "manyForReach";
  keywords: string;
  customHashtags: string;
}

// API functions
export const authAPI = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (username: string, email: string, password: string): Promise<RegisterResponse> => {
    const response = await api.post('/auth/register', { username, email, password });
    return response.data;
  },

  googleLogin: async (token: string): Promise<LoginResponse> => {
    const response = await api.post('/auth/google-login', { token });
    return response.data;
  },
};

export const dashboardAPI = {
  // Test API connectivity
  testAPIConnectivity: async (): Promise<void> => {
    console.log('Testing API connectivity...');
    console.log('Current API Base URL:', BASE_URL);
    
    const testEndpoints = [
      { path: '/auth/', name: 'Auth endpoint' },
      { path: '/users/me/connections', name: 'Users endpoint' },
      { path: '/ai/suggestions', name: 'AI suggestions endpoint' },
      { path: '/business-profile', name: 'Business profile endpoint' },
      { path: '/api/instagram/posts', name: 'Instagram endpoint' }
    ];
    
    for (const endpoint of testEndpoints) {
      try {
        console.log(`Testing ${endpoint.name} at ${endpoint.path}...`);
        const response = await api.get(endpoint.path);
        console.log(`${endpoint.name} response:`, response.status, response.data);
      } catch (error: unknown) {
        const axiosError = error as { response?: { status?: number; statusText?: string }; name?: string };
        console.error(`${endpoint.name} failed:`, axiosError.response?.status, axiosError.response?.statusText);
        if (axiosError.name === 'HTMLResponseError') {
          console.error('This endpoint is returning HTML instead of JSON');
        }
      }
    }
  },

  // Get user connection status
  getConnectionStatus: async (): Promise<{ instagramConnected: boolean; googleAnalyticsConnected: boolean }> => {
    const response = await api.get('/users/me/connections');
    return response.data;
  },

  // Test connection status persistence
  testConnectionStatus: async (): Promise<void> => {
    console.log('Testing connection status persistence...');
    
    // Get current status
    const status1 = await dashboardAPI.getConnectionStatus();
    console.log('Initial connection status:', status1);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get status again
    const status2 = await dashboardAPI.getConnectionStatus();
    console.log('Connection status after 1 second:', status2);
    
    // Check if status is consistent
    const isConsistent = status1.instagramConnected === status2.instagramConnected && 
                        status1.googleAnalyticsConnected === status2.googleAnalyticsConnected;
    
    console.log('Connection status consistency:', isConsistent);
    
    if (!isConsistent) {
      console.warn('Connection status is not consistent!');
    }
  },

  // Get site visits from Google Analytics
  getSiteVisits: async (postTimestamp?: string): Promise<SiteVisitsData> => {
    const params = postTimestamp ? { postTimestamp } : {};
    const response = await api.get('/analytics/site-visits', { params });
    return response.data;
  },

  // Get Instagram statistics
  getInstagramStats: async (): Promise<InstagramStats> => {
    const response = await api.get('/api/instagram/monthly');
    return response.data;
  },

  // Get content suggestions (Instagram-enhanced)
  getContentSuggestions: async (): Promise<ContentSuggestion[]> => {
    const response = await api.get('/ai/suggestions/user/me');
    return response.data;
  },

  // Get business profile content suggestions
  getBusinessSuggestions: async (): Promise<ContentSuggestion[]> => {
    const response = await api.get('/ai/suggestions');
    return response.data;
  },

  // Get top Instagram posts
  getTopInstagramPosts: async (): Promise<{ posts: InstagramPost[] }> => {
    const response = await api.get('/api/instagram/popular');
    return response.data;
  },

  // Refresh a content suggestion
  refreshSuggestion: async (suggestionId: string): Promise<ContentSuggestion> => {
    const response = await api.put(`/ai/suggestions/${suggestionId}/refresh`);
    return response.data;
  },

  // Update Google Analytics property ID
  updateGoogleAnalyticsPropertyId: async (propertyId: string): Promise<{ success: boolean; message: string; propertyId: string }> => {
    const response = await api.put('/analytics/google-analytics/property-id', { propertyId });
    return response.data;
  },
};

export const businessProfileAPI = {
  // Get business profile
  getBusinessProfile: async (): Promise<BusinessProfile> => {
    const response = await api.get('/business-profile');
    return response.data;
  },

  // Create or update business profile
  updateBusinessProfile: async (profileData: Partial<BusinessProfile>): Promise<BusinessProfile> => {
    const response = await api.put('/business-profile', profileData);
    return response.data;
  },
};

export const instagramAPI = {
  // Get Instagram posts
  getPosts: async (): Promise<unknown[]> => {
    const response = await api.get('/api/instagram/posts');
    return response.data.posts;
  },

  // Post to Instagram
  postToInstagram: async (caption: string, imageFile: File, scheduledAt?: string): Promise<unknown> => {
    const formData = new FormData();
    formData.append('caption', caption);
    formData.append('image', imageFile);
    if (scheduledAt) {
      formData.append('scheduledAt', scheduledAt);
    }
    
    console.log('Posting to Instagram with:', {
      caption,
      imageFile: imageFile.name,
      imageFileType: imageFile.type,
      imageFileSize: imageFile.size,
      scheduledAt
    });
    
    try {
      const response = await api.post('/api/instagram/post', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: unknown }; message?: string };
      console.error('Instagram post error:', axiosError.response?.data || axiosError.message);
      throw error;
    }
  },
};

export default api;
