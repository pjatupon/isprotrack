import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserManager } from "@/components/admin/users/user-manager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") redirect("/admin");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { requests: true, sessions: true } },
    },
  });

  return (
    <UserManager
      users={users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        emailVerified: user.emailVerified,
        image: user.image,
        requestCount: user._count.requests,
        sessionCount: user._count.sessions,
        createdAt: user.createdAt.toISOString(),
      }))}
    />
  );
}
