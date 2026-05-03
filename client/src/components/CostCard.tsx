import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface CostCardProps {
  title: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  description?: string;
}

export function CostCard({ title, value, trend, trendValue, icon, description }: CostCardProps) {
  return (
    <Card className="hover:shadow-lg transition-all duration-300 border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide truncate">
          {title}
        </CardTitle>
        <div className="shrink-0">
          {icon || <DollarSign className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
        <div className="text-xl sm:text-2xl font-bold text-foreground font-display truncate">{value}</div>
        {(trend || description) && (
          <div className="flex items-center mt-1 space-x-2">
            {trend && (
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full flex items-center",
                trend === "up" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : 
                trend === "down" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" : "bg-secondary text-muted-foreground"
              )}>
                {trend === "up" ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                {trendValue}
              </span>
            )}
            {description && (
              <p className="text-xs text-muted-foreground truncate">{description}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
