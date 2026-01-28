import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionStatus {
  subscribed: boolean;
  on_trial: boolean;
  trial_ends_at: string | null;
  subscription_status: string;
  current_period_end?: string;
  loading: boolean;
}

export const useSubscription = () => {
  const { toast } = useToast();
  const [status, setStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    on_trial: true,
    trial_ends_at: null,
    subscription_status: 'trialing',
    loading: true,
  });
  
  // Track current user to detect auth changes
  const currentUserIdRef = useRef<string | null>(null);

  const checkSubscription = useCallback(async () => {
    try {
      // Get fresh session to ensure we have the latest token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        setStatus(prev => ({ ...prev, loading: false }));
        currentUserIdRef.current = null;
        return;
      }

      // If user changed, reset status first
      if (currentUserIdRef.current !== session.user.id) {
        currentUserIdRef.current = session.user.id;
        setStatus(prev => ({ ...prev, loading: true }));
      }

      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        // If we get a 401, the session might be invalid - try to refresh
        if (error.message?.includes('401') || error.message?.includes('Invalid or expired')) {
          console.log('Session may be stale, attempting refresh...');
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData?.session) {
            // Retry with fresh session
            const { data: retryData, error: retryError } = await supabase.functions.invoke('check-subscription');
            if (!retryError && retryData) {
              setStatus({
                ...retryData,
                loading: false,
              });
              return;
            }
          }
        }
        throw error;
      }

      setStatus({
        ...data,
        loading: false,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      setStatus(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const createCheckout = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout');
      
      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Checkout failed",
        description: error.message || "Please try again later.",
      });
    }
  };

  const openCustomerPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Portal access failed",
        description: error.message || "Please try again later.",
      });
    }
  };

  const getTrialDaysRemaining = () => {
    if (!status.trial_ends_at) return 0;
    const now = new Date();
    const trialEnd = new Date(status.trial_ends_at);
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const isAccessAllowed = () => {
    return status.subscribed || status.on_trial;
  };

  useEffect(() => {
    checkSubscription();

    // Listen for auth state changes to refresh subscription status
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Small delay to ensure the session is fully established
          setTimeout(checkSubscription, 100);
        } else if (event === 'SIGNED_OUT') {
          currentUserIdRef.current = null;
          setStatus({
            subscribed: false,
            on_trial: true,
            trial_ends_at: null,
            subscription_status: 'trialing',
            loading: false,
          });
        }
      }
    );

    // Refresh subscription status periodically
    const interval = setInterval(checkSubscription, 60000); // Check every minute

    return () => {
      authSubscription.unsubscribe();
      clearInterval(interval);
    };
  }, [checkSubscription]);

  return {
    ...status,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
    getTrialDaysRemaining,
    isAccessAllowed,
  };
};
