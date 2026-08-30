import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DepartmentManager } from "@/components/admin/departments/department-manager";

export const dynamic = "force-dynamic";

export default async function AdminDepartmentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") redirect("/admin");

  const [departments, users] = await Promise.all([
    prisma.department.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { children: true, users: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        departmentId: true,
      },
    }),
  ]);

  return (
    <DepartmentManager
      departments={departments.map((department) => ({
        id: department.id,
        name: department.name,
        code: department.code,
        description: department.description,
        parentId: department.parentId,
        sortOrder: department.sortOrder,
        isActive: department.isActive,
        childrenCount: department._count.children,
        memberCount: department._count.users,
        createdAt: department.createdAt.toISOString(),
      }))}
      users={users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        departmentId: user.departmentId,
      }))}
    />
  );
}
