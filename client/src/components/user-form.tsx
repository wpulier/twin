import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type User } from "@shared/schema";
import { SiSpotify } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

interface UserFormProps {
  onSubmit: (data: any) => void;
  defaultValues?: Partial<User>;
  submitText?: string;
  isSubmitting?: boolean;
}

export function UserForm({ onSubmit, defaultValues, submitText = "Submit", isSubmitting = false }: UserFormProps) {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      letterboxdUrl: defaultValues?.letterboxdUrl ?? "",
      bio: defaultValues?.bio ?? ""
    }
  });

  const handleSpotifyConnect = async (e: React.MouseEvent) => {
    e.preventDefault();
    console.log('Initiating Spotify connection...');

    try {
      // Store form data in localStorage before redirecting
      const formData = form.getValues();
      localStorage.setItem('pendingTwinData', JSON.stringify(formData));

      // Use a programmatic redirect to the Spotify OAuth endpoint
      window.location.assign(`/api/connect/spotify?userId=pending`);
    } catch (error) {
      console.error('Error initiating Spotify connection:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to connect to Spotify. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Twin's Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter a name for your digital twin..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="letterboxdUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Letterboxd Profile URL (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="https://letterboxd.com/..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tell us about yourself</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Share your interests, favorite movies/shows/music, and what kind of conversations you'd like to have..."
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Spotify Integration</h4>
              <p className="text-sm text-muted-foreground">
                {defaultValues?.spotifyData?.status === 'success'
                  ? 'Connected! Your music preferences are enhancing your twin.'
                  : 'Connect your Spotify account to enhance your twin with your music preferences.'}
              </p>
            </div>
            {(!defaultValues?.spotifyData || defaultValues.spotifyData.status !== 'success') && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={handleSpotifyConnect}
              >
                <SiSpotify className="h-4 w-4" />
                Connect Spotify
              </Button>
            )}
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : submitText}
        </Button>
      </form>
    </Form>
  );
}