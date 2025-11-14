import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const NotificationPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkNotificationPermission();
  }, []);

  const checkNotificationPermission = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return;
    }

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check current permission
    const permission = Notification.permission;
    
    if (permission === "default") {
      // Show prompt after a short delay
      setTimeout(() => setShowPrompt(true), 3000);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPush = async () => {
    setIsSubscribing(true);

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      
      if (permission !== "granted") {
        toast({
          title: "Notifications blocked",
          description: "Please enable notifications in your browser settings",
          variant: "destructive",
        });
        setShowPrompt(false);
        setIsSubscribing(false);
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // VAPID public key - you'll need to generate this and add it as an environment variable
      // For now, we'll use a placeholder and show instructions
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      if (!vapidPublicKey) {
        toast({
          title: "Setup required",
          description: "Push notifications need to be configured by the administrator",
        });
        setShowPrompt(false);
        setIsSubscribing(false);
        return;
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Store subscription in database
      const subscriptionJson = subscription.toJSON();
      
      const { error } = await supabase
        .from("push_subscriptions" as any)
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint!,
          p256dh: subscriptionJson.keys!.p256dh,
          auth: subscriptionJson.keys!.auth,
          user_agent: navigator.userAgent,
        }, {
          onConflict: "user_id,endpoint"
        });

      if (error) throw error;

      toast({
        title: "Notifications enabled!",
        description: "You'll now receive updates about chores and allowances",
      });

      setShowPrompt(false);
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toast({
        title: "Subscription failed",
        description: error instanceof Error ? error.message : "Could not enable notifications",
        variant: "destructive",
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="relative pb-3">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6"
            onClick={() => setShowPrompt(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" />
            Enable Notifications
          </CardTitle>
          <CardDescription>
            Get notified about chore approvals and allowance payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✅ Chore approval alerts</li>
              <li>✅ Allowance payments</li>
              <li>✅ Wishlist updates</li>
            </ul>
            <Button 
              onClick={subscribeToPush} 
              className="w-full"
              disabled={isSubscribing}
            >
              <Bell className="mr-2 h-4 w-4" />
              {isSubscribing ? "Enabling..." : "Enable Notifications"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
