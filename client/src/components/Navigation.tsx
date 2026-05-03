import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calculator, DollarSign, Calendar, Boxes, Package, Truck, LogOut, User, Shield, Menu, Users, X, UserCircle, Tag, Target, FileSpreadsheet, ClipboardList, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function Navigation() {
  const [location] = useLocation();
  const { user, logout, isLoggingOut, isAdmin, isManager } = useAuth();

  const links = [
    { href: "/", label: "Start", icon: LayoutDashboard },
    { href: "/calculator", label: "Kalkulation", icon: Calculator },
    { href: "/sales-prices", label: "Verkaufspreise", icon: Tag },
    { href: "/materials", label: "Einkaufspreise", icon: Boxes },
    { href: "/resources", label: "Ressourcen", icon: Package },
    { href: "/costs", label: "Kosten", icon: DollarSign },
    { href: "/planning", label: "Planung", icon: Calendar },
    { href: "/trips", label: "Fahrten", icon: Truck },
    { href: "/customers", label: "Kunden", icon: UserCircle },
    { href: "/tasks", label: "Aufgaben & Notizen", icon: CheckSquare },
  ];

  const adminLinks = [
    { href: "/articles", label: "Artikelstamm", icon: ClipboardList },
    { href: "/bwa", label: "BWA", icon: FileSpreadsheet },
    { href: "/users", label: "Benutzerverwaltung", icon: Users },
  ];

  const managerLinks = [
    { href: "/forecast", label: "Prognose-Center", icon: Target },
  ];

  return (
    <nav className="hidden md:flex flex-col w-64 bg-card border-r border-border/50 h-screen sticky top-0 shadow-sm">
      <div className="p-6 border-b border-border/50">
        <h1 className="text-xl font-bold text-primary tracking-tight">
          Rieprecht
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Container Kalkulator</p>
      </div>

      <div className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location === link.href;
          return (
            <Link key={link.href} href={link.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "text-primary-foreground")} />
                <span className="font-medium text-sm">{link.label}</span>
              </div>
            </Link>
          );
        })}

        {isManager && (
          <>
            <div className="pt-4 pb-2">
              <p className="text-xs text-muted-foreground px-4 font-medium uppercase tracking-wider">Management</p>
            </div>
            {managerLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("w-5 h-5", isActive && "text-primary-foreground")} />
                    <span className="font-medium text-sm">{link.label}</span>
                  </div>
                </Link>
              );
            })}
          </>
        )}

        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              <p className="text-xs text-muted-foreground px-4 font-medium uppercase tracking-wider">Admin</p>
            </div>
            {adminLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("w-5 h-5", isActive && "text-primary-foreground")} />
                    <span className="font-medium text-sm">{link.label}</span>
                  </div>
                </Link>
              );
            })}
          </>
        )}
      </div>

      <div className="p-4 border-t border-border/50 space-y-2">
        {user && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50">
            {isAdmin ? (
              <Shield className="w-4 h-4 text-primary flex-shrink-0" />
            ) : (
              <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              <p className="text-[10px] text-primary capitalize">{user.role}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => logout()}
          disabled={isLoggingOut}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {isLoggingOut ? "Wird abgemeldet..." : "Abmelden"}
        </Button>
      </div>
    </nav>
  );
}

export function MobileNav() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { user, logout, isLoggingOut, isAdmin, isManager } = useAuth();

  const links = [
    { href: "/", label: "Start", icon: LayoutDashboard },
    { href: "/calculator", label: "Kalkulation", icon: Calculator },
    { href: "/sales-prices", label: "Verkaufspreise", icon: Tag },
    { href: "/materials", label: "Einkaufspreise", icon: Boxes },
    { href: "/resources", label: "Ressourcen", icon: Package },
    { href: "/costs", label: "Kosten", icon: DollarSign },
    { href: "/planning", label: "Planung", icon: Calendar },
    { href: "/trips", label: "Fahrten", icon: Truck },
    { href: "/customers", label: "Kunden", icon: UserCircle },
    { href: "/tasks", label: "Aufgaben & Notizen", icon: CheckSquare },
  ];

  const adminLinks = [
    { href: "/articles", label: "Artikelstamm", icon: ClipboardList },
    { href: "/bwa", label: "BWA", icon: FileSpreadsheet },
    { href: "/users", label: "Benutzerverwaltung", icon: Users },
  ];

  const managerLinks = [
    { href: "/forecast", label: "Prognose-Center", icon: Target },
  ];

  const handleNavigation = (href: string) => {
    setOpen(false);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Administrator";
      case "manager": return "Manager";
      case "mitarbeiter": return "Mitarbeiter";
      default: return role;
    }
  };

  const getRoleIcon = () => {
    if (user?.role === "admin") return <Shield className="w-5 h-5 text-primary" />;
    if (user?.role === "manager") return <Users className="w-5 h-5 text-blue-500" />;
    return <User className="w-5 h-5 text-muted-foreground" />;
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            className="md:hidden fixed top-3 right-3 z-50 w-10 h-10 rounded-lg bg-primary text-primary-foreground shadow-md flex items-center justify-center active:scale-95 transition-transform"
            data-testid="button-mobile-menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
          <SheetHeader className="p-6 border-b border-border/50">
            <SheetTitle className="text-left">
              <span className="text-xl font-bold text-primary">Rieprecht</span>
              <p className="text-xs text-muted-foreground font-normal mt-0.5">Container Kalkulator</p>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href} onClick={() => handleNavigation(link.href)}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground active:bg-secondary"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{link.label}</span>
                  </div>
                </Link>
              );
            })}

            {isManager && (
              <>
                <div className="pt-4 pb-2">
                  <p className="text-xs text-muted-foreground px-4 font-medium uppercase tracking-wider">Management</p>
                </div>
                {managerLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location === link.href;
                  return (
                    <Link key={link.href} href={link.href} onClick={() => handleNavigation(link.href)}>
                      <div
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground active:bg-secondary"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{link.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </>
            )}

            {isAdmin && (
              <>
                <div className="pt-4 pb-2">
                  <p className="text-xs text-muted-foreground px-4 font-medium uppercase tracking-wider">Admin</p>
                </div>
                {adminLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location === link.href;
                  return (
                    <Link key={link.href} href={link.href} onClick={() => handleNavigation(link.href)}>
                      <div
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground active:bg-secondary"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{link.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </>
            )}
          </div>

          <div className="p-4 border-t border-border/50 space-y-3">
            {user && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/50">
                {getRoleIcon()}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  <p className="text-xs text-primary">{getRoleLabel(user.role)}</p>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="default"
              className="w-full justify-start text-muted-foreground"
              onClick={() => {
                logout();
                setOpen(false);
              }}
              disabled={isLoggingOut}
              data-testid="button-mobile-logout"
            >
              <LogOut className="w-5 h-5 mr-3" />
              {isLoggingOut ? "Wird abgemeldet..." : "Abmelden"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
