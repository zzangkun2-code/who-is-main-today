import { FieldValue } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

async function assertAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!token) {
    throw new Error("관리자 인증 토큰이 없습니다. 다시 로그인해 주세요.");
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const adminDoc = await getAdminDb().doc(`admins/${decoded.uid}`).get();

  if (!adminDoc.exists) {
    throw new Error("관리자 권한이 없습니다.");
  }

  return decoded.uid;
}

export async function POST(request: NextRequest) {
  try {
    const adminUid = await assertAdmin(request);
    const body = (await request.json()) as {
      uid?: string;
      schoolName?: string;
      newPassword?: string;
    };

    if (!body.uid) {
      throw new Error("수정할 학교 UID가 필요합니다.");
    }

    const schoolName = body.schoolName?.trim();
    const newPassword = body.newPassword?.trim();

    if (!schoolName && !newPassword) {
      throw new Error("수정할 학교명 또는 새 비밀번호를 입력해 주세요.");
    }

    if (newPassword && newPassword.length < 6) {
      throw new Error("새 비밀번호는 6자 이상이어야 합니다.");
    }

    const authUpdate: { displayName?: string; password?: string } = {};
    if (schoolName) authUpdate.displayName = schoolName;
    if (newPassword) authUpdate.password = newPassword;
    await getAdminAuth().updateUser(body.uid, authUpdate);

    const firestoreUpdate = {
      ...(schoolName ? { schoolName, displayName: schoolName } : {}),
      ...(newPassword
        ? {
            isFirstLogin: true,
            mustChangePassword: true,
            passwordResetBy: adminUid
          }
        : {}),
      updatedBy: adminUid,
      updatedAt: FieldValue.serverTimestamp()
    };

    const db = getAdminDb();
    await Promise.all([
      db.doc(`schools/${body.uid}`).set(firestoreUpdate, { merge: true }),
      db.doc(`users/${body.uid}`).set(firestoreUpdate, { merge: true })
    ]);

    return NextResponse.json({ ok: true, uid: body.uid });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "계정 정보를 수정하지 못했습니다."
      },
      { status: 400 }
    );
  }
}
