"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StaticCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Textarea } from "@/components/ui/Input";
import { PROGRAMS } from "@/lib/constants";
import { saveActivityReport } from "@/lib/firestore";
import type { ProgramType, SchoolProfile } from "@/lib/types";

function formatUpdatedAt(value: unknown) {
  if (!value) return "";

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(value.toDate());
  }

  return "";
}

export function ActivityReportManager({
  profile,
  type,
  onBack,
  readOnly = false
}: {
  profile: SchoolProfile;
  type: ProgramType;
  onBack: () => void;
  readOnly?: boolean;
}) {
  const program = PROGRAMS[type];
  const report = profile.activityReports?.[type];
  const [content, setContent] = useState(report?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updatedAtText = useMemo(() => formatUpdatedAt(report?.updatedAt), [report?.updatedAt]);

  useEffect(() => {
    setContent(report?.content ?? "");
    setMessage(null);
    setError(null);
  }, [report?.content, type]);

  const handleSave = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setError("활동 기록 내용을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await saveActivityReport(profile.uid, type, trimmed);
      setMessage("활동 기록이 저장되었습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "활동 기록을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-full ${program.chip}`}>
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-skysoft-700">{program.label}</p>
            <h2 className="text-2xl font-black text-ink-900">
              {readOnly ? "활동 기록 확인" : "활동 기록 제출"}
            </h2>
          </div>
        </div>
        <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBack}>
          일정 목록
        </Button>
      </div>

      {message ? (
        <div className="rounded-card border border-mint-200 bg-mint-50 px-4 py-3 text-sm font-extrabold text-mint-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <StaticCard className="p-5">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
          <div>
            <h3 className="text-lg font-black text-ink-900">활동 요약</h3>
            <p className="text-sm font-bold text-slate-500">
              수업 활동 내용, 학생 소감, 학습 결과를 글로 정리합니다.
            </p>
          </div>
          {updatedAtText ? (
            <span className="rounded-full bg-skysoft-50 px-3 py-1 text-xs font-extrabold text-skysoft-700">
              최근 저장 {updatedAtText}
            </span>
          ) : null}
        </div>

        {readOnly ? (
          content ? (
            <div className="min-h-56 whitespace-pre-wrap rounded-card border border-skysoft-100 bg-white/90 p-4 text-sm font-semibold leading-7 text-ink-900">
              {content}
            </div>
          ) : (
            <EmptyState title="제출된 활동 기록이 없습니다" />
          )
        ) : (
          <>
            <Field label="활동 기록">
              <Textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={`예: ${program.label}에서 진행한 활동, 학생 반응, 배운 점, 다음 수업 계획을 적어 주세요.`}
                className="min-h-72 leading-7"
              />
            </Field>
            <Button
              className="mt-4"
              icon={<Save className="h-4 w-4" />}
              loading={saving}
              onClick={handleSave}
            >
              활동 기록 저장
            </Button>
          </>
        )}
      </StaticCard>
    </section>
  );
}
