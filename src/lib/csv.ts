import { BUSINESS_OPTIONS, PROGRAMS, PROGRAM_ORDER } from "@/lib/constants";
import { countriesToText, normalizeCountries } from "@/lib/country-data";
import type { CountrySelection, ScheduleItem, SchoolProfile } from "@/lib/types";

function escapeCsv(value: string | number) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function getScheduleCountries(item: ScheduleItem): CountrySelection[] {
  const payload = item.payload as unknown as Record<string, unknown>;
  const countries = normalizeCountries(payload.countries);
  if (countries.length) return countries;

  const legacyCountry = normalizeCountries(payload.country);
  if (legacyCountry.length) return legacyCountry;

  return normalizeCountries(payload.invitedCountry);
}

export function downloadSchoolStatsCsv(schools: SchoolProfile[], schedules: ScheduleItem[]) {
  const headers = [
    "학교ID",
    "학교명",
    "이메일",
    "연도",
    "학교급",
    "교류국 및 교류학교",
    "운영주제",
    "사업 유형",
    "교류국가",
    "온라인수업 활동 기록",
    "해외현장체험학습 활동 기록",
    "초청수업 활동 기록",
    "온라인수업 일정 수",
    "해외현장체험학습 일정 수",
    "초청수업 일정 수",
    "최근 일정일"
  ];

  const rows = schools.map((school) => {
    const owned = schedules.filter((item) => item.ownerUid === school.uid);
    const countries = owned.flatMap(getScheduleCountries);
    const counts = PROGRAM_ORDER.map(
      (program) => owned.filter((item) => item.type === program).length
    );
    const latest = owned.length
      ? [...owned].sort((a, b) => b.start.localeCompare(a.start))[0].start
      : "";
    const businessLabel =
      BUSINESS_OPTIONS.find((option) => option.value === school.businessType)?.label ??
      school.businessType;

    return [
      school.schoolId,
      school.schoolName,
      school.email,
      school.year,
      school.schoolLevel,
      school.partnerInfo,
      school.theme,
      businessLabel,
      countriesToText(countries),
      school.activityReports?.online?.content ?? "",
      school.activityReports?.fieldTrip?.content ?? "",
      school.activityReports?.invitation?.content ?? "",
      ...counts,
      latest
    ];
  });

  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `international-exchange-stats-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getScheduleTitle(item: ScheduleItem) {
  return `${item.schoolName} · ${PROGRAMS[item.type].label}`;
}
