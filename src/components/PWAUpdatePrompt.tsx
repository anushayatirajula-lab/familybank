import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RefreshCw } from "lucide-react";

export const PWAUpdatePrompt = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  const handleNewServiceWorker = useCallback((worker: ServiceWorker) => {
    setWaitingWorker(worker);
    setShowUpdatePrompt(true);
  }, []);

  useEffect(() => {
    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) return;

    const checkWaitingWorker = (reg: ServiceWorkerRegistration) => {
      // Check if there's already a waiting worker (covers iOS/mobile reload scenarios)
      if (reg.waiting) {
        handleNewServiceWorker(reg.waiting);
      }
    };

    const trackInstalling = (reg: ServiceWorkerRegistration) => {
      const installingWorker = reg.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        // When a new worker is installed and waiting
        if (installingWorker.state === 'installed') {
          // Check if we have a controller - if yes, it's an update
          // If no controller on mobile, still show prompt if there's a waiting worker
          if (navigator.serviceWorker.controller || reg.waiting) {
            handleNewServiceWorker(installingWorker);
          }
        }
      });
    };

    // Listen for new service worker available
    navigator.serviceWorker.ready.then((reg) => {
      // Check for existing waiting worker on page load
      checkWaitingWorker(reg);

      // Listen for future updates
      reg.addEventListener('updatefound', () => {
        trackInstalling(reg);
      });
    });

    // Also handle controllerchange event for iOS
    const handleControllerChange = () => {
      // Page will reload automatically after skipWaiting on most browsers
      // but on iOS we might need to force it
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Check for updates on mount and periodically
    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          // Check for waiting worker first
          checkWaitingWorker(reg);
          // Then trigger update check
          await reg.update();
        }
      } catch (error) {
        console.log('SW update check failed:', error);
      }
    };

    // Initial check
    checkForUpdates();
    
    // Check more frequently on mobile (every 30 seconds) vs desktop (every minute)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const interval = setInterval(checkForUpdates, isMobile ? 30000 : 60000);

    return () => {
      clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [handleNewServiceWorker]);

  const handleRefresh = () => {
    if (waitingWorker) {
      // Tell the waiting service worker to skip waiting
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    // Reload to get new content
    window.location.reload();
  };

  // Dismiss prompt
  const handleDismiss = () => {
    setShowUpdatePrompt(false);
  };

  if (!showUpdatePrompt) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] md:left-auto md:right-4 md:max-w-sm">
      <Alert className="bg-primary text-primary-foreground border-primary shadow-lg">
        <RefreshCw className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          <span>Update Available</span>
          <button 
            onClick={handleDismiss}
            className="text-primary-foreground/70 hover:text-primary-foreground text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </AlertTitle>
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
