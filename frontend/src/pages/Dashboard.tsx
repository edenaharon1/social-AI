import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Instagram, BarChart3, TrendingUp, Users, Heart, MessageCircle, Eye, RefreshCw, LogOut, Settings, Sparkles } from 'lucide-react';
import { SettingsDialog } from '@/components/ui/settings-dialog';
import { PostCreationModal } from '@/components/ui/post-creation-modal';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardAPI, SiteVisitsData, InstagramStats, ContentSuggestion, InstagramPost } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ImageWithFallback } from '@/lib/imageUtils';

// Mock data for when accounts aren't connected
const mockSiteVisits: SiteVisitsData = {
  pageViews: 2847,
  newUsers: 892,
  eventCount: 5673,
  hourlyData: [
    { date: '2024-01-15', hour: '09:00', pageViews: 234, newUsers: 67, eventCount: 456 },
    { date: '2024-01-15', hour: '10:00', pageViews: 289, newUsers: 89, eventCount: 567 },
    { date: '2024-01-15', hour: '11:00', pageViews: 312, newUsers: 98, eventCount: 623 },
    { date: '2024-01-15', hour: '12:00', pageViews: 298, newUsers: 87, eventCount: 589 },
    { date: '2024-01-15', hour: '13:00', pageViews: 345, newUsers: 112, eventCount: 678 },
    { date: '2024-01-15', hour: '14:00', pageViews: 267, newUsers: 78, eventCount: 523 },
    { date: '2024-01-15', hour: '15:00', pageViews: 189, newUsers: 54, eventCount: 378 },
  ]
};

// Enhanced mock data for better GA visualization
const mockTrafficData = [
  { name: 'Mon', visits: 234, pageviews: 567 },
  { name: 'Tue', visits: 289, pageviews: 723 },
  { name: 'Wed', visits: 312, pageviews: 845 },
  { name: 'Thu', visits: 298, pageviews: 789 },
  { name: 'Fri', visits: 345, pageviews: 912 },
  { name: 'Sat', visits: 267, pageviews: 634 },
  { name: 'Sun', visits: 189, pageviews: 456 },
];

const mockInstagramStats: InstagramStats = {
  totalPosts: 24,
  totalLikes: 2847,
  totalComments: 456,
  averageLikes: 118.6,
  averageComments: 19.0,
  dailyStats: [
    { date: '2024-01-10', likes: 45, comments: 8, posts: 1 },
    { date: '2024-01-11', likes: 67, comments: 12, posts: 1 },
    { date: '2024-01-12', likes: 89, comments: 15, posts: 2 },
    { date: '2024-01-13', likes: 123, comments: 21, posts: 1 },
    { date: '2024-01-14', likes: 156, comments: 28, posts: 2 },
    { date: '2024-01-15', likes: 134, comments: 24, posts: 1 },
    { date: '2024-01-16', likes: 98, comments: 18, posts: 1 },
  ]
};

const mockContentSuggestions: ContentSuggestion[] = [
  {
    _id: 'mock-1',
    title: 'Spring Nail Art Collection',
    content: "🌸 Spring is here! Our new nail art collection features delicate florals and pastel colors. Perfect for the season! Book your appointment today and get 15% off your first visit. #springnails #nailart #beauty #manicure",
    hashtags: ['springnails', 'nailart', 'beauty', 'manicure', 'spring'],
    imageUrls: ['https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=400&fit=crop'],
    contentType: 'Promotional',
    refreshed: false,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'mock-2',
    title: 'Self-Care Sunday Special',
    content: "💅 Self-care isn't selfish, it's essential! Treat yourself to our luxurious pedicure treatment this Sunday. Relax, rejuvenate, and leave feeling refreshed. Limited time offer - book now! #selfcare #pedicure #relaxation #sundayvibes",
    hashtags: ['selfcare', 'pedicure', 'relaxation', 'sundayvibes', 'wellness'],
    imageUrls: ['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=400&fit=crop'],
    contentType: 'Engagement',
    refreshed: false,
    createdAt: new Date().toISOString()
  },
  {
    _id: 'mock-3',
    title: 'Trend Alert: Geometric Nails',
    content: "🔺 Geometric nail art is trending! Clean lines, bold shapes, and modern vibes. Which design catches your eye? Comment below with your favorite! #geometricnails #nailtrends #modernnails #naildesign #trending",
    hashtags: ['geometricnails', 'nailtrends', 'modernnails', 'naildesign', 'trending'],
    imageUrls: ['https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=400&fit=crop'],
    contentType: 'Trending',
    refreshed: false,
    createdAt: new Date().toISOString()
  }
];

const engagementData = [
  { name: 'Week 1', likes: 240, comments: 45 },
  { name: 'Week 2', likes: 320, comments: 67 },
  { name: 'Week 3', likes: 180, comments: 32 },
  { name: 'Week 4', likes: 450, comments: 89 },
];

const Dashboard = () => {
  const { user, logout, instagramConnected, googleAnalyticsConnected, updateConnectionStatus, refreshConnectionStatus } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("business");
  const [siteVisits, setSiteVisits] = useState<SiteVisitsData | null>(null);
  const [instagramStats, setInstagramStats] = useState<InstagramStats | null>(null);
  const [contentSuggestions, setContentSuggestions] = useState<ContentSuggestion[]>([]);
  const [topInstagramPosts, setTopInstagramPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true); // Reverted back to true
  const [error, setError] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ContentSuggestion | null>(null);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [isUsingInstagramEnhanced, setIsUsingInstagramEnhanced] = useState(false);
  const [isGoogleAnalyticsConnected, setIsGoogleAnalyticsConnected] = useState(googleAnalyticsConnected);
  const [isInstagramConnected, setIsInstagramConnected] = useState(instagramConnected);

  // Refresh connection status when component mounts
  useEffect(() => {
    refreshConnectionStatus();
  }, []);

  // Update local state when AuthContext connection status changes
  useEffect(() => {
    setIsGoogleAnalyticsConnected(googleAnalyticsConnected);
    setIsInstagramConnected(instagramConnected);
  }, [googleAnalyticsConnected, instagramConnected]);

  const fetchDashboardData = async () => {
    setLoading(true); // Reverted back to using main loading state
    setError(null);
    
    try {
      console.log('Fetching dashboard data...');
      
      // Refresh connection status from server first
      await refreshConnectionStatus();
      
      // Get updated connection status from AuthContext
      const currentInstagramConnected = instagramConnected;
      const currentGoogleAnalyticsConnected = googleAnalyticsConnected;
      
      console.log('Current connection status after refresh:', { 
        instagramConnected: currentInstagramConnected, 
        googleAnalyticsConnected: currentGoogleAnalyticsConnected 
      });
      
      // Update local state to match AuthContext
      setIsGoogleAnalyticsConnected(currentGoogleAnalyticsConnected);
      setIsInstagramConnected(currentInstagramConnected);

      // Only call Instagram endpoints if Instagram is connected
      const promises = [
        currentGoogleAnalyticsConnected ? dashboardAPI.getSiteVisits() : Promise.reject(new Error('Google Analytics not connected')),
        currentInstagramConnected ? dashboardAPI.getInstagramStats() : Promise.reject(new Error('Instagram not connected')),
        currentInstagramConnected ? dashboardAPI.getContentSuggestions() : Promise.reject(new Error('Instagram not connected')),
        currentInstagramConnected ? dashboardAPI.getTopInstagramPosts() : Promise.reject(new Error('Instagram not connected'))
      ];

      console.log('Making API calls...');
      console.log('Google Analytics connected:', currentGoogleAnalyticsConnected);
      console.log('Instagram connected:', currentInstagramConnected);
      
      const [visitsData, instagramData, suggestionsData, topPostsData] = await Promise.allSettled(promises);
      console.log('API calls completed');
      console.log('Visits data result:', visitsData);
      console.log('Instagram data result:', instagramData);
      console.log('Suggestions data result:', suggestionsData);
      console.log('Top posts data result:', topPostsData);

      // Log detailed Instagram data analysis
      if (currentInstagramConnected) {
        console.log('Instagram connection status: CONNECTED');
        console.log('Instagram data status:', instagramData.status);
        if (instagramData.status === 'fulfilled') {
          console.log('Instagram data fulfilled:', instagramData.value);
          const instagramValue = instagramData.value as InstagramStats;
          console.log('Has totalPosts property:', 'totalPosts' in (instagramValue || {}));
          console.log('Total posts value:', instagramValue?.totalPosts);
        } else if (instagramData.status === 'rejected') {
          console.log('Instagram data rejected:', instagramData.reason);
        }
        
        console.log('Top posts data status:', topPostsData.status);
        if (topPostsData.status === 'fulfilled') {
          console.log('Top posts data fulfilled:', topPostsData.value);
          const topPostsValue = topPostsData.value as { posts: InstagramPost[] };
          console.log('Has posts property:', 'posts' in (topPostsValue || {}));
          console.log('Posts array:', topPostsValue?.posts);
          console.log('Posts array length:', topPostsValue?.posts?.length);
        } else if (topPostsData.status === 'rejected') {
          console.log('Top posts data rejected:', topPostsData.reason);
        }
      } else {
        console.log('Instagram connection status: NOT CONNECTED');
      }

      // Use real data if available, otherwise use mock data
      let usingMockData = false;
      
      if (currentGoogleAnalyticsConnected && visitsData.status === 'fulfilled' && visitsData.value && 'pageViews' in visitsData.value) {
        setSiteVisits(visitsData.value as SiteVisitsData);
        console.log('Using real site visits data:', visitsData.value);
      } else {
        setSiteVisits(mockSiteVisits);
        usingMockData = true;
        console.log('Using mock site visits data');
      }

      if (currentInstagramConnected && instagramData.status === 'fulfilled' && instagramData.value && 'totalPosts' in instagramData.value) {
        setInstagramStats(instagramData.value as InstagramStats);
        console.log('Using real Instagram stats:', instagramData.value);
      } else {
        setInstagramStats(mockInstagramStats);
        usingMockData = true;
        console.log('Using mock Instagram stats');
      }

      if (currentInstagramConnected && suggestionsData.status === 'fulfilled' && suggestionsData.value && Array.isArray(suggestionsData.value) && suggestionsData.value.length > 0) {
        setContentSuggestions(suggestionsData.value as ContentSuggestion[]);
        setIsUsingInstagramEnhanced(true);
        console.log('Using Instagram-enhanced suggestions');
      } else {
        // If Instagram is not connected, try to get business profile suggestions
        try {
          console.log('Trying to get business profile suggestions...');
          const businessSuggestions = await dashboardAPI.getBusinessSuggestions();
          if (businessSuggestions && businessSuggestions.length > 0) {
            setContentSuggestions(businessSuggestions);
            setIsUsingInstagramEnhanced(false);
            console.log('Using business profile suggestions');
          } else {
            setContentSuggestions(mockContentSuggestions);
            usingMockData = true;
            setIsUsingInstagramEnhanced(false);
            console.log('Using mock content suggestions');
          }
        } catch (err) {
          console.log('Instagram not connected, using business profile suggestions');
          setContentSuggestions(mockContentSuggestions);
          usingMockData = true;
          setIsUsingInstagramEnhanced(false);
        }
      }

      if (currentInstagramConnected && topPostsData.status === 'fulfilled' && topPostsData.value && 'posts' in topPostsData.value && Array.isArray(topPostsData.value.posts)) {
        setTopInstagramPosts((topPostsData.value as { posts: InstagramPost[] }).posts.slice(0, 3)); // Get top 3 posts
        console.log('Using real top Instagram posts:', topPostsData.value.posts.length, 'posts found');
      } else {
        setTopInstagramPosts([]);
        console.log('No top Instagram posts available');
      }
      
      setIsUsingMockData(usingMockData);
      console.log('Dashboard data fetch completed successfully');
    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while loading dashboard data');
      // Use mock data on error
      setSiteVisits(mockSiteVisits);
      setInstagramStats(mockInstagramStats);
      setContentSuggestions(mockContentSuggestions);
      setTopInstagramPosts([]);
      setIsUsingMockData(true);
      setIsGoogleAnalyticsConnected(false);
      setIsInstagramConnected(false);
    } finally {
      setLoading(false); // Set new loading state to false
    }
  };

  const handleRefreshSuggestion = async (suggestionId: string) => {
    try {
      const refreshedSuggestion = await dashboardAPI.refreshSuggestion(suggestionId);
      setContentSuggestions(prev => 
        prev.map(suggestion => 
          suggestion._id === suggestionId ? refreshedSuggestion : suggestion
        )
      );
      toast({
        title: "Success",
        description: "Suggestion refreshed successfully!",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to refresh suggestion",
        variant: "destructive",
      });
    }
  };

  const handleUseSuggestion = (suggestion: ContentSuggestion) => {
    if (!isInstagramConnected) {
      toast({
        title: "Instagram Not Connected",
        description: "Please connect your Instagram account first to create posts.",
        variant: "destructive",
      });
      return;
    }
    setSelectedSuggestion(suggestion);
    setPostModalOpen(true);
  };

  const handlePostCreated = () => {
    // Refresh dashboard data after posting
    fetchDashboardData();
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Safety check - ensure we have data to display
  const safeSiteVisits = siteVisits || mockSiteVisits;
  const safeInstagramStats = instagramStats || mockInstagramStats;
  const safeContentSuggestions = contentSuggestions || mockContentSuggestions;

  // Transform data for charts
  const engagementData = safeInstagramStats?.dailyStats?.slice(-7).map(day => ({
    name: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    likes: day.likes,
    comments: day.comments
  })) || [];

  // Use real traffic data if GA is connected, otherwise use mock data
  const trafficData = isGoogleAnalyticsConnected && safeSiteVisits && safeSiteVisits.hourlyData
    ? (safeSiteVisits.hourlyData.length > 0 
        ? safeSiteVisits.hourlyData.slice(-7).map(hour => ({
            name: `${hour.date} ${hour.hour}:00`,
            visits: hour.newUsers,
            pageviews: hour.pageViews
          }))
        : [] // Show empty data when GA is connected but has no data
      )
    : mockTrafficData; // Only use mock data when GA is not connected

  // Early return for loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchDashboardData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-primary/5 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Mock Data Banner */}
        {(!isGoogleAnalyticsConnected || !isInstagramConnected) && (
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Connect Your Accounts</h3>
                  <p className="text-white/80 text-sm">
                    {!isGoogleAnalyticsConnected && !isInstagramConnected 
                      ? "Connect your Instagram and Google Analytics accounts to see your real data."
                      : !isGoogleAnalyticsConnected 
                      ? "Connect your Google Analytics account to see your website traffic data."
                      : "Connect your Instagram account to see your social media performance data."
                    }
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-white/30 text-white bg-white/10 hover:bg-white/20 hover:text-white backdrop-blur-sm"
                onClick={() => {
                  setSettingsTab("social");
                  setSettingsOpen(true);
                }}
              >
                {!isGoogleAnalyticsConnected && !isInstagramConnected 
                  ? "Connect Accounts"
                  : !isGoogleAnalyticsConnected 
                  ? "Connect Google Analytics"
                  : "Connect Instagram"
                }
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Social Dashboard
            </h1>
            <p className="text-muted-foreground">Manage your social presence with AI-powered insights</p>
          </div>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/post-generator')}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI Chat
            </Button>
            
            {/* Debug button for testing connection status persistence */}
            {process.env.NODE_ENV === 'development' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={async () => {
                  try {
                    await dashboardAPI.testConnectionStatus();
                    toast({
                      title: "Debug Info",
                      description: "Check console for connection status test results",
                    });
                  } catch (error) {
                    console.error('Error testing connection status:', error);
                    toast({
                      title: "Debug Error",
                      description: "Error testing connection status",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Test Connection Status
              </Button>
            )}
            
            {/* Debug button for testing API connectivity */}
            {process.env.NODE_ENV === 'development' && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={async () => {
                  try {
                    await dashboardAPI.testAPIConnectivity();
                    toast({
                      title: "API Test Success",
                      description: "API connectivity test passed",
                    });
                  } catch (error: unknown) {
                    console.error('API connectivity test failed:', error);
                    const errorMessage = error instanceof Error ? error.message : "API connectivity test failed";
                    toast({
                      title: "API Test Failed",
                      description: errorMessage,
                      variant: "destructive",
                    });
                  }
                }}
              >
                Test API Connectivity
              </Button>
            )}
            
            <SettingsDialog 
              open={settingsOpen} 
              onOpenChange={setSettingsOpen}
              initialTab={settingsTab}
              isGoogleAnalyticsConnected={isGoogleAnalyticsConnected}
              isInstagramConnected={isInstagramConnected}
            />
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                logout();
                navigate('/');
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-primary rounded-lg">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Likes</p>
                <p className="text-2xl font-bold">{safeInstagramStats?.totalLikes || 0}</p>
                <p className="text-xs text-green-600">+{Math.round((safeInstagramStats?.averageLikes || 0) * 100) / 100} avg</p>
                {!isInstagramConnected && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    Demo Data
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-secondary rounded-lg">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comments</p>
                <p className="text-2xl font-bold">{safeInstagramStats?.totalComments || 0}</p>
                <p className="text-xs text-green-600">+{Math.round((safeInstagramStats?.averageComments || 0) * 100) / 100} avg</p>
                {!isInstagramConnected && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    Demo Data
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-primary rounded-lg">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Site Visits</p>
                <p className="text-2xl font-bold">{safeSiteVisits?.pageViews || 0}</p>
                <p className="text-xs text-green-600">+{safeSiteVisits?.newUsers || 0} new users</p>
                {!isGoogleAnalyticsConnected && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    Demo Data
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-secondary rounded-lg">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Posts</p>
                <p className="text-2xl font-bold">{safeInstagramStats?.totalPosts || 0}</p>
                <p className="text-xs text-green-600">Last 30 days</p>
                {!isInstagramConnected && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    Demo Data
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Engagement Overview
              {!isInstagramConnected && (
                <Badge variant="secondary" className="text-xs">
                  Demo
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Your social media engagement trends over the past month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Bar dataKey="likes" fill="hsl(var(--primary))" radius={4} />
                <Bar dataKey="comments" fill="hsl(var(--accent))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Website Traffic
              {!isGoogleAnalyticsConnected && (
                <Badge variant="secondary" className="text-xs">
                  Demo
                </Badge>
              )}
              {isGoogleAnalyticsConnected && trafficData.length === 0 && (
                <Badge variant="outline" className="text-xs">
                  No Data
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isGoogleAnalyticsConnected && trafficData.length === 0 
                ? "No traffic data available for the selected time period"
                : "Google Analytics data for the past week"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isGoogleAnalyticsConnected && trafficData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No traffic data available</p>
                  <p className="text-xs">Your Google Analytics account is connected but has no data for this time period.</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trafficData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Line type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={3} />
                  <Line type="monotone" dataKey="pageviews" stroke="hsl(var(--accent))" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Instagram Posts */}
      {topInstagramPosts.length > 0 && (
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5 text-primary" />
              Top Instagram Posts (Last 30 Days)
              {!isInstagramConnected && (
                <Badge variant="secondary" className="text-xs">
                  Demo
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Your most engaging posts from the past month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {topInstagramPosts.map((post, index) => (
                <div key={post.id} className="bg-background rounded-lg p-4 shadow-sm border">
                  <div className="aspect-square bg-gradient-secondary rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                    <ImageWithFallback 
                      src={post.media_url} 
                      alt={post.caption?.substring(0, 50) || `Instagram post ${index + 1}`} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {post.caption || "No caption"}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {post.like_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {post.comments_count || 0}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Post Suggestions */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xl">AI-Generated Post Suggestions</span>
            {!isInstagramConnected && (
              <Badge variant="secondary" className="text-xs">
                Demo
              </Badge>
            )}
            {isUsingInstagramEnhanced && (
              <Badge variant="default" className="text-xs">
                <Instagram className="w-3 h-3 mr-1" />
                Instagram Enhanced
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isUsingInstagramEnhanced 
              ? "Personalized content ideas based on your business settings AND your Instagram performance data"
              : "Personalized content ideas based on your business type and audience preferences"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && safeContentSuggestions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Generating AI suggestions...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {safeContentSuggestions.map((suggestion) => (
              <div key={suggestion._id} className="bg-background rounded-lg p-4 shadow-sm border">
                <div className="aspect-square bg-gradient-secondary rounded-lg mb-4 flex items-center justify-center">
                  {suggestion.imageUrls && suggestion.imageUrls.length > 0 ? (
                    <ImageWithFallback 
                      src={suggestion.imageUrls[0]} 
                      alt="AI Generated" 
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <span className="text-primary font-semibold">AI Generated Image</span>
                  )}
                </div>
                <h4 className="font-semibold mb-2">{suggestion.title}</h4>
                <p className="text-sm mb-3">{suggestion.content}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {suggestion.hashtags.map((tag, index) => (
                    <span key={index} className="text-xs text-muted-foreground">#{tag}</span>
                  ))}
                </div>
                <div className="flex justify-between items-center">
                  <Badge variant="secondary">
                    {suggestion.contentType} Content
                  </Badge>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleRefreshSuggestion(suggestion._id)}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Refresh
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleUseSuggestion(suggestion)}
                    >
                      Use This Suggestion
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>

      {/* Post Creation Modal */}
      <PostCreationModal
        open={postModalOpen}
        onOpenChange={setPostModalOpen}
        suggestion={selectedSuggestion}
        onPostCreated={handlePostCreated}
      />
      </div>
    </div>
  );
};

export default Dashboard;