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
import { ArrowDown, ArrowUp, Filter, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function CompaniesPage() {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const { data: companies = [] } = useQuery({
    queryKey: ['/api/companies'],
  });

  const handleSelectAll = () => {
    if (selectedRows.size === companies.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(companies.map((company: any) => company.id)));
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-muted-foreground stroke-[1.5px]" />
            <Input 
              placeholder="Search companies..." 
              className="w-[240px] h-[32px] text-[11px] pl-8 bg-background"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-[32px] px-2.5 text-[11px] font-medium flex items-center gap-1.5"
          >
            <Filter className="h-[14px] w-[14px] stroke-[1.5px]" />
            Filter
          </Button>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px] p-0">
                <div className="h-[40px] flex items-center justify-center">
                  <Checkbox 
                    className="h-[14px] w-[14px]"
                    checked={selectedRows.size === companies.length && companies.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </div>
              </TableHead>
              <TableHead 
                className="text-[11px] font-medium cursor-pointer hover:bg-accent/50"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Name
                  {sortConfig?.key === 'name' && (
                    sortConfig.direction === 'asc' ? 
                    <ArrowUp className="h-3 w-3 stroke-[1.5px]" /> : 
                    <ArrowDown className="h-3 w-3 stroke-[1.5px]" />
                  )}
                </div>
              </TableHead>
              <TableHead className="text-[11px] font-medium">Domain Name</TableHead>
              <TableHead className="text-[11px] font-medium">Created by</TableHead>
              <TableHead className="text-[11px] font-medium">Account Owner</TableHead>
              <TableHead 
                className="text-[11px] font-medium cursor-pointer hover:bg-accent/50"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center gap-1">
                  Creation date
                  {sortConfig?.key === 'createdAt' && (
                    sortConfig.direction === 'asc' ? 
                    <ArrowUp className="h-3 w-3 stroke-[1.5px]" /> : 
                    <ArrowDown className="h-3 w-3 stroke-[1.5px]" />
                  )}
                </div>
              </TableHead>
              <TableHead className="text-[11px] font-medium text-right">Employees</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((company: any) => (
              <TableRow key={company.id} className="h-[40px] hover:bg-accent/50">
                <TableCell className="p-0">
                  <div className="h-[40px] flex items-center justify-center">
                    <Checkbox 
                      className="h-[14px] w-[14px]"
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
                  </div>
                </TableCell>
                <TableCell className="py-0">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-[20px] w-[20px]" />
                    <span className="text-[11px] font-medium">{company.name}</span>
                  </div>
                </TableCell>
                <TableCell className="py-0">
                  <Badge variant="secondary" className="h-[20px] px-2 text-[11px] font-normal bg-accent hover:bg-accent">
                    {company.domain}
                  </Badge>
                </TableCell>
                <TableCell className="py-0">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-[16px] w-[16px]" />
                    <span className="text-[11px]">{company.createdBy || 'System'}</span>
                  </div>
                </TableCell>
                <TableCell className="py-0">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-[16px] w-[16px]" />
                    <span className="text-[11px]">{company.accountOwner}</span>
                  </div>
                </TableCell>
                <TableCell className="py-0">
                  <span className="text-[11px] text-muted-foreground">
                    {company.createdAt ? formatDistanceToNow(new Date(company.createdAt), { addSuffix: true }) : '-'}
                  </span>
                </TableCell>
                <TableCell className="py-0 text-right">
                  <span className="text-[11px] text-muted-foreground">{company.employeeCount || '-'}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}