import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, TrendingUp, Award, Download } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero-family.jpg";
import { InstallPWA } from "@/components/InstallPWA";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return; // Not logged in, show landing page

    // Check if user is a parent
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (userRole?.role === "PARENT") {
      navigate("/parent/dashboard");
      return;
    }

    // Check if user is a child
    const { data: childData } = await supabase
      .from("children")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (childData) {
      navigate(`/child/${childData.id}`);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full mb-6">
                <Sparkles className="w-4 h-4 text-secondary" />
                <span className="text-sm font-medium">The Duolingo of Money for Families</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl font-bold mb-6 text-primary-foreground">
                Make Learning Money Fun for Your Family
              </h1>
              
              <p className="text-xl mb-8 text-primary-foreground/90">
                Kids earn tokens through chores, learn to save in colorful jars, and discover 
                financial responsibility—all with AI coaching and parent oversight.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  asChild 
                  size="lg" 
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-coin text-lg"
                >
                  <Link to="/auth/signup">
                    Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                
                <Button 
                  asChild 
                  size="lg" 
                  variant="outline"
                  className="bg-white/10 backdrop-blur-sm border-primary-foreground/20 text-primary-foreground hover:bg-white/20"
                >
                  <Link to="/auth/login">Parent Login</Link>
                </Button>

                <Button 
                  asChild 
                  size="lg" 
                  variant="outline"
                  className="bg-white/10 backdrop-blur-sm border-primary-foreground/20 text-primary-foreground hover:bg-white/20"
                >
                  <Link to="/child/login">Child Login</Link>
                </Button>
              </div>
              
              <div className="mt-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center relative z-10">
                <p className="text-sm text-primary-foreground/70">
                  ✨ Simulated tokens — not real money • Parent approval required
                </p>
                <Button 
                  variant="outline"
                  size="sm"
                  className="bg-white/10 backdrop-blur-sm border-primary-foreground/30 text-primary-foreground hover:bg-white/20 hover:border-primary-foreground/50 cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Install button clicked - navigating to /install');
                    navigate("/install");
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Install App
                </Button>
              </div>
            </div>
            
            <div className="animate-scale-in">
              <img 
                src={heroImage} 
                alt="Family learning about money together" 
                className="rounded-2xl shadow-elevated w-full"
              />
            </div>
          </div>
        </div>
        
        {/* Decorative gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            How FamilyBank Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-gradient-card shadow-elevated hover:shadow-xl transition-all animate-fade-in">
              <div className="w-12 h-12 bg-jar-toys/20 rounded-xl flex items-center justify-center mb-4">
                <Award className="w-6 h-6 text-jar-toys" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Earn Through Chores</h3>
              <p className="text-muted-foreground">
                Kids complete chores and earn tokens. Parents approve and tokens automatically split into learning jars.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl bg-gradient-card shadow-elevated hover:shadow-xl transition-all animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="w-12 h-12 bg-jar-books/20 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-jar-books" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Save in Colorful Jars</h3>
              <p className="text-muted-foreground">
                Tokens split into Toys, Books, Shopping, Charity, and Wishlist jars. Kids see their progress in real-time.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl bg-gradient-card shadow-elevated hover:shadow-xl transition-all animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">AI Financial Coach</h3>
              <p className="text-muted-foreground">
                Age-appropriate tips encourage saving, teach responsibility, and celebrate achievements—never preachy, always supportive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-primary-foreground">
            Ready to Transform Your Family's Money Habits?
          </h2>
          <p className="text-xl mb-8 text-primary-foreground/90 max-w-2xl mx-auto">
            Join thousands of families teaching kids financial literacy through fun, gamified learning.
          </p>
          <Button 
            asChild 
            size="lg" 
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-coin text-lg"
          >
            <Link to="/auth/signup">
              Start Your Family Journey <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} FamilyBank. All tokens are simulated and educational only.</p>
            <Link to="/developer-docs" className="text-primary hover:underline font-medium">
              Developer Documentation
            </Link>
          </div>
        </div>
      </footer>
      <InstallPWA />
    </div>
  );
};

export default Index;
