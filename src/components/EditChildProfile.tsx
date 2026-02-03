import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Upload, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EditChildProfileProps {
  childId: string;
  childName: string;
  childAge: number | null;
  avatarUrl: string | null;
  onUpdate: () => void;
}

export const EditChildProfile = ({
  childId,
  childName,
  childAge,
  avatarUrl,
  onUpdate,
}: EditChildProfileProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(childName);
  const [age, setAge] = useState(childAge?.toString() || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please upload an image file.",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please upload an image smaller than 2MB.",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${childId}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("child-avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("child-avatars")
        .getPublicUrl(fileName);

      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setPreviewUrl(newUrl);

      // Update child record
      const { error: updateError } = await supabase
        .from("children")
        .update({ avatar_url: newUrl })
        .eq("id", childId);

      if (updateError) throw updateError;

      toast({
        title: "Avatar uploaded",
        description: "Profile picture has been updated.",
      });
      onUpdate();
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Failed to upload avatar. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Name required",
        description: "Please enter a name for the child.",
      });
      return;
    }

    const parsedAge = age ? parseInt(age, 10) : null;
    if (age && (isNaN(parsedAge!) || parsedAge! < 1 || parsedAge! > 18)) {
      toast({
        variant: "destructive",
        title: "Invalid age",
        description: "Please enter a valid age between 1 and 18.",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("children")
        .update({
          name: name.trim(),
          age: parsedAge,
        })
        .eq("id", childId);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: `${name}'s profile has been updated.`,
      });
      onUpdate();
      setOpen(false);
    } catch (error) {
      console.error("Error updating child:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Failed to update profile. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) {
        setName(childName);
        setAge(childAge?.toString() || "");
        setPreviewUrl(avatarUrl);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Child Profile</DialogTitle>
          <DialogDescription>
            Update {childName}'s name, age, or profile picture.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-24 w-24">
              <AvatarImage src={previewUrl || undefined} alt={name} />
              <AvatarFallback className="text-2xl bg-primary/10">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading}
              />
              <Button variant="outline" size="sm" disabled={uploading}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {uploading ? "Uploading..." : "Upload Photo"}
              </Button>
            </div>
          </div>

          {/* Name Field */}
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Child's name"
              className="text-base"
            />
          </div>

          {/* Age Field */}
          <div className="grid gap-2">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              min="1"
              max="18"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Child's age"
              className="text-base"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
