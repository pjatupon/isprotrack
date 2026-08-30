"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") {
    throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการหน่วยงานได้");
  }
  return session.user.id;
}

function errorResult(error: unknown) {
  return {
    success: false as const,
    error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
  };
}

export async function saveDepartment(prevState: unknown, formData: FormData) {
  try {
    await requireAdmin();

    const id = (formData.get("id") as string)?.trim() || undefined;
    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim().toUpperCase() || null;
    const description = (formData.get("description") as string)?.trim() || null;
    const parentId = (formData.get("parentId") as string)?.trim() || null;
    const sortOrder = Number((formData.get("sortOrder") as string) ?? 0) || 0;
    const isActive = (formData.get("isActive") as string) === "on";

    if (!name) {
      return { success: false, error: "กรุณาระบุชื่อหน่วยงาน" };
    }
    if (parentId === id) {
      return { success: false, error: "ไม่สามารถกำหนดหน่วยงานตนเองเป็นหน่วยงานแม่ได้" };
    }

    if (code) {
      const codeConflict = await prisma.department.findFirst({
        where: { code, NOT: id ? { id } : undefined },
      });
      if (codeConflict) {
        return { success: false, error: `มีหน่วยงานที่ใช้รหัส "${code}" อยู่แล้ว` };
      }
    }

    if (id) {
      const current = await prisma.department.findUnique({ where: { id } });
      if (!current) {
        return { success: false, error: "ไม่พบหน่วยงาน" };
      }
      if (parentId) {
        const cycle = await isDescendant(id, parentId);
        if (cycle) {
          return { success: false, error: "ไม่สามารถย้ายหน่วยงานไปไว้ภายใต้หน่วยงานย่อยของตนเองได้" };
        }
      }
      await prisma.department.update({
        where: { id },
        data: { name, code, description, parentId, sortOrder, isActive },
      });
      await syncUserDepartmentNames(id);
      revalidatePath("/admin/departments");
      return { success: true, message: `อัปเดตหน่วยงาน "${name}" เรียบร้อยแล้ว` };
    }

    await prisma.department.create({
      data: { name, code, description, parentId, sortOrder, isActive },
    });
    revalidatePath("/admin/departments");
    return { success: true, message: `สร้างหน่วยงาน "${name}" เรียบร้อยแล้ว` };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteDepartment(departmentId: string) {
  try {
    await requireAdmin();
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      return { success: false, error: "ไม่พบหน่วยงาน" };
    }

    const childrenCount = await prisma.department.count({ where: { parentId: departmentId } });
    if (childrenCount > 0) {
      return {
        success: false,
        error: `ไม่สามารถลบหน่วยงาน "${department.name}" ได้ เนื่องจากยังมีหน่วยงานย่อย ${childrenCount} หน่วย ภายใต้หน่วยงานนี้ กรุณาลบหรือย้ายหน่วยงานย่อยก่อน`,
      };
    }

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { departmentId },
        data: { departmentId: null, department: null },
      }),
      prisma.department.delete({ where: { id: departmentId } }),
    ]);

    revalidatePath("/admin/departments");
    return { success: true, message: `ลบหน่วยงาน "${department.name}" เรียบร้อยแล้ว` };
  } catch (error) {
    return errorResult(error);
  }
}

export async function setDepartmentUsers(departmentId: string, userIds: string[]) {
  try {
    await requireAdmin();
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      return { success: false, error: "ไม่พบหน่วยงาน" };
    }

    const ids = [...new Set(userIds.filter(Boolean))];
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { departmentId },
        data: { departmentId: null, department: null },
      }),
      prisma.user.updateMany({
        where: { id: { in: ids } },
        data: { departmentId, department: department.name },
      }),
    ]);

    revalidatePath("/admin/departments");
    return { success: true, message: `บันทึกสมาชิกของหน่วยงาน "${department.name}" เรียบร้อยแล้ว` };
  } catch (error) {
    return errorResult(error);
  }
}

async function isDescendant(parentId: string, candidateId: string): Promise<boolean> {
  const children = await prisma.department.findMany({
    where: { parentId: candidateId },
    select: { id: true },
  });
  if (children.some((child) => child.id === parentId)) {
    return true;
  }
  for (const child of children) {
    if (await isDescendant(parentId, child.id)) {
      return true;
    }
  }
  return false;
}

async function syncUserDepartmentNames(departmentId: string): Promise<void> {
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) return;
  await prisma.user.updateMany({
    where: { departmentId },
    data: { department: department.name },
  });
}
