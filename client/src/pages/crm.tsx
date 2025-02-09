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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Contact</DialogTitle>
                  </DialogHeader>
                  <Form {...contactForm}>
                    <form onSubmit={contactForm.handleSubmit(data => 
                      createContactMutation.mutate(data)
                    )} 
                    className="space-y-6">
                      {/* Basic Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={contactForm.control}
                            name="firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>First Name</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contactForm.control}
                            name="lastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Last Name</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={contactForm.control}
                            name="jobTitle"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Job Title</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contactForm.control}
                            name="department"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Department</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Contact Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Contact Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={contactForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input {...field} type="email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contactForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone</FormLabel>
                                <FormControl>
                                  <Input {...field} type="tel" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Social Media */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Social Media</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={contactForm.control}
                            name="linkedinUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>LinkedIn URL</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contactForm.control}
                            name="twitterHandle"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Twitter Handle</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={contactForm.control}
                          name="facebookUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Facebook URL</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Telegram Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Telegram Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={contactForm.control}
                            name="telegramId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Telegram ID</FormLabel>
                                <FormControl>
                                  <Input {...field} required />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contactForm.control}
                            name="telegramUsername"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Telegram Username</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Communication Preferences */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Communication Preferences</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={contactForm.control}
                            name="preferredContactMethod"
                            render={({ field }) => (
                              <FormItem>
fheader                                <FormLabel>Preferred Contact Method</FormLabel>
                                <Select 
                                  onValueChange={field.onChange}
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select method" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="phone">Phone</SelectItem>
                                    <SelectItem value="telegram">Telegram</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contactForm.control}
                            name="timeZone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Time Zone</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Status and Tags */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Status and Tags</h3>
                        <FormField
                          control={contactForm.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select 
                                onValueChange={field.onChange}
                                value={field.value}
                                defaultValue="active"
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="inactive">Inactive</SelectItem>
                                  <SelectItem value="do-not-contact">Do Not Contact</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={contactForm.control}
                          name="tags"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tags (comma-separated)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  onChange={(e) => {
                                    const tags = e.target.value.split(',').map(tag => tag.trim());
                                    field.onChange(tags);
                                  }}
                                  value={field.value?.join(', ') || ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Company Association */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Company</h3>
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
                      </div>

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
                        {`${contact.firstName} ${contact.lastName || ''}`}
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
                    className="space-y-6">
                      {/* Basic Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Basic Information</h3>
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
                        <FormField
                          control={companyForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Contact Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Contact Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={companyForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input {...field} type="email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={companyForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone</FormLabel>
                                <FormControl>
                                  <Input {...field} type="tel" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={companyForm.control}
                          name="website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Website</FormLabel>
                              <FormControl>
                                <Input {...field} type="url" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Location */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Location</h3>
                        <FormField
                          control={companyForm.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address</FormLabel>
                              <FormControl>
                                <Textarea {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={companyForm.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>City</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={companyForm.control}
                            name="country"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Country</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Social Media */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Social Media</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={companyForm.control}
                            name="linkedinUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>LinkedIn URL</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={companyForm.control}
                            name="twitterHandle"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Twitter Handle</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Additional Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Additional Information</h3>
                        <FormField
                          control={companyForm.control}
                          name="industry"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Industry</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={companyForm.control}
                            name="size"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Company Size</FormLabel>
                                <Select 
                                  onValueChange={field.onChange}
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select size" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="1-10">1-10 employees</SelectItem>
                                    <SelectItem value="11-50">11-50 employees</SelectItem>
                                    <SelectItem value="51-200">51-200 employees</SelectItem>
                                    <SelectItem value="201-500">201-500 employees</SelectItem>
                                    <SelectItem value="501-1000">501-1000 employees</SelectItem>
                                    <SelectItem value="1000+">1000+ employees</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={companyForm.control}
                            name="revenue"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Annual Revenue</FormLabel>
                                <Select 
                                  onValueChange={field.onChange}
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select revenue" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="<1M">Less than $1M</SelectItem>
                                    <SelectItem value="1M-10M">$1M - $10M</SelectItem>
                                    <SelectItem value="10M-50M">$10M - $50M</SelectItem>
                                    <SelectItem value="50M-100M">$50M - $100M</SelectItem>
                                    <SelectItem value="100M+">$100M+</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Tags</h3>
                        <FormField
                          control={companyForm.control}
                          name="tags"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tags (comma-separated)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  onChange={(e) => {
                                    const tags = e.target.value.split(',').map(tag => tag.trim());
                                    field.onChange(tags);
                                  }}
                                  value={field.value?.join(', ') || ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

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
                      <div className="space-y-4">
                        {companies.map((company) => (
                          <div
                            key={company.id}
                            className="p-4 rounded-lg border hover:border-primary transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-primary" />
                                <h3 className="font-medium">{company.name}</h3>
                              </div>
                              {company.industry && (
                                <Badge variant="secondary">{company.industry}</Badge>
                              )}
                            </div>
                            {company.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {company.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {company.tags?.map((tag) => (
                                <Badge key={tag} variant="outline">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            {(company.city || company.country) && (
                              <p className="text-sm text-muted-foreground mt-2">
                                📍 {[company.city, company.country].filter(Boolean).join(', ')}
                              </p>
                            )}
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