import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Contact, Company, Message, insertContactSchema } from "@shared/schema";
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
  Users, Plus, ChevronRight
} from "lucide-react";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function PeoplePage() {
  const { toast } = useToast();
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">People</h1>
          <p className="text-sm text-muted-foreground">
            Manage your contacts and their information
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            {/* Contact Form - Same as before */}
          </DialogContent>
        </Dialog>
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contacts && contacts.length > 0 ? (
          contacts.map((contact) => (
            <Card key={contact.id} className="hover:border-primary transition-colors">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">
                      {`${contact.firstName} ${contact.lastName || ''}`}
                    </CardTitle>
                  </div>
                  <Badge variant="secondary">{contact.status}</Badge>
                </div>
                {contact.jobTitle && (
                  <CardDescription>
                    {[contact.jobTitle, contact.department].filter(Boolean).join(' • ')}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {contact.email && (
                    <div className="text-sm">
                      ✉️ {contact.email}
                    </div>
                  )}
                  {contact.phone && (
                    <div className="text-sm">
                      📱 {contact.phone}
                    </div>
                  )}
                  {contact.telegramUsername && (
                    <div className="text-sm">
                      💬 @{contact.telegramUsername}
                    </div>
                  )}
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {contact.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No contacts yet</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Get started by adding your first contact
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
