"use client";

import React, { useState, useTransition } from "react";
import { Button, Card, Chip, Alert, Checkbox, Modal, Tooltip, useOverlayState } from "@heroui/react";
import {
  FiShield,
  FiEdit2,
  FiRefreshCw,
  FiCheck,
  FiX,
  FiInfo,
} from "react-icons/fi";
import {
  DEFAULT_MATRIX,
  PERMISSION_IDS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  USER_ROLES,
  type PermissionId,
  type RbacMatrix,
  type UserRole,
} from "@/lib/rbac";
import { saveRbacPermissions, resetRbacToDefault } from "@/app/admin/rbac/actions";

const ROLE_COLORS: Record<UserRole, "default" | "success" | "warning" | "danger" | "accent"> = {
  ADMIN: "danger",
  STAFF: "accent",
  APPROVER: "success",
  REQUESTER: "default",
};

export function RbacManager({ initialMatrix }: { initialMatrix: RbacMatrix }) {
  const [matrix, setMatrix] = useState<RbacMatrix>(initialMatrix);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [draftPerms, setDraftPerms] = useState<Set<PermissionId>>(new Set());
  const [isMutating, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ success: boolean; message: string } | null>(null);
  const editModal = useOverlayState();

  const openEdit = (role: UserRole) => {
    setEditingRole(role);
    setDraftPerms(
      new Set(PERMISSION_IDS.filter((permission) => matrix[role][permission])),
    );
    editModal.open();
  };

  const toggleDraft = (permission: PermissionId) => {
    setDraftPerms((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  };

  const handleSave = () => {
    if (!editingRole) return;
    startTransition(async () => {
      const result = await saveRbacPermissions(
        editingRole,
        Array.from(draftPerms),
      );
      if (!result.success && result.error) {
        setNotice({ success: false, message: result.error });
        return;
      }
      setMatrix((prev) => ({
        ...prev,
        [editingRole]: Object.fromEntries(
          PERMISSION_IDS.map((permission) => [
            permission,
            draftPerms.has(permission),
          ]),
        ) as RbacMatrix[UserRole],
      }));
      editModal.close();
      setNotice({ success: true, message: result.message ?? "บันทึกสิทธิ์เรียบร้อยแล้ว" });
    });
  };

  const handleReset = () => {
    startTransition(async () => {
      const result = await resetRbacToDefault();
      if (!result.success && result.error) {
        setNotice({ success: false, message: result.error });
        return;
      }
      setMatrix(DEFAULT_MATRIX);
      setNotice({ success: true, message: result.message ?? "รีเซ็ตสิทธิ์เรียบร้อยแล้ว" });
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="space-y-1">
          <span className="text-[0.7rem] font-black tracking-widest text-[#8B0000] uppercase">
            ROLE-BASED ACCESS CONTROL
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
            จัดการสิทธิ์การเข้าถึง (RBAC)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            กำหนดสิทธิ์ของแต่ละบทบาทในการใช้งานระบบฟีเจอร์ต่าง ๆ
          </p>
        </div>
        <Button
          onPress={handleReset}
          isDisabled={isMutating}
          variant="secondary"
          className="border border-slate-300 text-xs font-semibold text-[#272522]"
        >
          <FiRefreshCw /> รีเซ็ตเป็นค่าเริ่มต้น
        </Button>
      </div>

      {notice && (
        <Alert status={notice.success ? "success" : "danger"} className="rounded-2xl">
          <Alert.Description className="text-xs font-semibold">{notice.message}</Alert.Description>
        </Alert>
      )}

      {/* Permission matrix */}
      <Card className="border border-slate-200/80 bg-white p-5 shadow-xs rounded-xl">
        <Card.Header className="px-0 pt-0">
          <Card.Title className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FiShield className="text-[#8B0000]" /> ตารางเมทริกซ์สิทธิ์
          </Card.Title>
          <Card.Description className="text-xs text-slate-500">
            คลิกปุ่มแก้ไขในแต่ละคอลัมน์บทบาทเพื่อเปิด/ปิดสิทธิ์ แล้วกดบันทึก
          </Card.Description>
        </Card.Header>
        <Card.Content className="px-0 pt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-2.5 font-bold text-slate-600 min-w-[220px]">สิทธิ์ / ฟีเจอร์</th>
                {USER_ROLES.map((role) => (
                  <th key={role} className="p-2.5 text-center font-bold text-slate-600">
                    <div className="flex flex-col items-center gap-1">
                      <Chip size="sm" variant="soft" color={ROLE_COLORS[role]}>
                        {ROLE_LABELS[role]}
                      </Chip>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => openEdit(role)}
                        isDisabled={isMutating}
                        className="border border-slate-300 p-1 min-w-0 h-6 text-[0.65rem] text-slate-600"
                      >
                        <FiEdit2 size={10} /> แก้ไข
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_IDS.map((permission) => (
                <tr key={permission} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="p-2.5">
                    <div className="flex items-center gap-1.5 font-medium text-slate-700">
                      <span>{PERMISSION_LABELS[permission]}</span>
                      <Tooltip.Root>
                        <Tooltip.Trigger className="inline-flex">
                          <span className="text-slate-300 cursor-help">
                            <FiInfo size={12} />
                          </span>
                        </Tooltip.Trigger>
                        <Tooltip.Content className="z-50 rounded-lg bg-slate-800 px-2 py-1 text-[0.65rem] font-medium text-white max-w-[220px]">
                          {permission}
                        </Tooltip.Content>
                      </Tooltip.Root>
                    </div>
                  </td>
                  {USER_ROLES.map((role) => (
                    <td key={role} className="p-2.5 text-center">
                      {matrix[role][permission] ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                          <FiCheck size={14} />
                        </span>
                      ) : (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-300">
                          <FiX size={14} />
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card.Content>
      </Card>

      {/* Edit role permissions modal */}
      <Modal state={editModal}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2 text-slate-800">
                <FiShield className="text-[#8B0000]" />
                แก้ไขสิทธิ์บทบาท: {editingRole ? ROLE_LABELS[editingRole] : ""}
              </Modal.Heading>
            </Modal.Header>
            {editingRole && (
              <Modal.Body>
                <div className="space-y-1">
                  {PERMISSION_IDS.map((permission) => (
                    <label
                      key={permission}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-xs hover:bg-slate-50 transition cursor-pointer"
                    >
                      <span className="font-medium text-slate-700">{PERMISSION_LABELS[permission]}</span>
                      <Checkbox
                        isSelected={draftPerms.has(permission)}
                        onChange={() => toggleDraft(permission)}
                        aria-label={PERMISSION_LABELS[permission]}
                        className="shrink-0"
                      />
                    </label>
                  ))}
                </div>
              </Modal.Body>
            )}
            <Modal.Footer>
              <Button type="button" variant="secondary" className="border border-slate-300 text-xs" onPress={editModal.close}>
                ยกเลิก
              </Button>
              <Button
                type="button"
                onPress={handleSave}
                isDisabled={isMutating}
                className="bg-[#8B0000] font-semibold text-white hover:bg-[#6e0000] text-xs"
              >
                <FiCheck /> {isMutating ? "กำลังบันทึก..." : "บันทึกสิทธิ์"}
              </Button>
            </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
