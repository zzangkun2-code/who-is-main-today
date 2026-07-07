import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch
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
 * 저장 계층은 Firestore를 우선 사용하고, Firebase 환경변수 누락이나 권한 오류가
 * 있을 때만 기존 localStorage 저장소를 fallback으로 사용합니다.
 *
 * 보안 메모:
 * 현재는 클라이언트 앱만으로 그룹방을 만들기 때문에 비밀번호 검증도 클라이언트에서
 * 처리합니다. 운영 보안을 높이려면 Next.js API route/Firebase Functions에서
 * 서버 전용 salt와 느린 해시 알고리즘으로 passwordHash를 생성·검증하세요.
 */

function nowIso() {
  return new Date().toISOString();
}

export function normalizeRoomNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 12);
}

function roomMembersKey(roomNumber: string) {
  return `${GROUP_MEMBERS_KEY_PREFIX}${normalizeRoomNumber(roomNumber)}`;
}

function roomDocRef(roomNumber: string) {
  if (!db) return null;
  return doc(db, "groupRooms", normalizeRoomNumber(roomNumber));
}

function membersCollectionRef(roomNumber: string) {
  if (!db) return null;
  return collection(db, "groupRooms", normalizeRoomNumber(roomNumber), "members");
}

function memberDocRef(roomNumber: string, memberId: string) {
  if (!db) return null;
  return doc(
    db,
    "groupRooms",
    normalizeRoomNumber(roomNumber),
    "members",
    memberId
  );
}

function getLocalRooms() {
  return readJson<GroupRoom[]>(GROUP_ROOMS_KEY, []);
}

function saveLocalRooms(rooms: GroupRoom[]) {
  return writeJson(GROUP_ROOMS_KEY, rooms);
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

  const id =
    typeof record.id === "string" && record.id.trim()
      ? record.id
      : `${roomNumber}-${name}-${birthDate}-${birthTime}-${index}`;
  const avatarId = isAvatarIdForGender(record.avatarId, gender)
    ? record.avatarId
    : getDefaultAvatarId(
        gender,
        `${id}-${name}-${birthDate}-${birthTime}-${index}`
      );

  return {
    id,
    roomNumber,
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
  const roomNumber =
    typeof record.roomNumber === "string"
      ? normalizeRoomNumber(record.roomNumber)
      : "";
  if (!roomNumber) return null;

  return {
    roomNumber,
    password: typeof record.password === "string" ? record.password : undefined,
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
  const source = `${normalizeRoomNumber(roomNumber)}:${password}`;

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const bytes = new TextEncoder().encode(source);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return `client-sha256:${hash}`;
  }

  let value = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    value ^= source.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return `client-fnv1a:${(value >>> 0).toString(16)}`;
}

async function passwordMatches(room: GroupRoom, roomNumber: string, password: string) {
  if (room.passwordHash) {
    return room.passwordHash === (await hashRoomPassword(roomNumber, password));
  }

  return room.password === password;
}

function rememberLocalRoom(room: GroupRoom) {
  const rooms = getLocalRooms();
  const nextRooms = [
    ...rooms.filter((item) => item.roomNumber !== room.roomNumber),
    room
  ];
  saveLocalRooms(nextRooms);
}

function warnFirestoreFallback(error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("Firestore 저장소를 사용할 수 없어 localStorage로 fallback합니다.", error);
  }
}

async function getFirestoreRoom(roomNumber: string) {
  const ref = roomDocRef(roomNumber);
  if (!ref) return null;
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? normalizeRoom(snapshot.data()) : null;
}

async function getFirestoreMembers(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  const ref = membersCollectionRef(normalized);
  if (!ref) return null;

  const snapshot = await getDocs(ref);
  return snapshot.docs
    .map((memberDoc, index) =>
      normalizeMember(
        { id: memberDoc.id, ...memberDoc.data() },
        normalized,
        index
      )
    )
    .filter((member): member is Member => Boolean(member));
}

export async function checkRoomNumberAvailable(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return false;

  try {
    if (db) {
      return !(await getFirestoreRoom(normalized));
    }
  } catch (error) {
    warnFirestoreFallback(error);
  }

  return !getLocalRooms().some((room) => room.roomNumber === normalized);
}

export async function createGroupRoom(roomNumber: string, password: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) {
    throw new Error("그룹방 번호를 숫자로 입력해 주세요.");
  }
  if (!password) {
    throw new Error("비밀번호를 입력해 주세요.");
  }

  const timestamp = nowIso();
  const room: GroupRoom = {
    roomNumber: normalized,
    passwordHash: await hashRoomPassword(normalized, password),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  try {
    const ref = roomDocRef(normalized);
    if (ref) {
      const existingRoom = await getFirestoreRoom(normalized);
      if (existingRoom) {
        throw new Error("이미 사용 중인 그룹방 번호입니다.");
      }

      await setDoc(ref, room);
      rememberLocalRoom(room);

      const legacyMembers = readLegacyMembers(normalized);
      if (legacyMembers.length) {
        await saveMembers(normalized, legacyMembers);
      }

      return room;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("이미 사용 중")) {
      throw error;
    }
    warnFirestoreFallback(error);
  }

  const rooms = getLocalRooms();
  if (rooms.some((item) => item.roomNumber === normalized)) {
    throw new Error("이미 사용 중인 그룹방 번호입니다.");
  }
  if (!saveLocalRooms([...rooms, room])) {
    throw new Error("브라우저 저장소를 사용할 수 없어 그룹방을 만들 수 없습니다.");
  }

  const existingMembers = getLocalMembers(normalized);
  if (!existingMembers.length) {
    const legacyMembers = readLegacyMembers(normalized);
    if (legacyMembers.length) {
      saveLocalMembers(normalized, legacyMembers);
    }
  }

  return room;
}

export async function loginGroupRoom(roomNumber: string, password: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized || !password) return null;

  try {
    const firestoreRoom = db ? await getFirestoreRoom(normalized) : null;
    if (firestoreRoom) {
      const matched = await passwordMatches(firestoreRoom, normalized, password);
      if (!matched) return null;

      rememberLocalRoom(firestoreRoom);
      const firestoreMembers = await getFirestoreMembers(normalized);
      if (firestoreMembers) {
        saveLocalMembers(normalized, firestoreMembers);
      }
      return firestoreRoom;
    }
  } catch (error) {
    warnFirestoreFallback(error);
  }

  const localRoom =
    getLocalRooms().find((item) => item.roomNumber === normalized) ?? null;
  if (!localRoom || !(await passwordMatches(localRoom, normalized, password))) {
    return null;
  }
  return localRoom;
}

export async function getMembers(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return [];

  try {
    const firestoreMembers = db ? await getFirestoreMembers(normalized) : null;
    if (firestoreMembers) {
      saveLocalMembers(normalized, firestoreMembers);
      return firestoreMembers;
    }
  } catch (error) {
    warnFirestoreFallback(error);
  }

  return getLocalMembers(normalized);
}

export async function saveMembers(roomNumber: string, members: Member[]) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return false;

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
    const ref = membersCollectionRef(normalized);
    if (db && ref) {
      const snapshot = await getDocs(ref);
      const nextIds = new Set(normalizedMembers.map((member) => member.id));
      const batch = writeBatch(db);

      snapshot.docs.forEach((memberDoc) => {
        if (!nextIds.has(memberDoc.id)) {
          batch.delete(memberDoc.ref);
        }
      });

      normalizedMembers.forEach((member) => {
        batch.set(doc(ref, member.id), member, { merge: true });
      });

      await batch.commit();
      saveLocalMembers(normalized, normalizedMembers);
      return true;
    }
  } catch (error) {
    warnFirestoreFallback(error);
  }

  return saveLocalMembers(normalized, normalizedMembers);
}

export async function addMember(roomNumber: string, member: MemberInput) {
  const normalized = normalizeRoomNumber(roomNumber);
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
    const ref = memberDocRef(normalized, id);
    if (ref) {
      await setDoc(ref, nextMember);
      const current = getLocalMembers(normalized);
      saveLocalMembers(normalized, [...current, nextMember]);
      return nextMember;
    }
  } catch (error) {
    warnFirestoreFallback(error);
  }

  const members = getLocalMembers(normalized);
  saveLocalMembers(normalized, [...members, nextMember]);
  return nextMember;
}

export async function updateMember(
  roomNumber: string,
  memberId: string,
  updatedMember: Partial<MemberInput>
) {
  const normalized = normalizeRoomNumber(roomNumber);
  const members = await getMembers(normalized);
  const timestamp = nowIso();
  const nextMembers = members.map((member) =>
    member.id === memberId
      ? {
          ...member,
          ...updatedMember,
          name: updatedMember.name?.trim() ?? member.name,
          avatarId: isAvatarIdForGender(
            updatedMember.avatarId ?? member.avatarId,
            updatedMember.gender ?? member.gender
          )
            ? updatedMember.avatarId ?? member.avatarId
            : getDefaultAvatarId(
                updatedMember.gender ?? member.gender,
                `${member.id}-${updatedMember.name ?? member.name}`
              ),
          updatedAt: timestamp
        }
      : member
  );
  const nextMember = nextMembers.find((member) => member.id === memberId) ?? null;

  if (nextMember) {
    try {
      const ref = memberDocRef(normalized, memberId);
      if (ref) {
        await setDoc(ref, nextMember, { merge: true });
        saveLocalMembers(normalized, nextMembers);
        return nextMember;
      }
    } catch (error) {
      warnFirestoreFallback(error);
    }
  }

  saveLocalMembers(normalized, nextMembers);
  return nextMember;
}

export async function deleteMember(roomNumber: string, memberId: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  const members = await getMembers(normalized);
  const nextMembers = members.filter((member) => member.id !== memberId);

  try {
    const ref = memberDocRef(normalized, memberId);
    if (ref) {
      await deleteDoc(ref);
      saveLocalMembers(normalized, nextMembers);
      return nextMembers;
    }
  } catch (error) {
    warnFirestoreFallback(error);
  }

  saveLocalMembers(normalized, nextMembers);
  return nextMembers;
}
