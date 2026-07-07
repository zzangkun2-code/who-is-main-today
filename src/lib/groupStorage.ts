import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  type Firestore
} from "firebase/firestore";
import { getDefaultAvatarId, isAvatarIdForGender } from "@/lib/avatar";
import { db } from "@/lib/firebase";
import type { Gender } from "@/lib/fortune";
import { getLocalStorageAdapter, readJson, writeJson } from "@/lib/storageAdapter";
import type { GroupRoom, Member, MemberInput } from "@/types/group";

const GROUP_ROOMS_KEY = "today-main-character-group-rooms";
const GROUP_MEMBERS_KEY_PREFIX = "today-main-character-room-members:";
const LEGACY_MEMBER_KEYS = [
  "today-main-character-candidates",
  "todays-main-character-people-v1",
  "today-main-character-people-v1",
  "todays-main-character-candidates",
  "today-main-character-candidates-v1"
];

/**
 * Firestore가 기본 저장소입니다.
 * localStorage는 Firestore 저장 성공 후 같은 브라우저에 복사해두는 백업 캐시와
 * 과거 localStorage 후보 복구 용도로만 사용합니다.
 *
 * 중요: Firestore 초기화/권한/네트워크 오류가 발생하면 localStorage로 조용히
 * 넘어가지 않고 console.error와 예외로 드러냅니다. 그래야 다른 기기에서 공유되지
 * 않는 문제를 바로 발견할 수 있습니다.
 */

function nowIso() {
  return new Date().toISOString();
}

export function normalizeRoomNumber(value: unknown) {
  return String(value ?? "").trim().replace(/\D/g, "").slice(0, 12);
}

function normalizePassword(value: unknown) {
  return String(value ?? "").trim();
}

function roomMembersKey(roomNumber: string) {
  return `${GROUP_MEMBERS_KEY_PREFIX}${normalizeRoomNumber(roomNumber)}`;
}

function requireFirestore(operation: string): Firestore {
  if (!db) {
    const error = new Error(
      `${operation}: Firebase Firestore가 초기화되지 않았습니다. NEXT_PUBLIC_FIREBASE_* 환경변수를 확인해주세요.`
    );
    console.error("[Firestore]", error.message);
    throw error;
  }
  return db;
}

function roomDocRef(database: Firestore, roomNumber: string) {
  return doc(database, "groupRooms", normalizeRoomNumber(roomNumber));
}

function membersCollectionRef(database: Firestore, roomNumber: string) {
  return collection(
    database,
    "groupRooms",
    normalizeRoomNumber(roomNumber),
    "members"
  );
}

function memberDocRef(database: Firestore, roomNumber: string, memberId: string) {
  return doc(
    database,
    "groupRooms",
    normalizeRoomNumber(roomNumber),
    "members",
    memberId
  );
}

function throwFirestoreError(operation: string, error: unknown): never {
  console.error(`[Firestore] ${operation} 실패`, error);
  if (error instanceof Error) {
    throw new Error(`${operation} 중 Firebase 오류가 발생했습니다: ${error.message}`);
  }
  throw new Error(`${operation} 중 Firebase 오류가 발생했습니다.`);
}

function getLocalRooms() {
  return readJson<GroupRoom[]>(GROUP_ROOMS_KEY, []);
}

function saveLocalRooms(rooms: GroupRoom[]) {
  return writeJson(GROUP_ROOMS_KEY, rooms);
}

function rememberLocalRoom(room: GroupRoom) {
  const rooms = getLocalRooms();
  saveLocalRooms([
    ...rooms.filter((item) => item.roomNumber !== room.roomNumber),
    room
  ]);
}

function normalizeGender(value: unknown): Gender {
  return value === "male" ? "male" : "female";
}

function normalizeBirthDate(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  const normalized = match
    ? trimmed
    : compactMatch
      ? `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`
      : "";
  if (!normalized) return "";

  const [, yearText, monthText, dayText] =
    normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1900 || month < 1 || month > 12 || day < 1) return "";
  if (day > new Date(year, month, 0).getDate()) return "";
  return normalized;
}

function normalizeBirthTime(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return "";

  const hour = Number(match[1]);
  const minute = Number(match[2] ?? "00");
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeMember(
  raw: unknown,
  roomNumber: string,
  index: number,
  timestamp = nowIso()
): Member | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const gender = normalizeGender(record.gender);
  const birthDate = normalizeBirthDate(
    record.birthDate ?? record.birthday ?? record.dateOfBirth
  );
  const birthTime = normalizeBirthTime(
    record.birthTime ?? record.time ?? record.birthHour
  );

  if (!name || !birthDate || !birthTime) return null;

  const normalizedRoomNumber = normalizeRoomNumber(roomNumber);
  const id =
    typeof record.id === "string" && record.id.trim()
      ? record.id.trim()
      : `${normalizedRoomNumber}-${name}-${birthDate}-${birthTime}-${index}`;
  const avatarId = isAvatarIdForGender(record.avatarId, gender)
    ? record.avatarId
    : getDefaultAvatarId(
        gender,
        `${id}-${name}-${birthDate}-${birthTime}-${index}`
      );

  return {
    id,
    roomNumber: normalizedRoomNumber,
    name,
    gender,
    birthDate,
    birthTime,
    avatarId,
    createdAt:
      typeof record.createdAt === "string" ? record.createdAt : timestamp,
    updatedAt:
      typeof record.updatedAt === "string" ? record.updatedAt : timestamp
  };
}

function normalizeRoom(raw: unknown): GroupRoom | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const roomNumber = normalizeRoomNumber(record.roomNumber);
  if (!roomNumber) return null;

  return {
    roomNumber,
    password:
      typeof record.password === "string" ? record.password.trim() : undefined,
    passwordHash:
      typeof record.passwordHash === "string" ? record.passwordHash : undefined,
    createdAt:
      typeof record.createdAt === "string" ? record.createdAt : nowIso(),
    updatedAt:
      typeof record.updatedAt === "string" ? record.updatedAt : nowIso()
  };
}

function parseMemberList(value: string | null, roomNumber: string) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    const items = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { people?: unknown[] }).people)
        ? (parsed as { people: unknown[] }).people
        : [];

    return items
      .map((item, index) => normalizeMember(item, roomNumber, index))
      .filter((item): item is Member => Boolean(item));
  } catch {
    return [];
  }
}

function getLocalMembers(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  const storage = getLocalStorageAdapter();
  if (!storage || !normalized) return [];

  return parseMemberList(storage.getItem(roomMembersKey(normalized)), normalized);
}

function saveLocalMembers(roomNumber: string, members: Member[]) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return false;

  const timestamp = nowIso();
  const normalizedMembers = members
    .map((member, index) => normalizeMember(member, normalized, index, timestamp))
    .filter((member): member is Member => Boolean(member));

  return writeJson(roomMembersKey(normalized), normalizedMembers);
}

function readLegacyMembers(roomNumber: string) {
  const storage = getLocalStorageAdapter();
  if (!storage) return [];

  for (const key of LEGACY_MEMBER_KEYS) {
    const members = parseMemberList(storage.getItem(key), roomNumber);
    if (members.length) return members;
  }

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || LEGACY_MEMBER_KEYS.includes(key)) continue;

    const likelyMemberKey =
      key.toLowerCase().includes("fortune") ||
      key.toLowerCase().includes("character") ||
      key.toLowerCase().includes("candidate") ||
      key.toLowerCase().includes("people");

    if (!likelyMemberKey) continue;

    const members = parseMemberList(storage.getItem(key), roomNumber);
    if (members.length) return members;
  }

  return [];
}

async function hashRoomPassword(roomNumber: string, password: string) {
  const source = `${normalizeRoomNumber(roomNumber)}:${normalizePassword(password)}`;

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const bytes = new TextEncoder().encode(source);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return `client-sha256:${Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}`;
  }

  let value = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    value ^= source.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return `client-fnv1a:${(value >>> 0).toString(16)}`;
}

async function passwordMatches(
  room: GroupRoom,
  roomNumber: string,
  password: string
) {
  const cleanPassword = normalizePassword(password);

  if (room.passwordHash) {
    return room.passwordHash === (await hashRoomPassword(roomNumber, cleanPassword));
  }

  return normalizePassword(room.password) === cleanPassword;
}

async function getFirestoreRoom(database: Firestore, roomNumber: string) {
  const snapshot = await getDoc(roomDocRef(database, roomNumber));
  return snapshot.exists() ? normalizeRoom(snapshot.data()) : null;
}

async function getFirestoreMembers(database: Firestore, roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  const snapshot = await getDocs(membersCollectionRef(database, normalized));

  return snapshot.docs
    .map((memberDoc, index) =>
      normalizeMember({ id: memberDoc.id, ...memberDoc.data() }, normalized, index)
    )
    .filter((member): member is Member => Boolean(member))
    .sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
      return a.name.localeCompare(b.name, "ko");
    });
}

export async function checkRoomNumberAvailable(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return false;

  const database = requireFirestore("그룹방 번호 중복 확인");

  try {
    const room = await getFirestoreRoom(database, normalized);
    return !room;
  } catch (error) {
    throwFirestoreError("그룹방 번호 중복 확인", error);
  }
}

export async function createGroupRoom(roomNumber: string, password: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  const cleanPassword = normalizePassword(password);

  if (!normalized) {
    throw new Error("그룹방 번호를 숫자로 입력해 주세요.");
  }
  if (!cleanPassword) {
    throw new Error("비밀번호를 입력해 주세요.");
  }

  const database = requireFirestore("그룹방 생성");

  try {
    const existingRoom = await getFirestoreRoom(database, normalized);
    if (existingRoom) {
      throw new Error("이미 사용 중인 그룹방 번호입니다.");
    }

    const timestamp = nowIso();
    const room: GroupRoom = {
      roomNumber: normalized,
      passwordHash: await hashRoomPassword(normalized, cleanPassword),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await setDoc(roomDocRef(database, normalized), room);
    rememberLocalRoom(room);

    const legacyMembers = readLegacyMembers(normalized);
    if (legacyMembers.length) {
      await saveMembers(normalized, legacyMembers);
    }

    return room;
  } catch (error) {
    if (error instanceof Error && error.message === "이미 사용 중인 그룹방 번호입니다.") {
      throw error;
    }
    throwFirestoreError("그룹방 생성", error);
  }
}

export async function loginGroupRoom(roomNumber: string, password: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  const cleanPassword = normalizePassword(password);

  if (!normalized || !cleanPassword) return null;

  const database = requireFirestore("그룹방 로그인");

  try {
    const room = await getFirestoreRoom(database, normalized);
    if (!room) return null;

    const matched = await passwordMatches(room, normalized, cleanPassword);
    if (!matched) return null;

    rememberLocalRoom(room);
    return room;
  } catch (error) {
    throwFirestoreError("그룹방 로그인", error);
  }
}

export async function getMembers(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return [];

  const database = requireFirestore("후보 목록 불러오기");

  try {
    const members = await getFirestoreMembers(database, normalized);
    saveLocalMembers(normalized, members);
    return members;
  } catch (error) {
    throwFirestoreError("후보 목록 불러오기", error);
  }
}

export async function saveMembers(roomNumber: string, members: Member[]) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return false;

  const database = requireFirestore("후보 목록 저장");
  const timestamp = nowIso();
  const normalizedMembers = members
    .map((member, index) => normalizeMember(member, normalized, index, timestamp))
    .filter((member): member is Member => Boolean(member))
    .map((member) => ({
      ...member,
      roomNumber: normalized,
      updatedAt: member.updatedAt || timestamp
    }));

  try {
    const membersRef = membersCollectionRef(database, normalized);
    const snapshot = await getDocs(membersRef);
    const nextIds = new Set(normalizedMembers.map((member) => member.id));
    const batch = writeBatch(database);

    snapshot.docs.forEach((memberDoc) => {
      if (!nextIds.has(memberDoc.id)) {
        batch.delete(memberDoc.ref);
      }
    });

    normalizedMembers.forEach((member) => {
      batch.set(doc(membersRef, member.id), member, { merge: true });
    });

    await batch.commit();
    saveLocalMembers(normalized, normalizedMembers);
    return true;
  } catch (error) {
    throwFirestoreError("후보 목록 저장", error);
  }
}

export async function addMember(roomNumber: string, member: MemberInput) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) {
    throw new Error("그룹방 번호가 올바르지 않습니다.");
  }

  const database = requireFirestore("후보 추가");
  const timestamp = nowIso();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${normalized}-${Date.now()}-${Math.random()}`;
  const nextMember: Member = {
    id,
    roomNumber: normalized,
    ...member,
    name: member.name.trim(),
    avatarId: isAvatarIdForGender(member.avatarId, member.gender)
      ? member.avatarId
      : getDefaultAvatarId(
          member.gender,
          `${id}-${member.name}-${member.birthDate}`
        ),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  try {
    await setDoc(memberDocRef(database, normalized, id), nextMember);
    saveLocalMembers(normalized, [...getLocalMembers(normalized), nextMember]);
    return nextMember;
  } catch (error) {
    throwFirestoreError("후보 추가", error);
  }
}

export async function updateMember(
  roomNumber: string,
  memberId: string,
  updatedMember: Partial<MemberInput>
) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) {
    throw new Error("그룹방 번호가 올바르지 않습니다.");
  }

  const database = requireFirestore("후보 수정");
  const timestamp = nowIso();

  try {
    const ref = memberDocRef(database, normalized, memberId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;

    const current = normalizeMember(
      { id: snapshot.id, ...snapshot.data() },
      normalized,
      0,
      timestamp
    );
    if (!current) return null;

    const nextMember: Member = {
      ...current,
      ...updatedMember,
      name: updatedMember.name?.trim() ?? current.name,
      avatarId: isAvatarIdForGender(
        updatedMember.avatarId ?? current.avatarId,
        updatedMember.gender ?? current.gender
      )
        ? updatedMember.avatarId ?? current.avatarId
        : getDefaultAvatarId(
            updatedMember.gender ?? current.gender,
            `${current.id}-${updatedMember.name ?? current.name}`
          ),
      updatedAt: timestamp
    };

    await setDoc(ref, nextMember, { merge: true });
    saveLocalMembers(
      normalized,
      getLocalMembers(normalized).map((member) =>
        member.id === memberId ? nextMember : member
      )
    );
    return nextMember;
  } catch (error) {
    throwFirestoreError("후보 수정", error);
  }
}

export async function deleteMember(roomNumber: string, memberId: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return [];

  const database = requireFirestore("후보 삭제");

  try {
    await deleteDoc(memberDocRef(database, normalized, memberId));
    const nextMembers = getLocalMembers(normalized).filter(
      (member) => member.id !== memberId
    );
    saveLocalMembers(normalized, nextMembers);
    return nextMembers;
  } catch (error) {
    throwFirestoreError("후보 삭제", error);
  }
}
