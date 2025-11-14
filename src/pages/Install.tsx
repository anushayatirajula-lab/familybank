import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, CheckCircle2, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        toast({
          title: "Install on iOS",
          description: "Tap the Share button in Safari and select 'Add to Home Screen'",
          duration: 7000,
        });
      }
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      toast({
        title: "App installed!",
        description: "FamilyBank has been added to your home screen",
      });
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-elevated">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-3xl mb-2">Install FamilyBank</CardTitle>
          <CardDescription className="text-base">
            Get the best experience with our installable app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isInstalled ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Already Installed!</h3>
                <p className="text-muted-foreground">
                  FamilyBank is already installed on your device. You can find it on your home screen.
                </p>
              </div>
              <Button asChild className="mt-4">
                <Link to="/">
                  <Home className="mr-2 h-4 w-4" />
                  Go to Home
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Why Install?</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Quick Access</p>
                      <p className="text-sm text-muted-foreground">
                        Launch directly from your home screen
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Works Offline</p>
                      <p className="text-sm text-muted-foreground">
                        Access your data even without internet
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">App-Like Experience</p>
                      <p className="text-sm text-muted-foreground">
                        Full screen, no browser bars
                      </p>
                    </div>
                  </li>
                </ul>
              </div>

              {isIOS ? (
                <Card className="bg-muted/50">
                  <CardContent className="pt-6 space-y-3">
                    <h4 className="font-semibold">How to Install on iOS:</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>Tap the <span className="font-semibold">Share</span> button in Safari (square with arrow pointing up)</li>
                      <li>Scroll down and tap <span className="font-semibold">"Add to Home Screen"</span></li>
                      <li>Tap <span className="font-semibold">"Add"</span> in the top right</li>
                      <li>Find the FamilyBank icon on your home screen!</li>
                    </ol>
                  </CardContent>
                </Card>
              ) : (
                <Button 
                  onClick={handleInstallClick} 
                  size="lg"
                  className="w-full"
                  disabled={!isInstallable}
                >
                  <Download className="mr-2 h-5 w-5" />
                  {isInstallable ? "Install Now" : "Installation Not Available"}
                </Button>
              )}

              <div className="text-center">
                <Button variant="ghost" asChild>
                  <Link to="/">
                    <Home className="mr-2 h-4 w-4" />
                    Back to Home
                  </Link>
                </Button>
              </div>

              {!isInstallable && !isIOS && (
                <p className="text-xs text-center text-muted-foreground">
                  Installation is available on supported browsers like Chrome, Edge, or Samsung Internet
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
