import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertChannelInvitationSchema, TelegramChannel, ChannelInvitation } from "@shared/schema";
import { MessageSquare, Plus, Link as LinkIcon, Calendar, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function ChannelsPage() {
  const { toast } = useToast();
  const { data: channels } = useQuery<TelegramChannel[]>({
    queryKey: ["/api/telegram-channels"],
  });

  const form = useForm({
    resolver: zodResolver(insertChannelInvitationSchema),
  });

  const createInvitationMutation = useMutation({
    mutationFn: async (data: { channelId: number, maxUses?: number, expiresAt?: string }) => {
      const res = await apiRequest("POST", `/api/channels/${data.channelId}/invitations`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/channels/${variables.channelId}/invitations`]
      });
      toast({ title: "Invitation link created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async ({ channelId, invitationId }: { channelId: number, invitationId: number }) => {
      const res = await apiRequest(
        "POST", 
        `/api/channels/${channelId}/invitations/${invitationId}/revoke`
      );
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/channels/${variables.channelId}/invitations`]
      });
      toast({ title: "Invitation revoked successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to revoke invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Telegram Channels</h1>
      </div>

      <div className="grid gap-4">
        {channels?.map((channel) => {
          const { data: invitations } = useQuery<ChannelInvitation[]>({
            queryKey: [`/api/channels/${channel.id}/invitations`],
          });

          return (
            <Card key={channel.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-medium">{channel.name}</CardTitle>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Invite
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Channel Invitation</DialogTitle>
                      </DialogHeader>
                      <Form {...form}>
                        <form 
                          onSubmit={form.handleSubmit((data) => 
                            createInvitationMutation.mutate({
                              channelId: channel.id,
                              ...data,
                            })
                          )} 
                          className="space-y-4"
                        >
                          <FormField
                            control={form.control}
                            name="maxUses"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Max Uses</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field}
                                    placeholder="Leave empty for unlimited"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="expiresAt"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Expires At</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="datetime-local" 
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <Button 
                            type="submit" 
                            className="w-full"
                            disabled={createInvitationMutation.isPending}
                          >
                            Create Invitation
                          </Button>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="text-sm text-muted-foreground">
                    Type: {channel.type}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Created: {new Date(channel.createdAt).toLocaleDateString()}
                  </div>

                  {/* Active Invitations */}
                  {invitations && invitations.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-2">Active Invitations</h3>
                      <div className="space-y-2">
                        {invitations.filter(inv => inv.status === 'active').map((invitation) => (
                          <div 
                            key={invitation.id} 
                            className="flex items-center justify-between p-2 border rounded"
                          >
                            <div className="flex items-center gap-2">
                              <LinkIcon className="h-4 w-4 text-muted-foreground" />
                              <a 
                                href={invitation.inviteLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm hover:underline"
                              >
                                {invitation.inviteLink}
                              </a>
                            </div>
                            <div className="flex items-center gap-4">
                              {invitation.maxUses && (
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Users className="h-4 w-4" />
                                  {invitation.currentUses}/{invitation.maxUses}
                                </span>
                              )}
                              {invitation.expiresAt && (
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {new Date(invitation.expiresAt).toLocaleDateString()}
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => revokeInvitationMutation.mutate({
                                  channelId: channel.id,
                                  invitationId: invitation.id,
                                })}
                                disabled={revokeInvitationMutation.isPending}
                              >
                                Revoke
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {channels?.length === 0 && (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                No channels found. Add the bot to a Telegram channel or group to see it here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}