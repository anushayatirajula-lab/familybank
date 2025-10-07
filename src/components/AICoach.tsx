import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, BookOpen, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AICoachProps {
  childAge?: number;
}

const AICoach = ({ childAge }: AICoachProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"chat" | "lesson" | "quiz">("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (userMessage?: string) => {
    const messageToSend = userMessage || input.trim();
    if (!messageToSend || loading) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: messageToSend },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-coach", {
        body: {
          messages: newMessages,
          childAge: childAge || 10,
          mode: mode,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage = data.choices[0]?.message?.content;
      if (assistantMessage) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: assistantMessage },
        ]);
      }
    } catch (error: any) {
      console.error("AI Coach error:", error);
      toast({
        variant: "destructive",
        title: "Oops!",
        description: error.message || "I'm having trouble right now. Please try again!",
      });
    } finally {
      setLoading(false);
    }
  };

  const startLesson = () => {
    setMode("lesson");
    setMessages([]);
    sendMessage("Hi! I want to learn about saving money.");
  };

  const startQuiz = () => {
    setMode("quiz");
    setMessages([]);
    sendMessage("I'm ready for a quiz!");
  };

  const resetChat = () => {
    setMode("chat");
    setMessages([]);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle>FamilyBank Coach</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={startLesson}
              disabled={loading}
            >
              <BookOpen className="h-4 w-4 mr-1" />
              Lesson
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={startQuiz}
              disabled={loading}
            >
              <Trophy className="h-4 w-4 mr-1" />
              Quiz
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 p-4">
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary opacity-50" />
              <p className="text-sm">
                Hi! I'm your FamilyBank Coach. 👋
                <br />
                Start a lesson or ask me anything about money!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-primary rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      />
                      <div
                        className="w-2 h-2 bg-primary rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            placeholder="Ask me about money..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            disabled={loading}
          />
          <Button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={resetChat}>
            Start Over
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default AICoach;
