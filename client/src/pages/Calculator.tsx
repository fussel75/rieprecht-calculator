import { useState, useEffect } from "react";
import { useMaterials } from "@/hooks/use-materials";
import { useCostVariables } from "@/hooks/use-cost-variables";
import { usePlanningSettings, useCreateQuote } from "@/hooks/use-planning";
import { useVehicles, useEmployees, useLoans, useCustomers } from "@/hooks/use-resources";
import type { Loan, Customer, PurchaseSurcharge, SalesSurcharge } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Calculator as CalcIcon, Save, Truck, Scale, Box, Building2, Send, Mail, User, RefreshCw, TrendingUp, AlertCircle, ChevronDown, ChevronUp, Tag, FileText, Recycle, PackagePlus } from "lucide-react";
import { downloadPdf } from "@/lib/pdf-export";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { MarketPrice, SalesPrice } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

export default function Calculator() {
  const { data: materials } = useMaterials();
  const { data: variables } = useCostVariables();
  const { data: settings } = usePlanningSettings();
  const { data: vehicles } = useVehicles();
  const { data: employees } = useEmployees();
  const { data: loans } = useLoans();
  const { data: customers } = useCustomers();
  const { mutate: createQuote, isPending: isSaving } = useCreateQuote();

  // Sales prices (our own price list)
  const { data: salesPrices } = useQuery<SalesPrice[]>({
    queryKey: ["/api/sales-prices"],
  });

  const { data: purchaseSurcharges } = useQuery<PurchaseSurcharge[]>({
    queryKey: ["/api/purchase-surcharges"],
  });

  const { data: salesSurcharges } = useQuery<SalesSurcharge[]>({
    queryKey: ["/api/sales-surcharges"],
  });

  // Market prices query and mutation
  const { data: marketPrices, isLoading: isLoadingPrices } = useQuery<MarketPrice[]>({
    queryKey: ["/api/market-prices"],
  });

  const { mutate: refreshMarketPrices, isPending: isRefreshing } = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/market-prices/refresh", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-prices"] });
      toast({ title: "Aktualisiert", description: "Marktpreise wurden aktualisiert." });
    },
    onError: () => {
      toast({ title: "Fehler", description: "Marktpreise konnten nicht aktualisiert werden.", variant: "destructive" });
    }
  });

  const calcMonthlyLoanCost = (loan: Loan) => {
    const amount = Number(loan.amount || 0);
    const repayment = Number(loan.repaymentPercent || 0);
    const interest = Number(loan.interestPercent || 0);
    return ((amount * repayment / 100) + (amount * interest / 100)) / 12;
  };
  const { toast } = useToast();

  const [orderType, setOrderType] = useState<"entsorgung" | "lieferung">("entsorgung");
  const [materialId, setMaterialId] = useState<string>("");
  const [material2Id, setMaterial2Id] = useState<string>(""); // Second container material
  const [containerSize, setContainerSize] = useState<7 | 10>(7);
  const [distance, setDistance] = useState<number>(15);
  const [inputType, setInputType] = useState<"weight" | "volume">("volume");
  const [inputValue, setInputValue] = useState<string>("7");
  const [inputValue2, setInputValue2] = useState<string>("7"); // Second container volume/weight
  const [quantity, setQuantity] = useState<1 | 2>(1);
  const [withTrailer, setWithTrailer] = useState(false);
  
  const handleContainerSizeChange = (size: 7 | 10) => {
    setContainerSize(size);
    setShowPriceComparison(false);
    if (inputType === "volume") {
      setInputValue(size.toString());
      setInputValue2(size.toString());
    }
  };
  const [marginPercent, setMarginPercent] = useState<number>(15);
  const [customerName, setCustomerName] = useState("");
  
  // Schnell-Angebot state
  const [recipientType, setRecipientType] = useState<"customer" | "email">("customer");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [directEmail, setDirectEmail] = useState<string>("");
  const [directFirstName, setDirectFirstName] = useState<string>("");
  const [directLastName, setDirectLastName] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [showSendButton, setShowSendButton] = useState(false);
  const [isMarketCompareExpanded, setIsMarketCompareExpanded] = useState(false);
  const [showPriceComparison, setShowPriceComparison] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const selectedCustomer = customers?.find(c => c.id.toString() === selectedCustomerId);
  const recipientEmail = recipientType === "customer" 
    ? (selectedCustomer?.email1 || selectedCustomer?.email2 || "")
    : directEmail;
  const recipientName = recipientType === "customer"
    ? (selectedCustomer?.companyName || `${selectedCustomer?.firstName || ""} ${selectedCustomer?.lastName || ""}`.trim())
    : `${directFirstName} ${directLastName}`.trim();

  useEffect(() => {
    if (settings?.targetMarginPercent) {
      setMarginPercent(Number(settings.targetMarginPercent));
    }
  }, [settings]);

  const filteredMaterials = materials?.filter(m => (m as any).materialType === orderType || (!(m as any).materialType && orderType === "entsorgung"));

  // Material 1 (first container)
  const selectedMaterial = materials?.find(m => m.id.toString() === materialId);
  const density = selectedMaterial ? Number(selectedMaterial.density) : 0;
  
  // Material 2 (second container, falls back to material 1 if not set)
  const selectedMaterial2 = quantity === 2 && material2Id 
    ? materials?.find(m => m.id.toString() === material2Id) 
    : selectedMaterial;
  const density2 = selectedMaterial2 ? Number(selectedMaterial2.density) : 0;
  
  // Weight/Volume for container 1
  const weightT = inputType === "weight" 
    ? Number(inputValue) 
    : Number(inputValue) * density;
  
  // Weight/Volume for container 2 (when different materials)
  const weightT2 = quantity === 2 && material2Id
    ? (inputType === "weight" ? Number(inputValue2) : Number(inputValue2) * density2)
    : weightT;
    
  const dieselPrice = Number(variables?.find(v => v.name === "Diesel Preis")?.value || 1.70);
  const fuelConsumption = Number(variables?.find(v => v.name === "Verbrauch (L/100km)")?.value || 30);
  const tollPerKm = Number(variables?.find(v => v.name === "Maut / Gebühren")?.value || 0.19);
  
  // Material 1 cost rates (disposal for waste, purchase for delivery)
  const disposalRate = selectedMaterial 
    ? (orderType === "lieferung" ? Number((selectedMaterial as any).purchaseCostPerTonne || 0) : Number(selectedMaterial.disposalCostPerTonne))
    : 0;
  
  // Material 2 cost rates
  const disposalRate2 = selectedMaterial2 
    ? (orderType === "lieferung" ? Number((selectedMaterial2 as any).purchaseCostPerTonne || 0) : Number(selectedMaterial2.disposalCostPerTonne))
    : 0;
  
  // Transport costs (fuel + toll for round trip)
  const fuelCostPerKm = (fuelConsumption / 100) * dieselPrice;
  const transportCost = (fuelCostPerKm + tollPerKm) * distance * 2;
  
  // Helper: Check if a resource has already started (date is in the past or today)
  const hasStarted = (dateStr: string | null | undefined) => {
    if (!dateStr) return true; // No date = already active
    const startDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    return startDate <= today;
  };

  // Calculate monthly depreciation for a vehicle
  const calcMonthlyDepreciation = (purchaseCost: string | null | undefined, years: number | null | undefined) => {
    const cost = Number(purchaseCost || 0);
    const depYears = years || 10;
    return Math.round(cost / (depYears * 12) * 100) / 100;
  };

  // Fixed monthly costs from fleet (only resources that have already started) - including depreciation
  const monthlyVehicleCosts = vehicles?.filter(v => v.isActive && hasStarted(v.purchaseDate)).reduce((sum, v) => {
    const leaseCost = Number(v.monthlyLeaseCost || 0);
    const insurance = Number(v.monthlyInsurance || 0);
    const maintenance = Number(v.monthlyMaintenance || 0);
    const depreciation = calcMonthlyDepreciation(v.purchaseCost, v.depreciationYears);
    return sum + leaseCost + insurance + maintenance + depreciation;
  }, 0) || 0;
  
  const monthlyEmployeeCosts = employees?.filter(e => e.isActive && hasStarted(e.hireDate)).reduce((sum, e) => 
    sum + Number(e.monthlySalary || 0) + Number(e.taxFreeAllowance || 0), 0) || 0;
  
  // Operating costs from cost_variables (all monthly costs)
  const monthlyOperatingCosts = variables
    ?.filter(v => v.unit === 'per_month')
    ?.reduce((sum, v) => sum + Number(v.value), 0) || 0;
  
  // Loan costs (repayment + interest)
  const monthlyLoanCosts = loans?.filter(l => l.isActive && (!l.endDate || new Date(l.endDate) >= new Date())).reduce((sum, l) => 
    sum + calcMonthlyLoanCost(l), 0) || 0;
  
  const totalMonthlyFixed = monthlyVehicleCosts + monthlyEmployeeCosts + monthlyOperatingCosts + monthlyLoanCosts;
  
  // Distribute fixed costs across expected containers per month
  const workDays = settings?.workDaysPerMonth || 20;
  const containersPerDay = settings?.containersPerDay || 5;
  const containersPerMonth = workDays * containersPerDay;
  const fixedCostPerContainer = containersPerMonth > 0 ? totalMonthlyFixed / containersPerMonth : 0;
  
  // Normalize AVV number for matching (remove all non-alphanumeric, lowercase)
  const normalizeAvv = (avv: string | null | undefined): string => {
    if (!avv) return '';
    return avv.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  };

  // Find matching sales price by AVV number
  const matchingSalesPrice = selectedMaterial?.avvNumber 
    ? salesPrices?.find(sp => normalizeAvv(sp.avvCode) === normalizeAvv(selectedMaterial.avvNumber))
    : null;

  // Disposal costs for Container 1 (including surcharges)
  const volumeM3 = inputType === "volume" 
    ? Number(inputValue) 
    : (density > 0 ? Number(inputValue) / density : 0);

  const billingUnit: "tonne" | "m3" = inputType === "weight" ? "tonne" : "m3";

  const calcPurchaseSurcharges = (mat: typeof selectedMaterial, wT: number, vM3: number, isDangerous: boolean) => {
    if (!mat || !purchaseSurcharges) return 0;
    const ids = mat.purchaseSurchargeIds || [];
    return purchaseSurcharges
      .filter(s => ids.includes(s.id) && s.isActive)
      .filter(s => !s.appliesToDangerous || isDangerous)
      .filter(s => s.unit === billingUnit || s.unit === "stueck")
      .reduce((sum, s) => {
        const amt = Number(s.amount);
        if (s.unit === "tonne") return sum + amt * wT;
        if (s.unit === "m3") return sum + amt * vM3;
        if (s.unit === "stueck") return sum + amt;
        return sum;
      }, 0);
  };

  const materialIsDangerous = matchingSalesPrice?.isDangerous || false;
  const surcharge = calcPurchaseSurcharges(selectedMaterial, weightT, volumeM3, materialIsDangerous);
  const disposalCost = (weightT * disposalRate) + surcharge;
  
  // Disposal costs for Container 2 (including surcharges)
  const volumeM3_2 = quantity === 2 && material2Id
    ? (inputType === "volume" ? Number(inputValue2) : (density2 > 0 ? Number(inputValue2) / density2 : 0))
    : volumeM3;
  const matchingSalesPrice2 = selectedMaterial2?.avvNumber 
    ? salesPrices?.find(sp => normalizeAvv(sp.avvCode) === normalizeAvv(selectedMaterial2.avvNumber))
    : matchingSalesPrice;
  const material2IsDangerous = matchingSalesPrice2?.isDangerous || false;
  const surcharge2 = calcPurchaseSurcharges(selectedMaterial2 || selectedMaterial, weightT2, volumeM3_2, material2IsDangerous);
  const disposalCost2 = (weightT2 * disposalRate2) + surcharge2;
  
  // Trailer costs
  const trailerDiscount = 65; // €65 Rabatt bei Anhänger (spart eine Fahrt)
  
  // Calculate costs based on quantity
  // Transport costs are always calculated per container
  const effectiveTransportCost = transportCost * quantity;
  
  // Fixed costs apply per container
  const totalFixedCost = fixedCostPerContainer * quantity;
  
  // Total disposal costs: sum of both containers
  const totalDisposalCost = quantity === 2 
    ? disposalCost + disposalCost2  // Different materials possible
    : disposalCost;
  
  // Total base cost
  const baseCost = effectiveTransportCost + totalFixedCost + totalDisposalCost;
  
  const marginAmount = baseCost * (marginPercent / 100);
  // Apply trailer discount at the very end if 2 containers with trailer
  const trailerDiscountAmount = (quantity === 2 && withTrailer) ? trailerDiscount : 0;
  const finalPrice = baseCost + marginAmount - trailerDiscountAmount;
  const vatRate = 0.19;
  const grossPrice = finalPrice * (1 + vatRate);

  // Calculate sales price for BOTH variants: per tonne and per m³
  // Container Abholung/Tausch fixed price (always included)
  const containerPickupPrice = 135; // Pauschale aus Preisliste

  const calcSalesSurcharges = (sp: typeof matchingSalesPrice, unit: "tonne" | "m3", wT: number, vM3: number) => {
    if (!sp || !salesSurcharges) return 0;
    const ids = (sp as any).salesSurchargeIds || [];
    return salesSurcharges
      .filter(s => ids.includes(s.id) && s.isActive)
      .filter(s => !s.appliesToDangerous || (sp as any).isDangerous)
      .filter(s => s.unit === unit || s.unit === "stueck")
      .reduce((sum, s) => {
        const amt = Number(s.amount);
        if (s.unit === "tonne") return sum + amt * wT;
        if (s.unit === "m3") return sum + amt * vM3;
        if (s.unit === "stueck") return sum + amt;
        return sum;
      }, 0);
  };
  
  // Variant 1: Per Tonne calculation
  const hasTonnePrice = matchingSalesPrice?.pricePerTonne && weightT > 0;
  const salesSurchargeTonne = calcSalesSurcharges(matchingSalesPrice, "tonne", weightT, volumeM3);
  const salesPricePerTonne = hasTonnePrice
    ? Number(matchingSalesPrice.pricePerTonne) * weightT
    : 0;
  const totalSalesPriceTonne = salesPricePerTonne + salesSurchargeTonne + containerPickupPrice;
  const totalSalesPriceTonneGross = totalSalesPriceTonne * (1 + vatRate);
  
  // Variant 2: Per m³ calculation
  const hasM3Price = matchingSalesPrice?.pricePerCubicMeter && volumeM3 > 0;
  const salesSurchargeM3 = calcSalesSurcharges(matchingSalesPrice, "m3", weightT, volumeM3);
  const salesPricePerM3 = hasM3Price
    ? Number(matchingSalesPrice.pricePerCubicMeter) * volumeM3
    : 0;
  const totalSalesPriceM3 = salesPricePerM3 + salesSurchargeM3 + containerPickupPrice;
  const totalSalesPriceM3Gross = totalSalesPriceM3 * (1 + vatRate);
  
  // For backwards compatibility (comparison summary)
  const salesBehgSurcharge = hasTonnePrice ? salesSurchargeTonne : salesSurchargeM3;
  const totalSalesPrice = hasTonnePrice ? totalSalesPriceTonne : totalSalesPriceM3;
  const totalSalesPriceGross = hasTonnePrice ? totalSalesPriceTonneGross : totalSalesPriceM3Gross;

  // Find matching market price
  const matchingMarketPrice = marketPrices?.find(
    p => p.materialCategory === selectedMaterial?.name && p.containerSizeM3 === containerSize
  );
  const marketPriceNet = matchingMarketPrice ? Number(matchingMarketPrice.priceNet) : 0;
  const marketPriceGross = matchingMarketPrice ? Number(matchingMarketPrice.priceGross) : 0;

  const handleSave = () => {
    if (!selectedMaterial) return;
    
    createQuote({
      customerName: recipientName || customerName,
      materialId: Number(materialId),
      containerSize,
      distanceKm: distance.toString(),
      estimatedWeightT: weightT.toString(),
      calculatedCost: baseCost.toString(),
      finalPrice: finalPrice.toString(),
      margin: marginAmount.toString(),
    }, {
      onSuccess: () => {
        toast({ title: "Gespeichert", description: "Kalkulation wurde gespeichert." });
        setShowSendButton(true);
        setShowPriceComparison(true);
        setIsMarketCompareExpanded(true);
        const hasMatchingPrice = marketPrices?.some(
          p => p.materialCategory === selectedMaterial?.name && p.containerSizeM3 === containerSize
        );
        if (!hasMatchingPrice) {
          refreshMarketPrices();
        }
      }
    });
  };
  
  const handleSendQuote = async () => {
    if (!selectedMaterial) {
      toast({ title: "Fehler", description: "Bitte wählen Sie ein Material.", variant: "destructive" });
      return;
    }
    
    // Collect emails and customer data
    let emails: string[] = [];
    let firstName = "";
    let lastName = "";
    let companyName = "";
    let customerType: "privat" | "gewerblich" = "privat";
    
    if (recipientType === "customer" && selectedCustomer) {
      // Collect all valid emails from customer
      if (selectedCustomer.email1) emails.push(selectedCustomer.email1);
      if (selectedCustomer.email2) emails.push(selectedCustomer.email2);
      firstName = selectedCustomer.firstName;
      lastName = selectedCustomer.lastName;
      companyName = selectedCustomer.companyName || "";
      customerType = (selectedCustomer.customerType as "privat" | "gewerblich") || "privat";
    } else if (recipientType === "email" && directEmail) {
      emails.push(directEmail);
      firstName = directFirstName || "Kunde";
      lastName = directLastName || "";
    }
    
    if (emails.length === 0) {
      toast({ title: "Fehler", description: "Bitte wählen Sie einen Kunden oder geben Sie eine E-Mail ein.", variant: "destructive" });
      return;
    }
    
    // Validate email format for all emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of emails) {
      if (!emailRegex.test(email)) {
        toast({ title: "Fehler", description: `Ungültige E-Mail-Adresse: ${email}`, variant: "destructive" });
        return;
      }
    }
    
    // Validate all numeric values are finite
    const volumeM3 = inputType === "volume" ? Number(inputValue) : (weightT / (density || 1));
    if (!Number.isFinite(finalPrice) || !Number.isFinite(grossPrice) || 
        !Number.isFinite(weightT) || !Number.isFinite(volumeM3) || 
        !Number.isFinite(distance) || !Number.isFinite(containerSize)) {
      toast({ title: "Fehler", description: "Bitte überprüfen Sie die eingegebenen Werte.", variant: "destructive" });
      return;
    }
    
    setIsSending(true);
    try {
      // Calculate values for container 2 when different material
      const hasDifferentMaterial = quantity === 2 && material2Id && material2Id !== materialId;
      const container2VolumeM3 = hasDifferentMaterial 
        ? (inputType === "volume" ? Number(inputValue2) : (weightT2 / (density2 || 1)))
        : volumeM3;
      
      await apiRequest("POST", "/api/quotes/send-email", {
        recipientEmails: emails,
        customerType,
        firstName: firstName || "Kunde",
        lastName: lastName || "",
        companyName,
        materialName: selectedMaterial.name,
        articleNumber: (selectedMaterial as any).articleNumber || null,
        containerSize,
        distanceKm: distance,
        estimatedWeightT: weightT,
        finalPrice,
        grossPrice,
        volumeM3,
        quantity,
        withTrailer,
        // Container 2 info (when different material)
        material2Name: hasDifferentMaterial ? selectedMaterial2?.name : null,
        material2WeightT: hasDifferentMaterial ? weightT2 : null,
        material2VolumeM3: hasDifferentMaterial ? container2VolumeM3 : null,
      });
      
      const emailInfo = emails.length > 1 ? `${emails.length} E-Mails` : emails[0];
      toast({ title: "Angebot versendet", description: `E-Mail wurde an ${emailInfo} gesendet.` });
      setShowSendButton(false);
    } catch (error) {
      toast({ title: "Fehler", description: "E-Mail konnte nicht gesendet werden.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader 
          title="Preisrechner" 
          description="Kalkulation basierend auf Ihren Betriebskosten"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={pdfLoading}
          data-testid="button-pdf-export"
          onClick={async () => {
            setPdfLoading(true);
            try {
              await downloadPdf('/api/calculator/pdf', 'Kalkulation.pdf', {
                customerName,
                distance,
                calculations: {
                  baseCost,
                  marginPercent,
                  marginAmount,
                  finalPrice,
                  grossPrice,
                  transportCost,
                  fixedCostPerContainer,
                  disposalCost,
                  weightT,
                  containerSize,
                  materialName: selectedMaterial?.name || '',
                },
                containerSizes: [7, 10],
              });
            } catch (err: any) {
              toast({ title: "Fehler", description: err.message || "PDF-Export fehlgeschlagen", variant: "destructive" });
            } finally {
              setPdfLoading(false);
            }
          }}
        >
          <FileText className="h-4 w-4 mr-1" />
          {pdfLoading ? 'Exportiere...' : 'PDF Export'}
        </Button>
      </div>

      {/* Price Result Card */}
      <Card className="bg-industrial-gradient text-white border-none shadow-xl overflow-hidden relative">
        <CardContent className="py-5 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-white/60 text-sm font-medium">Berechneter Preis (Netto)</p>
              <span className="text-4xl sm:text-5xl font-bold tracking-tight" data-testid="text-final-price">
                {formatCurrency(finalPrice)}
              </span>
              <p className="mt-1 text-white/50 text-xs">
                Brutto: {formatCurrency(grossPrice)} (inkl. 19% MwSt.)
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-6">
                <span className="text-white/60">Basiskosten:</span>
                <span className="font-mono font-medium">{formatCurrency(baseCost)}</span>
              </div>
              <div className="flex justify-between gap-6 text-accent font-semibold">
                <span>Marge ({marginPercent}%):</span>
                <span className="font-mono">+{formatCurrency(marginAmount)}</span>
              </div>
              {showSendButton && recipientEmail && (
                <Button 
                  onClick={handleSendQuote}
                  disabled={isSending || !selectedMaterial}
                  className="mt-2 bg-white text-primary hover:bg-white/90 font-semibold"
                  data-testid="button-send-quote"
                >
                  {isSending ? "Senden..." : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Angebot versenden
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Quantity & Trailer Options */}
          <div className="mt-5 pt-5 border-t border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Quantity Selector */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-white/70">Stückzahl:</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    onClick={() => { setQuantity(1); setWithTrailer(false); setMaterial2Id(""); setInputValue2(containerSize.toString()); setShowPriceComparison(false); }}
                    className={`px-4 ${quantity === 1 ? "bg-white text-primary" : "bg-white/20 text-white hover:bg-white/30"}`}
                    data-testid="button-quantity-1"
                  >
                    1
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setQuantity(2); setShowPriceComparison(false); }}
                    className={`px-4 ${quantity === 2 ? "bg-white text-primary" : "bg-white/20 text-white hover:bg-white/30"}`}
                    data-testid="button-quantity-2"
                  >
                    2
                  </Button>
                </div>
              </div>
              
              {/* Trailer Toggle - only visible when quantity = 2 */}
              {quantity === 2 && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={withTrailer}
                    onCheckedChange={(checked) => { setWithTrailer(checked); setShowPriceComparison(false); }}
                    className="data-[state=checked]:bg-white"
                    thumbClassName="border-2 border-green-900"
                    data-testid="switch-trailer"
                  />
                  <div className="text-sm">
                    <span className={withTrailer ? "text-white font-medium" : "text-white/70"}>Mit Anhänger</span>
                    <span className="text-white/50 text-xs ml-1">(-65€ Rabatt)</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Trailer info hint */}
            {quantity === 2 && withTrailer && (
              <p className="mt-2 text-xs text-accent/90 bg-accent/10 rounded px-2 py-1">
                💡 Beide Container am gleichen Tag: Rabatt 65€, aber mit Anhänger bringen = mit Anhänger holen!
              </p>
            )}
          </div>

          {/* Margin Slider */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex justify-between text-sm font-medium mb-3">
              <span>Zielmarge anpassen</span>
              <span className="font-mono bg-white/10 px-2.5 py-0.5 rounded-full text-sm">{marginPercent}%</span>
            </div>
            <Slider 
              value={[marginPercent]} 
              onValueChange={(v) => setMarginPercent(v[0])} 
              max={100} 
              step={1}
              className="[&>.relative>.absolute]:bg-accent"
              data-testid="slider-margin"
            />
          </div>
        </CardContent>
      </Card>

      {/* Three-Way Price Comparison Summary - Shows after saving (only for single material) */}
      <AnimatePresence>
      {showPriceComparison && selectedMaterial && (matchingSalesPrice || matchingMarketPrice) && !(quantity === 2 && material2Id && material2Id !== materialId) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
        <Card className="border-2 border-primary/20 shadow-md" data-testid="card-three-way-comparison">
          <CardHeader className="pb-3 bg-primary/5">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="w-5 h-5 text-primary" />
              Dreifach-Preisvergleich
            </CardTitle>
            <p className="text-xs text-muted-foreground">Kalkulation vs. Listenpreis vs. Marktpreis</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="p-2 sm:p-4 text-center min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Kalkulation</p>
                <p className="text-base sm:text-lg font-bold text-primary truncate" data-testid="comparison-calculated">{formatCurrency(finalPrice)}</p>
                <Badge className="mt-1 text-xs" variant="outline">Marge {marginPercent}%</Badge>
              </div>
              <div className="p-2 sm:p-4 text-center min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Listenpreis</p>
                {matchingSalesPrice && (hasTonnePrice || hasM3Price) ? (
                  <div className="space-y-1">
                    {hasTonnePrice && (
                      <div>
                        <p className="text-base sm:text-lg font-bold text-emerald-600 truncate" data-testid="comparison-list-price-tonne">{formatCurrency(totalSalesPriceTonne)}</p>
                        <Badge className="text-xs" variant="outline">Tonne</Badge>
                      </div>
                    )}
                    {hasM3Price && (
                      <div className={hasTonnePrice ? "pt-1 border-t border-border/30" : ""}>
                        <p className="text-base sm:text-lg font-bold text-purple-600 truncate" data-testid="comparison-list-price-m3">{formatCurrency(totalSalesPriceM3)}</p>
                        <Badge className="text-xs" variant="outline">m³</Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-base text-muted-foreground">-</p>
                )}
              </div>
              <div className="p-2 sm:p-4 text-center min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Marktpreis</p>
                {matchingMarketPrice ? (
                  <>
                    <p className="text-base sm:text-lg font-bold text-blue-600 truncate" data-testid="comparison-market-price">{formatCurrency(marketPriceNet)}</p>
                    <Badge className="mt-1 text-xs" variant={matchingMarketPrice.provider === 'BUHCK' ? 'default' : 'secondary'}>
                      {matchingMarketPrice.provider === 'BUHCK' ? 'Preisliste' : 'KI'}
                    </Badge>
                  </>
                ) : (
                  <p className="text-base text-muted-foreground">-</p>
                )}
              </div>
            </div>
            <div className="p-3 bg-muted/30 text-xs border-t">
              <div className="flex flex-wrap justify-center gap-4">
                {matchingSalesPrice && (hasTonnePrice || hasM3Price) && (
                  <span>
                    Kalkulation vs. Liste: {" "}
                    <span className={finalPrice > (hasTonnePrice ? totalSalesPriceTonne : totalSalesPriceM3) ? "text-rose-600 font-medium" : "text-emerald-600 font-medium"}>
                      {finalPrice > (hasTonnePrice ? totalSalesPriceTonne : totalSalesPriceM3) 
                        ? `+${((finalPrice / (hasTonnePrice ? totalSalesPriceTonne : totalSalesPriceM3) - 1) * 100).toFixed(0)}%`
                        : `-${((1 - finalPrice / (hasTonnePrice ? totalSalesPriceTonne : totalSalesPriceM3)) * 100).toFixed(0)}%`}
                    </span>
                  </span>
                )}
                {matchingMarketPrice && marketPriceNet > 0 && (
                  <span>
                    Kalkulation vs. Markt: {" "}
                    <span className={finalPrice > marketPriceNet ? "text-rose-600 font-medium" : "text-emerald-600 font-medium"}>
                      {finalPrice > marketPriceNet 
                        ? `+${((finalPrice / marketPriceNet - 1) * 100).toFixed(0)}%`
                        : `-${((1 - finalPrice / marketPriceNet) * 100).toFixed(0)}%`}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      )}
      </AnimatePresence>
      
      {/* Info for two different materials */}
      <AnimatePresence>
      {showPriceComparison && quantity === 2 && material2Id && material2Id !== materialId && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
        <Card className="border-2 border-blue-200 bg-blue-50 dark:bg-blue-900/20 shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-300">Zwei verschiedene Abfallarten</p>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  Container 1: <strong>{selectedMaterial?.name}</strong> — Entsorgung: {formatCurrency(disposalCost)}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Container 2: <strong>{selectedMaterial2?.name}</strong> — Entsorgung: {formatCurrency(disposalCost2)}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                  Gesamtpreis (inkl. Transport + Marge): <strong>{formatCurrency(finalPrice)}</strong>
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                  {withTrailer ? "Mit Anhänger (-65€ Rabatt)" : "Separate Transporte"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Price Comparison Card - Shows both tonne and m³ variants - Shows after saving (only for single material) */}
      <AnimatePresence>
      {showPriceComparison && selectedMaterial && matchingSalesPrice && !(quantity === 2 && material2Id && material2Id !== materialId) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
        >
        <Card className="border-border/50 shadow-sm overflow-hidden" data-testid="card-price-comparison">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Tag className="w-5 h-5 text-primary" />
              Verkaufspreis nach Preisliste
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {matchingSalesPrice.materialName} (AVV {matchingSalesPrice.avvCode})
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {/* Per Tonne Row */}
            {hasTonnePrice && (
              <div className="border-b border-border/50">
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Nach Gewicht (Tonnen)</p>
                </div>
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Materialpreis</span>
                    <span>{weightT.toFixed(1)} t × {formatCurrency(Number(matchingSalesPrice.pricePerTonne))}/t = <span className="font-medium">{formatCurrency(salesPricePerTonne)}</span></span>
                  </div>
                  {salesSurchargeTonne > 0 && matchingSalesPrice && salesSurcharges && (
                    (matchingSalesPrice as any).salesSurchargeIds?.map((sid: number) => {
                      const s = salesSurcharges.find(x => x.id === sid && x.isActive);
                      if (!s || (s.unit !== "tonne" && s.unit !== "stueck")) return null;
                      if (s.appliesToDangerous && !(matchingSalesPrice as any).isDangerous) return null;
                      const amt = Number(s.amount);
                      const total = s.unit === "tonne" ? amt * weightT : amt;
                      return (
                        <div key={s.id} className="flex justify-between text-orange-600">
                          <span>{s.name}</span>
                          <span>{s.unit === "tonne" ? `${weightT.toFixed(1)} t × ${formatCurrency(amt)}/t` : `${formatCurrency(amt)}/Stk`} = <span className="font-medium">{formatCurrency(total)}</span></span>
                        </div>
                      );
                    })
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Container Abholung/Tausch</span>
                    <span className="font-medium">{formatCurrency(containerPickupPrice)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border/30 font-bold">
                    <span>Netto</span>
                    <span className="text-emerald-600 dark:text-emerald-400" data-testid="text-sales-price-tonne">{formatCurrency(totalSalesPriceTonne)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Brutto (inkl. 19% MwSt.)</span>
                    <span>{formatCurrency(totalSalesPriceTonneGross)}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Per m³ Row */}
            {hasM3Price && (
              <div className="border-b border-border/50">
                <div className="px-4 py-2 bg-purple-50 dark:bg-purple-950/30">
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">Nach Volumen (Kubikmeter) – max. 3t</p>
                </div>
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Materialpreis</span>
                    <span>{volumeM3.toFixed(1)} m³ × {formatCurrency(Number(matchingSalesPrice.pricePerCubicMeter))}/m³ = <span className="font-medium">{formatCurrency(salesPricePerM3)}</span></span>
                  </div>
                  {salesSurchargeM3 > 0 && matchingSalesPrice && salesSurcharges && (
                    (matchingSalesPrice as any).salesSurchargeIds?.map((sid: number) => {
                      const s = salesSurcharges.find(x => x.id === sid && x.isActive);
                      if (!s || (s.unit !== "m3" && s.unit !== "stueck")) return null;
                      if (s.appliesToDangerous && !(matchingSalesPrice as any).isDangerous) return null;
                      const amt = Number(s.amount);
                      const total = s.unit === "m3" ? amt * volumeM3 : amt;
                      return (
                        <div key={s.id} className="flex justify-between text-orange-600">
                          <span>{s.name}</span>
                          <span>{s.unit === "m3" ? `${volumeM3.toFixed(1)} m³ × ${formatCurrency(amt)}/m³` : `${formatCurrency(amt)}/Stk`} = <span className="font-medium">{formatCurrency(total)}</span></span>
                        </div>
                      );
                    })
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Container Abholung/Tausch</span>
                    <span className="font-medium">{formatCurrency(containerPickupPrice)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border/30 font-bold">
                    <span>Netto</span>
                    <span className="text-emerald-600 dark:text-emerald-400" data-testid="text-sales-price-m3">{formatCurrency(totalSalesPriceM3)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Brutto (inkl. 19% MwSt.)</span>
                    <span>{formatCurrency(totalSalesPriceM3Gross)}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Show message if only one pricing method available */}
            {!hasTonnePrice && !hasM3Price && (
              <div className="p-4 text-center text-muted-foreground">
                Kein Preis in Preisliste hinterlegt
              </div>
            )}
            
            {/* Comparison with calculated price */}
            {(hasTonnePrice || hasM3Price) && (
              <div className="p-3 bg-secondary/30 text-xs">
                <p className="font-medium mb-2">Vergleich mit Ihrer Kalkulation ({formatCurrency(finalPrice)} netto):</p>
                <div className="space-y-1">
                  {hasTonnePrice && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">vs. Tonnenpreis:</span>
                      <span className={finalPrice > totalSalesPriceTonne ? "text-rose-600 font-medium" : finalPrice < totalSalesPriceTonne ? "text-emerald-600 font-medium" : ""}>
                        {finalPrice > totalSalesPriceTonne 
                          ? `+${formatCurrency(finalPrice - totalSalesPriceTonne)} (${((finalPrice / totalSalesPriceTonne - 1) * 100).toFixed(0)}% höher)`
                          : finalPrice < totalSalesPriceTonne
                            ? `${formatCurrency(finalPrice - totalSalesPriceTonne)} (${((1 - finalPrice / totalSalesPriceTonne) * 100).toFixed(0)}% günstiger)`
                            : "Gleich"}
                      </span>
                    </div>
                  )}
                  {hasM3Price && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">vs. Kubikpreis:</span>
                      <span className={finalPrice > totalSalesPriceM3 ? "text-rose-600 font-medium" : finalPrice < totalSalesPriceM3 ? "text-emerald-600 font-medium" : ""}>
                        {finalPrice > totalSalesPriceM3 
                          ? `+${formatCurrency(finalPrice - totalSalesPriceM3)} (${((finalPrice / totalSalesPriceM3 - 1) * 100).toFixed(0)}% höher)`
                          : finalPrice < totalSalesPriceM3
                            ? `${formatCurrency(finalPrice - totalSalesPriceM3)} (${((1 - finalPrice / totalSalesPriceM3) * 100).toFixed(0)}% günstiger)`
                            : "Gleich"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Market Comparison Section - Collapsible */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader 
          className="pb-3 cursor-pointer hover-elevate rounded-t-lg"
          onClick={() => setIsMarketCompareExpanded(!isMarketCompareExpanded)}
          data-testid="button-toggle-market-compare"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="w-5 h-5 text-primary" />
              Marktvergleich
              {isMarketCompareExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </CardTitle>
            {isMarketCompareExpanded && (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={(e) => { e.stopPropagation(); refreshMarketPrices(); }}
                disabled={isRefreshing}
                data-testid="button-refresh-market-prices"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? "Lade..." : "Aktualisieren"}
              </Button>
            )}
          </div>
        </CardHeader>
        
        {isMarketCompareExpanded && (
          <CardContent className="space-y-4">
            {/* Disclaimer */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span>
                {orderType === 'lieferung' ? (
                  <><strong>Marktpreise:</strong> KI-gestützte Schätzungen basierend auf Hamburger Baustoffhändlern und Containerdiensten.</>
                ) : (
                  <><strong>Marktpreise:</strong> Basierend auf der offiziellen BUHCK Hamburg Preisliste 2025. Für nicht verfügbare Materialien werden KI-Schätzungen verwendet.</>
                )}
              </span>
            </div>

            {isLoadingPrices || isRefreshing ? (
              <div className="text-center py-6 text-muted-foreground">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />
                Lade Marktpreise...
              </div>
            ) : !marketPrices || marketPrices.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Keine Marktpreise vorhanden</p>
                <p className="text-xs mt-1">Marktpreise werden nach der Berechnung automatisch geladen.</p>
              </div>
            ) : (
              <>
                {/* Filter for current material and container size */}
                {(() => {
                  const relevantPrices = marketPrices.filter(
                    p => p.materialCategory === selectedMaterial?.name && p.containerSizeM3 === containerSize
                  );
                  const lastUpdate = marketPrices[0]?.sourceDate;
                  
                  if (relevantPrices.length === 0 && selectedMaterial) {
                    return (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        Keine Vergleichspreise für {selectedMaterial.name} ({containerSize}m³) verfügbar.
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-3">
                      {relevantPrices.map((price, idx) => {
                        const priceNet = Number(price.priceNet);
                        const priceGross = Number(price.priceGross);
                        const diffNet = finalPrice - priceNet;
                        const diffPercentNet = priceNet > 0 ? ((diffNet / priceNet) * 100) : 0;
                        const isHigher = diffNet > 0;
                        const isLower = diffNet < 0;
                        
                        return (
                          <div key={price.id || idx} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/50">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{price.provider}</span>
                                {price.provider.includes("BUHCK") ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">Preisliste</span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">KI</span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {price.materialCategory} • {price.containerSizeM3}m³
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-lg font-mono">
                                {formatCurrency(priceNet)}
                                <span className="text-xs text-muted-foreground font-normal ml-1">netto</span>
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {formatCurrency(priceGross)} brutto
                              </div>
                              {selectedMaterial && (
                                <div className={`text-xs font-medium mt-1 ${isHigher ? 'text-emerald-600 dark:text-emerald-400' : isLower ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
                                  {isHigher ? (
                                    <span>Ihr Preis: +{formatCurrency(diffNet)} ({diffPercentNet.toFixed(0)}% höher)</span>
                                  ) : isLower ? (
                                    <span>Ihr Preis: {formatCurrency(diffNet)} ({Math.abs(diffPercentNet).toFixed(0)}% günstiger)</span>
                                  ) : (
                                    <span>Gleicher Preis</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {lastUpdate && (
                        <p className="text-xs text-center text-muted-foreground pt-2">
                          Letzte Aktualisierung: {lastUpdate}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Input Section */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <CalcIcon className="w-5 h-5 text-primary" /> 
            Parameter für Schnell-Angebot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          
          {/* Recipient Type Toggle */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Empfänger</Label>
            <div className="flex items-center gap-2 text-sm">
              <span className={recipientType === "customer" ? "text-primary font-semibold" : "text-muted-foreground"}>
                <User className="inline w-4 h-4 mr-1" />Kunde
              </span>
              <Switch 
                checked={recipientType === "email"}
                onCheckedChange={(c) => {
                  setRecipientType(c ? "email" : "customer");
                  setShowSendButton(false);
                }}
                data-testid="switch-recipient-type"
              />
              <span className={recipientType === "email" ? "text-primary font-semibold" : "text-muted-foreground"}>
                <Mail className="inline w-4 h-4 mr-1" />E-Mail
              </span>
            </div>
            
            {recipientType === "customer" ? (
              <Select value={selectedCustomerId} onValueChange={(val) => { setSelectedCustomerId(val); setShowSendButton(false); }}>
                <SelectTrigger className="bg-secondary/30 border-border/50 w-full" data-testid="select-customer">
                  <SelectValue placeholder="Kunde auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {customers?.filter(c => c.isActive !== false && (c.email1 || c.email2)).map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.companyName ? `${c.companyName} (${c.firstName} ${c.lastName})` : `${c.firstName} ${c.lastName}`}
                      {c.email1 && <span className="text-muted-foreground text-xs ml-2">- {c.email1}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-3">
                <Input 
                  type="email"
                  placeholder="empfaenger@email.de" 
                  value={directEmail}
                  onChange={(e) => { setDirectEmail(e.target.value); setShowSendButton(false); }}
                  className="bg-secondary/30 border-border/50"
                  data-testid="input-direct-email"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Vorname</Label>
                    <Input 
                      placeholder="Max" 
                      value={directFirstName}
                      onChange={(e) => setDirectFirstName(e.target.value)}
                      className="bg-secondary/30 border-border/50"
                      data-testid="input-direct-first-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nachname</Label>
                    <Input 
                      placeholder="Mustermann" 
                      value={directLastName}
                      onChange={(e) => setDirectLastName(e.target.value)}
                      className="bg-secondary/30 border-border/50"
                      data-testid="input-direct-last-name"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Customer Reference (optional) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Referenz/Projekt (optional)</Label>
            <Input 
              placeholder="z.B. Müller Baustelle" 
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="bg-secondary/30 border-border/50"
              data-testid="input-customer-name"
            />
          </div>

          {/* Auftragsart Toggle */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Auftragsart</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={orderType === "entsorgung" ? "default" : "outline"}
                className={`${orderType === "entsorgung" ? "bg-primary text-white" : ""} text-xs sm:text-sm px-2 sm:px-4`}
                onClick={() => { setOrderType("entsorgung"); setMaterialId(""); setMaterial2Id(""); setShowPriceComparison(false); setInputType("volume"); }}
                data-testid="button-order-type-entsorgung"
              >
                <Recycle className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
                <span className="truncate">Entsorgung</span>
              </Button>
              <Button
                type="button"
                variant={orderType === "lieferung" ? "default" : "outline"}
                className={`${orderType === "lieferung" ? "bg-[#eb7636] hover:bg-[#d4682f] text-white" : ""} text-xs sm:text-sm px-2 sm:px-4`}
                onClick={() => { setOrderType("lieferung"); setMaterialId(""); setMaterial2Id(""); setShowPriceComparison(false); setInputType("weight"); }}
                data-testid="button-order-type-lieferung"
              >
                <PackagePlus className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
                <span className="truncate">Schüttgüter & Baustoffe</span>
              </Button>
            </div>
          </div>

          {/* Material 1 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {orderType === "lieferung" 
                ? (quantity === 2 ? "Schüttgut Container 1" : "Schüttgut / Baustoff")
                : (quantity === 2 ? "Abfallart Container 1" : "Abfallart")
              }
            </Label>
            <Select value={materialId} onValueChange={(val) => { 
              setMaterialId(val); 
              if (material2Id === val) setMaterial2Id(""); 
              setShowPriceComparison(false); 
            }}>
              <SelectTrigger className="bg-secondary/30 border-border/50 w-full" data-testid="select-material">
                <SelectValue placeholder={orderType === "lieferung" ? "Schüttgut wählen..." : "Material wählen..."} />
              </SelectTrigger>
              <SelectContent>
                {filteredMaterials?.map((m) => (
                  <SelectItem key={m.id} value={m.id.toString()}>
                    {m.name}{(m as any).grainSize ? ` ${(m as any).grainSize}` : ''} ({Number(m.density)} t/m³)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Material 2 - Only when quantity = 2 */}
          {quantity === 2 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {orderType === "lieferung" ? "Schüttgut Container 2" : "Abfallart Container 2"}
              </Label>
              <Select 
                value={material2Id || materialId} 
                onValueChange={(val) => { 
                  setMaterial2Id(val); 
                  setShowPriceComparison(false); 
                }}
              >
                <SelectTrigger className="bg-secondary/30 border-border/50 w-full" data-testid="select-material-2">
                  <SelectValue placeholder={orderType === "lieferung" ? "Schüttgut wählen..." : "Material wählen..."} />
                </SelectTrigger>
                <SelectContent>
                  {filteredMaterials?.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>
                      {m.name}{(m as any).grainSize ? ` ${(m as any).grainSize}` : ''} ({Number(m.density)} t/m³)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {material2Id && material2Id !== materialId && (
                <p className="text-xs text-muted-foreground">
                  Unterschiedliches Material für Container 2
                </p>
              )}
            </div>
          )}

          {/* Container Size */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Containergröße</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleContainerSizeChange(7)}
                className={`py-3 text-sm font-semibold rounded-lg border-2 transition-all ${
                  containerSize === 7 
                    ? "bg-primary text-white border-primary" 
                    : "bg-secondary/30 border-border/50 text-muted-foreground hover:border-primary/50"
                }`}
                data-testid="button-container-7"
              >
                7 m³
              </button>
              <button
                onClick={() => handleContainerSizeChange(10)}
                className={`py-3 text-sm font-semibold rounded-lg border-2 transition-all ${
                  containerSize === 10
                    ? "bg-primary text-white border-primary" 
                    : "bg-secondary/30 border-border/50 text-muted-foreground hover:border-primary/50"
                }`}
                data-testid="button-container-10"
              >
                10 m³
              </button>
            </div>
          </div>

          {/* Distance */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Entfernung (einfach)</Label>
              <span className="text-sm font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                {distance} km
              </span>
            </div>
            <Slider 
              value={[distance]} 
              onValueChange={(vals) => setDistance(vals[0])} 
              max={100} 
              step={1}
              className="py-2"
              data-testid="slider-distance"
            />
          </div>

          {/* Quantity */}
          <div className="p-4 bg-secondary/30 rounded-xl space-y-3 border border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Scale className="w-4 h-4" />
                {quantity === 2 && material2Id && material2Id !== materialId ? "Container 1" : "Mengenangabe"}
              </Label>
              <div className="flex items-center gap-2 text-sm">
                <span className={inputType === "weight" ? "text-primary font-semibold" : "text-muted-foreground"}>Tonnen</span>
                <Switch 
                  checked={inputType === "volume"}
                  onCheckedChange={(c) => setInputType(c ? "volume" : "weight")}
                  data-testid="switch-input-type"
                />
                <span className={inputType === "volume" ? "text-primary font-semibold" : "text-muted-foreground"}>m³</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Input 
                type="number" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="text-lg font-bold bg-white dark:bg-card border-border/50"
                data-testid="input-quantity"
              />
              <div className="flex items-center justify-center p-2 bg-white dark:bg-card rounded-lg text-sm border border-border/50">
                {inputType === "volume" ? (
                  <span>≈ <strong className="text-primary">{weightT.toFixed(2)}</strong> t</span>
                ) : (
                  <span>≈ <strong className="text-primary">{(weightT / (density || 1)).toFixed(2)}</strong> m³</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Container 2 Quantity - Only when different materials */}
          {quantity === 2 && material2Id && material2Id !== materialId && (
            <div className="p-4 bg-secondary/30 rounded-xl space-y-3 border border-border/50">
              <div className="flex items-center gap-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Scale className="w-4 h-4" />
                  Container 2
                </Label>
                <Badge variant="outline" className="text-xs">
                  {selectedMaterial2?.name}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Input 
                  type="number" 
                  value={inputValue2}
                  onChange={(e) => setInputValue2(e.target.value)}
                  className="text-lg font-bold bg-white dark:bg-card border-border/50"
                  data-testid="input-quantity-2"
                />
                <div className="flex items-center justify-center p-2 bg-white dark:bg-card rounded-lg text-sm border border-border/50">
                  {inputType === "volume" ? (
                    <span>≈ <strong className="text-primary">{weightT2.toFixed(2)}</strong> t</span>
                  ) : (
                    <span>≈ <strong className="text-primary">{(weightT2 / (density2 || 1)).toFixed(2)}</strong> m³</span>
                  )}
                </div>
              </div>
            </div>
          )}
          
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">Kostenaufstellung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BreakdownItem icon={<Truck className="w-4 h-4" />} label="Transport (Diesel + Maut)" amount={transportCost} total={baseCost} />
          <BreakdownItem icon={<Building2 className="w-4 h-4" />} label={`Fixkosten (${containersPerMonth} Cont./M)`} amount={fixedCostPerContainer} total={baseCost} />
          <BreakdownItem icon={<Box className="w-4 h-4" />} label={orderType === "lieferung" ? "Einkauf Schüttgüter und Baustoffe" : "Entsorgung (Deponie)"} amount={disposalCost} total={baseCost} />
          
          {/* Fixed costs breakdown info */}
          <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between">
              <span>Fahrzeuge (inkl. Abschr.):</span>
              <span className="font-mono">{formatCurrency(monthlyVehicleCosts)}</span>
            </div>
            <div className="flex justify-between">
              <span>Personal monatlich:</span>
              <span className="font-mono">{formatCurrency(monthlyEmployeeCosts)}</span>
            </div>
            <div className="flex justify-between">
              <span>Betriebskosten (inkl. Miete):</span>
              <span className="font-mono">{formatCurrency(monthlyOperatingCosts)}</span>
            </div>
            <div className="flex justify-between">
              <span>Darlehen monatlich:</span>
              <span className="font-mono">{formatCurrency(monthlyLoanCosts)}</span>
            </div>
            <div className="flex justify-between font-medium pt-1 border-t border-border/50">
              <span>Gesamt: {formatCurrency(totalMonthlyFixed)}/M</span>
              <span className="font-mono">= {formatCurrency(fixedCostPerContainer)}/Cont.</span>
            </div>
          </div>
          
          <Separator />
          
          <Button 
            className="w-full text-base py-5 font-semibold"
            onClick={handleSave}
            disabled={isSaving || !selectedMaterial}
            data-testid="button-save-quote"
          >
            {isSaving ? "Speichern..." : (
              <>
                <Save className="mr-2 h-4 w-4" /> Kalkulation speichern
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function BreakdownItem({ icon, label, amount, total }: { icon: React.ReactNode, label: string, amount: number, total: number }) {
  const percent = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">{icon} {label}</span>
        <span className="font-mono font-semibold">{formatCurrency(amount)}</span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full bg-primary/70 rounded-full" 
        />
      </div>
    </div>
  );
}
