import { useState } from "react";
import { useCostVariables, useUpdateCostVariable, useCreateCostVariable, useDeleteCostVariable } from "@/hooks/use-cost-variables";
import { useLoans, useCreateLoan, useUpdateLoan, useDeleteLoan, useAllLoanPayments, useCreateLoanPayment, useUpdateLoanPayment, useDeleteLoanPayment } from "@/hooks/use-resources";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Building2, Briefcase, Fuel, Landmark, Home, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Calendar, CheckCircle2, Circle, Euro, Shield, Megaphone, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLoanSchema, insertCostVariableSchema, insertLoanPaymentSchema, type InsertLoan, type InsertCostVariable, type InsertLoanPayment, type Loan, type CostVariable, type LoanPayment } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

export default function CostManagement() {
  const { data: variables } = useCostVariables();
  const { mutate: updateVariable } = useUpdateCostVariable();
  const { mutate: deleteCostVar } = useDeleteCostVariable();
  const { data: loans } = useLoans();
  const { mutate: deleteLoan } = useDeleteLoan();
  const { data: allPayments } = useAllLoanPayments();
  const { mutate: deletePayment } = useDeleteLoanPayment();
  const { toast } = useToast();
  
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [editLoan, setEditLoan] = useState<{ id: number; data: InsertLoan } | null>(null);
  const [deleteLoanConfirm, setDeleteLoanConfirm] = useState<{ id: number; name: string } | null>(null);
  const [expandedLoanId, setExpandedLoanId] = useState<number | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentLoanId, setPaymentLoanId] = useState<number | null>(null);
  const [editPayment, setEditPayment] = useState<{ id: number; data: LoanPayment } | null>(null);
  const [deletePaymentConfirm, setDeletePaymentConfirm] = useState<{ id: number; loanId: number } | null>(null);
  
  // Cost variable state
  const [costVarDialogOpen, setCostVarDialogOpen] = useState(false);
  const [costVarCategory, setCostVarCategory] = useState<string>("");
  const [editCostVar, setEditCostVar] = useState<{ id: number; data: CostVariable } | null>(null);
  const [deleteCostVarConfirm, setDeleteCostVarConfirm] = useState<{ id: number; name: string } | null>(null);
  
  
  // Helper to get payments for a specific loan
  const getPaymentsForLoan = (loanId: number) => 
    allPayments?.filter(p => p.loanId === loanId) || [];
  
  // Calculate remaining balance for a loan
  const calcRemainingBalance = (loan: Loan) => {
    const payments = getPaymentsForLoan(loan.id);
    const totalTilgung = payments
      .filter(p => p.paymentType === 'tilgung')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return Number(loan.amount || 0) - totalTilgung;
  };
  
  // Calculate interest for current year (respects startDate and prorates if loan started mid-year)
  const calcInterestForYear = (loan: Loan, year: number) => {
    const payments = getPaymentsForLoan(loan.id);
    
    // Check if loan started after this year
    const startDate = loan.startDate ? new Date(loan.startDate) : null;
    const startYear = startDate ? startDate.getFullYear() : null;
    
    // If loan hasn't started yet or started after this year, no interest due
    if (startYear && startYear > year) {
      return { calculated: 0, paid: 0, isPaid: true, paymentId: undefined };
    }
    
    // Get all tilgung payments before this year to calculate balance at year start
    const tilgungBeforeYear = payments
      .filter(p => p.paymentType === 'tilgung' && new Date(p.paymentDate).getFullYear() < year)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    
    const balanceAtYearStart = Number(loan.amount || 0) - tilgungBeforeYear;
    let yearlyInterest = balanceAtYearStart * (Number(loan.interestPercent || 0) / 100);
    
    // Prorate for first year if loan started mid-year
    if (startYear && startYear === year && startDate) {
      const daysInYear = 365;
      const startDay = Math.floor((startDate.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24));
      const daysActive = daysInYear - startDay;
      yearlyInterest = yearlyInterest * (daysActive / daysInYear);
    }
    
    // Check if interest was paid for this year
    const interestPayment = payments.find(p => p.paymentType === 'zinsen' && p.year === year);
    
    return {
      calculated: yearlyInterest,
      paid: interestPayment ? Number(interestPayment.amount || 0) : 0,
      isPaid: interestPayment?.isPaid || false,
      paymentId: interestPayment?.id
    };
  };
  
  const handleDeletePayment = () => {
    if (deletePaymentConfirm) {
      deletePayment({ id: deletePaymentConfirm.id, loanId: deletePaymentConfirm.loanId }, { 
        onSuccess: () => toast({ title: "Zahlung gelöscht" }) 
      });
      setDeletePaymentConfirm(null);
    }
  };
  
  const handleDeleteLoan = () => {
    if (deleteLoanConfirm) {
      deleteLoan(deleteLoanConfirm.id, { 
        onSuccess: () => toast({ title: "Darlehen gelöscht" }) 
      });
      setDeleteLoanConfirm(null);
    }
  };

  const handleDeleteCostVar = () => {
    if (deleteCostVarConfirm) {
      deleteCostVar(deleteCostVarConfirm.id, { 
        onSuccess: () => toast({ title: "Kostenpunkt gelöscht" }) 
      });
      setDeleteCostVarConfirm(null);
    }
  };

  const openAddCostVar = (category: string) => {
    setCostVarCategory(category);
    setEditCostVar(null);
    setCostVarDialogOpen(true);
  };

  const openEditCostVar = (costVar: CostVariable) => {
    setCostVarCategory(costVar.category);
    setEditCostVar({ id: costVar.id, data: costVar });
    setCostVarDialogOpen(true);
  };

  const calcMonthlyLoanCost = (loan: Loan) => {
    const remainingBalance = calcRemainingBalance(loan);
    const interest = Number(loan.interestPercent || 0);
    // Monthly interest is based on remaining balance
    const monthlyInterest = (remainingBalance * interest / 100) / 12;
    return { monthlyInterest, total: monthlyInterest, remainingBalance };
  };

  const totalMonthlyLoanCosts = loans?.filter(l => l.isActive && (!l.endDate || new Date(l.endDate) >= new Date())).reduce((sum, l) => 
    sum + calcMonthlyLoanCost(l).total, 0) || 0;

  // Calculate total monthly costs for summary display
  const monthlyVariableCosts = variables?.filter(v => v.unit === 'per_month').reduce((sum, v) => 
    sum + Number(v.value || 0), 0) || 0;
  const totalMonthlyCosts = monthlyVariableCosts + totalMonthlyLoanCosts;

  const categories: Record<string, { label: string; icon: typeof Calculator; color: string }> = {
    fuel: { label: "Kraftstoff & Fahrzeug", icon: Fuel, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400" },
    overhead: { label: "Maut & Sonstiges", icon: Briefcase, color: "text-slate-600 bg-slate-100 dark:bg-slate-900/30 dark:text-slate-400" },
    vehicle_tax: { label: "Kfz-Steuer", icon: Car, color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
    insurance: { label: "Versicherungen & Beiträge", icon: Shield, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" },
    accountant: { label: "Steuerberater & Buchhaltung", icon: Calculator, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
    admin: { label: "Verwaltung & Büro", icon: Building2, color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400" },
    marketing: { label: "Werbung & Marketing", icon: Megaphone, color: "text-pink-600 bg-pink-100 dark:bg-pink-900/30 dark:text-pink-400" },
  };

  const handleUpdate = (id: number, value: string) => {
    updateVariable({ id, value }, {
      onSuccess: () => toast({ title: "Gespeichert" })
    });
  };

  const getUnitLabel = (unit: string) => {
    const labels: Record<string, string> = {
      'per_month': '/Monat',
      'per_liter': '/Liter',
      'per_km': '/km',
      'fixed': '',
    };
    return labels[unit] || unit;
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <PageHeader 
          title="Betriebskosten" 
          description="Basisvariablen für Ihre Preiskalkulation" 
        />
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">
            {formatCurrency(totalMonthlyCosts)}
          </div>
          <div className="text-sm text-muted-foreground">Gesamt pro Monat</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(categories).map(([catKey, catInfo]) => {
          const catVars = variables?.filter(v => v.category === catKey) || [];
          const Icon = catInfo.icon;

          return (
            <Card key={catKey} className="border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-3 text-base font-semibold">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${catInfo.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {catInfo.label}
                  </CardTitle>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => openAddCostVar(catKey)}
                    data-testid={`button-add-cost-${catKey}`}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {catVars.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">Keine Kosten eingetragen</p>
                )}
                {catVars.map((v) => (
                  <div key={v.id} className="group">
                    <div className="flex justify-between items-center mb-1.5 gap-2">
                      <Label className="font-medium text-sm truncate flex-1">{v.name}</Label>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full shrink-0">
                          {getUnitLabel(v.unit)}
                        </span>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => openEditCostVar(v)}
                          data-testid={`button-edit-cost-${v.id}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          onClick={() => setDeleteCostVarConfirm({ id: v.id, name: v.name })}
                          data-testid={`button-delete-cost-${v.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                      <Input 
                        defaultValue={v.value}
                        key={v.value}
                        onBlur={(e) => handleUpdate(v.id, e.target.value)}
                        className="pl-8 font-mono font-medium border-border/50 bg-secondary/30"
                        data-testid={`input-cost-${v.id}`}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Darlehen Karte */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-3 text-base font-semibold">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400">
                <Landmark className="w-4 h-4" />
              </div>
              Darlehen
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{formatCurrency(totalMonthlyLoanCosts)}/M</span>
              <Button size="icon" variant="ghost" onClick={() => setLoanDialogOpen(true)} data-testid="button-add-loan">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loans?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Noch keine Darlehen angelegt</p>
          )}
          {loans?.map((loan) => {
            const costs = calcMonthlyLoanCost(loan);
            const isExpanded = expandedLoanId === loan.id;
            const payments = getPaymentsForLoan(loan.id);
            const currentYear = new Date().getFullYear();
            const interestInfo = calcInterestForYear(loan, currentYear);
            
            return (
              <div key={loan.id} className="rounded-lg border border-border/50 bg-secondary/20 overflow-hidden">
                {/* Loan Header */}
                <div 
                  className="p-3 cursor-pointer hover-elevate"
                  onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{loan.name}</h4>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                        <span>Ursprung: {formatCurrency(Number(loan.amount))}</span>
                        <span className="font-medium text-foreground">Restschuld: {formatCurrency(costs.remainingBalance)}</span>
                        {loan.startDate && <span>ab {new Date(loan.startDate).toLocaleDateString('de-DE')}</span>}
                        {loan.endDate && <span>bis {new Date(loan.endDate).toLocaleDateString('de-DE')}</span>}
                        {loan.endDate && new Date(loan.endDate) < new Date() && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">beendet</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditLoan({ id: loan.id, data: { name: loan.name, amount: loan.amount, startDate: loan.startDate, endDate: loan.endDate, repaymentPercent: loan.repaymentPercent, interestPercent: loan.interestPercent, isActive: loan.isActive ?? true } })} data-testid={`button-edit-loan-${loan.id}`}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteLoanConfirm({ id: loan.id, name: loan.name })} data-testid={`button-delete-loan-${loan.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-1.5 rounded bg-secondary/50">
                      <div className="text-muted-foreground">Zinsen {loan.interestPercent}% p.a.</div>
                      <div className="font-medium">{formatCurrency(costs.monthlyInterest)}/Monat</div>
                    </div>
                    <div className={`p-1.5 rounded flex items-center gap-1.5 ${interestInfo.isPaid ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                      {interestInfo.isPaid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      )}
                      <div>
                        <div className={`text-xs ${interestInfo.isPaid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                          Zinsen {currentYear}
                        </div>
                        <div className={`font-medium ${interestInfo.isPaid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                          {interestInfo.isPaid ? 'bezahlt' : `${formatCurrency(interestInfo.calculated)} offen`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-border/50 p-3 bg-background/50">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-medium">Zahlungen</h5>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs"
                        onClick={() => { setPaymentLoanId(loan.id); setPaymentDialogOpen(true); }}
                        data-testid={`button-add-payment-${loan.id}`}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Zahlung
                      </Button>
                    </div>
                    
                    {payments.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">Noch keine Zahlungen erfasst</p>
                    ) : (
                      <div className="space-y-2">
                        {payments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()).map((payment) => (
                          <div 
                            key={payment.id} 
                            className={`flex items-center justify-between p-2 rounded text-xs border ${
                              payment.paymentType === 'zinsen' 
                                ? payment.isPaid 
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              <span>{new Date(payment.paymentDate).toLocaleDateString('de-DE')}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                payment.paymentType === 'tilgung' 
                                  ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' 
                                  : 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                              }`}>
                                {payment.paymentType === 'tilgung' ? 'Tilgung' : `Zinsen ${payment.year}`}
                              </span>
                              {payment.paymentType === 'zinsen' && (
                                payment.isPaid 
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> 
                                  : <Circle className="w-3.5 h-3.5 text-red-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{formatCurrency(Number(payment.amount))}</span>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-5 w-5"
                                onClick={() => setEditPayment({ id: payment.id, data: payment })}
                                data-testid={`button-edit-payment-${payment.id}`}
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-5 w-5 text-destructive"
                                onClick={() => setDeletePaymentConfirm({ id: payment.id, loanId: loan.id })}
                                data-testid={`button-delete-payment-${payment.id}`}
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Darlehen Dialog */}
      <LoanDialog open={loanDialogOpen} onOpenChange={setLoanDialogOpen} />
      {editLoan && <LoanDialog open={!!editLoan} onOpenChange={(open) => !open && setEditLoan(null)} initialData={editLoan.data} id={editLoan.id} />}

      {/* Payment Dialog */}
      {paymentLoanId && (
        <PaymentDialog 
          open={paymentDialogOpen} 
          onOpenChange={(open) => { setPaymentDialogOpen(open); if (!open) setPaymentLoanId(null); }}
          loanId={paymentLoanId}
        />
      )}
      {editPayment && (
        <PaymentDialog 
          open={!!editPayment} 
          onOpenChange={(open) => !open && setEditPayment(null)} 
          loanId={editPayment.data.loanId}
          initialData={editPayment.data}
          id={editPayment.id}
        />
      )}

      {/* Zahlung Löschen Bestätigung */}
      <AlertDialog open={!!deletePaymentConfirm} onOpenChange={(open) => !open && setDeletePaymentConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zahlung löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Zahlung wirklich löschen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} className="bg-destructive text-destructive-foreground">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Kostenpunkt Dialog */}
      <CostVariableDialog 
        open={costVarDialogOpen} 
        onOpenChange={setCostVarDialogOpen}
        category={costVarCategory}
        initialData={editCostVar?.data}
        id={editCostVar?.id}
      />

      {/* Kostenpunkt Löschen Bestätigung */}
      <AlertDialog open={!!deleteCostVarConfirm} onOpenChange={(open) => !open && setDeleteCostVarConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kostenpunkt löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie "{deleteCostVarConfirm?.name}" wirklich löschen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCostVar} className="bg-destructive text-destructive-foreground">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Löschen Bestätigung */}
      <AlertDialog open={!!deleteLoanConfirm} onOpenChange={(open) => !open && setDeleteLoanConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Löschen bestätigen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie "{deleteLoanConfirm?.name}" wirklich löschen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLoan} className="bg-destructive text-destructive-foreground">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoanDialog({ open, onOpenChange, initialData, id }: { open: boolean; onOpenChange: (open: boolean) => void; initialData?: InsertLoan; id?: number }) {
  const { mutate: create } = useCreateLoan();
  const { mutate: update } = useUpdateLoan();
  const { toast } = useToast();

  const form = useForm<InsertLoan>({
    resolver: zodResolver(insertLoanSchema),
    defaultValues: initialData || {
      name: "",
      amount: "0",
      startDate: "",
      endDate: "",
      repaymentPercent: "0",
      interestPercent: "5.5",
      isActive: true,
    },
  });

  const onSubmit = (data: InsertLoan) => {
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
          <DialogTitle>{id ? "Darlehen bearbeiten" : "Neues Darlehen"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Bezeichnung</FormLabel>
                <FormControl><Input {...field} placeholder="z.B. Betriebsmittel" data-testid="input-loan-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Darlehensbetrag €</FormLabel>
                <FormControl><Input {...field} type="number" step="0.01" placeholder="90000" data-testid="input-loan-amount" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Anfangsdatum</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} type="date" data-testid="input-loan-start-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Enddatum</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} type="date" data-testid="input-loan-end-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="interestPercent" render={({ field }) => (
                <FormItem>
                  <FormLabel>Zinsen % p.a.</FormLabel>
                  <FormControl><Input {...field} type="number" step="0.1" placeholder="5.5" data-testid="input-loan-interest" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="repaymentPercent" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tilgung % p.a.</FormLabel>
                  <FormControl><Input {...field} type="number" step="0.1" placeholder="10" data-testid="input-loan-repayment" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full" data-testid="button-save-loan">Speichern</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ open, onOpenChange, loanId, initialData, id }: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  loanId: number;
  initialData?: LoanPayment; 
  id?: number 
}) {
  const { mutate: create } = useCreateLoanPayment();
  const { mutate: update } = useUpdateLoanPayment();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const form = useForm<InsertLoanPayment>({
    resolver: zodResolver(insertLoanPaymentSchema),
    defaultValues: initialData ? {
      loanId: initialData.loanId,
      paymentDate: initialData.paymentDate,
      paymentType: initialData.paymentType,
      amount: initialData.amount,
      year: initialData.year,
      isPaid: initialData.isPaid ?? false,
      notes: initialData.notes || "",
    } : {
      loanId: loanId,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentType: "tilgung",
      amount: "0",
      year: currentYear,
      isPaid: false,
      notes: "",
    },
  });

  const paymentType = form.watch("paymentType");

  const onSubmit = (data: InsertLoanPayment) => {
    const submitData = { ...data, loanId };
    if (id) {
      update({ id, ...submitData }, { onSuccess: () => { toast({ title: "Aktualisiert" }); onOpenChange(false); } });
    } else {
      create(submitData, { onSuccess: () => { toast({ title: "Zahlung erfasst" }); onOpenChange(false); form.reset(); } });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{id ? "Zahlung bearbeiten" : "Neue Zahlung"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="paymentType" render={({ field }) => (
              <FormItem>
                <FormLabel>Art der Zahlung</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-payment-type">
                      <SelectValue placeholder="Zahlungsart wählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="tilgung">Tilgung (Rückzahlung)</SelectItem>
                    <SelectItem value="zinsen">Zinszahlung</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            
            <FormField control={form.control} name="paymentDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Datum</FormLabel>
                <FormControl><Input {...field} type="date" data-testid="input-payment-date" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Betrag €</FormLabel>
                <FormControl><Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-payment-amount" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            
            {paymentType === "zinsen" && (
              <>
                <FormField control={form.control} name="year" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zinsen für Jahr</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value ?? currentYear}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || currentYear)}
                        type="number" 
                        placeholder={String(currentYear)} 
                        data-testid="input-payment-year" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="isPaid" render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <input 
                        type="checkbox" 
                        checked={field.value ?? false}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 rounded border-border"
                        data-testid="input-payment-is-paid"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Zinsen wurden bezahlt</FormLabel>
                  </FormItem>
                )} />
              </>
            )}
            
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notiz (optional)</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} placeholder="z.B. Halbjährliche Tilgung" data-testid="input-payment-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            
            <Button type="submit" className="w-full" data-testid="button-save-payment">Speichern</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CostVariableDialog({ 
  open, 
  onOpenChange, 
  category,
  initialData, 
  id 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  category: string;
  initialData?: CostVariable; 
  id?: number;
}) {
  const { mutate: create } = useCreateCostVariable();
  const { mutate: update } = useUpdateCostVariable();
  const { toast } = useToast();

  const categoryLabels: Record<string, string> = {
    fuel: "Kraftstoff & Fahrzeug",
    overhead: "Maut & Sonstiges",
    vehicle_tax: "Kfz-Steuer",
    insurance: "Versicherungen & Beiträge",
    accountant: "Steuerberater & Buchhaltung",
    admin: "Verwaltung & Büro",
    marketing: "Werbung & Marketing",
  };

  const form = useForm<InsertCostVariable>({
    resolver: zodResolver(insertCostVariableSchema),
    defaultValues: initialData ? {
      name: initialData.name,
      category: initialData.category,
      value: initialData.value,
      unit: initialData.unit,
      description: initialData.description || "",
    } : {
      name: "",
      category: category,
      value: "0",
      unit: "per_month",
      description: "",
    },
  });

  // Reset form when dialog opens with new data
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  const onSubmit = (data: InsertCostVariable) => {
    const submitData = { ...data, category };
    if (id) {
      update({ id, ...submitData }, { 
        onSuccess: () => { 
          toast({ title: "Aktualisiert" }); 
          handleOpenChange(false);
        } 
      });
    } else {
      create(submitData, { 
        onSuccess: () => { 
          toast({ title: "Kostenpunkt erstellt" }); 
          handleOpenChange(false);
          form.reset();
        } 
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {id ? "Kostenpunkt bearbeiten" : `Neuer Kostenpunkt (${categoryLabels[category] || category})`}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Bezeichnung</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="z.B. Telefon, Versicherung..." data-testid="input-cost-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="value" render={({ field }) => (
              <FormItem>
                <FormLabel>Betrag €</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-cost-value" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="unit" render={({ field }) => (
              <FormItem>
                <FormLabel>Einheit</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-cost-unit">
                      <SelectValue placeholder="Einheit wählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="per_month">pro Monat</SelectItem>
                    <SelectItem value="per_km">pro km</SelectItem>
                    <SelectItem value="per_liter">pro Liter</SelectItem>
                    <SelectItem value="fixed">Fixbetrag</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Beschreibung (optional)</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value || ""} placeholder="Kurze Beschreibung..." data-testid="input-cost-description" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" data-testid="button-save-cost">Speichern</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
