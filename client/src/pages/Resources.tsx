import { useState, forwardRef } from "react";
import { useVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle, useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee, useContainers, useCreateContainer, useUpdateContainer, useDeleteContainer } from "@/hooks/use-resources";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Truck, Users, Box } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

function TrailerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Ladefläche */}
      <rect x="4" y="8" width="16" height="6" rx="1" />
      {/* Deichsel */}
      <line x1="4" y1="11" x2="1" y2="11" />
      <circle cx="1" cy="11" r="0.5" fill="currentColor" />
      {/* Räder - Doppelachse */}
      <circle cx="10" cy="17" r="2.5" />
      <circle cx="16" cy="17" r="2.5" />
    </svg>
  );
}
const FormCurrencyInput = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  name?: string;
  "data-testid"?: string;
}>(({ value, onChange, onBlur, name, ...props }, ref) => {
  const [focused, setFocused] = useState(false);
  const [editVal, setEditVal] = useState("");
  const num = parseFloat(value || "0");
  const formatted = (isNaN(num) ? 0 : num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  return (
    <Input
      ref={ref}
      name={name}
      data-testid={props["data-testid"]}
      inputMode="decimal"
      value={focused ? editVal : formatted}
      onFocus={() => { setFocused(true); setEditVal((value || "0").replace('.', ',')); }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseFloat(editVal.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(parsed)) onChange(String(Math.round(parsed * 100) / 100));
        onBlur?.();
      }}
      onChange={e => { if (focused) setEditVal(e.target.value); }}
    />
  );
});

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertVehicleSchema, insertEmployeeSchema, insertContainerSchema, type InsertVehicle, type InsertEmployee, type InsertContainer } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

export default function Resources() {
  const { toast } = useToast();
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [containerDialogOpen, setContainerDialogOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<{ id: number; data: InsertVehicle } | null>(null);
  const [editEmployee, setEditEmployee] = useState<{ id: number; data: InsertEmployee } | null>(null);
  const [editContainer, setEditContainer] = useState<{ id: number; data: InsertContainer } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'vehicle' | 'employee' | 'container'; id: number; name: string } | null>(null);

  const { data: vehicles, isLoading: vehiclesLoading } = useVehicles();
  const { data: employees, isLoading: employeesLoading } = useEmployees();
  const { data: containers, isLoading: containersLoading } = useContainers();
  const { mutate: deleteVehicle } = useDeleteVehicle();
  const { mutate: deleteEmployee } = useDeleteEmployee();
  const { mutate: deleteContainer } = useDeleteContainer();

  // Helper: Check if a resource has already started (date is in the past or today)
  const hasStarted = (dateStr: string | null | undefined) => {
    if (!dateStr) return true; // No date = already active
    const startDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    return startDate <= today;
  };

  const calcMonthlyDepreciation = (purchaseCost: string | null | undefined, years: number | null | undefined) => {
    const cost = Number(purchaseCost || 0);
    const depYears = years || 10;
    return Math.round(cost / (depYears * 12) * 100) / 100;
  };

  const totalVehicleCosts = vehicles?.filter(v => v.isActive && hasStarted(v.purchaseDate)).reduce((sum, v) => {
    const leaseCost = Number(v.monthlyLeaseCost || 0);
    const insurance = Number(v.monthlyInsurance || 0);
    const maintenance = Number(v.monthlyMaintenance || 0);
    const depreciation = calcMonthlyDepreciation(v.purchaseCost, v.depreciationYears);
    return sum + leaseCost + insurance + maintenance + depreciation;
  }, 0) || 0;
  
  const totalSalaryCosts = employees?.filter(e => e.isActive && hasStarted(e.hireDate)).reduce((sum, e) => 
    sum + Number(e.monthlySalary || 0) + Number(e.taxFreeAllowance || 0), 0) || 0;

  const totalContainerCosts = containers?.filter(c => c.isActive).reduce((sum, c) => {
    const quantity = c.quantity || 1;
    const depreciation = calcMonthlyDepreciation(c.purchaseCost, c.depreciationYears) * quantity;
    return sum + depreciation;
  }, 0) || 0;

  const totalContainerCount = containers?.filter(c => c.isActive).reduce((sum, c) => sum + (c.quantity || 1), 0) || 0;

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'vehicle') {
      deleteVehicle(deleteConfirm.id, { onSuccess: () => toast({ title: "Fahrzeug gelöscht" }) });
    } else if (deleteConfirm.type === 'employee') {
      deleteEmployee(deleteConfirm.id, { onSuccess: () => toast({ title: "Mitarbeiter gelöscht" }) });
    } else if (deleteConfirm.type === 'container') {
      deleteContainer(deleteConfirm.id, { onSuccess: () => toast({ title: "Container gelöscht" }) });
    }
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in-up">
      <PageHeader 
        title="Ressourcen" 
        description="Fahrzeuge, Personal und Container verwalten"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-border/50">
          <CardContent className="p-2">
            <div className="flex flex-col items-center text-center">
              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1">
                <Truck className="w-3 h-3" />
              </div>
              <p className="text-[8px] text-muted-foreground">Fahrzeuge (inkl. Abschr.)</p>
              <p className="text-[10px] font-bold">{formatCurrency(totalVehicleCosts)}/M</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-2">
            <div className="flex flex-col items-center text-center">
              <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-1">
                <Users className="w-3 h-3" />
              </div>
              <p className="text-[8px] text-muted-foreground">Personal</p>
              <p className="text-[10px] font-bold">{formatCurrency(totalSalaryCosts)}/M</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-2">
            <div className="flex flex-col items-center text-center">
              <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1">
                <Box className="w-3 h-3" />
              </div>
              <p className="text-[8px] text-muted-foreground">Container</p>
              <p className="text-[10px] font-bold">{formatCurrency(totalContainerCosts)}/M</p>
              <p className="text-[8px] text-muted-foreground">{totalContainerCount} Stk.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="vehicles" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vehicles" className="gap-1 text-xs"><Truck className="w-3.5 h-3.5" /> Fahrzeuge</TabsTrigger>
          <TabsTrigger value="employees" className="gap-1 text-xs"><Users className="w-3.5 h-3.5" /> Personal</TabsTrigger>
          <TabsTrigger value="containers" className="gap-1 text-xs"><Box className="w-3.5 h-3.5" /> Container</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setVehicleDialogOpen(true)} data-testid="button-add-vehicle">
              <Plus className="mr-2 h-4 w-4" /> Fahrzeug
            </Button>
          </div>
          
          <div className="grid gap-3">
            {vehiclesLoading ? (
              <p className="text-center py-8 text-muted-foreground">Laden...</p>
            ) : vehicles?.map((vehicle) => (
              <Card key={vehicle.id} className="border-border/50 group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${vehicle.type === 'lkw' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400'}`}>
                      {vehicle.type === 'lkw' ? <Truck className="w-5 h-5" /> : <TrailerIcon className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm truncate">{vehicle.name}</h3>
                        {vehicle.licensePlate && <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">{vehicle.licensePlate}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
                        <span>{formatCurrency(Number(vehicle.monthlyLeaseCost || 0) + Number(vehicle.monthlyInsurance || 0) + Number(vehicle.monthlyMaintenance || 0), 0)}/M</span>
                        {vehicle.purchaseDate && <span>Kauf: {formatDate(vehicle.purchaseDate)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditVehicle({ id: vehicle.id, data: vehicle as InsertVehicle })} data-testid={`button-edit-vehicle-${vehicle.id}`}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm({ type: 'vehicle', id: vehicle.id, name: vehicle.name })} data-testid={`button-delete-vehicle-${vehicle.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {vehicles?.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Keine Fahrzeuge vorhanden</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="employees" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setEmployeeDialogOpen(true)} data-testid="button-add-employee">
              <Plus className="mr-2 h-4 w-4" /> Mitarbeiter
            </Button>
          </div>
          
          <div className="grid gap-3">
            {employeesLoading ? (
              <p className="text-center py-8 text-muted-foreground">Laden...</p>
            ) : employees?.map((employee) => (
              <Card key={employee.id} className="border-border/50 group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm truncate">{employee.name}</h3>
                        <span className="text-xs bg-secondary px-1.5 py-0.5 rounded capitalize">
                          {employee.role === 'geschaeftsfuehrer' ? 'GF' : employee.role === 'fahrer' ? 'Fahrer' : 'Büro'}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span>{formatCurrency(Number(employee.monthlySalary), 0)}/M</span>
                        {employee.hireDate && <span>Einstellung: {formatDate(employee.hireDate)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditEmployee({ id: employee.id, data: employee as InsertEmployee })} data-testid={`button-edit-employee-${employee.id}`}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm({ type: 'employee', id: employee.id, name: employee.name })} data-testid={`button-delete-employee-${employee.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {employees?.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Keine Mitarbeiter vorhanden</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="containers" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setContainerDialogOpen(true)} data-testid="button-add-container">
              <Plus className="mr-2 h-4 w-4" /> Container
            </Button>
          </div>
          
          <div className="grid gap-3">
            {containersLoading ? (
              <p className="text-center py-8 text-muted-foreground">Laden...</p>
            ) : containers?.map((container) => (
              <Card key={container.id} className="border-border/50 group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Box className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm truncate">{container.name}</h3>
                        <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">{container.sizeM3}m³</span>
                        <span className="text-xs bg-secondary px-1.5 py-0.5 rounded capitalize">{container.type}</span>
                        {(container.quantity || 1) > 1 && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{container.quantity}×</span>}
                      </div>
                      <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                        {Number(container.purchaseCost) > 0 && <span>Wert: {formatCurrency(Number(container.purchaseCost), 0)}</span>}
                        {container.purchaseDate && <span>Kauf: {formatDate(container.purchaseDate)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditContainer({ id: container.id, data: container as InsertContainer })} data-testid={`button-edit-container-${container.id}`}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm({ type: 'container', id: container.id, name: container.name })} data-testid={`button-delete-container-${container.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {containers?.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Keine Container vorhanden</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <VehicleDialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen} />
      {editVehicle && <VehicleDialog open={!!editVehicle} onOpenChange={(open) => !open && setEditVehicle(null)} initialData={editVehicle.data} id={editVehicle.id} />}
      
      <EmployeeDialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen} />
      {editEmployee && <EmployeeDialog open={!!editEmployee} onOpenChange={(open) => !open && setEditEmployee(null)} initialData={editEmployee.data} id={editEmployee.id} />}
      
      <ContainerDialog open={containerDialogOpen} onOpenChange={setContainerDialogOpen} />
      {editContainer && <ContainerDialog open={!!editContainer} onOpenChange={(open) => !open && setEditContainer(null)} initialData={editContainer.data} id={editContainer.id} />}

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Löschen bestätigen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie "{deleteConfirm?.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VehicleDialog({ open, onOpenChange, initialData, id }: { open: boolean; onOpenChange: (open: boolean) => void; initialData?: InsertVehicle; id?: number }) {
  const { mutate: create } = useCreateVehicle();
  const { mutate: update } = useUpdateVehicle();
  const { toast } = useToast();

  const form = useForm<InsertVehicle>({
    resolver: zodResolver(insertVehicleSchema),
    defaultValues: initialData || {
      name: "",
      type: "lkw",
      licensePlate: "",
      purchaseDate: "",
      purchaseCost: "0",
      depreciationYears: 10,
      monthlyLeaseCost: "0",
      monthlyInsurance: "0",
      monthlyMaintenance: "0",
      fuelConsumption: "30",
      isActive: true,
    },
  });

  const onSubmit = (data: InsertVehicle) => {
    if (id) {
      update({ id, ...data }, { onSuccess: () => { toast({ title: "Aktualisiert" }); onOpenChange(false); } });
    } else {
      create(data, { onSuccess: () => { toast({ title: "Erstellt" }); onOpenChange(false); form.reset(); } });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{id ? "Fahrzeug bearbeiten" : "Neues Fahrzeug"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Bezeichnung</FormLabel>
                <FormControl><Input {...field} placeholder="z.B. MAN TGS 26.400" data-testid="input-vehicle-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="lkw">LKW</SelectItem>
                      <SelectItem value="anhaenger">Anhänger</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="licensePlate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kennzeichen</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} placeholder="HH-XX 123" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kaufdatum</FormLabel>
                  <FormControl><Input {...field} type="date" value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="purchaseCost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kaufpreis €</FormLabel>
                  <FormControl><FormCurrencyInput value={field.value || "0"} onChange={field.onChange} onBlur={field.onBlur} name={field.name} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="depreciationYears" render={({ field }) => (
              <FormItem>
                <FormLabel>Abschreibung (Jahre)</FormLabel>
                <FormControl><Input {...field} type="number" min="1" max="30" value={field.value || 10} onChange={(e) => field.onChange(parseInt(e.target.value) || 10)} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="monthlyLeaseCost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mietkauf €</FormLabel>
                  <FormControl><FormCurrencyInput value={field.value || "0"} onChange={field.onChange} onBlur={field.onBlur} name={field.name} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="monthlyInsurance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Versich. €</FormLabel>
                  <FormControl><FormCurrencyInput value={field.value || "0"} onChange={field.onChange} onBlur={field.onBlur} name={field.name} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="monthlyMaintenance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Wartung €</FormLabel>
                  <FormControl><FormCurrencyInput value={field.value || "0"} onChange={field.onChange} onBlur={field.onBlur} name={field.name} /></FormControl>
                </FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full" data-testid="button-save-vehicle">Speichern</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeDialog({ open, onOpenChange, initialData, id }: { open: boolean; onOpenChange: (open: boolean) => void; initialData?: InsertEmployee; id?: number }) {
  const { mutate: create } = useCreateEmployee();
  const { mutate: update } = useUpdateEmployee();
  const { toast } = useToast();

  const form = useForm<InsertEmployee>({
    resolver: zodResolver(insertEmployeeSchema),
    defaultValues: initialData || {
      name: "",
      role: "fahrer",
      hireDate: "",
      monthlySalary: "0",
      taxFreeAllowance: "0",
      workHoursPerWeek: "40",
      isActive: true,
    },
  });

  const onSubmit = (data: InsertEmployee) => {
    if (id) {
      update({ id, ...data }, { onSuccess: () => { toast({ title: "Aktualisiert" }); onOpenChange(false); } });
    } else {
      create(data, { onSuccess: () => { toast({ title: "Erstellt" }); onOpenChange(false); form.reset(); } });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{id ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input {...field} placeholder="Vor- und Nachname" data-testid="input-employee-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Funktion</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="geschaeftsfuehrer">Geschäftsführer</SelectItem>
                      <SelectItem value="fahrer">Fahrer</SelectItem>
                      <SelectItem value="buero">Büro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hireDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Einstellungsdatum</FormLabel>
                  <FormControl><Input {...field} type="date" value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="monthlySalary" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gehalt €/Monat</FormLabel>
                  <FormControl><FormCurrencyInput value={field.value || "0"} onChange={field.onChange} onBlur={field.onBlur} name={field.name} data-testid="input-employee-salary" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="taxFreeAllowance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Steuerfreie Zulagen €</FormLabel>
                  <FormControl><FormCurrencyInput value={field.value || "0"} onChange={field.onChange} onBlur={field.onBlur} name={field.name} data-testid="input-employee-allowance" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="workHoursPerWeek" render={({ field }) => (
                <FormItem>
                  <FormLabel>Std./Woche</FormLabel>
                  <FormControl><Input {...field} type="number" value={field.value || "40"} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full" data-testid="button-save-employee">Speichern</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ContainerDialog({ open, onOpenChange, initialData, id }: { open: boolean; onOpenChange: (open: boolean) => void; initialData?: InsertContainer; id?: number }) {
  const { mutate: create } = useCreateContainer();
  const { mutate: update } = useUpdateContainer();
  const { toast } = useToast();

  const form = useForm<InsertContainer>({
    resolver: zodResolver(insertContainerSchema),
    defaultValues: initialData || {
      name: "",
      type: "absetz",
      sizeM3: 7,
      quantity: 1,
      purchaseDate: "",
      purchaseCost: "0",
      depreciationYears: 10,
      isActive: true,
    },
  });

  const onSubmit = (data: InsertContainer) => {
    if (id) {
      update({ id, ...data }, { onSuccess: () => { toast({ title: "Aktualisiert" }); onOpenChange(false); } });
    } else {
      create(data, { onSuccess: () => { toast({ title: "Erstellt" }); onOpenChange(false); form.reset(); } });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{id ? "Container bearbeiten" : "Neuer Container"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Bezeichnung</FormLabel>
                <FormControl><Input {...field} placeholder="z.B. Container #1" data-testid="input-container-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="absetz">Absetzcontainer</SelectItem>
                      <SelectItem value="abroll">Abrollcontainer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sizeM3" render={({ field }) => (
                <FormItem>
                  <FormLabel>Größe (m³)</FormLabel>
                  <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={field.value?.toString()}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="7">7 m³</SelectItem>
                      <SelectItem value="10">10 m³</SelectItem>
                      <SelectItem value="15">15 m³</SelectItem>
                      <SelectItem value="20">20 m³</SelectItem>
                      <SelectItem value="30">30 m³</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Stückzahl</FormLabel>
                  <FormControl><Input {...field} type="number" min="1" value={field.value || 1} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kaufdatum</FormLabel>
                  <FormControl><Input {...field} type="date" value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="purchaseCost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Stückpreis €</FormLabel>
                  <FormControl><FormCurrencyInput value={field.value || "0"} onChange={field.onChange} onBlur={field.onBlur} name={field.name} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="depreciationYears" render={({ field }) => (
                <FormItem>
                  <FormLabel>Abschreibung (Jahre)</FormLabel>
                  <FormControl><Input {...field} type="number" min="1" max="30" value={field.value || 10} onChange={(e) => field.onChange(parseInt(e.target.value) || 10)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full" data-testid="button-save-container">Speichern</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
