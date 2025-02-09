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
    <div className="min-h-screen bg-background flex dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-[280px] flex flex-col border-r bg-card/50 backdrop-blur dark:bg-gray-900 dark:border-gray-800">
        {/* Logo area */}
        <div className="h-[60px] flex items-center gap-2 px-4 border-b dark:border-gray-800">
          <MessageSquare className="h-6 w-6 text-primary dark:text-gray-400" />
          <span className="font-semibold text-lg dark:text-gray-200">TelegramCRM</span>
        </div>

        {/* Command Menu */}
        <div className="px-4 py-3">
          <Button 
            variant="outline" 
            className="w-full justify-between text-muted-foreground hover:text-foreground dark:bg-gray-800 dark:border-gray-700"
          >
            <div className="flex items-center">
              <Search className="h-4 w-4 mr-2" />
              <span>Search...</span>
            </div>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navigation.map((item) => (
            <Link key={item.name} href={item.href}>
              <Button
                variant={item.current ? "secondary" : "ghost"}
                className="w-full justify-start h-10 px-3 hover:bg-accent"
              >
                <item.icon className="h-[18px] w-[18px] mr-3 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium">{item.name}</span>
              </Button>
            </Link>
          ))}
        </nav>

        {/* Workspace Selector */}
        <div className="p-4 border-t dark:border-gray-800">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-between hover:bg-accent">
                <div className="flex items-center">
                  <Avatar className="h-5 w-5 mr-2" />
                  <span className="text-sm">Workspace</span>
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[240px]">
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Create New Workspace</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* User Menu */}
        <div className="p-4 border-t dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Avatar className="h-8 w-8 mr-2" />
              <div className="flex flex-col">
                <span className="text-sm font-medium dark:text-gray-200">{user.username}</span>
                <span className="text-xs text-muted-foreground">Admin</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              className="hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="h-[60px] border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-6 dark:bg-gray-900 dark:border-gray-800">
          <h1 className="text-xl font-semibold dark:text-gray-200">
            {navigation.find((item) => item.current)?.name || "Dashboard"}
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="hover:bg-accent">
              <BellIcon className="h-[18px] w-[18px]" />
            </Button>
            <Button className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}