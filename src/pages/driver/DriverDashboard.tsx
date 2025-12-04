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
          <p className="text-gray-700 font-medium">Loading...</p>
        </div>
      </div>
    );
  }


  const quickActions = [
    {
      title: "Start Route",
      description: "Begin today's delivery route",
      icon: Route,
      gradient: "from-blue-500 to-blue-600",
      action: () => navigate("/driver/start-route"),
    },
    {
      title: "Shop Billing",
      description: "Create bills for shop sales",
      icon: ShoppingCart,
      gradient: "from-emerald-500 to-emerald-600",
      action: () => navigate("/driver/shop-billing"),
    },
    {
      title: "Add Product",
      description: "Add new products to inventory",
      icon: Plus,
      gradient: "from-orange-500 to-orange-600",
      action: () => navigate("/driver/add-product"),
    },
    {
      title: "Day Summary",
      description: "View today's sales summary",
      icon: BarChart3,
      gradient: "from-purple-500 to-purple-600",
      action: () => navigate("/driver/summary"),
    },
    {
      title: "Bill History",
      description: "See all bills created for a day",
      icon: Package,
      gradient: "from-teal-500 to-teal-600",
      action: () => navigate("/driver/bill-history"),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent-light/10">
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
              <div
                key={index}
                className={`bg-gradient-to-br ${action.gradient} rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group hover:scale-[1.02] active:scale-[0.98] p-6 sm:p-8 touch-manipulation`}
                onClick={action.action}
              >
                <div className="flex flex-col items-center text-center text-white">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <action.icon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-2">{action.title}</h3>
                  <p className="text-white text-sm sm:text-base mb-4 font-medium">{action.description}</p>
                  <Button
                    variant="secondary"
                    className="w-full bg-white text-gray-900 hover:bg-gray-50 font-semibold border-2 border-white/20"
                  >
                    Get Started
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DriverDashboard;
