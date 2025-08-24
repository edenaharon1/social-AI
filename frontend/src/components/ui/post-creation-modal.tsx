import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Upload, Send, Loader2 } from 'lucide-react';
import { ContentSuggestion } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ImageWithFallback } from '@/lib/imageUtils';

interface PostCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: ContentSuggestion | null;
  onPostCreated: () => void;
}

export function PostCreationModal({ open, onOpenChange, suggestion, onPostCreated }: PostCreationModalProps) {
  const [caption, setCaption] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const { toast } = useToast();

  // Initialize caption with suggestion content when modal opens
  React.useEffect(() => {
    if (suggestion && open) {
      setCaption(suggestion.content);
      setImageFile(null);
      setScheduledAt('');
    }
  }, [suggestion, open]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const handlePostNow = async () => {
    if (!suggestion) return;
    
    setIsPosting(true);
    try {
      const formData = new FormData();
      formData.append('caption', caption);
      
      // Handle image: either uploaded file or AI suggestion image
      let imageToPost: File | null = imageFile;
      
      // If no uploaded image but suggestion has image URLs, download the first one
      if (!imageToPost && suggestion.imageUrls && suggestion.imageUrls.length > 0) {
        try {
          console.log('Downloading AI suggestion image:', suggestion.imageUrls[0]);
          const imageResponse = await fetch(suggestion.imageUrls[0]);
          if (imageResponse.ok) {
            const imageBlob = await imageResponse.blob();
            // Create a file from the blob
            imageToPost = new File([imageBlob], 'ai-generated-image.jpg', { type: 'image/jpeg' });
            console.log('Successfully downloaded AI suggestion image');
          } else {
            console.warn('Failed to download AI suggestion image:', imageResponse.status);
          }
        } catch (error) {
          console.error('Error downloading AI suggestion image:', error);
        }
      }
      
      if (imageToPost) {
        formData.append('image', imageToPost);
      } else {
        throw new Error('No image available for posting. Please upload an image or ensure the AI suggestion has an image.');
      }

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://aisocial.dev';
      console.log('API Base URL:', apiBaseUrl);
      console.log('Full URL:', `${apiBaseUrl}/api/instagram/post`);

      const response = await fetch(`${apiBaseUrl}/api/instagram/post`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('user') || '{}').token}`
        },
        body: formData
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Post published to Instagram successfully!",
        });
        onPostCreated();
        onOpenChange(false);
      } else {
        const errorData = await response.json();
        console.error('Instagram post error response:', errorData);
        throw new Error(errorData.message || 'Failed to post to Instagram');
      }
    } catch (error) {
      console.error('Post creation error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to post to Instagram. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleSchedulePost = async () => {
    if (!suggestion || !scheduledAt) return;
    
    setIsPosting(true);
    try {
      const formData = new FormData();
      formData.append('caption', caption);
      formData.append('scheduledAt', scheduledAt);
      
      // Handle image: either uploaded file or AI suggestion image
      let imageToPost: File | null = imageFile;
      
      // If no uploaded image but suggestion has image URLs, download the first one
      if (!imageToPost && suggestion.imageUrls && suggestion.imageUrls.length > 0) {
        try {
          console.log('Downloading AI suggestion image for scheduled post:', suggestion.imageUrls[0]);
          const imageResponse = await fetch(suggestion.imageUrls[0]);
          if (imageResponse.ok) {
            const imageBlob = await imageResponse.blob();
            // Create a file from the blob
            imageToPost = new File([imageBlob], 'ai-generated-image.jpg', { type: 'image/jpeg' });
            console.log('Successfully downloaded AI suggestion image for scheduled post');
          } else {
            console.warn('Failed to download AI suggestion image for scheduled post:', imageResponse.status);
          }
        } catch (error) {
          console.error('Error downloading AI suggestion image for scheduled post:', error);
        }
      }
      
      if (imageToPost) {
        formData.append('image', imageToPost);
      } else {
        throw new Error('No image available for posting. Please upload an image or ensure the AI suggestion has an image.');
      }

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://aisocial.dev';
      console.log('API Base URL (schedule):', apiBaseUrl);
      console.log('Full URL (schedule):', `${apiBaseUrl}/api/instagram/post`);

      const response = await fetch(`${apiBaseUrl}/api/instagram/post`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('user') || '{}').token}`
        },
        body: formData
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Post scheduled for ${new Date(scheduledAt).toLocaleString()}`,
        });
        onPostCreated();
        onOpenChange(false);
      } else {
        const errorData = await response.json();
        console.error('Instagram schedule post error response:', errorData);
        throw new Error(errorData.message || 'Failed to schedule post');
      }
    } catch (error) {
      console.error('Schedule post error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to schedule post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  if (!suggestion) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Instagram Post</DialogTitle>
          <DialogDescription>
            Customize and publish your AI-generated content to Instagram
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Suggestion Preview */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-semibold mb-2">Original Suggestion</h4>
            <div className="aspect-square bg-gradient-secondary rounded-lg mb-3 flex items-center justify-center">
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
            <p className="text-sm text-muted-foreground mb-2">{suggestion.content}</p>
            <div className="flex flex-wrap gap-1">
              {suggestion.hashtags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Caption Input */}
          <div>
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your Instagram caption..."
              className="mt-1 min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {caption.length}/2200 characters
            </p>
          </div>

          {/* Image Upload */}
          <div>
            <Label htmlFor="image">Upload Image (Optional)</Label>
            <div className="mt-1 flex items-center gap-3">
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="flex-1"
              />
              {imageFile && (
                <Badge variant="secondary">
                  {imageFile.name}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {imageFile 
                ? "Will use uploaded image for posting" 
                : suggestion.imageUrls && suggestion.imageUrls.length > 0 
                  ? "Will use AI-generated image for posting" 
                  : "No image available - please upload an image"
              }
            </p>
            {!imageFile && suggestion.imageUrls && suggestion.imageUrls.length > 0 && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Note:</strong> The AI-generated image will be automatically downloaded and used for posting.
                </p>
              </div>
            )}
          </div>

          {/* Scheduling */}
          <div>
            <Label htmlFor="scheduledAt">Schedule Post (Optional)</Label>
            <div className="mt-1 flex items-center gap-3">
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
              {scheduledAt && (
                <Badge variant="outline">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(scheduledAt).toLocaleString()}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to post immediately
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handlePostNow}
              disabled={isPosting || !caption.trim() || (!imageFile && (!suggestion.imageUrls || suggestion.imageUrls.length === 0))}
              className="flex-1"
            >
              {isPosting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Post Now
            </Button>
            
            {scheduledAt && (
              <Button
                onClick={handleSchedulePost}
                disabled={isPosting || !caption.trim() || !scheduledAt || (!imageFile && (!suggestion.imageUrls || suggestion.imageUrls.length === 0))}
                variant="outline"
                className="flex-1"
              >
                {isPosting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Calendar className="w-4 h-4 mr-2" />
                )}
                Schedule Post
              </Button>
            )}
          </div>
          
          {/* Helper text for disabled buttons */}
          {(!imageFile && (!suggestion.imageUrls || suggestion.imageUrls.length === 0)) && (
            <p className="text-xs text-red-600 mt-2">
              ⚠️ An image is required to post to Instagram. Please upload an image or ensure the AI suggestion has an image.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
