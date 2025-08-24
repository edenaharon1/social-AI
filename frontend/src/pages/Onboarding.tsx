import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, ArrowLeft, Check, Loader2, Instagram, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { businessProfileAPI, dashboardAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: '',
    clientType: '',
    primaryColor: '',
    socialGoals: '',
    contentStyle: '',
    ga4PropertyId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [gaConnected, setGaConnected] = useState(false);
  
  const navigate = useNavigate();
  const { user, isLoggedIn, updateConnectionStatus, refreshConnectionStatus } = useAuth();
  const { toast } = useToast();
  const totalSteps = 6;
  const progress = (step / totalSteps) * 100;

  // Debug logging
  console.log('Onboarding - User from context:', user);
  console.log('Onboarding - Is logged in:', isLoggedIn);

  // Redirect if not logged in
  if (!isLoggedIn) {
    navigate('/login');
    return null;
  }

  const businessTypes = [
    'Beauty Salon / Nail Salon',
    'Restaurant / Cafe',
    'Fitness Studio',
    'Retail Store',
    'Professional Services',
    'Healthcare Practice',
    'Other'
  ];

  const clientTypes = [
    'Young Professionals (25-35)',
    'Millennials (25-40)',
    'Gen Z (18-25)', 
    'Middle-aged Adults (35-55)',
    'Seniors (55+)',
    'Mixed Age Groups'
  ];

  const contentStyles = [
    'Professional & Clean',
    'Fun & Trendy',
    'Luxurious & Premium',
    'Casual & Friendly',
    'Educational & Informative',
    'Creative & Artistic'
  ];

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Complete setup and save to backend
      await handleCompleteSetup();
    }
  };

  const handleCompleteSetup = async () => {
    // Get user from localStorage instead of context
    const userData = localStorage.getItem('user');
    console.log('User data from localStorage:', userData);
    
    if (!userData) {
      toast({
        title: "Error",
        description: "User not found. Please log in again.",
        variant: "destructive",
      });
      navigate('/login');
      return;
    }

    let userId;
    try {
      const parsedUser = JSON.parse(userData);
      console.log('Parsed user data:', parsedUser);
      userId = parsedUser.RegisteredUser?.id;
      console.log('User ID:', userId);
    } catch (error) {
      console.error('Error parsing user data:', error);
      toast({
        title: "Error",
        description: "Invalid user data. Please log in again.",
        variant: "destructive",
      });
      navigate('/login');
      return;
    }

    if (!userId) {
      toast({
        title: "Error",
        description: "User ID not found. Please log in again.",
        variant: "destructive",
      });
      navigate('/login');
      return;
    }

    setIsSubmitting(true);
    try {
      // Map content style to valid toneOfVoice enum values
      const getToneOfVoice = (contentStyle: string): string => {
        switch (contentStyle) {
          case 'Professional & Clean':
            return 'Professional';
          case 'Fun & Trendy':
            return 'Funny';
          case 'Luxurious & Premium':
            return 'Luxury';
          case 'Casual & Friendly':
            return 'Friendly';
          case 'Educational & Informative':
            return 'Professional';
          case 'Creative & Artistic':
            return 'Bold';
          default:
            return 'Professional';
        }
      };

      const profileData = {
        businessName: formData.businessName,
        businessType: formData.businessType,
        audienceType: formData.clientType,
        marketingGoals: [formData.socialGoals], // Convert to array as expected by model
        toneOfVoice: getToneOfVoice(formData.contentStyle),
        mainColors: [formData.primaryColor], // Save color as array
        keywords: `Target audience: ${formData.clientType}. Content style: ${formData.contentStyle}.`,
      };

      await businessProfileAPI.updateBusinessProfile(profileData);
      
      toast({
        title: "Success",
        description: "Business profile setup completed!",
      });
      
      navigate('/dashboard');
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save business profile",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Connection handlers
  const handleConnectInstagram = () => {
    // Instagram OAuth flow - Basic Display API
    const clientId = import.meta.env.VITE_INSTAGRAM_CLIENT_ID || '665994033060068'; // Instagram App ID
    const redirectUri = encodeURIComponent(`${window.location.origin}/instagram-callback.html`);
    
    // Choose API type based on environment variable
    const useBusinessAPI = import.meta.env.VITE_USE_INSTAGRAM_BUSINESS_API === 'true';
    
    let scope, authUrl;
    
    if (useBusinessAPI) {
      // Instagram Business API scopes
      scope = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights';
      authUrl = `https://www.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    } else {
      // Instagram Basic Display API scopes
      scope = 'user_profile,user_media';
      authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    }
    
    // Open Instagram auth in a popup
    const popup = window.open(authUrl, 'instagram-auth', 'width=500,height=600');
    
    // Create a one-time event listener
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'instagram-callback') {
        // Remove the listener
        window.removeEventListener('message', handleMessage);
        
        if (event.data.error) {
          toast({
            title: "Error",
            description: `Instagram connection failed: ${event.data.error}`,
            variant: "destructive",
          });
          popup?.close();
          return;
        }
        
        if (event.data.code) {
          try {
            // Send the code to our backend
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://aisocial.dev'}/auth/instagram/callback`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JSON.parse(localStorage.getItem('user') || '{}').token}`
              },
              body: JSON.stringify({ code: event.data.code })
            });
            
            if (response.ok) {
              toast({
                title: "Success",
                description: "Instagram connected successfully!",
              });
              
              // Refresh connection status from server to get the latest state
              await refreshConnectionStatus();
              
              // Update local state
              setInstagramConnected(true);
            } else {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to connect Instagram');
            }
          } catch (error) {
            console.error('Instagram connection error:', error);
            toast({
              title: "Error",
              description: `Failed to connect Instagram: ${error instanceof Error ? error.message : 'Unknown error'}`,
              variant: "destructive",
            });
          }
        }
        popup?.close();
      }
    };
    
    window.addEventListener('message', handleMessage);
  };

  const handleConnectGoogleAnalytics = () => {
    // Google Analytics OAuth flow
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id';
    const redirectUri = encodeURIComponent(`${window.location.origin}/ga-callback.html`);
    const scope = 'https://www.googleapis.com/auth/analytics.readonly';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    
    // Open Google auth in a popup
    const popup = window.open(authUrl, 'ga-auth', 'width=500,height=600');
    
    // Create a one-time event listener
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'ga-callback') {
        // Remove the listener
        window.removeEventListener('message', handleMessage);
        
        if (event.data.error) {
          toast({
            title: "Error",
            description: `Google Analytics connection failed: ${event.data.error}`,
            variant: "destructive",
          });
          popup?.close();
          return;
        }
        
        if (event.data.code) {
          try {
            // Send the code to our backend
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://aisocial.dev'}/analytics/google-analytics/callback`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userData.token}`
              },
              body: JSON.stringify({ 
                code: event.data.code,
                userId: userData.RegisteredUser?.id 
              })
            });
            
            if (response.ok) {
              toast({
                title: "Success",
                description: "Google Analytics connected successfully! Please provide your GA4 Property ID below.",
              });
              console.log('Google Analytics connection successful, updating status...');
              
              // Refresh connection status from server to get the latest state
              await refreshConnectionStatus();
              
              // Update local state
              setGaConnected(true);
            } else {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to connect Google Analytics');
            }
          } catch (error) {
            console.error('Google Analytics connection error:', error);
            toast({
              title: "Error",
              description: `Failed to connect Google Analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
              variant: "destructive",
            });
          }
        }
        popup?.close();
      }
    };
    
    window.addEventListener('message', handleMessage);
  };

  const handleUpdateGAPropertyId = async () => {
    if (!formData.ga4PropertyId) {
      toast({
        title: "Error",
        description: "Please enter your GA4 Property ID",
        variant: "destructive",
      });
      return;
    }

    try {
      await dashboardAPI.updateGoogleAnalyticsPropertyId(formData.ga4PropertyId);
      toast({
        title: "Success",
        description: "Google Analytics Property ID updated successfully!",
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update Google Analytics Property ID",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Set Up Your Social Profile</h1>
          <p className="text-white/80">Let's customize your social media management experience</p>
        </div>

        <div className="mb-6">
          <Progress value={progress} className="h-2 bg-white/20" />
          <p className="text-white/60 text-sm mt-2 text-center">Step {step} of {totalSteps}</p>
        </div>

        <Card className="bg-white/95 backdrop-blur-sm shadow-elegant border-0">
          <CardContent className="p-8">
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <CardTitle className="text-2xl mb-2">Tell us about your business</CardTitle>
                  <CardDescription>Basic information to get started</CardDescription>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input
                      id="businessName"
                      placeholder="e.g., Luxe Nail Studio"
                      value={formData.businessName}
                      onChange={(e) => updateFormData('businessName', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label>Business Type</Label>
                    <RadioGroup 
                      value={formData.businessType} 
                      onValueChange={(value) => updateFormData('businessType', value)}
                      className="mt-3"
                    >
                      {businessTypes.map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <RadioGroupItem value={type} id={type} />
                          <Label htmlFor={type}>{type}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <CardTitle className="text-2xl mb-2">Choose your brand colors</CardTitle>
                  <CardDescription>Select colors that represent your brand</CardDescription>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="primaryColor">Primary Brand Color</Label>
                    <div className="flex gap-4 mt-3">
                      <Input
                        type="color"
                        id="primaryColor"
                        value={formData.primaryColor}
                        onChange={(e) => updateFormData('primaryColor', e.target.value)}
                        className="w-16 h-16 rounded-lg border-2"
                      />
                      <Input
                        value={formData.primaryColor}
                        onChange={(e) => updateFormData('primaryColor', e.target.value)}
                        placeholder="#8B5CF6"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-6 gap-3 mt-6">
                    {['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'].map((color) => (
                      <button
                        key={color}
                        onClick={() => updateFormData('primaryColor', color)}
                        className="w-12 h-12 rounded-lg border-2 border-gray-200 hover:border-gray-400 transition-colors"
                        style={{ backgroundColor: color }}
                      >
                        {formData.primaryColor === color && <Check className="w-6 h-6 text-white mx-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <CardTitle className="text-2xl mb-2">Who are your clients?</CardTitle>
                  <CardDescription>Help us understand your target audience</CardDescription>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label>Primary Client Demographics</Label>
                    <RadioGroup 
                      value={formData.clientType} 
                      onValueChange={(value) => updateFormData('clientType', value)}
                      className="mt-3"
                    >
                      {clientTypes.map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <RadioGroupItem value={type} id={type} />
                          <Label htmlFor={type}>{type}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <CardTitle className="text-2xl mb-2">Content preferences</CardTitle>
                  <CardDescription>What style of content works best for you?</CardDescription>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label>Content Style</Label>
                    <RadioGroup 
                      value={formData.contentStyle} 
                      onValueChange={(value) => updateFormData('contentStyle', value)}
                      className="mt-3"
                    >
                      {contentStyles.map((style) => (
                        <div key={style} className="flex items-center space-x-2">
                          <RadioGroupItem value={style} id={style} />
                          <Label htmlFor={style}>{style}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  
                  <div>
                    <Label htmlFor="socialGoals">Social Media Goals</Label>
                    <Textarea
                      id="socialGoals"
                      placeholder="e.g., Increase bookings, showcase nail art, build brand awareness..."
                      value={formData.socialGoals}
                      onChange={(e) => updateFormData('socialGoals', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <CardTitle className="text-2xl mb-2">Connect Instagram</CardTitle>
                  <CardDescription>Link your Instagram account to post content and track engagement</CardDescription>
                </div>
                
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-8 mb-6">
                      <Instagram className="w-16 h-16 text-white mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">Instagram Integration</h3>
                      <p className="text-white/80">Connect your Instagram account to automatically post content and track your performance</p>
                    </div>
                    
                    {instagramConnected ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center justify-center gap-2 text-green-700">
                          <Check className="w-5 h-5" />
                          <span className="font-semibold">Instagram Connected Successfully!</span>
                        </div>
                        <p className="text-green-600 text-sm text-center mt-1">
                          You can now post content and track engagement
                        </p>
                      </div>
                    ) : (
                      <Button 
                        onClick={handleConnectInstagram}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        size="lg"
                      >
                        <Instagram className="w-5 h-5 mr-2" />
                        Connect Instagram Account
                      </Button>
                    )}
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">What you'll get:</h4>
                    <ul className="text-blue-700 text-sm space-y-1">
                      <li>• Automatic posting of AI-generated content</li>
                      <li>• Schedule posts for optimal timing</li>
                      <li>• Track likes, comments, and engagement</li>
                      <li>• Analyze post performance</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <CardTitle className="text-2xl mb-2">Connect Google Analytics</CardTitle>
                  <CardDescription>Link your website analytics to track traffic and conversions</CardDescription>
                </div>
                
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="bg-gradient-to-r from-blue-500 to-green-500 rounded-lg p-8 mb-6">
                      <BarChart3 className="w-16 h-16 text-white mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">Google Analytics Integration</h3>
                      <p className="text-white/80">Connect your Google Analytics to track website traffic and measure the impact of your social media</p>
                    </div>
                    
                    {gaConnected ? (
                      <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center justify-center gap-2 text-green-700">
                            <Check className="w-5 h-5" />
                            <span className="font-semibold">Google Analytics Connected Successfully!</span>
                          </div>
                          <p className="text-green-600 text-sm text-center mt-1">
                            Now please provide your GA4 Property ID to complete the setup
                          </p>
                        </div>
                        
                        {/* GA4 Property ID Input */}
                        <div className="space-y-3">
                          <Label htmlFor="ga4PropertyId">Google Analytics 4 Property ID</Label>
                          <div className="flex gap-2">
                            <Input
                              id="ga4PropertyId"
                              placeholder="484268560"
                              value={formData.ga4PropertyId}
                              onChange={(e) => updateFormData('ga4PropertyId', e.target.value)}
                              className="flex-1"
                            />
                            <Button 
                              onClick={handleUpdateGAPropertyId}
                              disabled={!formData.ga4PropertyId || formData.ga4PropertyId.length < 3}
                              size="sm"
                            >
                              Update
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Find this in your Google Analytics account under Admin → Property Settings → Property ID
                          </p>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        onClick={handleConnectGoogleAnalytics}
                        className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
                        size="lg"
                      >
                        <BarChart3 className="w-5 h-5 mr-2" />
                        Connect Google Analytics
                      </Button>
                    )}
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">What you'll get:</h4>
                    <ul className="text-blue-700 text-sm space-y-1">
                      <li>• Track website traffic from social media</li>
                      <li>• Monitor conversion rates</li>
                      <li>• Analyze user behavior</li>
                      <li>• Measure ROI of social media campaigns</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={step === 1}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </Button>
              
              <Button
                onClick={handleNext}
                disabled={isSubmitting}
                className="bg-gradient-primary hover:shadow-glow flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {step === totalSteps ? (isSubmitting ? 'Saving...' : 'Complete Setup') : 'Next'}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </Button>
              
              {/* Skip button for social connections */}
              {(step === 5 || step === 6) && (
                <Button
                  variant="ghost"
                  onClick={handleNext}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Skip for now
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;