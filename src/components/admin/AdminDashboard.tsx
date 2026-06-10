"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Download,
  HelpCircle,
  KeyRound,
  Link as LinkIcon,
  ListChecks
} from "lucide-react";
import { AdminCalendar } from "@/components/admin/AdminCalendar";
import { AdminStats } from "@/components/admin/AdminStats";
import { FaqManager } from "@/components/admin/FaqManager";
import { SchoolAccountManager } from "@/components/admin/SchoolAccountManager";
import { SchoolCard } from "@/components/admin/SchoolCard";
import { ScheduleCalendar } from "@/components/calendar/ScheduleCalendar";
import { ScheduleFormModal } from "@/components/calendar/ScheduleFormModal";
import { SchoolTabs } from "@/components/dashboard/SchoolTabs";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StaticCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { VideoLinkManager } from "@/components/video/VideoLinkManager";
import { BUSINESS_TABS, PROGRAMS } from "@/lib/constants";
import { downloadSchoolStatsCsv } from "@/lib/csv";
import {
  deleteSchedule,
  subscribeAllSchedules,
  subscribeSchools,
  upsertSchedule
} from "@/lib/firestore";
import type {
  CalendarDraft,
  ProgramType,
  ScheduleItem,
  SchoolProfile
} from "@/lib/types";

type AdminView = "stats" | "schools" | "calendar" | "accounts" | "faq";
type DetailView = "schedule" | "video";

export function AdminDashboard() {
  const [schools, setSchools] = useState<SchoolProfile[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [view, setView] = useState<AdminView>("stats");
  const [detailView, setDetailView] = useState<DetailView>("schedule");
  const [activeTab, setActiveTab] = useState<ProgramType>("online");
  const [draft, setDraft] = useState<CalendarDraft | null>(null);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSchools(setSchools, (schoolError) => setError(schoolError.message));
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAllSchedules(setSchedules, (scheduleError) =>
      setError(scheduleError.message)
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedUid && schools.length) {
      setSelectedUid(schools[0].uid);
    }
  }, [schools, selectedUid]);

  const selectedSchool = useMemo(
    () => schools.find((school) => school.uid === selectedUid) ?? null,
    [schools, selectedUid]
  );

  const selectedTabs: ProgramType[] = selectedSchool
    ? BUSINESS_TABS[selectedSchool.businessType]
    : ["online"];
  const selectedSchedules = schedules.filter((item) => item.ownerUid === selectedUid);
  const selectedTabSchedules = selectedSchedules.filter((item) => item.type === activeTab);

  useEffect(() => {
    if (selectedSchool && !BUSINESS_TABS[selectedSchool.businessType].includes(activeTab)) {
      setActiveTab(BUSINESS_TABS[selectedSchool.businessType][0]);
    }
  }, [activeTab, selectedSchool]);

  const missingCount = schools.reduce((count, school) => {
    const tabs = BUSINESS_TABS[school.businessType];
    return (
      count +
      tabs.filter((tab) => !schedules.some((item) => item.ownerUid === school.uid && item.type === tab))
        .length
    );
  }, 0);

  const videoLinkCount = schools.reduce(
    (count, school) =>
      count +
      Object.values(school.videoLinks ?? {}).reduce(
        (linkCount, links) => linkCount + (links?.filter(Boolean).length ?? 0),
        0
      ),
    0
  );

  const navButtons = [
    { view: "stats" as const, label: "통계", icon: BarChart3 },
    { view: "schools" as const, label: "학교 관리", icon: ListChecks },
    { view: "calendar" as const, label: "전체 캘린더", icon: CalendarDays },
    { view: "accounts" as const, label: "계정 발급", icon: KeyRound },
    { view: "faq" as const, label: "FAQ 관리", icon: HelpCircle }
  ];

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <StaticCard className="p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <img
              src="/logo.png"
              alt="앱 로고"
              className="h-auto max-h-24 w-full max-w-md rounded-card bg-white object-contain px-3 py-2 shadow-soft"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">학교 {schools.length}</Badge>
                <Badge tone="mint">일정 {schedules.length}</Badge>
                <Badge tone="peach">영상 링크 {videoLinkCount}</Badge>
                <Badge tone={missingCount ? "danger" : "peach"}>미입력 {missingCount}</Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {navButtons.map((button) => {
              const Icon = button.icon;
              return (
                <Button
                  key={button.view}
                  variant={view === button.view ? "primary" : "secondary"}
                  icon={<Icon className="h-4 w-4" />}
                  onClick={() => setView(button.view)}
                >
                  {button.label}
                </Button>
              );
            })}
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={() => downloadSchoolStatsCsv(schools, schedules)}
            >
              CSV 다운로드
            </Button>
          </div>
        </div>
      </StaticCard>

      {error ? (
        <div className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {view === "stats" ? <AdminStats schools={schools} schedules={schedules} /> : null}
      {view === "calendar" ? <AdminCalendar schedules={schedules} /> : null}
      {view === "accounts" ? <SchoolAccountManager schools={schools} /> : null}
      {view === "faq" ? <FaqManager /> : null}

      {view === "schools" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid content-start gap-3">
            {schools.length ? (
              schools.map((school) => (
                <SchoolCard
                  key={school.uid}
                  school={school}
                  schedules={schedules.filter((item) => item.ownerUid === school.uid)}
                  selected={selectedUid === school.uid}
                  onClick={() => {
                    setSelectedUid(school.uid);
                    setDetailView("schedule");
                  }}
                />
              ))
            ) : (
              <EmptyState title="등록된 참여학교가 없습니다" />
            )}
          </div>

          {selectedSchool ? (
            <div className="grid content-start gap-4">
              <StaticCard className="p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm font-extrabold text-skysoft-700">선택한 학교</p>
                    <h2 className="text-xl font-black text-ink-900">{selectedSchool.schoolName}</h2>
                    <p className="mt-2 text-sm font-bold text-slate-500">
                      {selectedSchool.schoolId} · {selectedSchool.year}년 · {selectedSchool.schoolLevel}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {selectedSchool.partnerInfo || "교류국/교류학교 미입력"}
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-mint-700">
                      {selectedSchool.theme || "운영주제 미입력"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={detailView === "video" ? "primary" : "secondary"}
                      icon={<LinkIcon className="h-4 w-4" />}
                      onClick={() => setDetailView("video")}
                    >
                      수업 영상 링크
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedTabs.map((tab) => {
                    const complete = selectedSchedules.some((item) => item.type === tab);
                    return (
                      <StatusBadge key={tab} complete={complete}>
                        {PROGRAMS[tab].label} {complete ? "입력" : "미입력"}
                      </StatusBadge>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <SchoolTabs
                    tabs={selectedTabs}
                    active={activeTab}
                    onChange={(nextTab) => {
                      setActiveTab(nextTab);
                      setDetailView("schedule");
                    }}
                  />
                </div>
              </StaticCard>

              {detailView === "video" ? (
                <VideoLinkManager
                  profile={selectedSchool}
                  type={activeTab}
                  onBack={() => setDetailView("schedule")}
                  readOnly
                />
              ) : (
                <ScheduleCalendar
                  type={activeTab}
                  schedules={selectedTabSchedules}
                  onCreate={(nextDraft) => {
                    setEditingItem(null);
                    setDraft(nextDraft);
                  }}
                  onEdit={(item) => {
                    setDraft(null);
                    setEditingItem(item);
                  }}
                />
              )}
            </div>
          ) : (
            <EmptyState title="학교를 선택해 주세요" />
          )}
        </div>
      ) : null}

      {selectedSchool ? (
        <>
          <ScheduleFormModal
            draft={draft}
            editingItem={editingItem}
            profile={selectedSchool}
            onClose={() => {
              setDraft(null);
              setEditingItem(null);
            }}
            onSave={async (item) => {
              await upsertSchedule(selectedSchool.uid, item);
            }}
            onDelete={(item) =>
              item.id ? deleteSchedule(selectedSchool.uid, item.id) : Promise.resolve()
            }
          />
        </>
      ) : null}
    </div>
  );
}
