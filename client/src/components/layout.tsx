import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Users,
  MessageSquare,
  Settings,
  Building2,
  LogOut,
  Search,
  Plus,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  if (!user) {
    return children;
  }

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: MessageSquare,
      current: location === "/",
    },
    {
      name: "People",
      href: "/crm",
      icon: Users,
      current: location === "/crm",
    },
    {
      name: "Companies",
      href: "/companies",
      icon: Building2,
      current: location === "/companies",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 flex flex-col border-r bg-card">
        {/* Logo area */}
        <div className="h-16 flex items-center gap-2 px-4">
          <MessageSquare className="h-8 w-8 text-primary" />
          <span className="font-semibold text-xl">TelegramCRM</span>
        </div>

        {/* Search */}
        <div className="px-4 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8 bg-background"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => (
            <Link key={item.name} href={item.href}>
              <Button
                variant={item.current ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </Button>
            </Link>
          ))}
        </nav>

        {/* Workspace Selector */}
        <div className="p-4 border-t">
          <Button variant="ghost" className="w-full justify-between">
            <div className="flex items-center">
              <Avatar className="h-5 w-5 mr-2" />
              <span>Workspace</span>
            </div>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        {/* User Menu */}
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Avatar className="h-8 w-8 mr-2" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user.username}</span>
                <span className="text-xs text-muted-foreground">Admin</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 border-b bg-card/50 backdrop-blur flex items-center justify-between px-6">
          <h1 className="text-xl font-semibold">
            {navigation.find((item) => item.current)?.name || "Dashboard"}
          </h1>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add New
          </Button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}