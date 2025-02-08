import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import {
  Users,
  Building2,
  MessageSquare,
  Megaphone,
  PieChart,
  LogOut,
  Plus,
  Share2,
} from "lucide-react";
import {
  Message,
  Contact,
  Company,
  Announcement,
  TelegramChannel,
} from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAnnouncementSchema } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useState } from "react";

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
  });

  const { data: channels } = useQuery<TelegramChannel[]>({
    queryKey: ["/api/telegram-channels"],
  });

  const form = useForm({
    resolver: zodResolver(insertAnnouncementSchema),
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: { content: string; targetChannelIds?: string[] }) => {
      const res = await apiRequest("POST", "/api/announcements", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Announcement sent successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send announcement",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [selectedChannels, setSelectedChannels] = useState<TelegramChannel[]>([]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            <h1 className="text-xl font-bold">TelegramCRM</h1>
          </div>
          <div className="flex items-center gap-4">
            <span>Welcome, {user?.username}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link href="/crm">
            <Card className="hover:border-primary cursor-pointer transition-colors">
              <CardContent className="flex items-center gap-4 pt-6">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">CRM</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage contacts and companies
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/channels">
            <Card className="hover:border-primary cursor-pointer transition-colors">
              <CardContent className="flex items-center gap-4 pt-6">
                <Share2 className="h-8 w-8 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Channels</h2>
                  <p className="text-sm text-muted-foreground">
                    View connected Telegram channels
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <PieChart className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Analytics</h2>
                <p className="text-sm text-muted-foreground">
                  View message sentiment and trends
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{contacts?.length || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Companies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{companies?.length || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Announcements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{announcements?.length || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Messages Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">-</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Announcements */}
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Announcements</CardTitle>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Announcement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Announcement</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((data) =>
                      createAnnouncementMutation.mutate({
                        content: data.content,
                        targetChannelIds: selectedChannels.map((c) => c.telegramId),
                      })
                    )}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Announcement Content</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Write your announcement here..."
                              className="h-32"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <FormLabel>Target Channels/Groups</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start">
                            {selectedChannels.length > 0 ? (
                              <span>{selectedChannels.length} channels selected</span>
                            ) : (
                              <span>Select channels...</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder="Search channels..." />
                            <CommandEmpty>No channels found.</CommandEmpty>
                            <CommandGroup>
                              {channels?.map((channel) => (
                                <CommandItem
                                  key={channel.id}
                                  onSelect={() => {
                                    if (selectedChannels.some((c) => c.id === channel.id)) {
                                      setSelectedChannels(selectedChannels.filter((c) => c.id !== channel.id));
                                    } else {
                                      setSelectedChannels([...selectedChannels, channel]);
                                    }
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedChannels.some((c) => c.id === channel.id)
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {channel.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <p className="text-sm text-muted-foreground">
                        Leave empty to send to all channels
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createAnnouncementMutation.isPending}
                    >
                      Send Announcement
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {announcements && announcements.length > 0 ? (
              <div className="space-y-4">
                {announcements.slice(0, 5).map((announcement) => (
                  <div key={announcement.id} className="border-b pb-4">
                    <p className="text-sm text-muted-foreground">
                      {new Date(announcement.createdAt).toLocaleDateString()}
                    </p>
                    <p className="mt-1">{announcement.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No announcements yet</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}