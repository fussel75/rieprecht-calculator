import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from "@/hooks/use-resources";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Building2, User, Phone, Mail, MapPin, Search, FileText } from "lucide-react";
import { downloadPdf } from "@/lib/pdf-export";
import type { Customer, InsertCustomer } from "@shared/schema";

const customerFormSchema = z.object({
  customerNumber: z.string().optional(),
  customerType: z.enum(["privat", "gewerblich"]),
  firstName: z.string().min(1, "Vorname erforderlich"),
  lastName: z.string().min(1, "Nachname erforderlich"),
  companyName: z.string().optional(),
  street: z.string().min(1, "Straße erforderlich"),
  postalCode: z.string().min(1, "PLZ erforderlich"),
  city: z.string().min(1, "Ort erforderlich"),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  email1: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
  email2: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
  skontoPercent: z.number().min(0).max(2).default(0),
  discountPercent: z.number().min(0).max(7).default(0),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

export default function Customers() {
  const { data: customers, isLoading } = useCustomers();
  const { mutate: createCustomer, isPending: isCreating } = useCreateCustomer();
  const { mutate: updateCustomer, isPending: isUpdating } = useUpdateCustomer();
  const { mutate: deleteCustomer } = useDeleteCustomer();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const filteredCustomers = customers?.filter(c => {
    const search = searchTerm.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(search) ||
      c.lastName.toLowerCase().includes(search) ||
      (c.customerNumber?.toLowerCase().includes(search)) ||
      (c.companyName?.toLowerCase().includes(search)) ||
      c.city.toLowerCase().includes(search)
    );
  }) || [];

  const handleDelete = () => {
    if (deleteConfirm) {
      deleteCustomer(deleteConfirm.id, {
        onSuccess: () => {
          toast({ title: "Kunde gelöscht" });
          setDeleteConfirm(null);
        }
      });
    }
  };

  const openEdit = (customer: Customer) => {
    setEditCustomer(customer);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditCustomer(null);
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in-up">
      <PageHeader 
        title="Kunden" 
        description="Ihre Kundendatenbank verwalten"
      />

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg font-semibold">Kundenliste</CardTitle>
            <div className="flex gap-2">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-full sm:w-48"
                  data-testid="input-search-customers"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pdfLoading}
                data-testid="button-pdf-export"
                onClick={async () => {
                  setPdfLoading(true);
                  try {
                    await downloadPdf('/api/customers/pdf', 'Kunden.pdf');
                  } catch (err: any) {
                    toast({ title: "Fehler", description: err.message || "PDF-Export fehlgeschlagen", variant: "destructive" });
                  } finally {
                    setPdfLoading(false);
                  }
                }}
              >
                <FileText className="w-4 h-4 mr-1" />
                {pdfLoading ? 'Exportiere...' : 'PDF'}
              </Button>
              <Button onClick={() => setDialogOpen(true)} data-testid="button-add-customer">
                <Plus className="w-4 h-4 mr-1" /> Neu
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Laden...</p>
          ) : filteredCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {searchTerm ? "Keine Treffer gefunden" : "Noch keine Kunden angelegt"}
            </p>
          ) : (
            filteredCustomers.map((customer) => (
              <CustomerCard 
                key={customer.id} 
                customer={customer} 
                onEdit={() => openEdit(customer)}
                onDelete={() => setDeleteConfirm({ id: customer.id, name: `${customer.firstName} ${customer.lastName}` })}
              />
            ))
          )}
        </CardContent>
      </Card>

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={(open) => !open && closeDialog()}
        customer={editCustomer}
        onSave={(data) => {
          if (editCustomer) {
            updateCustomer({ id: editCustomer.id, ...data }, {
              onSuccess: () => {
                toast({ title: "Kunde aktualisiert" });
                closeDialog();
              }
            });
          } else {
            createCustomer(data as InsertCustomer, {
              onSuccess: () => {
                toast({ title: "Kunde erstellt" });
                closeDialog();
              }
            });
          }
        }}
        isLoading={isCreating || isUpdating}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Löschen bestätigen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie "{deleteConfirm?.name}" wirklich löschen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CustomerCard({ customer, onEdit, onDelete }: { customer: Customer; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="p-4 rounded-lg border border-border/50 bg-card hover:bg-secondary/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm">
              {customer.firstName} {customer.lastName}
            </h4>
            <Badge variant={customer.customerType === "gewerblich" ? "default" : "secondary"} className="text-xs">
              {customer.customerType === "gewerblich" ? <Building2 className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
              {customer.customerType}
            </Badge>
            {customer.customerNumber && (
              <span className="text-xs text-muted-foreground font-mono">#{customer.customerNumber}</span>
            )}
          </div>
          {customer.companyName && (
            <p className="text-sm text-muted-foreground mt-0.5">{customer.companyName}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {customer.street}, {customer.postalCode} {customer.city}
            </span>
            {customer.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {customer.phone}
              </span>
            )}
            {customer.email1 && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {customer.email1}
              </span>
            )}
          </div>
          {((customer.skontoPercent ?? 0) > 0 || (customer.discountPercent ?? 0) > 0) && (
            <div className="flex gap-2 mt-2">
              {(customer.skontoPercent ?? 0) > 0 && (
                <Badge variant="outline" className="text-xs">Skonto {customer.skontoPercent}%</Badge>
              )}
              {(customer.discountPercent ?? 0) > 0 && (
                <Badge variant="outline" className="text-xs">Nachlass {customer.discountPercent}%</Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} data-testid={`button-edit-customer-${customer.id}`}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete} data-testid={`button-delete-customer-${customer.id}`}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomerDialog({ 
  open, 
  onOpenChange, 
  customer, 
  onSave, 
  isLoading 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  customer: Customer | null;
  onSave: (data: CustomerFormData) => void;
  isLoading: boolean;
}) {
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      customerNumber: "",
      customerType: "privat",
      firstName: "",
      lastName: "",
      companyName: "",
      street: "",
      postalCode: "",
      city: "",
      phone: "",
      mobile: "",
      email1: "",
      email2: "",
      skontoPercent: 0,
      discountPercent: 0,
      notes: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (customer) {
        form.reset({
          customerNumber: customer.customerNumber || "",
          customerType: customer.customerType as "privat" | "gewerblich",
          firstName: customer.firstName,
          lastName: customer.lastName,
          companyName: customer.companyName || "",
          street: customer.street,
          postalCode: customer.postalCode,
          city: customer.city,
          phone: customer.phone || "",
          mobile: customer.mobile || "",
          email1: customer.email1 || "",
          email2: customer.email2 || "",
          skontoPercent: customer.skontoPercent ?? 0,
          discountPercent: customer.discountPercent ?? 0,
          notes: customer.notes || "",
          isActive: customer.isActive ?? true,
        });
      } else {
        form.reset({
          customerNumber: "",
          customerType: "privat",
          firstName: "",
          lastName: "",
          companyName: "",
          street: "",
          postalCode: "",
          city: "",
          phone: "",
          mobile: "",
          email1: "",
          email2: "",
          skontoPercent: 0,
          discountPercent: 0,
          notes: "",
          isActive: true,
        });
      }
    }
  }, [open, customer, form]);

  const onSubmit = (data: CustomerFormData) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? "Kunde bearbeiten" : "Neuer Kunde"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="customerNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kundennummer</FormLabel>
                  <FormControl><Input {...field} placeholder="K-001" data-testid="input-customer-number" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="customerType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kundentyp</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-customer-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="privat">Privat</SelectItem>
                      <SelectItem value="gewerblich">Gewerblich</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vorname</FormLabel>
                  <FormControl><Input {...field} data-testid="input-first-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nachname</FormLabel>
                  <FormControl><Input {...field} data-testid="input-last-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="companyName" render={({ field }) => (
              <FormItem>
                <FormLabel>Firmenname (optional)</FormLabel>
                <FormControl><Input {...field} data-testid="input-company-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="street" render={({ field }) => (
              <FormItem>
                <FormLabel>Straße + Hausnummer</FormLabel>
                <FormControl><Input {...field} placeholder="Musterstraße 123" data-testid="input-street" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="postalCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>PLZ</FormLabel>
                  <FormControl><Input {...field} placeholder="20095" data-testid="input-postal-code" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Ort</FormLabel>
                  <FormControl><Input {...field} placeholder="Hamburg" data-testid="input-city" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon</FormLabel>
                  <FormControl><Input {...field} type="tel" data-testid="input-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="mobile" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobil</FormLabel>
                  <FormControl><Input {...field} type="tel" data-testid="input-mobile" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="email1" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail 1</FormLabel>
                  <FormControl><Input {...field} type="email" data-testid="input-email1" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email2" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail 2</FormLabel>
                  <FormControl><Input {...field} type="email" data-testid="input-email2" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-3">Rabatte</p>
              <div className="space-y-3">
                <FormField control={form.control} name="skontoPercent" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skonto</FormLabel>
                    <div className="flex gap-2">
                      {[0, 1, 2].map((val) => (
                        <Button
                          key={val}
                          type="button"
                          variant={field.value === val ? "default" : "outline"}
                          size="sm"
                          onClick={() => field.onChange(val)}
                          data-testid={`button-skonto-${val}`}
                        >
                          {val === 0 ? "Kein" : `${val}%`}
                        </Button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="discountPercent" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nachlass</FormLabel>
                    <div className="flex gap-2 flex-wrap">
                      {[0, 3, 5, 7].map((val) => (
                        <Button
                          key={val}
                          type="button"
                          variant={field.value === val ? "default" : "outline"}
                          size="sm"
                          onClick={() => field.onChange(val)}
                          data-testid={`button-discount-${val}`}
                        >
                          {val === 0 ? "Kein" : `${val}%`}
                        </Button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notizen (optional)</FormLabel>
                <FormControl><Textarea {...field} className="resize-none" rows={2} data-testid="input-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-save-customer">
              {isLoading ? "Speichern..." : "Speichern"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
