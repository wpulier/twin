import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Send, RefreshCw, Info, Edit2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserForm } from "@/components/user-form";
import { queryClient } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { type User, type Message } from "@shared/schema";

export default function Chat() {
  const { id } = useParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      message: "",
    },
  });

  const { data: user } = useQuery<User>({
    queryKey: [`/api/users/${id}`],
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: [`/api/users/${id}/messages`],
    enabled: !isStreaming, // Don't fetch messages while streaming
  });

  const updateUser = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated!",
        description: "Your digital twin's personality has been refreshed.",
      });
      setShowEditForm(false);
      queryClient.invalidateQueries({ queryKey: [`/api/users/${id}`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      setIsStreaming(true);
      setStreamingMessage("");
      form.reset();
      setOptimisticMessage(content); // Set optimistic message immediately

      try {
        const response = await fetch(`/api/users/${id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        let isFirstChunk = true;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = new TextDecoder().decode(value);

          // First chunk contains the user message object
          if (isFirstChunk) {
            isFirstChunk = false;
            try {
              // Add user message to the messages array
              const { userMessage } = JSON.parse(text.split('\n')[0]);
              queryClient.setQueryData([`/api/users/${id}/messages`], (old: Message[] = []) => [...old, userMessage]);
              setOptimisticMessage(null); // Clear optimistic message once confirmed
              continue;
            } catch (e) {
              console.error('Failed to parse user message:', e);
            }
          }

          setStreamingMessage(prev => prev + text);
        }
      } finally {
        setIsStreaming(false);
        queryClient.invalidateQueries({ queryKey: [`/api/users/${id}/messages`] });
        setOptimisticMessage(null); // Clear optimistic message in case of error
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsStreaming(false);
      setOptimisticMessage(null); // Clear optimistic message on error
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMessage, optimisticMessage]);

  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col h-screen bg-background"
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex-1" />
        <h1 className="text-xl font-semibold flex-1 text-center">Chat with {user.name}</h1>
        <div className="flex-1 flex justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowEditForm(true)}
            title="Edit Twin Info"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowPrompt(true)}
            title="View System Prompt"
          >
            <Info className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocation("/")}
            title="Start Over"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>System Prompt for {user.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md">
              <h3 className="font-semibold mb-2">Integration Status:</h3>
              <div className="space-y-2">
                <div>
                  <span className="font-medium">Letterboxd: </span>
                  {user.letterboxdData?.status === 'success' ? (
                    <span className="text-green-600">Connected</span>
                  ) : user.letterboxdData?.status === 'error' ? (
                    <span className="text-red-600">Error: {user.letterboxdData.error}</span>
                  ) : (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                </div>
                {user.letterboxdData?.status === 'success' && (
                  <div className="pl-4 text-sm">
                    <p className="font-medium mt-2">Favorite Films:</p>
                    <ul className="list-disc pl-4">
                      {user.letterboxdData.favoriteFilms?.map((film, i) => (
                        <li key={i}>{film}</li>
                      ))}
                    </ul>
                    <p className="font-medium mt-2">Favorite Genres:</p>
                    <p>{user.letterboxdData.favoriteGenres?.join(', ')}</p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-medium">Spotify: </span>
                  {user.spotifyData?.status === 'success' ? (
                    <span className="text-green-600">Connected</span>
                  ) : user.spotifyData?.status === 'error' ? (
                    <span className="text-red-600">Error: {user.spotifyData.error}</span>
                  ) : (
                    <>
                      <span className="text-muted-foreground">Not connected</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = `/api/connect/spotify?userId=${id}`}
                      >
                        Connect Spotify
                      </Button>
                    </>
                  )}
                </div>
                {user.spotifyData?.status === 'success' && (
                  <div className="pl-4 text-sm">
                    <p className="font-medium mt-2">Top Artists:</p>
                    <p>{user.spotifyData.topArtists?.join(', ')}</p>
                    <p className="font-medium mt-2">Favorite Music Genres:</p>
                    <p>{user.spotifyData.topGenres?.join(', ')}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-muted p-4 rounded-md">
              <h3 className="font-semibold mb-2">Personality Profile:</h3>
              <pre className="whitespace-pre-wrap text-sm">
                {JSON.stringify(user.twinPersonality || {}, null, 2)}
              </pre>
            </div>

            <div className="bg-muted p-4 rounded-md">
              <h3 className="font-semibold mb-2">Chat Prompt Template:</h3>
              <pre className="whitespace-pre-wrap text-sm">
                {`You are roleplaying as ${user.name}, a digital twin of the user. Stay in character throughout the conversation.

Your Personality Profile:
- Name: ${user.name}
- Key Interests: [From profile]
- Communication Style: [From profile]
- Notable Traits: [From profile]

Additional Context About You:
[Personality Insight from Analysis]

Your Role:
- You are a digital twin who shares the exact same traits and interests as shown in your profile
- Only discuss topics and preferences that are evidenced in your profile
- If asked about preferences or interests not in your profile, acknowledge that you're still learning about those aspects
- Stay consistently in character, using your defined communication style`}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex-1 p-4">
        <ScrollArea ref={scrollRef} className="h-full pr-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <Card
                key={message.id}
                className={`max-w-[80%] ${
                  message.fromUser ? "ml-auto bg-primary text-primary-foreground" : "mr-auto"
                }`}
              >
                <CardContent className="p-3">
                  <p className="text-sm">{message.content}</p>
                </CardContent>
              </Card>
            ))}
            {optimisticMessage && (
              <Card className="max-w-[80%] ml-auto bg-primary text-primary-foreground">
                <CardContent className="p-3">
                  <p className="text-sm">{optimisticMessage}</p>
                </CardContent>
              </Card>
            )}
            {(isStreaming || (streamingMessage && !messages.some(m => m.content === streamingMessage))) && (
              <Card className="max-w-[80%] mr-auto">
                <CardContent className="p-3">
                  <p className="text-sm">{streamingMessage}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="p-4 border-t">
        <form
          onSubmit={form.handleSubmit((data) => sendMessage.mutate(data.message))}
          className="flex gap-2"
        >
          <Input
            {...form.register("message")}
            placeholder={`Message ${user.name}...`}
            disabled={sendMessage.isPending}
          />
          <Button type="submit" disabled={sendMessage.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </motion.div>
  );
}