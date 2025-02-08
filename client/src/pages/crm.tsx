import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Contact, Company, Message, insertContactSchema, insertCompanySchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { 
  Card, CardContent, CardHeader, 
  CardTitle, CardDescription 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Form, FormControl, FormField, 
  FormItem, FormLabel, FormMessage 
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Users, Building2, ArrowLeft, Plus,
  MessageSquare, ChevronRight 
} from "lucide-react";
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function CRM() {
  const { toast } = useToast();
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: messages } = useQuery<Message[]>({
    queryKey: ["/api/contacts", selectedContactId, "messages"],
    enabled: !!selectedContactId,
  });

  // Contact Form
  const contactForm = useForm({
    resolver: zodResolver(insertContactSchema),
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contacts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Contact created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create contact",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Company Form
  const companyForm = useForm({
    resolver: zodResolver(insertCompanySchema),
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/companies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Company created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Contacts Column */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Contacts</CardTitle>
                <CardDescription>Manage your Telegram contacts</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Contact</DialogTitle>
                  </DialogHeader>
                  <Form {...contactForm}>
                    <form onSubmit={contactForm.handleSubmit(data => 
                      createContactMutation.mutate(data)
                    )} 
                    className="space-y-4">
                      <FormField
                        control={contactForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="telegramId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telegram ID</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="companyId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              value={field.value?.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select company" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {companies?.map((company) => (
                                  <SelectItem 
                                    key={company.id} 
                                    value={company.id.toString()}
                                  >
                                    {company.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={createContactMutation.isPending}
                      >
                        Create Contact
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {contacts && contacts.length > 0 ? (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <Button
                      key={contact.id}
                      variant={selectedContactId === contact.id ? "secondary" : "ghost"}
                      className="w-full justify-between"
                      onClick={() => setSelectedContactId(contact.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {contact.name}
                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No contacts yet</p>
              )}
            </CardContent>
          </Card>

          {/* Companies Column */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Companies</CardTitle>
                <CardDescription>Manage organizations</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Company</DialogTitle>
                  </DialogHeader>
                  <Form {...companyForm}>
                    <form onSubmit={companyForm.handleSubmit(data => 
                      createCompanyMutation.mutate(data)
                    )} 
                    className="space-y-4">
                      <FormField
                        control={companyForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={createCompanyMutation.isPending}
                      >
                        Create Company
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {companies && companies.length > 0 ? (
                <div className="space-y-2">
                  {companies.map((company) => (
                    <div
                      key={company.id}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted"
                    >
                      <Building2 className="h-4 w-4" />
                      <span>{company.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No companies yet</p>
              )}
            </CardContent>
          </Card>

          {/* Messages Column */}
          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
              <CardDescription>
                {selectedContactId 
                  ? "Recent messages and sentiment"
                  : "Select a contact to view messages"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedContactId && messages ? (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className="border-b pb-4">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-sm text-muted-foreground">
                          {new Date(message.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1">{message.content}</p>
                      {message.sentiment && (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          message.sentiment === "positive" 
                            ? "bg-green-100 text-green-800"
                            : message.sentiment === "negative"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {message.sentiment}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a contact to view their message history
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
