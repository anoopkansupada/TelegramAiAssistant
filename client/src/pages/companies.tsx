import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, Search, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { Company } from "@shared/schema";

export default function CompaniesPage() {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  const handleSelectAll = () => {
    if (selectedRows.size === companies.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(companies.map((company) => company.id)));
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Companies</h1>
          <p className="text-sm text-muted-foreground">
            Manage your organization contacts
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search companies..." 
                className="pl-8 w-[300px]"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox 
                    checked={selectedRows.size === companies.length && companies.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-2">
                    Name
                    {sortConfig?.key === 'name' && (
                      sortConfig.direction === 'asc' ? 
                      <ArrowUp className="h-4 w-4" /> : 
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('createdAt')}>
                  <div className="flex items-center gap-2">
                    Created
                    {sortConfig?.key === 'createdAt' && (
                      sortConfig.direction === 'asc' ? 
                      <ArrowUp className="h-4 w-4" /> : 
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedRows.has(company.id)}
                      onCheckedChange={(checked) => {
                        const newSelected = new Set(selectedRows);
                        if (checked) {
                          newSelected.add(company.id);
                        } else {
                          newSelected.delete(company.id);
                        }
                        setSelectedRows(newSelected);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8" />
                      <div>
                        <div className="font-medium">{company.name}</div>
                        {company.email && (
                          <div className="text-sm text-muted-foreground">
                            {company.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {company.industry && (
                      <Badge variant="secondary">
                        {company.industry}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {company.city && company.country && (
                      <span className="text-sm text-muted-foreground">
                        {`${company.city}, ${company.country}`}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {company.size && (
                      <span className="text-sm text-muted-foreground">
                        {company.size}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(company.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}