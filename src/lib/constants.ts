import {
  BookOpenCheck,
  Globe2,
  HeartHandshake,
  PlaneTakeoff,
  School,
  UsersRound
} from "lucide-react";
import type { BusinessType, ProgramType } from "@/lib/types";

export const EXCHANGE_EMAIL_DOMAIN = "@exchange.jbe.kr";

export const BUSINESS_OPTIONS: Array<{
  value: BusinessType;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: "A",
    label: "A: 온라인수업",
    shortLabel: "온라인",
    description: "온라인수업만 진행"
  },
  {
    value: "B",
    label: "B: 해외현장체험학습",
    shortLabel: "온라인+체험",
    description: "온라인수업 + 해외현장체험학습"
  },
  {
    value: "C",
    label: "C: 초청",
    shortLabel: "온라인+초청",
    description: "온라인수업 + 초청수업"
  },
  {
    value: "D",
    label: "D: 통합형",
    shortLabel: "통합형",
    description: "온라인수업 + 해외현장체험학습 + 초청수업"
  }
];

export const PROGRAMS: Record<
  ProgramType,
  {
    label: string;
    navLabel: string;
    icon: typeof Globe2;
    color: string;
    bg: string;
    chip: string;
    eventColor: string;
  }
> = {
  online: {
    label: "온라인수업",
    navLabel: "온라인수업",
    icon: BookOpenCheck,
    color: "text-skysoft-700",
    bg: "bg-skysoft-50",
    chip: "bg-skysoft-100 text-skysoft-700",
    eventColor: "#AED9E0"
  },
  fieldTrip: {
    label: "해외현장체험학습",
    navLabel: "해외현장체험학습",
    icon: PlaneTakeoff,
    color: "text-mint-700",
    bg: "bg-mint-50",
    chip: "bg-mint-100 text-mint-700",
    eventColor: "#42c7a6"
  },
  invitation: {
    label: "초청수업",
    navLabel: "초청수업",
    icon: HeartHandshake,
    color: "text-pinkwarm-700",
    bg: "bg-pinkwarm-50",
    chip: "bg-pinkwarm-100 text-pinkwarm-700",
    eventColor: "#ef6fa5"
  }
};

export const BUSINESS_TABS: Record<BusinessType, ProgramType[]> = {
  A: ["online"],
  B: ["online", "fieldTrip"],
  C: ["online", "invitation"],
  D: ["online", "fieldTrip", "invitation"]
};

export const ROLE_CARDS = [
  {
    role: "admin" as const,
    title: "교육청",
    subtitle: "전체 학교 현황 보기",
    icon: School,
    className: "from-skysoft-100 to-mint-100 text-skysoft-700"
  },
  {
    role: "school" as const,
    title: "참여학교",
    subtitle: "일정과 활동 기록 제출",
    icon: UsersRound,
    className: "from-pinkwarm-100 to-peach-100 text-pinkwarm-700"
  }
];

export const PROGRAM_ORDER: ProgramType[] = ["online", "fieldTrip", "invitation"];
