import { requireAuth } from "@/lib/firebase";
import type { SchoolAccountCreateInput, SchoolAccountUpdateInput } from "@/lib/types";

async function authedFetch(path: string, body: unknown) {
  const currentUser = requireAuth().currentUser;
  if (!currentUser) {
    throw new Error("관리자 로그인이 필요합니다.");
  }

  const token = await currentUser.getIdToken(true);
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? "요청 처리에 실패했습니다.");
  }

  return payload;
}

export async function createSchoolAccount(input: SchoolAccountCreateInput) {
  return authedFetch("/api/create-user", input) as Promise<{
    uid: string;
    email: string;
    schoolId: string;
    schoolName: string;
    year: number;
    schoolLevel: string;
    updatedExistingUser: boolean;
  }>;
}

export async function resetSchoolPassword(input: {
  uid: string;
  newPassword: string;
}) {
  return authedFetch("/api/reset-password", input) as Promise<{
    uid: string;
    ok: boolean;
  }>;
}

export async function updateSchoolAccount(input: SchoolAccountUpdateInput) {
  return authedFetch("/api/update-school-account", input) as Promise<{
    uid: string;
    ok: boolean;
  }>;
}

export async function deleteSchoolAccount(uid: string) {
  return authedFetch("/api/delete-school-account", { uid }) as Promise<{
    uid: string;
    ok: boolean;
  }>;
}
