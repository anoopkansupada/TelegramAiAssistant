import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Building2,
  MessageSquare,
  Megaphone,
  Bot,
  Share2,
} from "lucide-react";
import {
  Contact,
  Company,
  Announcement,
  TelegramChannel,
} from "@shared/schema";

export default function Dashboard() {
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

  return (
    <div>
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

        <Link href="/telegram-login">
          <Card className="hover:border-primary cursor-pointer transition-colors">
            <CardContent className="flex items-center gap-4 pt-6">
              <Bot className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Telegram Auth</h2>
                <p className="text-sm text-muted-foreground">
                  Connect your Telegram account
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
                  Manage Telegram channels
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
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
        <CardHeader>
          <CardTitle>Recent Announcements</CardTitle>
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
    </div>
  );
}