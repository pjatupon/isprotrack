import "server-only";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MATRIX,
  USER_ROLES,
  isRbacMatrix,
  type PermissionId,
  type RbacMatrix,
} from "./rbac";

export const RBAC_SETTING_NAME = "rbac.permissions";

export async function getRbacMatrix(): Promise<RbacMatrix> {
  const setting = await prisma.setting.findUnique({ where: { name: RBAC_SETTING_NAME } });
  if (!setting?.value) return DEFAULT_MATRIX;

  try {
    const parsed: unknown = JSON.parse(setting.value);
    if (!isRbacMatrix(parsed)) return DEFAULT_MATRIX;
    return parsed;
  } catch {
    return DEFAULT_MATRIX;
  }
}

export async function saveRbacMatrix(matrix: RbacMatrix): Promise<void> {
  await prisma.setting.upsert({
    where: { name: RBAC_SETTING_NAME },
    update: { value: JSON.stringify(matrix) },
    create: { name: RBAC_SETTING_NAME, value: JSON.stringify(matrix) },
  });
}

export async function can(
  role: string | undefined | null,
  permission: PermissionId,
): Promise<boolean> {
  if (!role || !USER_ROLES.includes(role as never)) return false;
  const matrix = await getRbacMatrix();
  return matrix[role as keyof RbacMatrix][permission] === true;
}
