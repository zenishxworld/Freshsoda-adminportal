import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useToast } from "../../hooks/use-toast";
import {
  Route,
  ShoppingCart,
  Plus,
  BarChart3,
  LogOut,
  User,
  Package
} from "lucide-react";
import { isWithinAuthGracePeriod } from "../../lib/utils";

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { }, [navigate]);

  const handleLogout = async () => {
    try { localStorage.removeItem('lastLoginAt'); } catch { }
    toast({ title: "Logged Out", description: "You have been logged out successfully" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-accent-light flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }


  const quickActions = [
    {
      title: "Start Route",
      description: "Begin today's delivery route",
      icon: Route,
      color: "bg-blue-500",
      action: () => navigate("/driver/start-route"),
    },
    {
      title: "Shop Billing",
      description: "Create bills for shop sales",
      icon: ShoppingCart,
      color: "bg-emerald-400",
      action: () => navigate("/driver/shop-billing"),
    },
    {
      title: "Add Product",
      description: "Add new products to inventory",
      icon: Plus,
      color: "bg-amber-400",
      action: () => navigate("/driver/add-product"),
    },
    {
      title: "Day Summary",
      description: "View today's sales summary",
      icon: BarChart3,
      color: "bg-blue-500",
      action: () => navigate("/driver/summary"),
    },
    {
      title: "Bill History",
      description: "See all bills created for a day",
      icon: Package,
      color: "bg-emerald-400",
      action: () => navigate("/driver/bill-history"),
    },
  ];

  return (
    <div className="min-h-screen bg-purple-50">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-border shadow-soft sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-business-blue to-business-blue-dark rounded-lg sm:rounded-xl flex items-center justify-center">
                <Route className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-foreground">Fresh Soda</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Driver Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                <span className="font-medium">{user?.email?.split('@')[0] || 'Driver'}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="h-9 w-9 p-0">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-safe">
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">Welcome Back!</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Ready to start your delivery route today?</p>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {quickActions.map((action, index) => (
              <Card
                key={index}
                className="border-0 shadow-medium active:shadow-strong transition-all duration-200 cursor-pointer group active:scale-[0.98] sm:hover:scale-[1.02] touch-manipulation"
                onClick={action.action}
              >
                <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl ${action.color} flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <action.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-bold">{action.title}</CardTitle>
                  <CardDescription className="text-sm sm:text-base">{action.description}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <Button variant="card" className="w-full h-10 sm:h-9 text-sm sm:text-base touch-manipulation">
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DriverDashboard;
