export type KnowledgeRole = "ADMIN" | "STAFF" | "APPROVER" | "REQUESTER";

export const KNOWLEDGE_MANAGE_ROLES: readonly KnowledgeRole[] = ["ADMIN", "STAFF"];

export function canManageKnowledge(role: unknown): boolean {
  return KNOWLEDGE_MANAGE_ROLES.includes(role as KnowledgeRole);
}
