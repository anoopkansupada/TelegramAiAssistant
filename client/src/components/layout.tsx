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
  BellIcon,
  Command,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Header } from "@/pages/components/Header";
import { Footer } from "@/components/Footer";

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
      href: "/people",
      icon: Users,
      current: location === "/people",
    },
    {
      name: "Companies",
      href: "/companies",
      icon: Building2,
      current: location === "/companies",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-[280px] flex flex-col border-r bg-card/50 backdrop-blur dark:bg-gray-900 dark:border-gray-800">
        {/* Logo area */}
        <div className="h-[60px] flex items-center gap-2 px-4 border-b dark:border-gray-800">
          <MessageSquare className="h-[16px] w-[16px] text-primary dark:text-gray-400 stroke-[1.5px]" />
          <span className="font-semibold text-[13px] tracking-[-0.01em] dark:text-gray-200">TelegramCRM</span>
        </div>

        {/* Command Menu */}
        <div className="px-4 py-3">
          <Button 
            variant="outline" 
            className="w-full justify-between text-muted-foreground hover:text-foreground dark:bg-gray-800/50 dark:border-gray-700 h-[32px] px-2 text-[11px]"
          >
            <div className="flex items-center">
              <Search className="h-[14px] w-[14px] mr-1.5 stroke-[1.5px]" />
              <span>Search...</span>
            </div>
            <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[9px] font-medium text-muted-foreground">
              <span className="text-[9px]">⌘</span>K
            </kbd>
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-[4px]">
          {navigation.map((item) => (
            <Link key={item.name} href={item.href}>
              <Button
                variant={item.current ? "secondary" : "ghost"}
                className="w-full justify-start h-[28px] px-2 hover:bg-accent text-[11px] font-medium"
              >
                <item.icon className="h-[16px] w-[16px] mr-2 text-gray-500 dark:text-gray-400 stroke-[1.5px]" />
                <span>{item.name}</span>
              </Button>
            </Link>
          ))}
        </nav>

        {/* User Menu */}
        <div className="px-2 py-1 border-t dark:border-gray-800">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center">
              <Avatar className="h-[24px] w-[24px] mr-2" />
              <div className="flex flex-col">
                <span className="text-[11px] font-medium leading-none mb-0.5 dark:text-gray-200">
                  {user.username}
                </span>
                <span className="text-[10px] text-muted-foreground leading-none">Admin</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              className="h-[24px] w-[24px] hover:bg-accent"
            >
              <LogOut className="h-[14px] w-[14px] stroke-[1.5px]" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}