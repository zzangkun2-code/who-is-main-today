import { FieldValue } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { parseSchoolId, schoolIdToEmail } from "@/lib/school-id";
import type { BusinessType, SchoolAccountCreateInput } from "@/lib/types";

export const runtime = "nodejs";

const BUSINESS_TYPES: BusinessType[] = ["A", "B", "C", "D"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "알 수 없는 오류가 발생했습니다.";
  const code = "code" in error ? ` (${String(error.code)})` : "";
  return `${error.message}${code}`;
}

function permissionHelp(action: string, error: unknown) {
  return `${action} 중 권한 오류가 발생했습니다. Firebase Admin SDK 서비스 계정의 프로젝트 ID가 웹앱 프로젝트와 같은지, Google Cloud IAM에서 해당 서비스 계정에 Cloud Datastore User 또는 Cloud Datastore Owner 권한이 있는지 확인해 주세요. 원문: ${toErrorMessage(error)}`;
}

async function assertAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!token) {
    throw new Error("관리자 인증 토큰이 없습니다. 다시 로그인해 주세요.");
  }

  const decoded = await getAdminAuth().verifyIdToken(token);

  try {
    const adminDoc = await getAdminDb().doc(`admins/${decoded.uid}`).get();
    if (!adminDoc.exists) {
      throw new Error("관리자 권한 문서가 없습니다. Firestore의 admins/{관리자 UID} 문서를 확인해 주세요.");
    }
  } catch (error) {
    throw new Error(permissionHelp("관리자 권한 확인", error));
  }

  return decoded.uid;
}

function validatePayload(payload: Partial<SchoolAccountCreateInput>) {
  if (
    !payload.schoolId ||
    !payload.email ||
    !payload.initialPassword ||
    !payload.schoolName ||
    !payload.businessType
  ) {
    throw new Error("학교 ID, 이메일, 초기 비밀번호, 학교명, 사업 유형을 모두 입력해 주세요.");
  }

  if (!EMAIL_PATTERN.test(payload.email)) {
    throw new Error("API로 전달된 이메일 형식이 올바르지 않습니다.");
  }

  if (!BUSINESS_TYPES.includes(payload.businessType as BusinessType)) {
    throw new Error("사업 유형은 A, B, C, D 중 하나여야 합니다.");
  }

  if (payload.initialPassword.length < 6) {
    throw new Error("초기 비밀번호는 6자 이상이어야 합니다.");
  }

  const parsed = parseSchoolId(payload.schoolId);
  const expectedEmail = schoolIdToEmail(parsed.schoolId);

  if (payload.email.toLowerCase() !== expectedEmail) {
    throw new Error(`학교 ID와 이메일이 일치하지 않습니다. 예상 이메일: ${expectedEmail}`);
  }

  return {
    body: payload as SchoolAccountCreateInput,
    parsed,
    email: expectedEmail
  };
}

async function getExistingUserByEmail(email: string) {
  try {
    return await getAdminAuth().getUserByEmail(email);
  } catch (error: unknown) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "auth/user-not-found") return null;
    throw error;
  }
}

export async function POST(request: NextRequest) {
  let createdUid: string | null = null;

  try {
    const adminUid = await assertAdmin(request);
    const { body, parsed, email } = validatePayload(await request.json());
    const auth = getAdminAuth();
    const db = getAdminDb();

    const existingUser = await getExistingUserByEmail(email);
    const user = existingUser
      ? await auth.updateUser(existingUser.uid, {
          password: body.initialPassword,
          displayName: body.schoolName,
          disabled: false,
          emailVerified: true
        })
      : await auth.createUser({
          email,
          password: body.initialPassword,
          displayName: body.schoolName,
          emailVerified: true,
          disabled: false
        });

    if (!existingUser) {
      createdUid = user.uid;
    }

    try {
      await db.doc(`schools/${user.uid}`).set(
        {
          uid: user.uid,
          email,
          schoolId: parsed.schoolId,
          displayName: body.schoolName,
          schoolName: body.schoolName,
          businessType: body.businessType,
          year: parsed.year,
          schoolLevel: parsed.schoolLevel,
          partnerInfo: "",
          theme: "",
          activityReports: {},
          isFirstLogin: true,
          mustChangePassword: true,
          createdBy: adminUid,
          updatedAt: FieldValue.serverTimestamp(),
          ...(existingUser ? {} : { createdAt: FieldValue.serverTimestamp() })
        },
        { merge: true }
      );
    } catch (error) {
      if (createdUid) {
        await auth.deleteUser(createdUid).catch(() => undefined);
      }
      throw new Error(permissionHelp("학교 문서 저장", error));
    }

    return NextResponse.json({
      uid: user.uid,
      email,
      schoolId: parsed.schoolId,
      schoolName: body.schoolName,
      year: parsed.year,
      schoolLevel: parsed.schoolLevel,
      updatedExistingUser: Boolean(existingUser)
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "학교 계정을 생성하지 못했습니다."
      },
      { status: 400 }
    );
  }
}
