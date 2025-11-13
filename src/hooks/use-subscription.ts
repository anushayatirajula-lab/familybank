import { useState, useEffect } from "react";
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

  const checkSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus(prev => ({ ...prev, loading: false }));
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) throw error;

      setStatus({
        ...data,
        loading: false,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      setStatus(prev => ({ ...prev, loading: false }));
    }
  };

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

    // Refresh subscription status periodically
    const interval = setInterval(checkSubscription, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return {
    ...status,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
    getTrialDaysRemaining,
    isAccessAllowed,
  };
};
