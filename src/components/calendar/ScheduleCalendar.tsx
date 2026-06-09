"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { DateSelectArg, EventClickArg, EventInput } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import koLocale from "@fullcalendar/core/locales/ko";
import { Plus } from "lucide-react";
import { ScheduleDetailModal } from "@/components/calendar/ScheduleDetailModal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PROGRAMS } from "@/lib/constants";
import type { CalendarDraft, ProgramType, ScheduleItem } from "@/lib/types";
import { addDays } from "@/lib/utils";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), {
  ssr: false
});

function buildEvents(schedules: ScheduleItem[]): EventInput[] {
  return schedules.map((item) => {
    const program = PROGRAMS[item.type];
    const allDay = item.type !== "online";
    return {
      id: item.id,
      title: item.schoolName,
      start: item.start,
      end: allDay ? addDays(item.end, 1) : item.start,
      allDay,
      backgroundColor: program.eventColor,
      borderColor: program.eventColor,
      textColor: item.type === "online" ? "#172033" : "#ffffff",
      extendedProps: { item }
    };
  });
}

export function ScheduleCalendar({
  type,
  schedules,
  onCreate,
  onEdit
}: {
  type: ProgramType;
  schedules: ScheduleItem[];
  onCreate: (draft: CalendarDraft) => void;
  onEdit: (item: ScheduleItem) => void;
}) {
  const program = PROGRAMS[type];
  const Icon = program.icon;
  const [detailItem, setDetailItem] = useState<ScheduleItem | null>(null);

  return (
    <section className="grid gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-full ${program.chip}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-ink-900">{program.label}</h2>
            <p className="text-sm font-bold text-slate-500">
              날짜를 선택해 일정을 입력하고, 등록된 일정은 클릭해서 상세 정보를 확인하세요.
            </p>
          </div>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() =>
            onCreate({
              type,
              start: new Date().toISOString().slice(0, 10),
              end: new Date().toISOString().slice(0, 10)
            })
          }
        >
          일정 추가
        </Button>
      </div>

      <div className="rounded-card border border-white/80 bg-white/80 p-3 shadow-soft">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={koLocale}
          height="auto"
          selectable
          dayMaxEvents
          events={buildEvents(schedules)}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek"
          }}
          buttonText={{
            today: "오늘",
            month: "월",
            week: "주"
          }}
          dateClick={(info: DateClickArg) =>
            onCreate({ type, start: info.dateStr, end: info.dateStr })
          }
          select={(info: DateSelectArg) => {
            const start = info.startStr.slice(0, 10);
            const rawEnd = info.endStr ? info.endStr.slice(0, 10) : start;
            const inclusiveEnd = rawEnd > start ? addDays(rawEnd, -1) : start;
            onCreate({
              type,
              start,
              end: type === "online" ? start : inclusiveEnd
            });
          }}
          eventClick={(info: EventClickArg) => {
            setDetailItem(info.event.extendedProps.item as ScheduleItem);
          }}
        />
      </div>

      {schedules.length === 0 ? (
        <EmptyState title="아직 등록된 일정이 없습니다">
          <span>{program.label} 날짜를 선택해 첫 일정을 저장해 보세요.</span>
        </EmptyState>
      ) : null}

      <ScheduleDetailModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onEdit={(item) => {
          setDetailItem(null);
          onEdit(item);
        }}
      />
    </section>
  );
}
