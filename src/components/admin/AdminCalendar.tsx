"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import koLocale from "@fullcalendar/core/locales/ko";
import { ScheduleDetailModal } from "@/components/calendar/ScheduleDetailModal";
import { PROGRAMS } from "@/lib/constants";
import type { ScheduleItem } from "@/lib/types";
import { addDays } from "@/lib/utils";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), {
  ssr: false
});

function buildEvents(schedules: ScheduleItem[]): EventInput[] {
  return schedules.map((item) => {
    const program = PROGRAMS[item.type];
    const allDay = item.type !== "online";
    return {
      id: `${item.ownerUid}-${item.id}`,
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

export function AdminCalendar({ schedules }: { schedules: ScheduleItem[] }) {
  const [detailItem, setDetailItem] = useState<ScheduleItem | null>(null);

  return (
    <div className="rounded-card border border-white/80 bg-white/80 p-3 shadow-soft">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={koLocale}
        height="auto"
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
        eventClick={(info: EventClickArg) => {
          setDetailItem(info.event.extendedProps.item as ScheduleItem);
        }}
      />

      <ScheduleDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
    </div>
  );
}
