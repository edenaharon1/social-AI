import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import PostGenerator from "./pages/PostGenerator";
import NotFound from "./pages/NotFound";
import React from "react"; // Added missing import for React

const queryClient = new QueryClient();

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return isLoggedIn ? <>{children}</> : <Navigate to="/login" replace />;
};

// Smart Route Component that checks business profile
const SmartRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, isLoading, user } = useAuth();
  const [hasBusinessProfile, setHasBusinessProfile] = React.useState<boolean | null>(null);
  const [isCheckingProfile, setIsCheckingProfile] = React.useState(false);

  React.useEffect(() => {
    const checkBusinessProfile = async () => {
      if (!isLoggedIn || !user) {
        setHasBusinessProfile(false);
        return;
      }

      setIsCheckingProfile(true);
      try {
        const userData = localStorage.getItem('user');
        if (!userData) {
          setHasBusinessProfile(false);
          return;
        }

        const parsedUser = JSON.parse(userData);
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://aisocial.dev'}/business-profile`, {
          headers: {
            Authorization: `Bearer ${parsedUser.token}`,
          },
        });

        if (response.ok) {
          const profileData = await response.json();
          setHasBusinessProfile(!!(profileData && profileData.businessName && profileData.businessType));
        } else if (response.status === 404) {
          setHasBusinessProfile(false);
        } else {
          // On error, assume they need onboarding
          setHasBusinessProfile(false);
        }
      } catch (error) {
        console.error('Error checking business profile:', error);
        setHasBusinessProfile(false);
      } finally {
        setIsCheckingProfile(false);
      }
    };

    checkBusinessProfile();
  }, [isLoggedIn, user]);

  if (isLoading || isCheckingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  // If user doesn't have a business profile, redirect to onboarding
  if (hasBusinessProfile === false) {
    return <Navigate to="/onboarding" replace />;
  }

  // If user has a business profile, show the intended component
  return <>{children}</>;
};

const AppRoutes = () => {
  const { isLoggedIn } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={isLoggedIn ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route 
          path="/onboarding" 
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <SmartRoute>
              <Dashboard />
            </SmartRoute>
          } 
        />
        <Route 
          path="/post-generator" 
          element={
            <SmartRoute>
              <PostGenerator />
            </SmartRoute>
          } 
        />

        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRoutes />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
