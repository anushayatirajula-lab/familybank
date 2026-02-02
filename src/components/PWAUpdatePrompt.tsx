import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RefreshCw } from "lucide-react";

export const PWAUpdatePrompt = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) return;

    const handleUpdate = (reg: ServiceWorkerRegistration) => {
      setRegistration(reg);
      setShowUpdatePrompt(true);
    };

    // Listen for new service worker available
    navigator.serviceWorker.ready.then((reg) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available
              handleUpdate(reg);
            }
          });
        }
      });
    });

    // Check for updates on mount and periodically
    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
        }
      } catch (error) {
        console.log('SW update check failed:', error);
      }
    };

    checkForUpdates();
    const interval = setInterval(checkForUpdates, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    if (registration?.waiting) {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    // Reload to get new content
    window.location.reload();
  };

  if (!showUpdatePrompt) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] md:left-auto md:right-4 md:max-w-sm">
      <Alert className="bg-primary text-primary-foreground border-primary shadow-lg">
        <RefreshCw className="h-4 w-4" />
        <AlertTitle>Update Available</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3 text-primary-foreground/90">
            A new version of FamilyBank is ready. Refresh to get the latest features and fixes.
          </p>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleRefresh}
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Now
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
};
