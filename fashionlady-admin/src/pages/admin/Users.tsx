import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Search, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface AdminUser {
  id: number;
  name?: string;
  email: string;
  roleId: string;
  roleName: string;
  active: boolean;
}

interface Role {
  id: string;
  name: string;
}

export default function Users() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data } = await api.get("/admin-access/users");
      return data.data as AdminUser[];
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data } = await api.get("/admin-access/roles");
      return data.data as Role[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post("/admin-access/users", payload);
      return data.data;
    },
    onSuccess: async () => {
      toast({ title: "Admin created" });
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const users = (usersQuery.data ?? []).filter((user) =>
    [user.name, user.email, user.roleName].join(" ").toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">Admin Management</CardTitle>
            <p className="text-sm text-muted-foreground">Manage staff accounts and role access.</p>
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-col gap-3 border-b md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl">Admin List</CardTitle>
            <p className="text-sm text-muted-foreground">{users.length} accounts</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="w-72 pl-9" />
            </div>
            <Button onClick={() => setOpen(true)} className="bg-gradient-primary text-primary-foreground">
              <Plus className="mr-2 h-4 w-4" /> Add New Admin
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr className="text-left">
                  <th className="p-4">#</th>
                  <th className="p-4">Admin</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr key={user.id} className="border-t">
                    <td className="p-4">{index + 1}</td>
                    <td className="p-4">
                      <div className="font-semibold">{user.name || user.email}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="p-4">{user.roleName}</td>
                    <td className="p-4">
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        {user.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="outline" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl">Add New Admin</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              await createMutation.mutateAsync({
                name: form.get("name"),
                email: form.get("email"),
                password: form.get("password"),
                roleId: form.get("roleId"),
                active: form.get("active") === "on",
              });
            }}
          >
            <div className="space-y-2">
              <Label>Name</Label>
              <Input name="name" placeholder="Enter name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input name="email" type="email" required placeholder="admin@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input name="password" type="password" required placeholder="Password" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select name="roleId" required className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Select role</option>
                {(rolesQuery.data ?? []).map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center justify-between">
              <span className="font-medium">Active</span>
              <Switch name="active" defaultChecked />
            </label>
            <DialogFooter className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Discard</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-primary text-primary-foreground">
                {createMutation.isPending ? "Creating..." : "Create Admin"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
