import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, User, Crown } from "lucide-react";

type AppRole = 'admin' | 'manager' | 'staff';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole | null;
  created_at: string;
}

const roleLabels: Record<AppRole, string> = {
  admin: 'เจ้าของร้าน',
  manager: 'ผู้จัดการ',
  staff: 'พนักงาน',
};

const roleIcons: Record<AppRole, React.ReactNode> = {
  admin: <Crown className="h-4 w-4" />,
  manager: <ShieldCheck className="h-4 w-4" />,
  staff: <User className="h-4 w-4" />,
};

const roleBadgeVariants: Record<AppRole, "default" | "secondary" | "outline"> = {
  admin: 'default',
  manager: 'secondary',
  staff: 'outline',
};

export default function Users() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<AppRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState<AppRole>('staff');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    fetchUsers();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (roleData) {
        setCurrentUserRole(roleData.role as AppRole);
      }
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, created_at');

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Create a map of roles
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role as AppRole]) || []);

      // Get user emails from auth (we'll use profiles as base)
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => ({
        id: profile.id,
        email: '', // We'll need to get this separately or store in profiles
        full_name: profile.full_name,
        role: roleMap.get(profile.id) || null,
        created_at: profile.created_at,
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast.error("ไม่สามารถดึงข้อมูลผู้ใช้ได้: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (user: UserWithRole) => {
    setSelectedUser(user);
    setNewRole(user.role || 'staff');
    setDialogOpen(true);
  };

  const saveRole = async () => {
    if (!selectedUser) return;

    try {
      if (selectedUser.role) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', selectedUser.id);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: selectedUser.id, role: newRole });

        if (error) throw error;
      }

      toast.success("เปลี่ยนยศสำเร็จ");
      setDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error("ไม่สามารถเปลี่ยนยศได้: " + error.message);
    }
  };

  const isAdmin = currentUserRole === 'admin';

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">จัดการผู้ใช้</h1>
            <p className="text-muted-foreground">ดูรายชื่อผู้ใช้และจัดการยศ</p>
          </div>
          {currentUserRole && (
            <Badge variant={roleBadgeVariants[currentUserRole]} className="flex items-center gap-1">
              {roleIcons[currentUserRole]}
              {roleLabels[currentUserRole]}
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="text-center py-10">กำลังโหลด...</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>ยศ</TableHead>
                  <TableHead>วันที่สมัคร</TableHead>
                  {isAdmin && <TableHead className="text-right">จัดการ</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      ยังไม่มีผู้ใช้ในระบบ
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name || 'ไม่ระบุชื่อ'}
                        {user.id === currentUserId && (
                          <Badge variant="outline" className="ml-2">คุณ</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.role ? (
                          <Badge variant={roleBadgeVariants[user.role]} className="flex items-center gap-1 w-fit">
                            {roleIcons[user.role]}
                            {roleLabels[user.role]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">ยังไม่มียศ</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString('th-TH')}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRoleChange(user)}
                            disabled={user.id === currentUserId}
                          >
                            <Shield className="h-4 w-4 mr-1" />
                            เปลี่ยนยศ
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!isAdmin && currentUserRole && (
          <p className="text-sm text-muted-foreground text-center">
            คุณต้องเป็นเจ้าของร้านเพื่อจัดการยศของผู้ใช้อื่น
          </p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เปลี่ยนยศผู้ใช้</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>เปลี่ยนยศของ: <strong>{selectedUser?.full_name || 'ไม่ระบุชื่อ'}</strong></p>
            <Select value={newRole} onValueChange={(value) => setNewRole(value as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    เจ้าของร้าน
                  </div>
                </SelectItem>
                <SelectItem value="manager">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    ผู้จัดการ
                  </div>
                </SelectItem>
                <SelectItem value="staff">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    พนักงาน
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={saveRole}>
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
