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
}

function isUserNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String(error.code) === "auth/user-not-found"
  );
}

export async function POST(request: NextRequest) {
  try {
    await assertAdmin(request);
    const body = (await request.json()) as {
      uid?: string;
    };

    if (!body.uid) {
      throw new Error("삭제할 학교 UID가 필요합니다.");
    }

    const db = getAdminDb();
    await Promise.all([
      db.recursiveDelete(db.doc(`schools/${body.uid}`)),
      db.recursiveDelete(db.doc(`users/${body.uid}`))
    ]);

    try {
      await getAdminAuth().deleteUser(body.uid);
    } catch (error) {
      if (!isUserNotFound(error)) throw error;
    }

    return NextResponse.json({ ok: true, uid: body.uid });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "학교 계정을 삭제하지 못했습니다."
      },
      { status: 400 }
    );
  }
}
