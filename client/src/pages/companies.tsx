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
import { Calendar, ChevronDown, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function CompaniesPage() {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const { data: companies = [] } = useQuery({
    queryKey: ['/api/companies'],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <Input 
            placeholder="Search companies..." 
            className="w-[240px] h-[32px] text-[11px] bg-background"
          />
          <Button 
            variant="outline" 
            size="sm" 
            className="h-[32px] px-2.5 text-[11px] font-medium flex items-center gap-1.5"
          >
            <Filter className="h-[14px] w-[14px] stroke-[1.5px]" />
            Filter
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="h-[32px] px-2.5 text-[11px] font-medium flex items-center gap-1.5"
          >
            Sort
            <ChevronDown className="h-[14px] w-[14px] stroke-[1.5px]" />
          </Button>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px] p-0">
                <div className="h-[40px] flex items-center justify-center">
                  <Checkbox className="h-[14px] w-[14px]" />
                </div>
              </TableHead>
              <TableHead className="text-[11px] font-medium">Name</TableHead>
              <TableHead className="text-[11px] font-medium">Domain Name</TableHead>
              <TableHead className="text-[11px] font-medium">Created by</TableHead>
              <TableHead className="text-[11px] font-medium">Account Owner</TableHead>
              <TableHead className="text-[11px] font-medium">Creation date</TableHead>
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
                  <span className="text-[11px] text-muted-foreground">{company.domain}</span>
                </TableCell>
                <TableCell className="py-0">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-[16px] w-[16px]" />
                    <span className="text-[11px]">{company.createdBy}</span>
                  </div>
                </TableCell>
                <TableCell className="py-0">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-[16px] w-[16px]" />
                    <span className="text-[11px]">{company.accountOwner}</span>
                  </div>
                </TableCell>
                <TableCell className="py-0">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-[14px] w-[14px] text-muted-foreground stroke-[1.5px]" />
                    <span className="text-[11px] text-muted-foreground">
                      {company.createdAt ? formatDistanceToNow(new Date(company.createdAt), { addSuffix: true }) : '-'}
                    </span>
                  </div>
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