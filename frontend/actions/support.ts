"use server";

import { cookies } from "next/headers";

const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";

async function supportRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = (await cookies()).get("access_token")?.value ?? "";
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", access_token: token, ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message ?? "Support request failed");
  return payload?.data as T;
}

export type SupportMessage = { _id: string; userId: string; senderType: "user" | "admin"; message: string; createdAt: string; expiresAt: string };
export type SupportConversation = { userId: string; user?: { name?: string; email?: string; phoneNumber?: string; planName?: string; supportBlocked?: boolean }; lastMessage: string; lastAt: string };

export async function getMySupport() {
  return supportRequest<{ messages: SupportMessage[]; cooldownSeconds: number; supportBlocked?: boolean }>("/support/me");
}

export async function getSupportConversations() {
  return supportRequest<SupportConversation[]>("/support/admin/conversations");
}

export async function getAdminSupportHistory(userId: string) {
  return supportRequest<{ user: SupportConversation["user"]; messages: SupportMessage[] }>(`/support/admin/users/${userId}`);
}

export async function deleteSupportConversation(userId: string) {
  return supportRequest<{ deleted: number }>(`/support/admin/users/${userId}/conversation`, { method: "DELETE" });
}

export async function setSupportBlocked(userId: string, blocked: boolean) {
  return supportRequest<{ supportBlocked?: boolean }>(`/support/admin/users/${userId}/block`, {
    method: "PATCH",
    body: JSON.stringify({ blocked }),
  });
}
