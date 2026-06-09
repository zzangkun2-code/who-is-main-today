"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, HelpCircle, KeyRound, MapPinned, Sparkles } from "lucide-react";
import { ActivityReportManager } from "@/components/activity/ActivityReportManager";
import { ScheduleCalendar } from "@/components/calendar/ScheduleCalendar";
import { ScheduleFormModal } from "@/components/calendar/ScheduleFormModal";
import { SchoolInfoEditor } from "@/components/dashboard/SchoolInfoEditor";
import { SchoolTabs } from "@/components/dashboard/SchoolTabs";
import { FaqViewerModal } from "@/components/faq/FaqViewerModal";
import { PasswordChangeModal } from "@/components/PasswordChangeModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StaticCard } from "@/components/ui/Card";
import { BUSINESS_OPTIONS, BUSINESS_TABS, PROGRAMS } from "@/lib/constants";
import { deleteSchedule, subscribeSchedules, upsertSchedule } from "@/lib/firestore";
import type { CalendarDraft, ProgramType, ScheduleItem, SchoolProfile } from "@/lib/types";

export function UserDashboard({ profile }: { profile: SchoolProfile }) {
  const tabs = useMemo(() => BUSINESS_TABS[profile.businessType], [profile.businessType]);
  const [activeTab, setActiveTab] = useState<ProgramType>(tabs[0]);
  const [view, setView] = useState<"calendar" | "activity">("calendar");
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [draft, setDraft] = useState<CalendarDraft | null>(null);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(Boolean(profile.isFirstLogin || profile.mustChangePassword));
  const [faqOpen, setFaqOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tabs.includes(activeTab)) {
      setActiveTab(tabs[0]);
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    if (profile.isFirstLogin || profile.mustChangePassword) {
      setPasswordOpen(true);
    }
  }, [profile.isFirstLogin, profile.mustChangePassword]);

  useEffect(() => {
    const unsubscribe = subscribeSchedules(profile.uid, setSchedules, (scheduleError) =>
      setError(scheduleError.message)
    );
    return unsubscribe;
  }, [profile.uid]);

  const filteredSchedules = schedules.filter((item) => item.type === activeTab);
  const businessLabel =
    BUSINESS_OPTIONS.find((option) => option.value === profile.businessType)?.label ??
    profile.businessType;

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <StaticCard className="p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-peach-100 text-peach-700">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-ink-900 sm:text-3xl">
                  {profile.schoolName}
                </h1>
                <Badge tone="blue">{businessLabel}</Badge>
                <Badge tone="mint">{profile.schoolId}</Badge>
                <Badge tone="peach">{profile.year}년 · {profile.schoolLevel}</Badge>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {profile.partnerInfo || "교류국/교류학교를 입력해 주세요."}
              </p>
              <p className="mt-1 text-sm font-extrabold text-mint-700">
                {profile.theme || "운영주제를 입력해 주세요."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<KeyRound className="h-4 w-4" />}
              onClick={() => setPasswordOpen(true)}
            >
              비밀번호 변경
            </Button>
            <Button
              variant="secondary"
              icon={<HelpCircle className="h-4 w-4" />}
              onClick={() => setFaqOpen(true)}
            >
              FAQ
            </Button>
            <Button
              variant={view === "activity" ? "primary" : "secondary"}
              icon={<FileText className="h-4 w-4" />}
              onClick={() => setView("activity")}
            >
              활동 기록 제출
            </Button>
          </div>
        </div>
      </StaticCard>

      {profile.isFirstLogin || profile.mustChangePassword ? (
        <div className="rounded-card border border-peach-200 bg-peach-50 px-4 py-3 text-sm font-extrabold text-peach-700 shadow-soft">
          초기 비밀번호 상태입니다. 비밀번호 변경 후 서비스를 이용해 주세요.
        </div>
      ) : null}

      <SchoolInfoEditor profile={profile} />

      <StaticCard className="p-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <SchoolTabs
            tabs={tabs}
            active={activeTab}
            onChange={(nextTab) => {
              setActiveTab(nextTab);
              setView("calendar");
            }}
          />
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Badge key={tab} tone={schedules.some((item) => item.type === tab) ? "mint" : "peach"}>
                <MapPinned className="h-3.5 w-3.5" />
                {PROGRAMS[tab].label} {schedules.filter((item) => item.type === tab).length}
              </Badge>
            ))}
          </div>
        </div>
      </StaticCard>

      {error ? (
        <div className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {view === "activity" ? (
        <ActivityReportManager
          profile={profile}
          type={activeTab}
          onBack={() => setView("calendar")}
        />
      ) : (
        <ScheduleCalendar
          type={activeTab}
          schedules={filteredSchedules}
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

      <ScheduleFormModal
        draft={draft}
        editingItem={editingItem}
        profile={profile}
        onClose={() => {
          setDraft(null);
          setEditingItem(null);
        }}
        onSave={async (item) => {
          await upsertSchedule(profile.uid, item);
        }}
        onDelete={(item) => (item.id ? deleteSchedule(profile.uid, item.id) : Promise.resolve())}
      />
      <PasswordChangeModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        force={Boolean(profile.isFirstLogin || profile.mustChangePassword)}
      />
      <FaqViewerModal open={faqOpen} onClose={() => setFaqOpen(false)} />
    </div>
  );
}
