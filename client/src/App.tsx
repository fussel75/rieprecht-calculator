import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Calculator from "@/pages/Calculator";
import CostManagement from "@/pages/CostManagement";
import Materials from "@/pages/Materials";
import Planning from "@/pages/Planning";
import Resources from "@/pages/Resources";
import Trips from "@/pages/Trips";
import Users from "@/pages/Users";
import Customers from "@/pages/Customers";
import SalesPrices from "@/pages/SalesPrices";
import ComprehensiveReport from "@/pages/ComprehensiveReport";
import ForecastCenter from "@/pages/ForecastCenter";
import BWA from "@/pages/BWA";
import Articles from "@/pages/Articles";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import { Navigation, MobileNav } from "@/components/Navigation";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function AuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function AuthenticatedLayout() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Navigation />
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-8 lg:p-12 pb-24 md:pb-12">
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500 w-full">
          <Switch>
            <Route path="/">
              <ProtectedRoute component={Dashboard} />
            </Route>
            <Route path="/calculator">
              <ProtectedRoute component={Calculator} />
            </Route>
            <Route path="/trips">
              <ProtectedRoute component={Trips} />
            </Route>
            <Route path="/costs">
              <ProtectedRoute component={CostManagement} />
            </Route>
            <Route path="/materials">
              <ProtectedRoute component={Materials} />
            </Route>
            <Route path="/resources">
              <ProtectedRoute component={Resources} />
            </Route>
            <Route path="/planning">
              <ProtectedRoute component={Planning} />
            </Route>
            <Route path="/users">
              <ProtectedRoute component={Users} />
            </Route>
            <Route path="/customers">
              <ProtectedRoute component={Customers} />
            </Route>
            <Route path="/sales-prices">
              <ProtectedRoute component={SalesPrices} />
            </Route>
            <Route path="/report">
              <ProtectedRoute component={ComprehensiveReport} />
            </Route>
            <Route path="/forecast">
              <ProtectedRoute component={ForecastCenter} />
            </Route>
            <Route path="/bwa">
              <ProtectedRoute component={BWA} />
            </Route>
            <Route path="/articles">
              <ProtectedRoute component={Articles} />
            </Route>
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];
  const isAuthRoute = authRoutes.some(route => location.startsWith(route));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthRoute) {
    return (
      <Switch>
        <Route path="/login">
          <AuthRoute component={Login} />
        </Route>
        <Route path="/register">
          <AuthRoute component={Register} />
        </Route>
        <Route path="/forgot-password">
          <AuthRoute component={ForgotPassword} />
        </Route>
        <Route path="/reset-password">
          <AuthRoute component={ResetPassword} />
        </Route>
        <Route path="/verify-email">
          <VerifyEmail />
        </Route>
      </Switch>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
