import { ReactNode } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import collegeLogo from "@/assets/college-logo.webp";
import itLogo from "@/assets/it-logo.jpg";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("เกิดข้อผิดพลาดในการออกจากระบบ");
    } else {
      toast.success("ออกจากระบบสำเร็จ");
      navigate("/auth");
    }
  };

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "หน้าหลัก" },
    { path: "/products", icon: Package, label: "จัดการสินค้า" },
    { path: "/pos", icon: ShoppingCart, label: "ขายสินค้า" },
    { path: "/stock-in", icon: PackagePlus, label: "รับสินค้าเข้า" },
    { path: "/sales-history", icon: History, label: "ประวัติการขาย" },
    { path: "/settings", icon: Settings, label: "ตั้งค่า" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3 mb-4">
            <img src={collegeLogo} alt="College" className="h-12 w-12 object-contain" />
            <img src={itLogo} alt="IT Department" className="h-12 w-12 object-contain" />
          </div>
          <h2 className="text-lg font-semibold">ระบบจัดการร้านขายของชำ</h2>
          <p className="text-sm text-sidebar-foreground/80">วิทยาลัยเทคนิควังน้ำเย็น</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
