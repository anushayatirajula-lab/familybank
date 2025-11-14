import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowBanner(false);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Show banner for iOS users
    if (iOS && !window.matchMedia('(display-mode: standalone)').matches) {
      setShowBanner(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        toast({
          title: "Install on iOS",
          description: "Tap the Share button in Safari and select 'Add to Home Screen'",
          duration: 5000,
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
      setShowBanner(false);
    }

    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="relative pb-3">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6"
            onClick={() => setShowBanner(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5 text-primary" />
            Install FamilyBank
          </CardTitle>
          <CardDescription>
            Add to your home screen for quick access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isIOS ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Tap the <span className="font-semibold">Share</span> button in Safari,
                then select <span className="font-semibold">"Add to Home Screen"</span>
              </p>
            </div>
          ) : (
            <Button 
              onClick={handleInstallClick} 
              className="w-full"
              disabled={!isInstallable}
            >
              <Download className="mr-2 h-4 w-4" />
              Install App
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
