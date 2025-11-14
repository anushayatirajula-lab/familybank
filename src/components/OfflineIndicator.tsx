import { useOffline } from "@/hooks/use-offline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WifiOff } from "lucide-react";

export const OfflineIndicator = () => {
  const isOnline = useOffline();

  if (isOnline) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
      <Alert variant="destructive">
        <WifiOff className="h-4 w-4" />
        <AlertDescription>
          You're offline. Some features may be limited.
        </AlertDescription>
      </Alert>
    </div>
  );
};
