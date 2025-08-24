import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Settings, Check, Loader2, Instagram, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { businessProfileAPI, dashboardAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface SettingsData {
  businessName: string;
  businessType: string;
  clientType: string;
  primaryColor: string;
  socialGoals: string;
  contentStyle: string;
}

interface SettingsDialogProps {
  initialData?: SettingsData;
  onSave?: (data: SettingsData) => void;
  initialTab?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isGoogleAnalyticsConnected?: boolean;
  isInstagramConnected?: boolean;
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

export function SettingsDialog({ initialData, onSave, initialTab = "business", open: controlledOpen, onOpenChange, isGoogleAnalyticsConnected = false, isInstagramConnected = false }: SettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<SettingsData>({
    businessName: '',
    businessType: '',
    clientType: '',
    primaryColor: '',
    socialGoals: '',
    contentStyle: ''
  });
  const [instagramConnected, setInstagramConnected] = useState(isInstagramConnected);
  const [gaConnected, setGaConnected] = useState(isGoogleAnalyticsConnected);
  const [gaPropertyId, setGaPropertyId] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { user, updateConnectionStatus, refreshConnectionStatus } = useAuth();
  
  // Update connection states when props change
  useEffect(() => {
    setInstagramConnected(isInstagramConnected);
    setGaConnected(isGoogleAnalyticsConnected);
  }, [isInstagramConnected, isGoogleAnalyticsConnected]);

  // Load business profile when dialog opens
  useEffect(() => {
    console.log('Settings dialog useEffect triggered:', { open, userId: user?.id });
    if (open) {
      loadBusinessProfile();
      // Refresh connection status when dialog opens
      refreshConnectionStatus();
    }
  }, [open, user?.id]);

  const loadBusinessProfile = async () => {
    console.log('Loading business profile for user:', user?.id);
    console.log('User object from context:', user);
    
    // Try to get user ID from context first, then from localStorage
    let userId = user?.id;
    console.log('User ID from context:', userId);
    
    if (!userId) {
      const userData = localStorage.getItem('user');
      console.log('User data from localStorage:', userData);
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          console.log('Parsed user data:', parsedUser);
          userId = parsedUser.RegisteredUser?.id;
          console.log('Got user ID from localStorage:', userId);
        } catch (error) {
          console.error('Error parsing user data from localStorage:', error);
        }
      }
    }
    
    if (!userId) {
      console.log('No user ID available');
      return;
    }
    
    setLoading(true);
    try {
      console.log('Making API call to get business profile for user ID:', userId);
      const profile = await businessProfileAPI.getBusinessProfile();
      console.log('Loaded profile:', profile);
      // Map toneOfVoice back to frontend content style
      const getContentStyle = (toneOfVoice: string): string => {
        switch (toneOfVoice) {
          case 'Professional':
            return 'Professional & Clean';
          case 'Funny':
            return 'Fun & Trendy';
          case 'Luxury':
            return 'Luxurious & Premium';
          case 'Friendly':
            return 'Casual & Friendly';
          case 'Bold':
            return 'Creative & Artistic';
          default:
            return 'Professional & Clean';
        }
      };

      setFormData({
        businessName: profile.businessName || '',
        businessType: profile.businessType || '',
        clientType: profile.audienceType || '',
        primaryColor: profile.mainColors?.[0] || '#8B5CF6', // Get first color from array
        socialGoals: profile.marketingGoals?.[0] || '', // Get first goal from array
        contentStyle: getContentStyle(profile.toneOfVoice) || 'Professional & Clean'
      });
    } catch (error: unknown) {
      console.error('Error loading business profile:', error);
      // Keep default values if profile doesn't exist
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: keyof SettingsData, value: string) => {
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
          } catch (error: unknown) {
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
                description: "Google Analytics connected successfully!",
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
          } catch (error: unknown) {
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
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not found. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await dashboardAPI.updateGoogleAnalyticsPropertyId(gaPropertyId);
      toast({
        title: "Success",
        description: "Google Analytics Property ID updated successfully!",
      });
      setGaConnected(true); // Assuming update is successful, re-enable connection
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update Google Analytics Property ID",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not found. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
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
        description: "Settings updated successfully!",
      });
      
      onSave?.(formData);
      setOpen(false);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Business Settings</DialogTitle>
          <DialogDescription>
            Update your business profile and content preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={initialTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
          </TabsList>

          <TabsContent value="business" className="space-y-6 mt-6">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Loading business profile...</span>
              </div>
            )}
            {!loading && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
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
            )}
          </TabsContent>

          <TabsContent value="branding" className="space-y-6 mt-6">
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
          </TabsContent>

          <TabsContent value="content" className="space-y-6 mt-6">
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
          </TabsContent>

          <TabsContent value="social" className="space-y-6 mt-6">
            <div className="space-y-6">
              {/* Instagram Connection */}
              <div className="border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                      <Instagram className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Instagram</h3>
                      <p className="text-sm text-muted-foreground">Post content and track engagement</p>
                    </div>
                  </div>
                  {instagramConnected && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <Check className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
                
                {instagramConnected ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-700 text-sm">
                      Your Instagram account is connected. You can now post content and track engagement.
                    </p>
                  </div>
                ) : (
                  <Button 
                    onClick={handleConnectInstagram}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                  >
                    <Instagram className="w-4 h-4 mr-2" />
                    Connect Instagram
                  </Button>
                )}
              </div>

              {/* Google Analytics Connection */}
              <div className="border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-green-500 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Google Analytics</h3>
                      <p className="text-sm text-muted-foreground">Track website traffic and conversions</p>
                    </div>
                  </div>
                  {gaConnected && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <Check className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
                
                {gaConnected ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-700 text-sm">
                        Your Google Analytics account is connected. You can now track website traffic and conversions.
                      </p>
                    </div>
                    
                    {/* GA Property ID Input */}
                    <div>
                      <Label htmlFor="gaPropertyId">Google Analytics Property ID</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="gaPropertyId"
                          placeholder="484268560"
                          className="flex-1"
                          onChange={(e) => setGaPropertyId(e.target.value)}
                        />
                        <Button 
                          onClick={handleUpdateGAPropertyId}
                          disabled={!gaPropertyId || gaPropertyId.length < 3}
                          size="sm"
                        >
                          Update
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Find this in your Google Analytics account under Admin → Property Settings → Property ID
                      </p>
                    </div>
                  </div>
                ) : (
                  <Button 
                    onClick={handleConnectGoogleAnalytics}
                    className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Connect Google Analytics
                  </Button>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Why connect these accounts?</h4>
                <ul className="text-blue-700 text-sm space-y-1">
                  <li>• <strong>Instagram:</strong> Post AI-generated content automatically and track engagement</li>
                  <li>• <strong>Google Analytics:</strong> Measure the impact of your social media on website traffic</li>
                  <li>• <strong>Better Insights:</strong> Get comprehensive analytics across all your platforms</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}