import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const JAR_TYPES = ["TOYS", "BOOKS", "SHOPPING", "CHARITY", "WISHLIST"] as const;

interface JarPercentageEditorProps {
  childId: string;
  childName: string;
  onUpdate?: () => void;
}

export const JarPercentageEditor = ({ childId, childName, onUpdate }: JarPercentageEditorProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jarPercentages, setJarPercentages] = useState<Record<string, number>>({
    TOYS: 20,
    BOOKS: 20,
    SHOPPING: 20,
    CHARITY: 20,
    WISHLIST: 20,
  });

  useEffect(() => {
    if (open) {
      fetchCurrentPercentages();
    }
  }, [open, childId]);

  const fetchCurrentPercentages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("jars")
        .select("jar_type, percentage")
        .eq("child_id", childId);

      if (error) throw error;

      if (data && data.length > 0) {
        const percentages: Record<string, number> = {};
        data.forEach((jar) => {
          percentages[jar.jar_type] = jar.percentage;
        });
        setJarPercentages(percentages);
      }
    } catch (error) {
      console.error("Error fetching jar percentages:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load current jar percentages.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePercentageChange = (jar: string, value: number[]) => {
    setJarPercentages((prev) => ({ ...prev, [jar]: value[0] }));
  };

  const getTotalPercentage = () => {
    return Object.values(jarPercentages).reduce((sum, val) => sum + val, 0);
  };

  const handleSave = async () => {
    if (getTotalPercentage() !== 100) {
      toast({
        variant: "destructive",
        title: "Invalid percentages",
        description: "Jar percentages must total exactly 100%",
      });
      return;
    }

    setSaving(true);
    try {
      // Update each jar's percentage
      for (const jarType of JAR_TYPES) {
        const { error } = await supabase
          .from("jars")
          .update({ percentage: jarPercentages[jarType] })
          .eq("child_id", childId)
          .eq("jar_type", jarType);

        if (error) throw error;
      }

      toast({
        title: "Percentages updated!",
        description: `${childName}'s jar distribution has been updated.`,
      });

      setOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error updating jar percentages:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update jar percentages.",
      });
    } finally {
      setSaving(false);
    }
  };

  const getJarColor = (jarType: string) => {
    const colors: Record<string, string> = {
      TOYS: "bg-jar-toys",
      BOOKS: "bg-jar-books",
      SHOPPING: "bg-jar-shopping",
      CHARITY: "bg-jar-charity",
      WISHLIST: "bg-jar-wishlist",
    };
    return colors[jarType] || "bg-primary";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-2 h-4 w-4" />
          Edit Jar Split
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Jar Percentages</DialogTitle>
          <DialogDescription>
            Adjust how {childName}'s earnings are split across jars. Must total 100%.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm font-medium">
                Current total:{" "}
                <span className={getTotalPercentage() === 100 ? "text-green-600" : "text-destructive"}>
                  {getTotalPercentage()}%
                </span>
                {getTotalPercentage() === 100 ? " ✓" : " ⚠️"}
              </p>
            </div>

            {JAR_TYPES.map((jar) => (
              <div key={jar} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded ${getJarColor(jar)}`} />
                    <Label className="capitalize">{jar.toLowerCase()}</Label>
                  </div>
                  <span className="font-semibold text-primary">
                    {jarPercentages[jar]}%
                  </span>
                </div>
                <Slider
                  value={[jarPercentages[jar]]}
                  onValueChange={(value) => handlePercentageChange(jar, value)}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
            ))}

            <Button
              onClick={handleSave}
              className="w-full"
              disabled={saving || getTotalPercentage() !== 100}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
