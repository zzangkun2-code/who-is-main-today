import type { Gender } from "@/lib/fortune";
import { getDefaultAvatarId, isAvatarIdForGender } from "@/lib/avatar";
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
 * 현재 파일은 1단계 구현용 localStorage 어댑터입니다.
 * TODO: 온라인 저장으로 전환할 때는 아래 함수 이름을 유지한 채 내부 구현만
 * Next.js API route, Firebase SDK/Functions, 또는 서버 측 Google Sheets 연동으로 교체하세요.
 * Google Sheets service account private key는 클라이언트 번들에 절대 넣지 말고
 * .env.local + 서버 API route에서만 사용해야 합니다.
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

function getRooms() {
  return readJson<GroupRoom[]>(GROUP_ROOMS_KEY, []);
}

function saveRooms(rooms: GroupRoom[]) {
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
    : getDefaultAvatarId(gender, `${id}-${name}-${birthDate}-${birthTime}-${index}`);

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

function parseMemberList(value: string | null, roomNumber: string) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    const items = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { people?: unknown[] }).people)
        ? (parsed as { people: unknown[] }).people
        : [];

    return items
      .map((item, index) => normalizeMember(item, roomNumber, index))
      .filter((item): item is Member => Boolean(item));
  } catch {
    return [];
  }
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

export async function checkRoomNumberAvailable(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return false;
  return !getRooms().some((room) => room.roomNumber === normalized);
}

export async function createGroupRoom(roomNumber: string, password: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) {
    throw new Error("그룹방 번호를 숫자로 입력해 주세요.");
  }
  if (!password) {
    throw new Error("비밀번호를 입력해 주세요.");
  }

  const rooms = getRooms();
  if (rooms.some((room) => room.roomNumber === normalized)) {
    throw new Error("이미 사용 중인 그룹방 번호입니다.");
  }

  const timestamp = nowIso();
  const room: GroupRoom = {
    roomNumber: normalized,
    /**
     * TODO: Firebase, Google Sheets, 서버 DB 연동 시 평문 password 저장 금지.
     * Next.js API route 또는 Firebase Functions에서 passwordHash를 생성/검증하세요.
     */
    password,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (!saveRooms([...rooms, room])) {
    throw new Error("브라우저 저장소를 사용할 수 없어 그룹방을 만들 수 없습니다.");
  }

  const existingMembers = await getMembers(normalized);
  if (!existingMembers.length) {
    const legacyMembers = readLegacyMembers(normalized);
    if (legacyMembers.length) {
      await saveMembers(normalized, legacyMembers);
    }
  }

  return room;
}

export async function loginGroupRoom(roomNumber: string, password: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  const room = getRooms().find((item) => item.roomNumber === normalized);

  if (!room || room.password !== password) {
    return null;
  }

  return room;
}

export async function getMembers(roomNumber: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  const storage = getLocalStorageAdapter();
  if (!storage || !normalized) return [];

  return parseMemberList(storage.getItem(roomMembersKey(normalized)), normalized);
}

export async function saveMembers(roomNumber: string, members: Member[]) {
  const normalized = normalizeRoomNumber(roomNumber);
  if (!normalized) return false;

  const timestamp = nowIso();
  const normalizedMembers = members
    .map((member, index) => normalizeMember(member, normalized, index, timestamp))
    .filter((member): member is Member => Boolean(member));

  return writeJson(roomMembersKey(normalized), normalizedMembers);
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
      : getDefaultAvatarId(member.gender, `${id}-${member.name}-${member.birthDate}`),
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const members = await getMembers(normalized);
  await saveMembers(normalized, [...members, nextMember]);
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
  await saveMembers(normalized, nextMembers);
  return nextMembers.find((member) => member.id === memberId) ?? null;
}

export async function deleteMember(roomNumber: string, memberId: string) {
  const normalized = normalizeRoomNumber(roomNumber);
  const members = await getMembers(normalized);
  const nextMembers = members.filter((member) => member.id !== memberId);
  await saveMembers(normalized, nextMembers);
  return nextMembers;
}
