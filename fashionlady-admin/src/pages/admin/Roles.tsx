import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface PermissionModule {
  group: string;
  name: string;
  key: string;
  viewOnly?: boolean;
}

interface Role {
  id: string;
  name: string;
  active: boolean;
  totalPermission: string;
  permissions: Record<string, { view: boolean; edit: boolean }>;
}

export default function Roles() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Record<string, { view: boolean; edit: boolean }>>({});

  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data } = await api.get("/admin-access/roles");
      return data.data as Role[];
    },
  });

  const modulesQuery = useQuery({
    queryKey: ["permission-modules"],
    queryFn: async () => {
      const { data } = await api.get("/admin-access/modules");
      return data.data as PermissionModule[];
    },
  });

  const groupedModules = useMemo(() => {
    return (modulesQuery.data ?? []).reduce<Record<string, PermissionModule[]>>((acc, item) => {
      acc[item.group] = acc[item.group] || [];
      acc[item.group].push(item);
      return acc;
    }, {});
  }, [modulesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { name: string; active: boolean; permissions: Record<string, { view: boolean; edit: boolean }> }) => {
      if (editingRole) {
        const { data } = await api.patch(`/admin-access/roles/${editingRole.id}`, payload);
        return data.data;
      }
      const { data } = await api.post("/admin-access/roles", payload);
      return data.data;
    },
    onSuccess: async () => {
      toast({ title: editingRole ? "Role updated" : "Role created" });
      setOpen(false);
      setEditingRole(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
    },
  });

  function openRole(role?: Role) {
    setEditingRole(role ?? null);
    setPermissions(role?.permissions ?? {});
    setOpen(true);
  }

  function setPermission(key: string, field: "view" | "edit", value: boolean) {
    setPermissions((current) => ({
      ...current,
      [key]: {
        view: field === "edit" && value ? true : current[key]?.view || (field === "view" ? value : false),
        edit: field === "view" && !value ? false : field === "edit" ? value : current[key]?.edit || false,
      },
    }));
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-2xl">Role Management</CardTitle>
            <p className="text-sm text-muted-foreground">Create roles and assign module permissions.</p>
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div>
            <CardTitle className="text-2xl">Role List</CardTitle>
            <p className="text-sm text-muted-foreground">{rolesQuery.data?.length ?? 0} roles</p>
          </div>
          <Button onClick={() => openRole()} className="bg-gradient-primary text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Add New Role
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr className="text-left">
                <th className="p-4">#</th>
                <th className="p-4">Role</th>
                <th className="p-4">Total Permission</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(rolesQuery.data ?? []).map((role, index) => (
                <tr key={role.id} className="border-t">
                  <td className="p-4">{index + 1}</td>
                  <td className="p-4">
                    <div className="font-semibold">{role.name}</div>
                    <div className="max-w-md truncate text-xs text-muted-foreground">
                      {Object.entries(role.permissions || {}).filter(([, p]) => p.view || p.edit).map(([key]) => key).join(", ")}
                    </div>
                  </td>
                  <td className="p-4">{role.totalPermission}</td>
                  <td className="p-4">
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{role.active ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="outline" size="icon" onClick={() => openRole(role)}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl">{editingRole ? "Edit Role" : "Add New Role"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              await saveMutation.mutateAsync({
                name: String(form.get("name") || ""),
                active: form.get("active") === "on",
                permissions,
              });
            }}
          >
            <div className="space-y-2">
              <Label>Role name</Label>
              <Input name="name" required defaultValue={editingRole?.name ?? ""} placeholder="Role name" />
            </div>
            <div className="grid grid-cols-[1fr_110px_110px] border-b bg-secondary/40 px-3 py-2 text-sm font-semibold">
              <span>Name</span>
              <span>View</span>
              <span>Edit</span>
            </div>
            {Object.entries(groupedModules).map(([group, items]) => (
              <div key={group}>
                <h3 className="px-1 py-3 text-xs font-bold uppercase text-muted-foreground">{group}</h3>
                {items.map((item) => (
                  <div key={item.key} className="grid grid-cols-[1fr_110px_110px] items-center border-b px-3 py-3">
                    <div className="font-medium">{item.name}</div>
                    <Switch
                      checked={permissions[item.key]?.view || false}
                      onCheckedChange={(value) => setPermission(item.key, "view", value)}
                    />
                    {item.viewOnly ? (
                      <span className="text-sm text-muted-foreground">View only</span>
                    ) : (
                      <Switch
                        checked={permissions[item.key]?.edit || false}
                        onCheckedChange={(value) => setPermission(item.key, "edit", value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}
            <label className="flex items-center justify-between">
              <span className="font-medium">Active</span>
              <Switch name="active" defaultChecked={editingRole?.active ?? true} />
            </label>
            <DialogFooter className="sticky bottom-0 grid grid-cols-2 gap-3 bg-background py-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Discard</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-gradient-primary text-primary-foreground">
                {saveMutation.isPending ? "Saving..." : editingRole ? "Update Role" : "Create Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
