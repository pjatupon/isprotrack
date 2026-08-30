"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { USER_ROLES } from "@/lib/rbac";

import type { UserRole as SchemaUserRole } from "@/generated/prisma/enums";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") {
    throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการผู้ใช้ได้");
  }
  return session.user.id;
}

function isUserRole(value: string): value is SchemaUserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

function errorResult(error: unknown) {
  return {
    success: false as const,
    error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
  };
}

export async function createUser(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();

    const name = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const password = (formData.get("password") as string) ?? "";
    const role = (formData.get("role") as string) ?? "REQUESTER";
    const department = (formData.get("department") as string)?.trim() || null;

    if (!name || !email) {
      return { success: false, error: "กรุณาระบุชื่อและอีเมล" };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: "รูปแบบอีเมลไม่ถูกต้อง" };
    }
    if (password.length < 8) {
      return { success: false, error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" };
    }
    if (!isUserRole(role)) {
      return { success: false, error: "บทบาทไม่ถูกต้อง" };
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "มีผู้ใช้ที่มีอีเมลนี้อยู่แล้ว" };
    }

    await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
        department: department ?? undefined,
      },
    });

    await prisma.user.update({
      where: { email },
      data: { role: role as SchemaUserRole, emailVerified: true, department },
    });

    revalidatePath("/admin/users");
    return { success: true, message: `สร้างผู้ใช้ ${name} เรียบร้อยแล้ว` };
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateUser(userId: string, formData: FormData) {
  try {
    await requireAdmin();

    const name = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const role = (formData.get("role") as string) ?? "REQUESTER";
    const department = (formData.get("department") as string)?.trim() || null;
    const emailVerified = (formData.get("emailVerified") as string) === "on";

    if (!name || !email) {
      return { success: false, error: "กรุณาระบุชื่อและอีเมล" };
    }
    if (!isUserRole(role)) {
      return { success: false, error: "บทบาทไม่ถูกต้อง" };
    }

    const conflict = await prisma.user.findFirst({
      where: { email, NOT: { id: userId } },
    });
    if (conflict) {
      return { success: false, error: "มีผู้ใช้ที่มีอีเมลนี้อยู่แล้ว" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { name, email, role: role as SchemaUserRole, department, emailVerified },
    });

    revalidatePath("/admin/users");
    return { success: true, message: "อัปเดตผู้ใช้เรียบร้อยแล้ว" };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteUser(userId: string) {
  try {
    const adminId = await requireAdmin();
    if (adminId === userId) {
      return { success: false, error: "ไม่สามารถลบบัญชีผู้ดูแลระบบของตัวเองได้" };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, error: "ไม่พบผู้ใช้" };
    }

    await prisma.user.delete({ where: { id: userId } });
    revalidatePath("/admin/users");
    return { success: true, message: `ลบผู้ใช้ ${user.name} เรียบร้อยแล้ว` };
  } catch (error) {
    return errorResult(error);
  }
}
