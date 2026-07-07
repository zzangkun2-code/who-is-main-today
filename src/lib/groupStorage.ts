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

const APP_STORAGE_PREFIX = "who-is-main-today";
const GROUP_ROOMS_KEY = `${APP_STORAGE_PREFIX}-rooms`;
const GROUP_MEMBERS_KEY_PREFIX = `${APP_STORAGE_PREFIX}-room-members:`;
const LEGACY_TODAY_PREFIX = ["today", "main", "character"].join("-");
const LEGACY_TODAYS_PREFIX = ["todays", "main", "character"].join("-");
const LEGACY_SCHOOL_PREFIX = ["school", "exchange", "app"].join("-");

const LEGACY_ROOM_KEYS = [
  `${LEGACY_TODAY_PREFIX}-group-rooms`,
  `${LEGACY_TODAY_PREFIX}-rooms`,
  `${LEGACY_TODAYS_PREFIX}-rooms`,
  `${LEGACY_SCHOOL_PREFIX}-group-rooms`,
  `${LEGACY_SCHOOL_PREFIX}-rooms`
];

const LEGACY_MEMBER_KEY_PREFIXES = [
  `${LEGACY_TODAY_PREFIX}-room-members:`,
  `${LEGACY_TODAYS_PREFIX}-room-members:`,
  `${LEGACY_SCHOOL_PREFIX}-room-members:`
];

const LEGACY_MEMBER_KEYS = [
  `${LEGACY_TODAY_PREFIX}-candidates`,
  `${LEGACY_TODAYS_PREFIX}-people-v1`,
  `${LEGACY_TODAY_PREFIX}-people-v1`,
  `${LEGACY_TODAYS_PREFIX}-candidates`,
  `${LEGACY_TODAY_PREFIX}-candidates-v1`,
  `${LEGACY_SCHOOL_PREFIX}-candidates`
];

export type AdminGroupRoomSummary = GroupRoom & {
  memberCount: number;
};

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

function getFirestoreForOperation(operation: string): Firestore | null {
  if (!db) {
    console.error(
      `[who-is-main-today Firebase] ${operation}: Firestore is not initialized. Check .env.local or Vercel NEXT_PUBLIC_FIREBASE_* environment variables. Falling back to localStorage.`
    );
    return null;
  }

  return db;
}

function logFirestoreFallback(operation: string, error: unknown) {
  console.error(
    `[who-is-main-today Firebase] ${operation} failed. Falling back to localStorage.`,
    error
  );
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

function parseRoomList(value: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    const items = Array.isArray(parsed) ? parsed : [];
    return items
      .map((item) => normalizeRoom(item))
      .filter((item): item is GroupRoom => Boolean(item));
  } catch {
    return [];
  }
}

function saveLocalRooms(rooms: GroupRoom[]) {
  return writeJson(GROUP_ROOMS_KEY, rooms);
}

function getLocalRooms() {
  const storage = getLocalStorageAdapter();
  const currentRooms = readJson<GroupRoom[]>(GROUP_ROOMS_KEY, [])
    .map((room) => normalizeRoom(room))
    .filter((room): room is GroupRoom => Boolean(room));
  if (!storage) return currentRooms;
  if (currentRooms.length) return currentRooms;

  for (const key of LEGACY_ROOM_KEYS) {
    const migratedRooms = parseRoomList(storage.getItem(key));
    if (migratedRooms.length) {
      saveLocalRooms(migratedRooms);
      return migratedRooms;
    }
  }

  return [];
}

function rememberLocalRoom(room: GroupRoom) {
  const rooms = getLocalRooms();
  saveLocalRooms([
    ...rooms.filter((item) => item.roomNumber !== room.roomNumber),
    room
  ]);
}

function removeLocalRoom(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  saveLocalRooms(getLocalRooms().filter((room) => room.roomNumber !== normalized));
  const storage = getLocalStorageAdapter();
  storage?.removeItem(roomMembersKey(normalized));
  LEGACY_MEMBER_KEY_PREFIXES.forEach((prefix) => {
    storage?.removeItem(`${prefix}${normalized}`);
  });
}

function readLegacyMembers(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  const storage = getLocalStorageAdapter();
  if (!storage) return [];

  for (const prefix of LEGACY_MEMBER_KEY_PREFIXES) {
    const members = parseMemberList(storage.getItem(`${prefix}${normalized}`), normalized);
    if (members.length) return members;
  }

  for (const key of LEGACY_MEMBER_KEYS) {
    const members = parseMemberList(storage.getItem(key), normalized);
    if (members.length) return members;
  }

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (
      !key ||
      LEGACY_MEMBER_KEYS.includes(key) ||
      LEGACY_MEMBER_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
    ) {
      continue;
    }

    const lowerKey = key.toLowerCase();
    const likelyMemberKey =
      lowerKey.includes("fortune") ||
      lowerKey.includes("character") ||
      lowerKey.includes("candidate") ||
      lowerKey.includes("people");

    if (!likelyMemberKey) continue;

    const members = parseMemberList(storage.getItem(key), normalized);
    if (members.length) return members;
  }

  return [];
}

function getLocalMembers(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  const storage = getLocalStorageAdapter();
  if (!storage || !normalized) return [];

  const currentMembers = parseMemberList(storage.getItem(roomMembersKey(normalized)), normalized);
  if (currentMembers.length || storage.getItem(roomMembersKey(normalized))) {
    return currentMembers;
  }

  const legacyMembers = readLegacyMembers(normalized);
  if (legacyMembers.length) {
    saveLocalMembers(normalized, legacyMembers);
  }
  return legacyMembers;
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

  const database = getFirestoreForOperation("check room availability");
  if (database) {
    try {
      return !(await getFirestoreRoom(database, normalized));
    } catch (error) {
      logFirestoreFallback("check room availability", error);
    }
  }

  return !getLocalRooms().some((room) => room.roomNumber === normalized);
}

export async function createGroupRoom(roomNumber: string, password: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  const cleanPassword = normalizePassword(password);

  if (!normalized) {
    throw new Error("Room number is required.");
  }
  if (!cleanPassword) {
    throw new Error("Password is required.");
  }

  const timestamp = nowIso();
  const room: GroupRoom = {
    roomNumber: normalized,
    passwordHash: await hashRoomPassword(normalized, cleanPassword),
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const database = getFirestoreForOperation("create group room");

  if (database) {
    try {
      const existingRoom = await getFirestoreRoom(database, normalized);
      if (existingRoom) {
        throw new Error("Room number is already in use.");
      }

      await setDoc(roomDocRef(database, normalized), room);
      rememberLocalRoom(room);
      return room;
    } catch (error) {
      if (error instanceof Error && error.message === "Room number is already in use.") {
        throw error;
      }
      logFirestoreFallback("create group room", error);
    }
  }

  const localRooms = getLocalRooms();
  if (localRooms.some((item) => item.roomNumber === normalized)) {
    throw new Error("Room number is already in use.");
  }
  if (!saveLocalRooms([...localRooms, room])) {
    throw new Error("Local browser storage is not available.");
  }
  return room;
}

export async function loginGroupRoom(roomNumber: string, password: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  const cleanPassword = normalizePassword(password);

  if (!normalized || !cleanPassword) return null;

  const database = getFirestoreForOperation("login group room");
  if (database) {
    try {
      const room = await getFirestoreRoom(database, normalized);
      if (room && (await passwordMatches(room, normalized, cleanPassword))) {
        rememberLocalRoom(room);
        return room;
      }
      if (room) return null;
    } catch (error) {
      logFirestoreFallback("login group room", error);
    }
  }

  const localRoom =
    getLocalRooms().find((item) => item.roomNumber === normalized) ?? null;
  if (!localRoom || !(await passwordMatches(localRoom, normalized, cleanPassword))) {
    return null;
  }
  return localRoom;
}

export async function getMembers(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return [];

  const database = getFirestoreForOperation("load members");
  if (database) {
    try {
      const members = await getFirestoreMembers(database, normalized);
      saveLocalMembers(normalized, members);
      return members;
    } catch (error) {
      logFirestoreFallback("load members", error);
    }
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
  const database = getFirestoreForOperation("save members");

  if (database) {
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
      logFirestoreFallback("save members", error);
    }
  }

  return saveLocalMembers(normalized, normalizedMembers);
}

export async function addMember(roomNumber: string, member: MemberInput) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) {
    throw new Error("Room number is invalid.");
  }

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
  const database = getFirestoreForOperation("add member");

  if (database) {
    try {
      await setDoc(memberDocRef(database, normalized, id), nextMember);
      saveLocalMembers(normalized, [...getLocalMembers(normalized), nextMember]);
      return nextMember;
    } catch (error) {
      logFirestoreFallback("add member", error);
    }
  }

  saveLocalMembers(normalized, [...getLocalMembers(normalized), nextMember]);
  return nextMember;
}

export async function updateMember(
  roomNumber: string,
  memberId: string,
  updatedMember: Partial<MemberInput>
) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) {
    throw new Error("Room number is invalid.");
  }

  const timestamp = nowIso();
  const database = getFirestoreForOperation("update member");

  if (database) {
    try {
      const ref = memberDocRef(database, normalized, memberId);
      const snapshot = await getDoc(ref);
      if (snapshot.exists()) {
        const current = normalizeMember(
          { id: snapshot.id, ...snapshot.data() },
          normalized,
          0,
          timestamp
        );
        if (current) {
          const nextMember = buildUpdatedMember(current, updatedMember, timestamp);
          await setDoc(ref, nextMember, { merge: true });
          saveLocalMembers(
            normalized,
            getLocalMembers(normalized).map((member) =>
              member.id === memberId ? nextMember : member
            )
          );
          return nextMember;
        }
      }
    } catch (error) {
      logFirestoreFallback("update member", error);
    }
  }

  const localMembers = getLocalMembers(normalized);
  const current = localMembers.find((member) => member.id === memberId);
  if (!current) return null;
  const nextMember = buildUpdatedMember(current, updatedMember, timestamp);
  saveLocalMembers(
    normalized,
    localMembers.map((member) => (member.id === memberId ? nextMember : member))
  );
  return nextMember;
}

function buildUpdatedMember(
  current: Member,
  updatedMember: Partial<MemberInput>,
  timestamp: string
): Member {
  return {
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
}

export async function deleteMember(roomNumber: string, memberId: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return [];

  const database = getFirestoreForOperation("delete member");
  if (database) {
    try {
      await deleteDoc(memberDocRef(database, normalized, memberId));
    } catch (error) {
      logFirestoreFallback("delete member", error);
    }
  }

  const nextMembers = getLocalMembers(normalized).filter(
    (member) => member.id !== memberId
  );
  saveLocalMembers(normalized, nextMembers);
  return nextMembers;
}

export async function listGroupRoomsForAdmin() {
  const database = getFirestoreForOperation("list group rooms for admin");
  if (database) {
    try {
      const snapshot = await getDocs(collection(database, "groupRooms"));
      const rooms = await Promise.all(
        snapshot.docs.map(async (roomSnapshot) => {
          const room = normalizeRoom({
            roomNumber: roomSnapshot.id,
            ...roomSnapshot.data()
          });
          if (!room) return null;
          const members = await getFirestoreMembers(database, room.roomNumber);
          return {
            ...room,
            memberCount: members.length
          };
        })
      );

      return rooms
        .filter((room): room is AdminGroupRoomSummary => Boolean(room))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      logFirestoreFallback("list group rooms for admin", error);
    }
  }

  return getLocalRooms()
    .map((room) => ({
      ...room,
      memberCount: getLocalMembers(room.roomNumber).length
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRoomMembersForAdmin(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return [];

  const database = getFirestoreForOperation("load room members for admin");
  if (database) {
    try {
      return await getFirestoreMembers(database, normalized);
    } catch (error) {
      logFirestoreFallback("load room members for admin", error);
    }
  }

  return getLocalMembers(normalized);
}

export async function deleteGroupRoomForAdmin(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return;

  const database = getFirestoreForOperation("delete group room for admin");
  if (database) {
    try {
      const membersSnapshot = await getDocs(membersCollectionRef(database, normalized));
      const batch = writeBatch(database);

      membersSnapshot.docs.forEach((memberSnapshot) => {
        batch.delete(memberSnapshot.ref);
      });
      batch.delete(roomDocRef(database, normalized));

      await batch.commit();
    } catch (error) {
      logFirestoreFallback("delete group room for admin", error);
    }
  }

  removeLocalRoom(normalized);
}

export function readLegacyMembersForRoom(roomNumber: string) {
  return readLegacyMembers(roomNumber);
}
