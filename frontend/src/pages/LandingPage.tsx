import { HeroButton } from '@/components/ui/hero-button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Instagram, BarChart3, Sparkles, TrendingUp, Users, Zap, Check, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import heroImage from '@/assets/hero-social-management.jpg';

const features = [
  {
    icon: Sparkles,
    title: 'AI-Powered Content',
    description: 'Generate engaging posts and images tailored to your business and audience automatically.'
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Track engagement, reach, and conversions with detailed insights from Instagram and Google Analytics.'
  },
  {
    icon: TrendingUp,
    title: 'Growth Optimization',
    description: 'Get data-driven recommendations to increase your social media presence and engagement.'
  },
  {
    icon: Users,
    title: 'Audience Insights',
    description: 'Understand your audience better with demographic analysis and behavior patterns.'
  }
];

const plans = [
  {
    name: 'Starter',
    price: '$29',
    description: 'Perfect for small businesses getting started',
    features: [
      '50 AI-generated posts per month',
      'Instagram connection',
      'Basic analytics dashboard',
      'Email support'
    ]
  },
  {
    name: 'Professional',
    price: '$79',
    description: 'For growing businesses that need more',
    features: [
      '200 AI-generated posts per month',
      'Instagram + Google Analytics',
      'Advanced analytics & insights',
      'Content calendar',
      'Priority support'
    ],
    popular: true
  },
  {
    name: 'Enterprise',
    price: '$199',
    description: 'For established businesses with high volume needs',
    features: [
      'Unlimited AI-generated posts',
      'All platform connections',
      'Custom analytics reports',
      'White-label options',
      'Dedicated account manager'
    ]
  }
];

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl bg-gradient-primary bg-clip-text text-transparent">
              social.ai
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <HeroButton 
              variant="hero-ghost" 
              size="sm"
              onClick={() => navigate('/onboarding')}
            >
              Sign In
            </HeroButton>
            <HeroButton 
              variant="hero" 
              size="sm"
              onClick={() => navigate('/onboarding')}
            >
              Get Started
            </HeroButton>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-hero py-20 px-6 text-center text-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-left">
              <Badge className="mb-6 bg-white/20 text-white border-white/20">
                ✨ AI-Powered Social Media Management
              </Badge>
              
              <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                Transform Your
                <span className="block bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                  Social Presence
                </span>
              </h1>
              
              <p className="text-xl text-white/90 mb-8 leading-relaxed">
                Let AI create stunning content for your business while you focus on what matters most. 
                Get personalized posts, track engagement, and grow your audience effortlessly.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <HeroButton 
                  variant="hero" 
                  size="xl"
                  onClick={() => navigate('/onboarding')}
                  className="text-lg"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </HeroButton>
                <HeroButton 
                  variant="hero-outline" 
                  size="xl"
                  className="text-lg"
                >
                  Watch Demo
                </HeroButton>
              </div>
            </div>
            
            <div className="relative">
              <img
                src={heroImage}
                alt="Social media management dashboard"
                className="rounded-2xl shadow-glow w-full max-w-lg mx-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-background to-accent/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
              Everything you need to succeed
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our AI-powered platform handles content creation, scheduling, and analytics 
              so you can focus on growing your business.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-gradient-card shadow-card border-0 hover:shadow-elegant transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Section */}
      <section className="py-20 px-6 bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Connect Your Favorite Platforms</h2>
          <p className="text-xl text-muted-foreground mb-12">
            Seamlessly integrate with the tools you already use to get the most out of your social media strategy.
          </p>
          
          <div className="flex justify-center items-center gap-12 flex-wrap">
            <div className="flex items-center gap-3 bg-gradient-card p-6 rounded-2xl shadow-card">
              <Instagram className="w-8 h-8 text-pink-600" />
              <span className="font-semibold text-lg">Instagram Business</span>
            </div>
            <div className="flex items-center gap-3 bg-gradient-card p-6 rounded-2xl shadow-card">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <span className="font-semibold text-lg">Google Analytics</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-accent/5 to-primary/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
              Choose Your Plan
            </h2>
            <p className="text-xl text-muted-foreground">
              Start free and scale as your business grows
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <Card key={plan.name} className={`relative bg-gradient-card shadow-card border-0 ${plan.popular ? 'ring-2 ring-primary shadow-glow' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-primary text-white px-4 py-1">Most Popular</Badge>
                  </div>
                )}
                <CardContent className="p-8">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <div className="mb-2">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <p className="text-muted-foreground">{plan.description}</p>
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <HeroButton 
                    variant={plan.popular ? "hero" : "hero-outline"} 
                    className="w-full"
                    onClick={() => navigate('/onboarding')}
                  >
                    {plan.popular ? 'Start Free Trial' : 'Choose Plan'}
                  </HeroButton>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-hero text-white text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Social Media?</h2>
          <p className="text-xl text-white/90 mb-8">
            Join thousands of businesses already using social.ai to grow their online presence.
          </p>
          <HeroButton 
            variant="hero" 
            size="xl"
            onClick={() => navigate('/onboarding')}
            className="text-lg"
          >
            Get Started for Free
            <ArrowRight className="w-5 h-5" />
          </HeroButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t py-12 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl bg-gradient-primary bg-clip-text text-transparent">
              social.ai
            </span>
          </div>
          <p className="text-muted-foreground">
            © 2024 social.ai. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;