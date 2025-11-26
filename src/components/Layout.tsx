import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  PackagePlus,
  History,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import collegeLogo from "@/assets/college-logo-new.png";
import itLogo from "@/assets/it-logo-new.png";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    // ล้าง session ในฝั่ง local เสมอไม่ว่าจะมี error หรือไม่
    await supabase.auth.signOut({ scope: 'local' });
    toast.success("ออกจากระบบสำเร็จ");
    navigate("/auth");
  };

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "หน้าหลัก" },
    { path: "/products", icon: Package, label: "จัดการสินค้า" },
    { path: "/pos", icon: ShoppingCart, label: "ขายสินค้า" },
    { path: "/sales-history", icon: History, label: "ประวัติการขาย" },
    { path: "/settings", icon: Settings, label: "ตั้งค่า" },
  ];

  const SidebarContent = () => (
    <>
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-4">
          <img src={collegeLogo} alt="College" className="h-12 w-12 object-contain" />
          <img src={itLogo} alt="IT Department" className="h-12 w-12 object-contain" />
        </div>
        <h2 className="text-base sm:text-lg font-semibold">ระบบจัดการร้านขายของชำ</h2>
        <p className="text-xs sm:text-sm text-sidebar-foreground/80">วิทยาลัยเทคนิควังน้ำเย็น</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-destructive hover:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          ออกจากระบบ
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-1.5">
          <img src={collegeLogo} alt="College" className="h-8 w-8 object-contain" />
          <img src={itLogo} alt="IT Department" className="h-8 w-8 object-contain" />
          <h2 className="text-sm font-semibold">ระบบจัดการร้านขายของชำ</h2>
        </div>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
