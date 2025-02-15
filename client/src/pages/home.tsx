import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserForm } from "@/components/user-form";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TwinCreationLoading } from "@/components/twin-creation-loading";
import { motion } from "framer-motion";
import { useEffect } from "react";

export default function Home() {
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Handle form data restoration after Spotify OAuth
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const spotifyStatus = searchParams.get('spotify');
    const pendingData = localStorage.getItem('pendingTwinData');

    if (spotifyStatus === 'connected') {
      toast({
        title: "Spotify Connected!",
        description: "Your music preferences will be included in your twin's personality.",
      });
    }

    if (pendingData) {
      localStorage.removeItem('pendingTwinData');
    }
  }, [toast]);

  const createUser = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Twin created!",
        description: "Your digital twin is ready to chat.",
      });
      setLocation(`/chat/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-4">
      {createUser.isPending && <TwinCreationLoading />}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto pt-12"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Create Your Digital Twin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UserForm
              onSubmit={(data) => createUser.mutate(data)}
              submitText="Create Twin"
              isSubmitting={createUser.isPending}
              defaultValues={
                localStorage.getItem('pendingTwinData')
                  ? JSON.parse(localStorage.getItem('pendingTwinData')!)
                  : undefined
              }
            />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}