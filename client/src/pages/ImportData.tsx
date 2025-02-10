import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
//import { apiRequest } from "@/lib/queryClient"; //Removed as fetch is used instead

export default function ImportData() {
  const { toast } = useToast();

  const handleImport = async () => {
    try {
      const response = await fetch("/api/import-telegram-data", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Telegram data import started successfully",
        });
      } else {
        throw new Error("Import failed");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to import Telegram data",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Import Telegram Data</h1>
      <p className="mb-4">Click the button below to import your Telegram data from the uploaded files.</p>
      <Button onClick={handleImport}>
        Start Import
      </Button>
    </div>
  );
}