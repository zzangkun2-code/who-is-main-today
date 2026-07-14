"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Crown,
  Edit3,
  Gift,
  Heart,
  HeartHandshake,
  Medal,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Stethoscope,
  Trash2,
  Trophy,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  DailyFortune,
  Gender,
  Person,
  calculateFortune,
  formatKoreanDate,
  getLocalDateKey,
  rankFortunes
} from "@/lib/fortune";
import {
  getAvatarById,
  getAvatarOptions,
  getDefaultAvatarId,
  isAvatarIdForGender
} from "@/lib/avatar";
import {
  firebaseProjectId,
  missingFirebaseConfigKeys
} from "@/lib/firebase";
import {
  type AdminGroupRoomSummary,
  addMember,
  checkRoomNumberAvailable,
  createGroupRoom,
  deleteGroupRoomForAdmin,
  deleteMember,
  getRoomMembersForAdmin,
  getMembers,
  hasFirestoreStorage,
  listGroupRoomsForAdmin,
  loginGroupRoom,
  normalizeRoomNumber,
  subscribeRoomMembers,
  updateMember,
  type StorageMode
} from "@/lib/groupStorage";
import type { GroupRoom, Member } from "@/types/group";

const MIN_BIRTH_YEAR = 1900;
const INITIAL_BIRTH_YEAR = 1980;

type AuthView = "landing" | "create" | "login" | "room" | "admin";

type FormState = {
  name: string;
  gender: Gender;
  birthDate: string;
  birthTime: string;
  birthTimeUnknown: boolean;
  privacyConsent: boolean;
};

type RoomFormState = {
  roomNumber: string;
  password: string;
  passwordConfirm: string;
};

const emptyForm: FormState = {
  name: "",
  gender: "female",
  birthDate: "",
  birthTime: "",
  birthTimeUnknown: false,
  privacyConsent: false
};

const emptyRoomForm: RoomFormState = {
  roomNumber: "",
  password: "",
  passwordConfirm: ""
};

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

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStorageUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const firebaseIssue =
    message.includes("Firebase") ||
    message.includes("Firestore") ||
    message.includes("permission-denied") ||
    message.includes("Missing env") ||
    message.includes("environment variables");

  if (firebaseIssue) {
    return "who-is-main-today Firebase 연결에 실패했습니다. 프로젝트 루트의 .env.local 또는 Vercel 환경변수와 Firestore 권한 설정을 확인해주세요.";
  }
  if (message.includes("Room number is already in use")) {
    return "이미 사용 중인 그룹방 번호입니다.";
  }
  if (message.includes("Room number is required")) {
    return "그룹방 번호를 숫자로 입력해 주세요.";
  }
  if (message.includes("Password is required")) {
    return "비밀번호를 입력해 주세요.";
  }
  if (message.includes("Room number is invalid")) {
    return "그룹방 번호가 올바르지 않습니다.";
  }

  return message || "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function getFirebaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function getFirebaseErrorMessage(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  return String(error);
}

function getStorageFailureNotice(error?: unknown) {
  if (missingFirebaseConfigKeys.length > 0) {
    return `임시 저장 모드: 배포된 앱에 Firebase 환경변수가 빠져 있습니다. 누락: ${missingFirebaseConfigKeys.join(
      ", "
    )}. Vercel Environment Variables에 추가한 뒤 Redeploy 해주세요.`;
  }

  const code = getFirebaseErrorCode(error);
  const message = getFirebaseErrorMessage(error);
  const projectHint = firebaseProjectId
    ? `현재 앱의 Firebase projectId는 ${firebaseProjectId}입니다.`
    : "Firebase projectId를 확인하지 못했습니다.";

  if (code === "permission-denied") {
    return `임시 저장 모드: Firestore 권한 거부(permission-denied)입니다. Firebase Console > Firestore Database > 규칙에서 groupRooms/members 읽기·쓰기를 허용하고 '게시'를 눌러주세요. ${projectHint}`;
  }

  if (code === "unavailable" || code === "deadline-exceeded") {
    return `임시 저장 모드: Firestore 네트워크 연결이 불안정합니다(${code}). 잠시 후 새로고침해 주세요. ${projectHint}`;
  }

  if (code === "failed-precondition") {
    return `임시 저장 모드: Firestore 설정 조건이 맞지 않습니다(${code}). Firestore Database가 생성되어 있는지 확인해 주세요. ${projectHint}`;
  }

  return `임시 저장 모드: Firestore 연결에 실패했습니다${
    code ? `(${code})` : ""
  }. ${projectHint}${message ? ` 오류 원문: ${message}` : ""}`;
}

function isAdminCredential(roomNumber: string, password: string) {
  // Demo-only admin shortcut. In a real service, handle admin auth with Firebase Auth or a server API.
  return normalizeRoomNumber(roomNumber) === "0202" && password.trim() === "0425";
}

function Character({
  person,
  size = "normal",
  crowned = false
}: {
  person: Person;
  size?: "small" | "normal" | "large";
  crowned?: boolean;
}) {
  const avatar = getAvatarById(
    person.avatarId,
    person.gender,
    `${person.id}-${person.name}`
  );
  const colors = {
    hair: avatar.hair,
    outfit: avatar.outfit,
    detail: avatar.detail,
    skin: avatar.skin
  };
  const dimension = size === "small" ? 74 : size === "large" ? 150 : 112;
  const gradientId =
    `outfit-${person.id}-${avatar.id}`.replace(/[^a-zA-Z0-9]/g, "") ||
    "outfit-avatar";
  const useFullHair =
    avatar.hairStyle === "long" ||
    avatar.hairStyle === "bob" ||
    avatar.hairStyle === "wave";
  const femaleHairBase =
    avatar.hairStyle === "bob"
      ? "M47 70c-4-28 12-48 34-48 25 0 39 20 35 51l-8 27H54z"
      : avatar.hairStyle === "wave"
        ? "M43 75c-5-32 12-54 38-54 28 0 42 23 36 58-5 18-3 27 5 37-17-1-25-8-28-17H61c-3 9-11 16-27 17 9-12 11-22 9-41z"
        : "M45 73c-3-31 12-51 36-51 27 0 40 21 34 56l-12 30H58z";
  const femaleFrontHair =
    avatar.hairStyle === "bob"
      ? "M50 60c3-24 16-37 32-37 20 0 31 14 33 37-10 1-21-6-28-17-8 11-20 17-37 17z"
      : avatar.hairStyle === "wave"
        ? "M48 62c3-26 17-40 34-40 21 0 32 15 33 40-13-3-22-12-28-23-9 12-21 20-39 23z"
        : "M50 62c2-27 16-39 32-39 20 0 31 14 32 39-12-4-21-13-27-23-8 12-20 20-37 23z";
  const maleHairBase =
    avatar.hairStyle === "round"
      ? "M49 62c0-25 15-42 34-42 22 0 35 17 34 43l-8-5c-15 7-37 7-52-1z"
      : avatar.hairStyle === "soft"
        ? "M48 62c0-27 16-42 34-42 25 0 36 16 34 45l-8-4c-8-12-19-18-32-18-10 8-20 13-28 19z"
        : "M48 62c0-27 16-42 34-42 25 0 36 16 34 45l-9-6-6-16c-15 10-34 11-48 5z";
  const maleFrontHair =
    avatar.hairStyle === "round"
      ? "M50 57c2-22 15-36 34-36 19 0 30 13 31 34-13 4-29 2-43-7-6 5-13 8-22 9z"
      : avatar.hairStyle === "soft"
        ? "M50 58c1-25 14-37 33-37 20 0 30 13 31 35-12 2-24-5-33-17-8 11-19 17-31 19z"
        : "M50 58c1-25 14-37 33-37 20 0 30 13 31 35-13-2-24-9-31-18-8 9-19 16-33 20z";
  const mouthPath =
    avatar.mood === "calm"
      ? "M74 86q6 4 12 0"
      : avatar.mood === "bright"
        ? "M72 84q8 11 18 0"
        : "M72 85q8 9 16 0";

  return (
    <div
      className="fortune-character relative shrink-0"
      style={{ width: dimension, height: dimension }}
      aria-label={`${person.name} 캐릭터`}
    >
      {crowned ? (
        <Crown
          className="crown-bounce absolute -top-8 left-1/2 z-10 h-12 w-12 -translate-x-1/2 fill-[#ffd95a] text-[#f0a928] drop-shadow-md"
          strokeWidth={2.4}
        />
      ) : null}
      <svg viewBox="0 0 160 160" role="img" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors.outfit} />
            <stop offset="100%" stopColor={colors.detail} />
          </linearGradient>
        </defs>
        <ellipse cx="80" cy="147" rx="49" ry="8" fill="#71648A" opacity=".13" />
        <path
          d="M38 148c2-34 18-49 42-49s40 15 42 49"
          fill={`url(#${gradientId})`}
        />
        <path
          d="M68 101h24v17c-7 6-17 6-24 0z"
          fill="#F6BE9B"
        />
        {useFullHair ? (
          <path
            d={femaleHairBase}
            fill={colors.hair}
          />
        ) : (
          <path
            d={maleHairBase}
            fill={colors.hair}
          />
        )}
        <ellipse cx="80" cy="70" rx="30" ry="34" fill={colors.skin} />
        {useFullHair ? (
          <>
            <path
              d={femaleFrontHair}
              fill={colors.hair}
            />
          </>
        ) : (
          <path
            d={maleFrontHair}
            fill={colors.hair}
          />
        )}
        {avatar.accessory === "bow" ? (
          <g>
            <circle cx="111" cy="47" r="7" fill={colors.detail} />
            <circle cx="118" cy="52" r="5.5" fill={colors.outfit} />
            <circle cx="113" cy="52" r="3.2" fill="#fff" opacity=".72" />
          </g>
        ) : null}
        {avatar.accessory === "flower" ? (
          <g>
            <circle cx="111" cy="48" r="3.8" fill={colors.detail} />
            <circle cx="106" cy="48" r="3.5" fill={colors.outfit} />
            <circle cx="116" cy="48" r="3.5" fill={colors.outfit} />
            <circle cx="111" cy="43" r="3.5" fill={colors.outfit} />
            <circle cx="111" cy="53" r="3.5" fill={colors.outfit} />
          </g>
        ) : null}
        {avatar.accessory === "star" ? (
          <path
            d="M111 38l3.1 6.3 7 .9-5.1 4.9 1.3 6.9-6.3-3.3-6.2 3.3 1.2-6.9-5-4.9 6.9-.9z"
            fill={colors.detail}
          />
        ) : null}
        {avatar.accessory === "moon" ? (
          <path
            d="M111 37c-5 6-3 15 5 18-8 3-17-2-17-11 0-8 6-13 12-13z"
            fill={colors.detail}
          />
        ) : null}
        {avatar.accessory === "ribbon" ? (
          <g>
            <path d="M51 52l18 8-18 9zM72 60l18-8v17z" fill={colors.detail} />
            <circle cx="70" cy="60" r="4" fill="#fff" opacity=".78" />
          </g>
        ) : null}
        {avatar.accessory === "cap" ? (
          <g>
            <path
              d="M49 46c6-16 22-24 39-20 15 4 24 15 24 31-20-6-43-7-63-1z"
              fill={colors.outfit}
            />
            <path d="M84 54c18 0 29 2 38 8-14 4-26 2-38-4z" fill={colors.detail} />
          </g>
        ) : null}
        {avatar.accessory === "leaf" ? (
          <path
            d="M109 39c10 1 15 8 14 17-9 1-17-5-18-14 5 1 9 3 13 7"
            fill={colors.detail}
            opacity=".95"
          />
        ) : null}
        {avatar.accessory === "spark" ? (
          <g fill={colors.detail}>
            <path d="M112 35l2.4 7.2 7.2 2.4-7.2 2.4-2.4 7.2-2.4-7.2-7.2-2.4 7.2-2.4z" />
            <circle cx="100" cy="54" r="2.5" opacity=".75" />
          </g>
        ) : null}
        {avatar.mood === "wink" ? (
          <>
            <ellipse cx="68" cy="71" rx="3.4" ry="4" fill="#40364C" />
            <path d="M88 71q5 4 10 0" fill="none" stroke="#40364C" strokeLinecap="round" strokeWidth="2.4" />
            <circle cx="67" cy="69.5" r="1" fill="white" />
          </>
        ) : avatar.mood === "calm" ? (
          <>
            <path d="M64 72q4-3 8 0M89 72q4-3 8 0" fill="none" stroke="#40364C" strokeLinecap="round" strokeWidth="2.3" />
          </>
        ) : (
          <>
            <ellipse cx="68" cy="71" rx="3.4" ry="4" fill="#40364C" />
            <ellipse cx="93" cy="71" rx="3.4" ry="4" fill="#40364C" />
            <circle cx="67" cy="69.5" r="1" fill="white" />
            <circle cx="92" cy="69.5" r="1" fill="white" />
          </>
        )}
        {avatar.accessory === "glasses" ? (
          <g fill="none" stroke={colors.hair} strokeWidth="2.2" opacity=".78">
            <circle cx="68" cy="71" r="8" />
            <circle cx="93" cy="71" r="8" />
            <path d="M76 71h9" />
          </g>
        ) : null}
        <path
          d={mouthPath}
          fill="none"
          stroke="#CB6D73"
          strokeLinecap="round"
          strokeWidth="2.7"
        />
        <circle cx="57" cy="81" r="5" fill="#FF9FAB" opacity=".35" />
        <circle cx="103" cy="81" r="5" fill="#FF9FAB" opacity=".35" />
        <path
          d="M62 115l18 15 18-15 12 33H50z"
          fill="white"
          opacity=".32"
        />
        <Star
          x="70"
          y="127"
          width="20"
          height="20"
          fill="#FFF2A5"
          color="#FFF2A5"
        />
      </svg>
    </div>
  );
}

function AppModal({
  open,
  onClose,
  children,
  label,
  wide = false
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  label: string;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-fade fixed inset-0 z-50 flex items-end justify-center bg-[#2b2145]/45 p-2 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`modal-pop relative max-h-[94dvh] w-full overscroll-contain overflow-y-auto rounded-[24px] border border-white/80 bg-[#fffdfb] shadow-[0_30px_90px_rgba(73,48,108,.28)] sm:max-h-[92vh] sm:rounded-[32px] ${
          wide ? "max-w-3xl" : "max-w-xl"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <button
          type="button"
          onClick={onClose}
          className="focus-ring absolute right-3 top-3 z-20 grid h-12 w-12 place-items-center rounded-full bg-white/90 text-[#75698c] shadow-sm transition hover:rotate-6 hover:text-[#4b3d69] sm:right-4 sm:top-4"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </section>
    </div>
  );
}

function AvatarPickerModal({
  person,
  onClose,
  onSelect
}: {
  person: Member | null;
  onClose: () => void;
  onSelect: (avatarId: string) => void;
}) {
  const [draftAvatarId, setDraftAvatarId] = useState("");

  useEffect(() => {
    if (!person) return;
    setDraftAvatarId(
      getAvatarById(person.avatarId, person.gender, `${person.id}-${person.name}`).id
    );
  }, [person]);

  const options = person ? getAvatarOptions(person.gender) : [];

  return (
    <AppModal
      open={Boolean(person)}
      onClose={onClose}
      label="캐릭터 선택"
      wide
    >
      {person ? (
        <div className="px-5 pb-7 pt-16 sm:px-8 sm:pt-8">
          <div className="text-center">
            <p className="text-xs font-black tracking-[.16em] text-[#9b80bd]">
              AVATAR STYLE
            </p>
            <h2 className="mt-2 text-3xl font-black text-[#3c2d54]">
              캐릭터 선택
            </h2>
            <p className="mt-2 text-sm font-bold text-[#8f8499]">
              {person.name}님에게 어울리는 캐릭터를 골라주세요.
            </p>
          </div>

          <div className="avatar-choice-grid mt-6">
            {options.map((avatar) => {
              const selected = avatar.id === draftAvatarId;
              return (
                <button
                  type="button"
                  key={avatar.id}
                  onClick={() => setDraftAvatarId(avatar.id)}
                  className={`focus-ring avatar-choice-card ${
                    selected ? "avatar-choice-selected" : ""
                  }`}
                  aria-pressed={selected}
                >
                  <span className="avatar-choice-check" aria-hidden="true">
                    {selected ? <Check className="h-4 w-4" /> : null}
                  </span>
                  <Character
                    person={{ ...person, avatarId: avatar.id }}
                    size="small"
                  />
                  <span>{avatar.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring min-h-12 rounded-full border border-[#dfd4e8] bg-white px-5 text-sm font-black text-[#715885] transition hover:bg-[#fbf8ff]"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={() => onSelect(draftAvatarId)}
              className="focus-ring min-h-12 rounded-full bg-gradient-to-r from-[#8a62ca] to-[#ec84a9] px-6 text-sm font-black text-white shadow-[0_14px_34px_rgba(145,89,181,.26)] transition hover:-translate-y-0.5"
            >
              선택 완료
            </button>
          </div>
        </div>
      ) : null}
    </AppModal>
  );
}

function BirthDatePicker({
  value,
  maxDate,
  onChange
}: {
  value: string;
  maxDate: string;
  onChange: (value: string) => void;
}) {
  const [year, setYear] = useState(value.slice(0, 4));
  const [month, setMonth] = useState(value.slice(5, 7));
  const [day, setDay] = useState(value.slice(8, 10));
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const yearGridRef = useRef<HTMLDivElement>(null);
  const [maxYear, maxMonth, maxDay] = maxDate.split("-").map(Number);
  const years = useMemo(
    () =>
      Array.from(
        { length: maxYear - MIN_BIRTH_YEAR + 1 },
        (_, index) => MIN_BIRTH_YEAR + index
      ),
    [maxYear]
  );

  useEffect(() => {
    setYear(value.slice(0, 4));
    setMonth(value.slice(5, 7));
    setDay(value.slice(8, 10));
  }, [value]);

  useEffect(() => {
    if (!yearPickerOpen) return;
    const focusYear = Number(year) || INITIAL_BIRTH_YEAR;
    const grid = yearGridRef.current;
    const target = grid?.querySelector<HTMLElement>(
      `[data-year="${focusYear}"]`
    );
    if (!grid || !target) return;
    grid.scrollTop =
      target.offsetTop - grid.clientHeight / 2 + target.clientHeight / 2;
  }, [yearPickerOpen, year]);

  const selectedYear = Number(year);
  const selectedMonth = Number(month);
  const monthLimit = selectedYear === maxYear ? maxMonth : 12;
  const naturalDayLimit =
    selectedYear && selectedMonth
      ? new Date(selectedYear, selectedMonth, 0).getDate()
      : 31;
  const dayLimit =
    selectedYear === maxYear && selectedMonth === maxMonth
      ? Math.min(naturalDayLimit, maxDay)
      : naturalDayLimit;
  const months = Array.from({ length: monthLimit }, (_, index) => index + 1);
  const days = Array.from({ length: dayLimit }, (_, index) => index + 1);

  function updateDate(nextYear: string, nextMonth: string, nextDay: string) {
    setYear(nextYear);
    setMonth(nextMonth);
    setDay(nextDay);
    if (nextYear && nextMonth && nextDay) {
      onChange(`${nextYear}-${nextMonth}-${nextDay}`);
    } else {
      onChange("");
    }
  }

  function chooseYear(nextYear: number) {
    const nextYearText = String(nextYear);
    const nextMonth =
      month && Number(month) <= (nextYear === maxYear ? maxMonth : 12)
        ? month
        : "";
    const nextNaturalLimit = nextMonth
      ? new Date(nextYear, Number(nextMonth), 0).getDate()
      : 31;
    const nextDayLimit =
      nextYear === maxYear && Number(nextMonth) === maxMonth
        ? Math.min(nextNaturalLimit, maxDay)
        : nextNaturalLimit;
    const nextDay =
      day && Number(day) <= nextDayLimit
        ? day
        : day
          ? String(nextDayLimit).padStart(2, "0")
          : "";
    updateDate(nextYearText, nextMonth, nextDay);
    setYearPickerOpen(false);
  }

  function chooseMonth(nextMonth: string) {
    const nextNaturalLimit =
      year && nextMonth
        ? new Date(Number(year), Number(nextMonth), 0).getDate()
        : 31;
    const nextDayLimit =
      Number(year) === maxYear && Number(nextMonth) === maxMonth
        ? Math.min(nextNaturalLimit, maxDay)
        : nextNaturalLimit;
    const nextDay =
      day && Number(day) > nextDayLimit
        ? String(nextDayLimit).padStart(2, "0")
        : day;
    updateDate(year, nextMonth, nextDay);
  }

  return (
    <fieldset className="birth-date-picker">
      <legend className="mb-2 text-base font-black text-[#5a4c6c]">
        생년월일
      </legend>
      <button
        type="button"
        className="focus-ring year-picker-trigger"
        aria-expanded={yearPickerOpen}
        aria-controls="birth-year-grid"
        onClick={() => setYearPickerOpen((current) => !current)}
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-[#9a84b2]" />
          <span>
            {year ? (
              <>
                <strong>{year}년</strong>
                <small> 선택됨</small>
              </>
            ) : (
              "연도를 선택해 주세요"
            )}
          </span>
        </span>
        <ChevronDown
          className={`h-5 w-5 transition ${
            yearPickerOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {yearPickerOpen ? (
        <div className="year-picker-panel">
          <div className="year-picker-heading">
            <strong>태어난 연도</strong>
            <span>1980년 근처에서 시작해요</span>
          </div>
          <div
            id="birth-year-grid"
            ref={yearGridRef}
            className="year-grid-scroll"
            role="listbox"
            aria-label="태어난 연도 선택"
          >
            <div className="year-grid">
              {years.map((item) => (
                <button
                  type="button"
                  key={item}
                  data-year={item}
                  role="option"
                  aria-selected={year === String(item)}
                  className={`focus-ring year-option ${
                    year === String(item) ? "year-option-selected" : ""
                  }`}
                  onClick={() => chooseYear(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="birth-month-day-grid">
        <fieldset className="birth-choice-group">
          <legend>월</legend>
          <div className="month-grid" role="listbox" aria-label="태어난 월 선택">
            {months.map((item) => {
              const option = String(item).padStart(2, "0");
              const selected = month === option;
              return (
                <button
                  type="button"
                  key={option}
                  data-month={option}
                  role="option"
                  aria-selected={selected}
                  disabled={!year}
                  className={`focus-ring date-option month-option ${
                    selected ? "date-option-selected" : ""
                  }`}
                  onClick={() => chooseMonth(option)}
                >
                  {item}월
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="birth-choice-group">
          <legend>일</legend>
          {year && month ? (
            <div className="day-grid" role="listbox" aria-label="태어난 일 선택">
              {days.map((item) => {
                const option = String(item).padStart(2, "0");
                const selected = day === option;
                return (
                  <button
                    type="button"
                    key={option}
                    data-day={option}
                    role="option"
                    aria-selected={selected}
                    className={`focus-ring date-option day-option ${
                      selected ? "date-option-selected" : ""
                    }`}
                    onClick={() => updateDate(year, month, option)}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="date-picker-hint">연도와 월을 먼저 선택해 주세요.</p>
          )}
        </fieldset>
      </div>
    </fieldset>
  );
}

function BirthTimePicker({
  value,
  unknown,
  onUnknownChange,
  onChange
}: {
  value: string;
  unknown: boolean;
  onUnknownChange: (value: boolean) => void;
  onChange: (value: string) => void;
}) {
  const normalized = normalizeBirthTime(value);
  const selectedHour = normalized ? normalized.slice(0, 2) : "";
  const selectedMinute = normalized ? normalized.slice(3, 5) : "";
  const minuteOptions = useMemo(() => {
    const options = ["00", "30"];
    if (selectedMinute && !options.includes(selectedMinute)) {
      options.push(selectedMinute);
    }
    return options.sort((a, b) => Number(a) - Number(b));
  }, [selectedMinute]);

  function chooseHour(hour: string) {
    if (unknown) return;
    onChange(`${hour}:${selectedMinute || "00"}`);
  }

  function chooseMinute(minute: string) {
    if (unknown) return;
    onChange(`${selectedHour || "00"}:${minute}`);
  }

  return (
    <fieldset className="birth-time-picker">
      <legend className="mb-2 text-sm font-black text-[#5a4c6c]">
        태어난 시간
      </legend>
      <div className="time-picker-summary">
        <Clock3 className="h-4 w-4 text-[#9a84b2]" />
        {unknown
          ? "태어난 시간을 잘 모름으로 저장해요"
          : normalized
            ? `${Number(selectedHour)}시 ${selectedMinute}분 선택됨`
            : "시간을 선택해 주세요"}
      </div>
      <div className="time-picker-section">
        <button
          type="button"
          onClick={() => onUnknownChange(!unknown)}
          className={`focus-ring unknown-time-toggle ${
            unknown ? "unknown-time-toggle-selected" : ""
          }`}
          aria-pressed={unknown}
        >
          {unknown ? <Check className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
          잘 모름
        </button>
        <p>시</p>
        <div
          className={`hour-grid ${unknown ? "time-grid-disabled" : ""}`}
          role="listbox"
          aria-label="태어난 시 선택"
          aria-disabled={unknown}
        >
          {Array.from({ length: 24 }, (_, index) => {
            const hour = String(index).padStart(2, "0");
            const selected = selectedHour === hour;
            return (
              <button
                type="button"
                key={hour}
                data-hour={hour}
                role="option"
                aria-selected={selected}
                disabled={unknown}
                className={`focus-ring time-option ${
                  selected ? "time-option-selected" : ""
                }`}
                onClick={() => chooseHour(hour)}
              >
                {index}시
              </button>
            );
          })}
        </div>
      </div>
      <div className="time-picker-section">
        <p>분</p>
        <div
          className={`minute-grid ${unknown ? "time-grid-disabled" : ""}`}
          role="listbox"
          aria-label="태어난 분 선택"
          aria-disabled={unknown}
        >
          {minuteOptions.map((minute) => {
            const selected = selectedMinute === minute;
            return (
              <button
                type="button"
                key={minute}
                data-minute={minute}
                role="option"
                aria-selected={selected}
                disabled={unknown}
                className={`focus-ring time-option minute-option ${
                  selected ? "time-option-selected" : ""
                }`}
                onClick={() => chooseMinute(minute)}
              >
                {minute}분
              </button>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}

function PersonCard({
  person,
  onEdit,
  onDelete,
  onFortune,
  onAvatarSelect
}: {
  person: Member;
  onEdit: () => void;
  onDelete: () => void;
  onFortune: () => void;
  onAvatarSelect: () => void;
}) {
  return (
    <article className="candidate-card group relative overflow-hidden rounded-[26px] border border-white bg-white p-4 shadow-[0_14px_40px_rgba(98,75,135,.09)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(98,75,135,.15)] sm:p-5">
      <div className="absolute -right-5 -top-7 h-24 w-24 rounded-full bg-[#fff1bc]/60 blur-sm" />
      <div className="candidate-card-body relative">
        <button
          type="button"
          onClick={onAvatarSelect}
          className="candidate-avatar-button focus-ring rounded-2xl"
          aria-label={`${person.name} 캐릭터 선택`}
        >
          <Character person={person} size="small" />
          <span className="candidate-avatar-hint">캐릭터 변경</span>
        </button>
        <div className="candidate-info">
          <div className="candidate-title-row">
            <button
              type="button"
              onClick={onFortune}
              className="focus-ring min-w-0 rounded-lg text-left"
            >
              <h3 className="candidate-name text-xl font-black text-[#3e3157]">
                {person.name}
              </h3>
            </button>
          </div>
          <div className="candidate-meta-row">
            <span>운세 계산 정보는 비공개</span>
          </div>
          <button
            type="button"
            onClick={onFortune}
            className="focus-ring mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-full bg-[#f5efff] px-4 py-2 text-sm font-extrabold text-[#8158c6] transition hover:bg-[#efe4ff] hover:text-[#6e3fc0] sm:w-auto"
          >
            오늘의 운세 보기 <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="candidate-actions">
          <button
            type="button"
            onClick={onEdit}
            className="focus-ring grid h-11 w-11 place-items-center rounded-full text-[#a197b0] transition hover:bg-[#f3edff] hover:text-[#7951bd]"
            aria-label={`${person.name} 수정`}
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="focus-ring grid h-11 w-11 place-items-center rounded-full text-[#a197b0] transition hover:bg-[#fff0f2] hover:text-[#df6680]"
            aria-label={`${person.name} 삭제`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function FortuneDetail({
  fortune,
  onClose
}: {
  fortune: DailyFortune | null;
  onClose: () => void;
}) {
  const icons = {
    love: Heart,
    money: CircleDollarSign,
    health: Stethoscope,
    relationship: HeartHandshake,
    lucky: Gift
  };
  const colors = {
    love: "bg-[#fff0f4] text-[#ef6f94]",
    money: "bg-[#fff8d9] text-[#d69b26]",
    health: "bg-[#ebfbf5] text-[#39a981]",
    relationship: "bg-[#edf3ff] text-[#6689dc]",
    lucky: "bg-[#f4edff] text-[#9362d2]"
  };

  return (
      <AppModal
      open={Boolean(fortune)}
      onClose={onClose}
      label={`${fortune?.person.name ?? ""} 오늘의 기운 풀이`}
      wide
    >
      {fortune ? (
        <>
          <div className="relative overflow-hidden rounded-t-[24px] bg-gradient-to-br from-[#eee7ff] via-[#fff4f7] to-[#fff7d5] px-5 pb-7 pt-16 sm:rounded-t-[32px] sm:px-9 sm:pt-8">
            <div className="absolute right-8 top-7 text-[#d8c5ff]">
              <Sparkles className="h-9 w-9" />
            </div>
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-5 sm:text-left">
              <Character person={fortune.person} />
              <div>
                <p className="text-base font-extrabold text-[#8c78ae]">
                  {formatKoreanDate(getLocalDateKey())}
                </p>
                <h2 className="mt-1 text-3xl font-black text-[#3f315a]">
                  {fortune.person.name}님의 오늘의 기운 풀이
                </h2>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span className="rounded-full bg-white/80 px-3 py-1.5 text-sm font-black text-[#7752b2]">
                    {fortune.keyword}
                  </span>
                  <strong className="text-2xl font-black text-[#6f46b1]">
                    {fortune.score}점
                  </strong>
                </div>
                <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-[#71637f]">
                  {fortune.summary}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-7">
            {fortune.categories.map((category, index) => {
              const Icon = icons[category.key];
              return (
                <article
                  key={category.key}
                  className={`rounded-[22px] border border-[#eee8f4] bg-white p-5 ${
                    index === 4 ? "sm:col-span-2" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                        colors[category.key]
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-black text-[#4a3b62]">
                          {category.label}
                        </h3>
                        <span className="text-base font-black text-[#8067a5]">
                          {category.score}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f0ecf4]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#a988e2] to-[#ff91af]"
                          style={{ width: `${category.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-base font-medium leading-7 text-[#71677e]">
                    {category.description}
                  </p>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </AppModal>
  );
}

function WinnerModal({
  fortune,
  onClose,
  onDetail
}: {
  fortune: DailyFortune | null;
  onClose: () => void;
  onDetail: () => void;
}) {
  return (
    <AppModal
      open={Boolean(fortune)}
      onClose={onClose}
      label="오늘 가장 빛나는 기운"
    >
      {fortune ? (
        <div className="relative overflow-hidden px-5 pb-8 pt-16 text-center sm:px-10 sm:pt-10">
          <div className="absolute left-8 top-8 text-[#ffbc5e]">
            <Star className="h-5 w-5 fill-current" />
          </div>
          <div className="absolute right-10 top-16 text-[#b497e8]">
            <Sparkles className="h-7 w-7" />
          </div>
          <p className="text-base font-black tracking-[.18em] text-[#9b7ccb]">
            TODAY&apos;S ENERGY
          </p>
          <div className="mx-auto mt-8 flex w-fit justify-center rounded-full bg-gradient-to-br from-[#fff5c9] to-[#ffe6ef] p-3 shadow-[0_14px_38px_rgba(180,120,145,.18)]">
            <Character person={fortune.person} size="large" crowned />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-[#f3ad2f]">
            <Trophy className="h-6 w-6 fill-[#ffd96a]" />
            <span className="text-base font-black">오늘의 주인공</span>
            <Trophy className="h-6 w-6 fill-[#ffd96a]" />
          </div>
          <h2 className="mt-2 text-4xl font-black text-[#3e2e56]">
            {fortune.person.name}
          </h2>
          <div className="mt-3 inline-flex rounded-full bg-[#f2ebff] px-5 py-2 text-base font-black text-[#7951b9]">
            오늘의 운세 {fortune.score}점
          </div>
          <div className="mt-6 rounded-[24px] bg-[#faf7ff] p-5 text-left sm:p-6">
            {fortune.winnerPraise.map((sentence) => (
              <p
                key={sentence}
                className="mb-3 text-base font-medium leading-7 text-[#655a72] last:mb-0"
              >
                {sentence}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={onDetail}
            className="focus-ring mt-6 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#8f67d2] to-[#ef83aa] px-7 text-base font-black text-white shadow-[0_12px_28px_rgba(142,92,188,.3)] transition hover:-translate-y-0.5"
          >
            자세한 오늘의 운세 보기
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </AppModal>
  );
}

function PodiumCard({
  fortune,
  rank,
  onDetail
}: {
  fortune: DailyFortune;
  rank: 1 | 2 | 3;
  onDetail: () => void;
}) {
  const rankStyle = {
    1: {
      order: "md:order-2",
      height: "h-44 sm:h-52",
      podium: "from-[#ffd968] to-[#f8ae4d]",
      badge: "bg-[#ffd859] text-[#8f5b0b]",
      medal: "🥇"
    },
    2: {
      order: "md:order-1",
      height: "h-32 sm:h-40",
      podium: "from-[#cfd8e6] to-[#aebbd0]",
      badge: "bg-[#dce3ec] text-[#5e6c7e]",
      medal: "🥈"
    },
    3: {
      order: "md:order-3",
      height: "h-24 sm:h-32",
      podium: "from-[#e5ad83] to-[#c98359]",
      badge: "bg-[#efc09d] text-[#7c4a2b]",
      medal: "🥉"
    }
  }[rank];

  return (
    <article
      className={`flex min-w-0 flex-1 flex-col items-center ${rankStyle.order}`}
    >
      <div className="podium-person relative z-10 flex flex-col items-center text-center">
        <span
          className={`mb-2 rounded-full px-3 py-1.5 text-sm font-black shadow-sm ${rankStyle.badge}`}
        >
          {rank}위 · {fortune.score}점
        </span>
        <Character
          person={fortune.person}
          size={rank === 1 ? "large" : "normal"}
          crowned={rank === 1}
        />
        <button
          type="button"
          onClick={onDetail}
          className="focus-ring mt-1 max-w-[180px] truncate rounded-lg text-xl font-black text-[#413256] transition hover:text-[#8658c5]"
        >
          {fortune.person.name}
        </button>
        <p className="mt-1 max-w-[240px] text-sm font-semibold leading-6 text-[#776c83]">
          {rank === 1
            ? fortune.summary
            : fortune.runnerUpMessage}
        </p>
        <button
          type="button"
          onClick={onDetail}
          className="focus-ring mt-3 inline-flex min-h-11 items-center gap-1 rounded-full bg-white/80 px-4 py-2 text-sm font-black text-[#7958aa] shadow-sm"
        >
          운세 보기 <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <div
        className={`relative mt-4 flex w-full max-w-[240px] items-start justify-center rounded-t-[22px] bg-gradient-to-b ${rankStyle.podium} ${rankStyle.height} pt-5 shadow-[inset_0_3px_0_rgba(255,255,255,.35),0_18px_35px_rgba(72,50,100,.13)]`}
      >
        <span className="text-4xl drop-shadow-sm sm:text-5xl">
          {rankStyle.medal}
        </span>
        <span className="absolute bottom-4 font-black text-white/60">
          {rank}
        </span>
      </div>
    </article>
  );
}

function RankingListItem({
  fortune,
  rank,
  onDetail
}: {
  fortune: DailyFortune;
  rank: number;
  onDetail: () => void;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-[0_12px_32px_rgba(91,65,120,.08)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(91,65,120,.13)] sm:p-5">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#f5edff]/80" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onDetail}
          className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left"
          aria-label={`${fortune.person.name} 오늘의 운세 보기`}
        >
          <span className="relative shrink-0">
            <Character person={fortune.person} size="small" />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-[#f3ecff] px-2 py-1 text-xs font-black text-[#7955b4] shadow-sm">
              {rank}위
            </span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xl font-black text-[#3f3158]">
              {fortune.person.name}
            </span>
            <span className="mt-1 block text-sm font-extrabold text-[#8f7fa3]">
              {fortune.keyword} · {fortune.score}점
            </span>
          </span>
        </button>
        <div className="min-w-0 flex-1 sm:max-w-[52%]">
          <p className="fortune-ranking-summary text-sm font-medium leading-6 text-[#75697f]">
            {fortune.runnerUpMessage}
          </p>
          <button
            type="button"
            onClick={onDetail}
            className="focus-ring mt-3 inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-[#f6f0ff] px-4 py-2 text-sm font-black text-[#7652ad] transition hover:bg-[#efe4ff]"
          >
            오늘의 운세 보기 <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function FortuneApp() {
  const [authView, setAuthView] = useState<AuthView>("landing");
  const [activeRoom, setActiveRoom] = useState<GroupRoom | null>(null);
  const [people, setPeople] = useState<Member[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [createForm, setCreateForm] = useState<RoomFormState>(emptyRoomForm);
  const [loginForm, setLoginForm] = useState<Omit<RoomFormState, "passwordConfirm">>({
    roomNumber: "",
    password: ""
  });
  const [roomCheck, setRoomCheck] = useState<{
    roomNumber: string;
    status: "idle" | "available" | "taken";
  }>({ roomNumber: "", status: "idle" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"input" | "result">("input");
  const [rankings, setRankings] = useState<DailyFortune[]>([]);
  const [winner, setWinner] = useState<DailyFortune | null>(null);
  const [detail, setDetail] = useState<DailyFortune | null>(null);
  const [avatarTargetId, setAvatarTargetId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [adminRooms, setAdminRooms] = useState<AdminGroupRoomSummary[]>([]);
  const [adminSelectedRoom, setAdminSelectedRoom] =
    useState<AdminGroupRoomSummary | null>(null);
  const [adminMembers, setAdminMembers] = useState<Member[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [storageMode, setStorageMode] = useState<StorageMode | "checking">(
    "checking"
  );
  const [storageNotice, setStorageNotice] = useState("");
  const dateKey = useMemo(() => getLocalDateKey(), []);

  const previewFortunes = useMemo(
    () => rankFortunes(people, dateKey),
    [people, dateKey]
  );
  const avatarTarget = useMemo(
    () => people.find((person) => person.id === avatarTargetId) ?? null,
    [people, avatarTargetId]
  );

  useEffect(() => {
    setRankings((current) =>
      current.length ? rankFortunes(people, dateKey) : current
    );
    setWinner((current) => {
      if (!current) return current;
      const latestPerson = people.find(
        (person) => person.id === current.person.id
      );
      return latestPerson ? calculateFortune(latestPerson, dateKey) : null;
    });
    setDetail((current) => {
      if (!current) return current;
      const latestPerson = people.find(
        (person) => person.id === current.person.id
      );
      return latestPerson ? calculateFortune(latestPerson, dateKey) : null;
    });
  }, [people, dateKey]);

  useEffect(() => {
    const roomNumber = activeRoom?.roomNumber;
    if (!roomNumber) {
      setStorageMode("checking");
      setStorageNotice("");
      return;
    }

    let cancelled = false;
    setStorageMode(hasFirestoreStorage() ? "checking" : "local");
    setStorageNotice(
      hasFirestoreStorage()
        ? "서버 저장소와 연결을 확인하고 있어요."
        : getStorageFailureNotice()
    );

    const loadFallbackMembers = async () => {
      try {
        const fallbackMembers = await getMembers(roomNumber);
        if (!cancelled) {
          setPeople(fallbackMembers);
        }
      } catch (loadError) {
        console.error("[who-is-main-today Firebase] 후보 목록 fallback 불러오기 실패", loadError);
        if (!cancelled) {
          setError(getStorageUserMessage(loadError));
          setStorageNotice(getStorageFailureNotice(loadError));
        }
      }
    };

    const unsubscribe = subscribeRoomMembers(
      roomNumber,
      (members) => {
        if (cancelled) return;
        setPeople(members);
        setStorageMode("firestore");
        setStorageNotice("서버 저장 모드: 같은 그룹방 사람들과 후보 목록을 공유합니다.");
      },
      (status) => {
        if (cancelled) return;
        if (status.mode === "firestore") {
          setStorageMode("firestore");
          setStorageNotice(
            "서버 저장 모드: 같은 그룹방 사람들과 후보 목록을 공유합니다."
          );
          return;
        }

        setStorageMode("local");
        setStorageNotice(getStorageFailureNotice(status.error));
        void loadFallbackMembers();
      }
    );

    if (!unsubscribe) {
      void loadFallbackMembers();
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [activeRoom?.roomNumber]);

  function resetRoomUi() {
    setForm(emptyForm);
    setEditingId(null);
    setActiveTab("input");
    setRankings([]);
    setWinner(null);
    setDetail(null);
    setAvatarTargetId(null);
    setError("");
  }

  function resetAdminUi() {
    setAdminRooms([]);
    setAdminSelectedRoom(null);
    setAdminMembers([]);
    setAdminLoading(false);
    setAdminError("");
  }

  async function loadAdminRooms() {
    setAdminLoading(true);
    setAdminError("");
    try {
      const rooms = await listGroupRoomsForAdmin();
      setAdminRooms(rooms);
    } catch (adminLoadError) {
      console.error("[Firestore] 관리자 그룹방 목록 불러오기 실패", adminLoadError);
      setAdminError(getStorageUserMessage(adminLoadError));
    } finally {
      setAdminLoading(false);
    }
  }

  async function enterAdminMode() {
    resetRoomUi();
    setActiveRoom(null);
    setPeople([]);
    setAuthView("admin");
    setAuthMessage("");
    setLoginForm({ roomNumber: "", password: "" });
    await loadAdminRooms();
  }

  function leaveAdminMode() {
    resetAdminUi();
    setAuthView("landing");
    setAuthMessage("");
  }

  async function openAdminRoom(room: AdminGroupRoomSummary) {
    setAdminLoading(true);
    setAdminError("");
    try {
      const members = await getRoomMembersForAdmin(room.roomNumber);
      setAdminSelectedRoom(room);
      setAdminMembers(members);
    } catch (adminRoomError) {
      console.error("[Firestore] 관리자 그룹방 상세 불러오기 실패", adminRoomError);
      setAdminError(getStorageUserMessage(adminRoomError));
    } finally {
      setAdminLoading(false);
    }
  }

  async function deleteAdminRoom(room: AdminGroupRoomSummary) {
    const confirmed = window.confirm(
      "정말로 이 그룹방과 그 안의 모든 후보 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
    );
    if (!confirmed) return;

    setAdminLoading(true);
    setAdminError("");
    try {
      await deleteGroupRoomForAdmin(room.roomNumber);
      setAdminRooms((current) =>
        current.filter((item) => item.roomNumber !== room.roomNumber)
      );
      if (adminSelectedRoom?.roomNumber === room.roomNumber) {
        setAdminSelectedRoom(null);
        setAdminMembers([]);
      }
    } catch (adminDeleteError) {
      console.error("[Firestore] 관리자 그룹방 삭제 실패", adminDeleteError);
      setAdminError(getStorageUserMessage(adminDeleteError));
    } finally {
      setAdminLoading(false);
    }
  }

  async function enterRoom(room: GroupRoom) {
    const members = await getMembers(room.roomNumber);
    setActiveRoom(room);
    setPeople(members);
    setAuthView("room");
    setAuthMessage("");
    resetRoomUi();
  }

  async function handleRoomAvailabilityCheck() {
    const roomNumber = normalizeRoomNumber(createForm.roomNumber);
    if (!roomNumber) {
      setAuthMessage("그룹방 번호를 숫자로 입력해 주세요.");
      setRoomCheck({ roomNumber: "", status: "idle" });
      return;
    }

    try {
      const available = await checkRoomNumberAvailable(roomNumber);
      setRoomCheck({
        roomNumber,
        status: available ? "available" : "taken"
      });
      setAuthMessage(
        available
          ? "사용 가능한 그룹방 번호입니다."
          : "이미 사용 중인 그룹방 번호입니다."
      );
    } catch (roomError) {
      console.error("[Firestore] 그룹방 번호 중복 확인 실패", roomError);
      setRoomCheck({ roomNumber: "", status: "idle" });
      setAuthMessage(
        roomError instanceof Error
          ? getStorageUserMessage(roomError)
          : "Firebase에서 그룹방 번호를 확인하지 못했습니다."
      );
    }
  }

  async function submitCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const roomNumber = normalizeRoomNumber(createForm.roomNumber);
    const password = createForm.password.trim();
    const passwordConfirm = createForm.passwordConfirm.trim();

    if (!roomNumber || !password || !passwordConfirm) {
      setAuthMessage("그룹방 번호와 비밀번호를 모두 입력해 주세요.");
      return;
    }
    if (password !== passwordConfirm) {
      setAuthMessage("비밀번호와 비밀번호 재입력이 서로 다릅니다.");
      return;
    }
    if (
      roomCheck.roomNumber !== roomNumber ||
      roomCheck.status !== "available"
    ) {
      setAuthMessage("그룹방 번호 중복 확인을 먼저 해주세요.");
      return;
    }

    try {
      const room = await createGroupRoom(roomNumber, password);
      setCreateForm(emptyRoomForm);
      setRoomCheck({ roomNumber: "", status: "idle" });
      await enterRoom(room);
    } catch (roomError) {
      console.error("[Firestore] 그룹방 생성 실패", roomError);
      setAuthMessage(
        roomError instanceof Error
          ? getStorageUserMessage(roomError)
          : "그룹방을 만들 수 없습니다."
      );
    }
  }

  async function submitLoginRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const roomNumber = normalizeRoomNumber(loginForm.roomNumber);
    const password = loginForm.password.trim();
    if (!roomNumber || !password) {
      setAuthMessage("그룹방 번호와 비밀번호를 입력해 주세요.");
      return;
    }

    if (isAdminCredential(roomNumber, password)) {
      try {
        await enterAdminMode();
      } catch (adminError) {
        console.error("[Firestore] 관리자 모드 진입 실패", adminError);
        setAuthMessage(getStorageUserMessage(adminError));
      }
      return;
    }

    try {
      const room = await loginGroupRoom(roomNumber, password);
      if (!room) {
        setAuthMessage("그룹방 번호 또는 비밀번호가 올바르지 않습니다.");
        return;
      }

      setLoginForm({ roomNumber: "", password: "" });
      await enterRoom(room);
    } catch (roomError) {
      console.error("[Firestore] 그룹방 로그인 실패", roomError);
      setAuthMessage(
        roomError instanceof Error
          ? getStorageUserMessage(roomError)
          : "Firebase에서 그룹방 정보를 불러오지 못했습니다."
      );
    }
  }

  function leaveRoom() {
    setActiveRoom(null);
    setPeople([]);
    setAuthView("landing");
    setAuthMessage("");
    resetRoomUi();
  }

  async function submitPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!activeRoom) {
      setError("먼저 그룹방에 입장해 주세요.");
      return;
    }
    if (!form.name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }

    if (!editingId && (!form.birthDate || (!form.birthTimeUnknown && !form.birthTime))) {
      setError("이름, 생년월일, 태어난 시간을 모두 알려주세요.");
      return;
    }
    if (!editingId && !form.privacyConsent) {
      setError("개인정보 활용 안내에 동의해야 후보를 추가하거나 수정할 수 있어요.");
      return;
    }

    const memberPayload = {
      name: form.name.trim(),
      gender: form.gender,
      birthDate: form.birthDate,
      birthTime: form.birthTimeUnknown ? "unknown" : form.birthTime,
      birthTimeUnknown: form.birthTimeUnknown
    };

    try {
      if (editingId) {
        const currentPerson = people.find((person) => person.id === editingId);
        if (!currentPerson) {
          setError("수정할 후보를 찾지 못했습니다.");
          return;
        }

        const savedMember = await updateMember(activeRoom.roomNumber, editingId, {
          name: form.name.trim()
        });

        if (savedMember) {
          setPeople((current) =>
            current.map((person) =>
              person.id === editingId ? savedMember : person
            )
          );
        }
      } else {
        const savedMember = await addMember(activeRoom.roomNumber, {
          ...memberPayload,
          avatarId: getDefaultAvatarId(
            form.gender,
            `${activeRoom.roomNumber}-${form.name.trim()}-${people.length}`
          )
        });

        setPeople((current) =>
          current.some((person) => person.id === savedMember.id)
            ? current
            : [...current, savedMember]
        );
      }

      setForm(emptyForm);
      setEditingId(null);
    } catch (storageError) {
      console.error("[who-is-main-today Firebase] 후보 저장 실패", storageError);
      setError(getStorageUserMessage(storageError));
    }
  }

  function editPerson(person: Person) {
    setForm({
      name: person.name,
      gender: person.gender,
      birthDate: person.birthDate,
      birthTime: person.birthTime === "unknown" ? "" : person.birthTime,
      birthTimeUnknown: Boolean(person.birthTimeUnknown || person.birthTime === "unknown"),
      privacyConsent: false
    });
    setEditingId(person.id);
    setError("");
    document
      .getElementById("person-form")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function deletePerson(id: string) {
    if (!activeRoom) return;

    const previousPeople = people;
    setPeople((current) => current.filter((person) => person.id !== id));
    try {
      await deleteMember(activeRoom.roomNumber, id);
    } catch (storageError) {
      console.error("[who-is-main-today Firebase] 후보 삭제 실패", storageError);
      setPeople(previousPeople);
      setError(getStorageUserMessage(storageError));
    }
    if (editingId === id) {
      setForm(emptyForm);
      setEditingId(null);
    }
  }

  async function selectAvatar(avatarId: string) {
    if (
      !activeRoom ||
      !avatarTarget ||
      !isAvatarIdForGender(avatarId, avatarTarget.gender)
    ) {
      return;
    }

    try {
      const savedMember = await updateMember(activeRoom.roomNumber, avatarTarget.id, {
        avatarId
      });
      if (savedMember) {
        setPeople((current) =>
          current.map((person) =>
            person.id === avatarTarget.id ? savedMember : person
          )
        );
      }
      setAvatarTargetId(null);
    } catch (storageError) {
      console.error("[who-is-main-today Firebase] 캐릭터 저장 실패", storageError);
      setError(getStorageUserMessage(storageError));
    }
  }

  function openPersonFortune(person: Person) {
    setDetail(calculateFortune(person, dateKey));
  }

  function drawWinner() {
    if (people.length < 3) {
      setError("시상대를 채우려면 주인공 후보가 3명 이상 필요해요.");
      return;
    }
    const nextRankings = rankFortunes(people, dateKey);
    setRankings(nextRankings);
    setActiveTab("result");
    setWinner(nextRankings[0]);
    setError("");
    window.setTimeout(() => {
      document
        .getElementById("results")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const shownRankings = rankings.length ? rankings : previewFortunes;

  if (authView === "admin") {
    return (
      <main className="fortune-app min-h-screen overflow-hidden text-[#403653]">
        <div className="magic-orb magic-orb-one" />
        <div className="magic-orb magic-orb-two" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-5 sm:px-6 sm:pt-8 lg:px-8">
          <header className="flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/70 px-5 py-4 shadow-[0_12px_38px_rgba(86,61,120,.08)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-[18px] bg-gradient-to-br from-[#58436f] to-[#9f7bd1] text-white shadow-[0_10px_22px_rgba(86,61,120,.22)]">
                <UsersRound className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black tracking-[.18em] text-[#9b80bd]">
                  ADMIN MODE
                </p>
                <h1 className="text-2xl font-black tracking-[-.04em] text-[#3c2d54]">
                  관리자 모드
                </h1>
                <p className="text-sm font-bold text-[#9a8eaa]">
                  전체 그룹방 관리
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadAdminRooms}
                disabled={adminLoading}
                className="focus-ring min-h-11 rounded-full border border-[#dfd4e8] bg-white px-4 text-sm font-black text-[#715885] transition hover:-translate-y-0.5 hover:bg-[#fbf8ff] disabled:opacity-55"
              >
                새로고침
              </button>
              <button
                type="button"
                onClick={leaveAdminMode}
                className="focus-ring min-h-11 rounded-full bg-[#58436f] px-4 text-sm font-black text-white shadow-[0_10px_22px_rgba(75,52,99,.18)] transition hover:-translate-y-0.5"
              >
                관리자 모드 종료
              </button>
            </div>
          </header>

          {adminError ? (
            <p className="mt-5 rounded-2xl bg-[#fff0f2] px-4 py-3 text-sm font-bold text-[#cb5771]">
              {adminError}
            </p>
          ) : null}

          <section className="mt-7 rounded-[32px] border border-white bg-white/75 p-5 shadow-[0_18px_55px_rgba(91,65,120,.09)] backdrop-blur sm:p-7">
            {adminSelectedRoom ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminSelectedRoom(null);
                        setAdminMembers([]);
                      }}
                      className="focus-ring mb-4 inline-flex min-h-10 items-center rounded-full border border-[#dfd4e8] bg-white px-4 text-sm font-black text-[#715885]"
                    >
                      ← 전체 목록으로
                    </button>
                    <p className="text-xs font-black tracking-[.16em] text-[#9b80bd]">
                      ROOM DETAIL
                    </p>
                    <h2 className="mt-1 text-3xl font-black text-[#403157]">
                      그룹방 {adminSelectedRoom.roomNumber}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-[#9588a4]">
                      멤버 {adminMembers.length}명
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteAdminRoom(adminSelectedRoom)}
                    disabled={adminLoading}
                    className="focus-ring min-h-11 rounded-full bg-[#fff0f2] px-4 text-sm font-black text-[#d75772] transition hover:bg-[#ffe5ea] disabled:opacity-55"
                  >
                    이 그룹방 삭제
                  </button>
                </div>

                {adminMembers.length ? (
                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {adminMembers.map((member) => (
                      <article
                        key={member.id}
                        className="rounded-[24px] border border-[#eee8f4] bg-white p-4 shadow-[0_10px_28px_rgba(91,65,120,.07)]"
                      >
                        <div className="flex items-start gap-3">
                          <Character person={member} size="small" />
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-xl font-black text-[#3f3158]">
                              {member.name}
                            </h3>
                            <div className="mt-2 grid gap-1 text-sm font-bold leading-6 text-[#786c84]">
                              <p>성별: 비공개</p>
                              <p>생년월일: ****-**-**</p>
                              <p>생시: 비공개</p>
                              <p>캐릭터: {member.avatarId ?? "-"}</p>
                              <p>생성일: {formatDateTime(member.createdAt)}</p>
                              <p>수정일: {formatDateTime(member.updatedAt)}</p>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-[26px] border-2 border-dashed border-[#e4d9ec] bg-white/50 p-8 text-center">
                    <p className="text-lg font-black text-[#61536f]">
                      아직 등록된 후보가 없습니다
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#9b90a4]">
                      새 그룹방은 후보가 입력되기 전까지 members 하위 컬렉션이 비어 있습니다.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black tracking-[.16em] text-[#9b80bd]">
                      ALL GROUP ROOMS
                    </p>
                    <h2 className="mt-1 text-3xl font-black text-[#403157]">
                      전체 그룹방 목록
                    </h2>
                  </div>
                  <p className="text-sm font-bold text-[#9588a4]">
                    총 {adminRooms.length}개
                  </p>
                </div>

                {adminLoading && !adminRooms.length ? (
                  <div className="mt-6 rounded-[26px] bg-white/55 p-8 text-center text-sm font-black text-[#7c6f8a]">
                    그룹방 목록을 불러오는 중입니다...
                  </div>
                ) : adminRooms.length ? (
                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {adminRooms.map((room) => (
                      <article
                        key={room.roomNumber}
                        className="rounded-[24px] border border-[#eee8f4] bg-white p-5 shadow-[0_10px_28px_rgba(91,65,120,.07)]"
                      >
                        <div className="flex flex-col gap-4">
                          <div>
                            <p className="text-xs font-black tracking-[.14em] text-[#9b80bd]">
                              GROUP ROOM
                            </p>
                            <h3 className="mt-1 text-2xl font-black text-[#3f3158]">
                              {room.roomNumber}
                            </h3>
                            <div className="mt-3 grid gap-1 text-sm font-bold leading-6 text-[#786c84]">
                              <p>멤버 수: {room.memberCount}명</p>
                              <p>생성일: {formatDateTime(room.createdAt)}</p>
                              <p>수정일: {formatDateTime(room.updatedAt)}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => openAdminRoom(room)}
                              disabled={adminLoading}
                              className="focus-ring min-h-11 rounded-full bg-[#f5efff] px-4 text-sm font-black text-[#7652ad] transition hover:bg-[#efe4ff] disabled:opacity-55"
                            >
                              보기
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteAdminRoom(room)}
                              disabled={adminLoading}
                              className="focus-ring min-h-11 rounded-full bg-[#fff0f2] px-4 text-sm font-black text-[#d75772] transition hover:bg-[#ffe5ea] disabled:opacity-55"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-[26px] border-2 border-dashed border-[#e4d9ec] bg-white/50 p-8 text-center">
                    <p className="text-lg font-black text-[#61536f]">
                      아직 생성된 그룹방이 없습니다
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#9b90a4]">
                      사용자가 그룹방을 만들면 Firestore의 groupRooms 컬렉션에 표시됩니다.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    );
  }

  if (authView !== "room" || !activeRoom) {
    return (
      <main className="fortune-app min-h-screen overflow-hidden text-[#403653]">
        <div className="magic-orb magic-orb-one" />
        <div className="magic-orb magic-orb-two" />
        <div className="relative mx-auto flex min-h-screen max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
          <section className="w-full overflow-hidden rounded-[36px] border border-white/75 bg-white/72 p-5 shadow-[0_24px_70px_rgba(87,60,118,.13)] backdrop-blur-xl sm:p-8 lg:p-10">
            {authView === "landing" ? (
              <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
                <div className="text-center lg:text-left">
                  <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-[#dbcafb] bg-white/80 px-4 py-2 text-xs font-black text-[#7b55b5] shadow-sm lg:mx-0">
                    <Sparkles className="h-4 w-4 text-[#f2aa4b]" />
                    GROUP FORTUNE ROOM
                  </div>
                  <h1 className="text-4xl font-black tracking-[-.05em] text-[#392b50] sm:text-6xl">
                    오늘의
                    <br />
                    <span className="hero-gradient">주인공은?</span>
                  </h1>
                  <p className="mt-5 text-base font-bold leading-8 text-[#766b83]">
                    오늘 가장 빛나는 사람을 뽑아보세요.
                    <br className="hidden sm:block" />
                    우리만의 그룹방에서 후보와 운세를 안전하게 따로 저장해요.
                  </p>
                  <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthView("create");
                        setAuthMessage("");
                      }}
                      className="auth-action-button focus-ring flex min-h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#8a62ca] via-[#ad6fc2] to-[#ec84a9] px-6 text-base font-black text-white shadow-[0_14px_34px_rgba(145,89,181,.3)] transition hover:-translate-y-0.5"
                    >
                      <Plus className="h-5 w-5 shrink-0" />
                      <span className="auth-button-text">
                        <span>내 그룹방</span>
                        <span>개설</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthView("login");
                        setAuthMessage("");
                      }}
                      className="auth-action-button focus-ring flex min-h-14 items-center justify-center gap-2 rounded-full border border-[#dfd4e8] bg-white px-6 text-base font-black text-[#715885] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fbf8ff]"
                    >
                      <UsersRound className="h-5 w-5 shrink-0" />
                      <span className="auth-button-text">
                        <span>기존 그룹방</span>
                        <span>로그인</span>
                      </span>
                    </button>
                  </div>
                </div>
                <div className="relative mx-auto grid w-full max-w-sm place-items-center rounded-[32px] bg-gradient-to-br from-[#fff5c9] via-[#ffeaf2] to-[#eee7ff] p-6 shadow-[0_22px_60px_rgba(142,92,188,.16)]">
                  <div className="absolute left-7 top-7 text-[#ffbc5e]">
                    <Star className="h-6 w-6 fill-current" />
                  </div>
                  <div className="absolute right-8 top-12 text-[#b497e8]">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <div className="rounded-full bg-white/65 p-5">
                    <Crown className="h-28 w-28 fill-[#ffe782] text-[#f0a928] drop-shadow-md" />
                  </div>
                  <p className="mt-5 rounded-full bg-white/75 px-5 py-2 text-sm font-black text-[#7652ad]">
                    우리 방 오늘의 별빛을 찾아요 ✦
                  </p>
                </div>
              </div>
            ) : null}

            {authView === "create" ? (
              <div className="mx-auto max-w-xl">
                <div className="text-center">
                  <p className="text-xs font-black tracking-[.16em] text-[#9b80bd]">
                    CREATE ROOM
                  </p>
                  <h1 className="mt-2 text-3xl font-black text-[#3c2d54] sm:text-4xl">
                    내 그룹방 개설
                  </h1>
                  <p className="mt-2 text-sm font-bold text-[#8f8499]">
                    숫자 방 번호와 비밀번호로 우리만의 운세 방을 만들어요.
                  </p>
                </div>
                <form onSubmit={submitCreateRoom} className="mt-7 space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-[#5a4c6c]">
                      그룹방 번호
                    </span>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={createForm.roomNumber}
                        onInput={(event) => {
                          const roomNumber = normalizeRoomNumber(
                            event.currentTarget.value
                          );
                          setCreateForm((current) => ({
                            ...current,
                            roomNumber
                          }));
                          setRoomCheck({ roomNumber: "", status: "idle" });
                          setAuthMessage("");
                        }}
                        placeholder="예: 1001"
                        className="fortune-input"
                      />
                      <button
                        type="button"
                        onClick={handleRoomAvailabilityCheck}
                        className="focus-ring min-h-14 rounded-full bg-[#58436f] px-5 text-sm font-black text-white shadow-[0_10px_22px_rgba(75,52,99,.18)] transition hover:bg-[#6c4f89]"
                      >
                        중복 확인
                      </button>
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-[#5a4c6c]">
                      비밀번호
                    </span>
                    <input
                      type="password"
                      value={createForm.password}
                      onInput={(event) => {
                        const password = event.currentTarget.value;
                        setCreateForm((current) => ({
                          ...current,
                          password
                        }));
                      }}
                      className="fortune-input"
                      placeholder="비밀번호를 입력해 주세요"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-[#5a4c6c]">
                      비밀번호 재입력
                    </span>
                    <input
                      type="password"
                      value={createForm.passwordConfirm}
                      onInput={(event) => {
                        const passwordConfirm = event.currentTarget.value;
                        setCreateForm((current) => ({
                          ...current,
                          passwordConfirm
                        }));
                      }}
                      className="fortune-input"
                      placeholder="비밀번호를 한 번 더 입력해 주세요"
                    />
                  </label>
                  {authMessage ? (
                    <p
                      className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                        roomCheck.status === "available"
                          ? "bg-[#ecfbf5] text-[#2f9d75]"
                          : "bg-[#fff0f2] text-[#cb5771]"
                      }`}
                    >
                      {authMessage}
                    </p>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthView("landing");
                        setAuthMessage("");
                      }}
                      className="focus-ring min-h-14 rounded-full border border-[#dfd4e8] bg-white px-5 text-sm font-black text-[#715885]"
                    >
                      처음 화면으로 돌아가기
                    </button>
                    <button
                      type="submit"
                      className="focus-ring min-h-14 rounded-full bg-gradient-to-r from-[#8a62ca] to-[#ec84a9] px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(145,89,181,.26)]"
                    >
                      그룹방 만들기
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {authView === "login" ? (
              <div className="mx-auto max-w-xl">
                <div className="text-center">
                  <p className="text-xs font-black tracking-[.16em] text-[#9b80bd]">
                    ENTER ROOM
                  </p>
                  <h1 className="mt-2 text-3xl font-black text-[#3c2d54] sm:text-4xl">
                    기존 그룹방 로그인
                  </h1>
                  <p className="mt-2 text-sm font-bold text-[#8f8499]">
                    방 번호와 비밀번호를 입력하면 저장된 후보 목록을 불러와요.
                  </p>
                </div>
                <form onSubmit={submitLoginRoom} className="mt-7 space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-[#5a4c6c]">
                      그룹방 번호
                    </span>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={loginForm.roomNumber}
                      onInput={(event) => {
                        const roomNumber = normalizeRoomNumber(
                          event.currentTarget.value
                        );
                        setLoginForm((current) => ({
                          ...current,
                          roomNumber
                        }));
                        setAuthMessage("");
                      }}
                      placeholder="예: 1001"
                      className="fortune-input"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-[#5a4c6c]">
                      비밀번호
                    </span>
                    <input
                      type="password"
                      value={loginForm.password}
                      onInput={(event) => {
                        const password = event.currentTarget.value;
                        setLoginForm((current) => ({
                          ...current,
                          password
                        }));
                      }}
                      className="fortune-input"
                      placeholder="비밀번호를 입력해 주세요"
                    />
                  </label>
                  {authMessage ? (
                    <p className="rounded-2xl bg-[#fff0f2] px-4 py-3 text-sm font-bold text-[#cb5771]">
                      {authMessage}
                    </p>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthView("landing");
                        setAuthMessage("");
                      }}
                      className="focus-ring min-h-14 rounded-full border border-[#dfd4e8] bg-white px-5 text-sm font-black text-[#715885]"
                    >
                      처음 화면으로 돌아가기
                    </button>
                    <button
                      type="submit"
                      className="focus-ring min-h-14 rounded-full bg-gradient-to-r from-[#8a62ca] to-[#ec84a9] px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(145,89,181,.26)]"
                    >
                      입장하기
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="fortune-app min-h-screen overflow-hidden text-[#403653]">
      <div className="magic-orb magic-orb-one" />
      <div className="magic-orb magic-orb-two" />
      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <header className="flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/65 px-5 py-4 shadow-[0_12px_38px_rgba(86,61,120,.08)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative grid h-12 w-12 place-items-center rounded-[18px] bg-gradient-to-br from-[#8c66ca] to-[#f18cad] text-white shadow-[0_10px_22px_rgba(138,91,181,.25)]">
              <Crown className="h-7 w-7 fill-[#ffe782] text-[#ffe782]" />
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#ffe77c] ring-2 ring-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-[-.04em] text-[#3c2d54] sm:text-2xl">
                오늘의 주인공은?
              </h1>
              <p className="text-xs font-bold text-[#9a8eaa]">
                별빛이 골라 주는 우리들의 오늘
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 self-start sm:self-auto md:flex-row md:items-center">
            <div className="flex items-center gap-2 rounded-full bg-[#f6f0ff] px-4 py-2 text-xs font-extrabold text-[#7b60a3]">
              <UsersRound className="h-4 w-4" />
              그룹방 {activeRoom.roomNumber}번
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[#fff6df] px-4 py-2 text-xs font-extrabold text-[#8c651a]">
              <CalendarDays className="h-4 w-4" />
              {formatKoreanDate(dateKey)}
            </div>
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-extrabold ${
                storageMode === "firestore"
                  ? "bg-[#e9fff3] text-[#21724a]"
                  : storageMode === "local"
                    ? "bg-[#fff0f2] text-[#b4435d]"
                    : "bg-[#edf3ff] text-[#4c63a8]"
              }`}
              title={storageNotice}
            >
              <Sparkles className="h-4 w-4" />
              {storageMode === "firestore"
                ? "서버 저장 모드"
                : storageMode === "local"
                  ? "임시 저장 모드"
                  : "저장소 확인 중"}
            </div>
            <button
              type="button"
              onClick={leaveRoom}
              className="focus-ring rounded-full border border-[#dfd4e8] bg-white px-4 py-2 text-xs font-black text-[#715885] transition hover:-translate-y-0.5 hover:bg-[#fbf8ff]"
            >
              방 나가기
            </button>
          </div>
        </header>

        {storageNotice ? (
          <p
            className={`mt-3 rounded-2xl px-4 py-3 text-sm font-bold shadow-sm ${
              storageMode === "local"
                ? "bg-[#fff0f2] text-[#b4435d]"
                : "bg-white/70 text-[#75698c]"
            }`}
          >
            {storageNotice}
          </p>
        ) : null}

        <section className="px-2 pb-9 pt-12 text-center sm:pb-12 sm:pt-16">
          <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-[#dbcafb] bg-white/75 px-4 py-2 text-xs font-black text-[#7b55b5] shadow-sm">
            <Sparkles className="h-4 w-4 text-[#f2aa4b]" />
            오늘 가장 반짝일 한 사람
          </div>
          <h2 className="mx-auto max-w-3xl text-4xl font-black leading-[1.18] tracking-[-.05em] text-[#392b50] sm:text-6xl">
            오늘, 우리 중 누가
            <br />
            <span className="hero-gradient">가장 빛날까요?</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm font-medium leading-7 text-[#766b83] sm:text-base">
            생년월일과 태어난 시간에 오늘의 별빛을 더해
            <br className="hidden sm:block" /> 가장 좋은 기운을 가진 주인공을
            찾아드려요.
          </p>
        </section>

        <nav className="mx-auto mb-6 flex max-w-md rounded-full border border-white bg-white/70 p-1.5 shadow-[0_10px_30px_rgba(91,65,120,.09)] backdrop-blur">
          <button
            type="button"
            onClick={() => setActiveTab("input")}
            className={`focus-ring flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-black transition ${
              activeTab === "input"
                ? "bg-[#544268] text-white shadow-md"
                : "text-[#8c809a] hover:bg-white"
            }`}
          >
            <UsersRound className="h-4 w-4" />
            후보 입력
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("result")}
            className={`focus-ring flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-black transition ${
              activeTab === "result"
                ? "bg-[#544268] text-white shadow-md"
                : "text-[#8c809a] hover:bg-white"
            }`}
          >
            <Trophy className="h-4 w-4" />
            오늘의 결과
          </button>
        </nav>

        {activeTab === "input" ? (
          <div className="grid gap-6 lg:grid-cols-[.88fr_1.12fr]">
            <section
              id="person-form"
              className="relative overflow-hidden rounded-[32px] border border-white bg-white/85 p-5 shadow-[0_18px_55px_rgba(91,65,120,.11)] backdrop-blur sm:p-7"
            >
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#eee3ff]/70" />
              <div className="relative">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f0e7ff] text-[#825bbd]">
                  {editingId ? (
                    <Edit3 className="h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </span>
                <h3 className="mt-4 text-2xl font-black text-[#403157]">
                  {editingId ? "후보 정보 수정" : "새 후보 등록"}
                </h3>
                <p className="mt-1 text-sm font-medium text-[#91869f]">
                  {editingId
                    ? "개인정보 보호를 위해 이름만 수정할 수 있어요."
                    : "생년월일과 태어난 시간은 운세 계산에만 사용돼요."}
                </p>
              </div>

              <form onSubmit={submitPerson} className="relative mt-7 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-[#5a4c6c]">
                    이름
                  </span>
                  <span className="relative block">
                    <UserRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a89ab8]" />
                    <input
                      value={form.name}
                      onInput={(event) => {
                        const name = event.currentTarget.value;
                        setForm({ ...form, name });
                      }}
                      placeholder="이름을 입력해 주세요"
                      maxLength={20}
                      className="fortune-input pl-11"
                    />
                  </span>
                </label>

                {!editingId ? (
                  <>
                    <fieldset>
                      <legend className="mb-2 text-sm font-black text-[#5a4c6c]">
                        성별
                      </legend>
                      <div className="grid grid-cols-2 gap-3">
                        {(
                          [
                            ["female", "여성", "🌸"],
                            ["male", "남성", "🌿"]
                          ] as const
                        ).map(([value, label, emoji]) => (
                          <label
                            key={value}
                            className={`focus-within:ring-2 focus-within:ring-[#b996e7] flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border text-sm font-black transition ${
                              form.gender === value
                                ? "border-[#a77bdc] bg-[#f4edff] text-[#7045a8]"
                                : "border-[#ebe5ef] bg-white text-[#81768d] hover:border-[#d6c4e8]"
                            }`}
                          >
                            <input
                              type="radio"
                              name="gender"
                              value={value}
                              checked={form.gender === value}
                              onChange={() => setForm({ ...form, gender: value })}
                              className="sr-only"
                            />
                            <span>{emoji}</span>
                            {label}
                            {form.gender === value ? (
                              <Check className="h-4 w-4" />
                            ) : null}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div className="grid gap-4">
                      <BirthDatePicker
                        value={form.birthDate}
                        maxDate={dateKey}
                        onChange={(birthDate) =>
                          setForm((current) => ({ ...current, birthDate }))
                        }
                      />
                      <BirthTimePicker
                        value={form.birthTime}
                        unknown={form.birthTimeUnknown}
                        onUnknownChange={(birthTimeUnknown) =>
                          setForm((current) => ({
                            ...current,
                            birthTimeUnknown
                          }))
                        }
                        onChange={(birthTime) =>
                          setForm((current) => ({
                            ...current,
                            birthTime,
                            birthTimeUnknown: false
                          }))
                        }
                      />
                    </div>
                  </>
                ) : null}

                {error ? (
                  <p className="rounded-2xl bg-[#fff0f2] px-4 py-3 text-sm font-bold text-[#cb5771]">
                    {error}
                  </p>
                ) : null}

                {!editingId ? (
                  <label className="privacy-consent-card focus-within:ring-2 focus-within:ring-[#b996e7]">
                    <input
                      type="checkbox"
                      checked={form.privacyConsent}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          privacyConsent: event.currentTarget.checked
                        }))
                      }
                    />
                    <span>
                      입력한 정보는 ‘오늘의 주인공은?’ 앱의 운세 계산과 그룹방
                      공유 기능에만 사용되며, 생년월일과 태어난 시간은 후보 생성
                      후 화면에 표시되지 않습니다.
                    </span>
                  </label>
                ) : null}

                <div className="flex gap-3">
                  {editingId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setForm(emptyForm);
                        setError("");
                      }}
                      className="focus-ring min-h-12 rounded-full border border-[#ddd3e5] px-5 text-sm font-black text-[#776b84] transition hover:bg-[#f8f5fa]"
                    >
                      취소
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={!editingId && !form.privacyConsent}
                    className="focus-ring flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#58436f] px-6 text-sm font-black text-white shadow-[0_12px_25px_rgba(75,52,99,.22)] transition hover:-translate-y-0.5 hover:bg-[#6c4f89] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {editingId ? (
                      <>
                        <Check className="h-4 w-4" /> 수정 완료
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" /> 후보 추가하기
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-[32px] border border-white bg-white/60 p-5 shadow-[0_18px_55px_rgba(91,65,120,.08)] backdrop-blur sm:p-7">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black tracking-[.16em] text-[#9b80bd]">
                    CANDIDATES
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-[#403157]">
                    오늘의 후보들
                    <span className="ml-2 text-[#9b75cf]">{people.length}</span>
                  </h3>
                </div>
                <span className="text-xs font-bold text-[#a195ac]">
                  최소 3명
                </span>
              </div>

              {people.length ? (
                <div className="mt-5 grid gap-3">
                  {people.map((person) => (
                    <PersonCard
                      key={person.id}
                      person={person}
                      onEdit={() => editPerson(person)}
                      onDelete={() => void deletePerson(person.id)}
                      onFortune={() => openPersonFortune(person)}
                      onAvatarSelect={() => setAvatarTargetId(person.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-5 grid min-h-72 place-items-center rounded-[26px] border-2 border-dashed border-[#e4d9ec] bg-white/45 p-8 text-center">
                  <div>
                    <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#f5effb]">
                      <UsersRound className="h-9 w-9 text-[#b79bce]" />
                    </div>
                    <p className="mt-4 font-black text-[#61536f]">
                      아직 등록된 후보가 없어요
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#9b90a4]">
                      왼쪽에서 첫 번째 주인공 후보를 추가해 주세요.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={drawWinner}
                disabled={people.length < 3}
                className="focus-ring mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#8a62ca] via-[#ad6fc2] to-[#ec84a9] px-6 text-base font-black text-white shadow-[0_14px_34px_rgba(145,89,181,.3)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:grayscale-[.25] disabled:opacity-50"
              >
                <Crown className="h-5 w-5 fill-[#ffe885] text-[#ffe885]" />
                오늘의 주인공 뽑기
                <Sparkles className="h-5 w-5" />
              </button>
              {people.length > 0 && people.length < 3 ? (
                <p className="mt-3 text-center text-xs font-bold text-[#9a8da5]">
                  {3 - people.length}명만 더 추가하면 시상대를 열 수 있어요!
                </p>
              ) : null}
            </section>
          </div>
        ) : (
          <section
            id="results"
            className="relative overflow-hidden rounded-[36px] border border-white bg-white/70 px-4 pb-0 pt-8 shadow-[0_24px_70px_rgba(87,60,118,.13)] backdrop-blur sm:px-8 sm:pt-10"
          >
            {rankings.length ? (
              <>
                <div className="confetti" aria-hidden="true">
                  {Array.from({ length: 18 }).map((_, index) => (
                    <i key={index} style={{ "--i": index } as React.CSSProperties} />
                  ))}
                </div>
                <div className="relative z-10 text-center">
                  <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-[#fff5ce] px-4 py-2 text-xs font-black text-[#a16b12]">
                    <Medal className="h-4 w-4" />
                    오늘의 별빛 시상식
                  </div>
                  <h3 className="mt-4 text-3xl font-black tracking-[-.04em] text-[#3b2d51] sm:text-4xl">
                    주인공이 탄생했어요!
                  </h3>
                  <p className="mt-2 text-sm font-medium text-[#8a7e94]">
                    {formatKoreanDate(dateKey)}의 기운을 모아 뽑은 결과예요.
                  </p>
                </div>
                <div className="relative z-10 mt-12 flex flex-col items-stretch gap-8 md:flex-row md:items-end md:gap-3">
                  {shownRankings.slice(0, 3).map((fortune, index) => (
                    <PodiumCard
                      key={fortune.person.id}
                      fortune={fortune}
                      rank={(index + 1) as 1 | 2 | 3}
                      onDetail={() => setDetail(fortune)}
                    />
                  ))}
                </div>
                {shownRankings.length > 3 ? (
                  <section className="relative z-10 mt-10 rounded-[30px] border border-white/80 bg-white/60 p-4 shadow-[0_16px_45px_rgba(91,65,120,.08)] sm:p-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-black tracking-[.16em] text-[#9b80bd]">
                          FULL RANKING
                        </p>
                        <h4 className="mt-1 text-2xl font-black text-[#403157]">
                          4위부터 전체 순위
                        </h4>
                      </div>
                      <p className="text-sm font-bold text-[#9588a4]">
                        이름이나 버튼을 누르면 상세 운세를 볼 수 있어요.
                      </p>
                    </div>
                    <div className="mt-5 grid gap-3">
                      {shownRankings.slice(3).map((fortune, index) => (
                        <RankingListItem
                          key={fortune.person.id}
                          fortune={fortune}
                          rank={index + 4}
                          onDetail={() => setDetail(fortune)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
                <div className="-mx-4 mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/80 bg-white/55 px-5 py-5 sm:-mx-8 sm:flex-row sm:px-8">
                  <p className="text-xs font-bold text-[#93879f]">
                    같은 사람과 같은 날짜에는 언제나 같은 결과가 나와요.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("input")}
                    className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-[#dfd4e8] bg-white px-5 text-sm font-black text-[#715885] transition hover:-translate-y-0.5"
                  >
                    <RotateCcw className="h-4 w-4" />
                    후보 목록으로
                  </button>
                </div>
              </>
            ) : (
              <div className="grid min-h-[520px] place-items-center px-5 py-14 text-center">
                <div>
                  <div className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-[#f1e8ff] to-[#fff0c9]">
                    <Trophy className="h-12 w-12 text-[#a484c7]" />
                  </div>
                  <h3 className="mt-6 text-2xl font-black text-[#48385e]">
                    아직 오늘의 시상식 전이에요
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#8f8499]">
                    후보를 3명 이상 등록하고
                    <br />
                    오늘의 주인공을 뽑아 보세요.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("input")}
                    className="focus-ring mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#5a466f] px-6 text-sm font-black text-white"
                  >
                    후보 입력하러 가기
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <footer className="relative border-t border-white/60 bg-white/35 py-6 text-center text-xs font-bold text-[#9e92a7] backdrop-blur">
        별빛은 재미로, 오늘의 선택은 나답게 ✦
      </footer>

      <WinnerModal
        fortune={winner}
        onClose={() => setWinner(null)}
        onDetail={() => {
          setDetail(winner);
          setWinner(null);
        }}
      />
      <AvatarPickerModal
        person={avatarTarget}
        onClose={() => setAvatarTargetId(null)}
        onSelect={selectAvatar}
      />
      <FortuneDetail fortune={detail} onClose={() => setDetail(null)} />
    </main>
  );
}
