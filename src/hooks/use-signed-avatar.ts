import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a child avatar to a signed URL.
 * avatar_url can be either a storage path (e.g. "childId/avatar.png")
 * or a legacy full public URL. Returns null while loading.
 */
export function useSignedAvatar(avatarUrl: string | null | undefined): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarUrl) {
      setSignedUrl(null);
      return;
    }

    // If it looks like a storage path (no "http"), create a signed URL
    const isPath = !avatarUrl.startsWith("http");
    if (isPath) {
      supabase.storage
        .from("child-avatars")
        .createSignedUrl(avatarUrl, 3600)
        .then(({ data }) => {
          setSignedUrl(data?.signedUrl ?? null);
        })
        .catch(() => setSignedUrl(null));
    } else {
      // Legacy: was stored as full URL — display as-is (may break for old records)
      setSignedUrl(avatarUrl);
    }
  }, [avatarUrl]);

  return signedUrl;
}
