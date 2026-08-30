"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { USER_ROLES, PERMISSION_IDS, mergeMatrix, DEFAULT_MATRIX, type UserRole, type PermissionId } from "@/lib/rbac";
import { getRbacMatrix, saveRbacMatrix } from "@/lib/rbac-store";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนดำเนินการ");
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "ADMIN") {
    throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการสิทธิ์ได้");
  }
  return session.user.id;
}

export async function saveRbacPermissions(
  role: string,
  checkedPermissions: string[],
) {
  try {
    await requireAdmin();

    if (!(USER_ROLES as readonly string[]).includes(role)) {
      return { success: false, error: "บทบาทไม่ถูกต้อง" };
    }

    const current = await getRbacMatrix();
    const updates = {
      [role]: Object.fromEntries(
        PERMISSION_IDS.map((permission) => [
          permission,
          checkedPermissions.includes(permission),
        ]),
      ),
    } as Record<UserRole, Record<PermissionId, boolean>>;

    const next = mergeMatrix(current, updates);
    await saveRbacMatrix(next);

    revalidatePath("/admin/rbac");
    revalidatePath("/admin/knowledge-base");
    return { success: true, message: "บันทึกสิทธิ์เรียบร้อยแล้ว" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึก",
    };
  }
}

export async function resetRbacToDefault() {
  try {
    await requireAdmin();
    await saveRbacMatrix(DEFAULT_MATRIX);
    revalidatePath("/admin/rbac");
    return { success: true, message: "รีเซ็ตสิทธิ์เป็นค่าเริ่มต้นแล้ว" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
    };
  }
}
