"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Edit3, KeyRound, PlusCircle, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  createSchoolAccount,
  deleteSchoolAccount,
  resetSchoolPassword,
  updateSchoolAccount
} from "@/lib/admin-api";
import { BUSINESS_OPTIONS } from "@/lib/constants";
import { normalizeSchoolId, parseSchoolId, schoolIdToEmail } from "@/lib/school-id";
import type { BusinessType, SchoolAccountCreateInput, SchoolProfile } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StaticCard } from "@/components/ui/Card";
import { Field, Select, TextInput } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

const initialForm: SchoolAccountCreateInput = {
  schoolId: "",
  email: "",
  initialPassword: "",
  schoolName: "",
  businessType: "A"
};

type EditForm = {
  schoolName: string;
  newPassword: string;
};

export function SchoolAccountManager({ schools }: { schools: SchoolProfile[] }) {
  const [form, setForm] = useState<SchoolAccountCreateInput>(initialForm);
  const [editingSchool, setEditingSchool] = useState<SchoolProfile | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ schoolName: "", newPassword: "" });
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [resettingUid, setResettingUid] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingSchool) return;
    setEditForm({
      schoolName: editingSchool.schoolName,
      newPassword: ""
    });
  }, [editingSchool]);

  const parsedSchoolId = useMemo(() => {
    try {
      return form.schoolId ? parseSchoolId(form.schoolId) : null;
    } catch {
      return null;
    }
  }, [form.schoolId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setMessage(null);
    setError(null);

    try {
      const schoolId = normalizeSchoolId(form.schoolId);
      const email = schoolIdToEmail(schoolId);
      const created = await createSchoolAccount({
        ...form,
        schoolId,
        email
      });

      setMessage(
        `${created.schoolName} 계정이 ${created.updatedExistingUser ? "갱신" : "생성"}되었습니다. 로그인 ID: ${created.schoolId}`
      );
      setForm(initialForm);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "학교 계정을 생성하지 못했습니다."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (school: SchoolProfile) => {
    const newPassword = window.prompt(`${school.schoolName}의 새 초기 비밀번호를 입력하세요.`, "");
    if (!newPassword) return;

    setResettingUid(school.uid);
    setMessage(null);
    setError(null);
    try {
      await resetSchoolPassword({ uid: school.uid, newPassword });
      setMessage(`${school.schoolName} 비밀번호가 초기화되었습니다.`);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "비밀번호를 초기화하지 못했습니다.");
    } finally {
      setResettingUid(null);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingSchool) return;

    setUpdating(true);
    setMessage(null);
    setError(null);
    try {
      await updateSchoolAccount({
        uid: editingSchool.uid,
        schoolName: editForm.schoolName.trim(),
        newPassword: editForm.newPassword.trim() || undefined
      });
      setMessage(`${editForm.schoolName.trim()} 계정 정보가 수정되었습니다.`);
      setEditingSchool(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "계정 정보를 수정하지 못했습니다.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (school: SchoolProfile) => {
    const confirmed = window.confirm(
      `${school.schoolName} 계정을 삭제할까요?\n\n로그인 계정과 Firestore 학교 문서가 함께 삭제됩니다.`
    );
    if (!confirmed) return;

    setDeletingUid(school.uid);
    setMessage(null);
    setError(null);
    try {
      await deleteSchoolAccount(school.uid);
      setMessage(`${school.schoolName} 계정이 삭제되었습니다.`);
      if (editingSchool?.uid === school.uid) {
        setEditingSchool(null);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "학교 계정을 삭제하지 못했습니다.");
    } finally {
      setDeletingUid(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_460px]">
      <StaticCard className="p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-mint-100 text-mint-700">
            <PlusCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-skysoft-700">계정 관리</p>
            <h2 className="text-xl font-black text-ink-900">참여학교 계정 발급</h2>
          </div>
        </div>

        {message ? (
          <div className="mb-4 rounded-card border border-mint-200 bg-mint-50 px-4 py-3 text-sm font-extrabold text-mint-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-extrabold text-red-700">
            {error}
          </div>
        ) : null}

        <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="학교 ID">
              <TextInput
                type="text"
                value={form.schoolId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    schoolId: event.target.value.trim().toLowerCase(),
                    email: schoolIdToEmail(event.target.value)
                  }))
                }
                placeholder="예: 26e01"
                autoComplete="off"
                required
              />
              <p className="mt-2 text-xs font-bold text-slate-500">
                26e01처럼 입력하세요. e=초등학교, m=중학교, h=고등학교입니다.
              </p>
              {parsedSchoolId ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="mint">{parsedSchoolId.year}년</Badge>
                  <Badge tone="blue">{parsedSchoolId.schoolLevel}</Badge>
                  <Badge tone="peach">{parsedSchoolId.email}</Badge>
                </div>
              ) : null}
            </Field>
            <Field label="초기 비밀번호">
              <TextInput
                type="text"
                value={form.initialPassword}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, initialPassword: event.target.value }))
                }
                placeholder="6자 이상"
                minLength={6}
                required
              />
            </Field>
          </div>
          <Field label="학교명">
            <TextInput
              type="text"
              value={form.schoolName}
              onChange={(event) => setForm((prev) => ({ ...prev, schoolName: event.target.value }))}
              placeholder="예: 전주미래초등학교"
              required
            />
          </Field>
          <Field label="사업 유형">
            <Select
              value={form.businessType}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, businessType: event.target.value as BusinessType }))
              }
            >
              {BUSINESS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.description})
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" loading={creating} icon={<KeyRound className="h-4 w-4" />}>
            학교 계정 생성
          </Button>
        </form>
      </StaticCard>

      <StaticCard className="h-fit p-5">
        <h2 className="text-lg font-black text-ink-900">계정 발급 현황</h2>
        <div className="mt-4 grid gap-3">
          {schools.map((school) => {
            const businessLabel =
              BUSINESS_OPTIONS.find((option) => option.value === school.businessType)?.shortLabel ??
              school.businessType;
            return (
              <div key={school.uid} className="rounded-card border border-skysoft-100 bg-white/80 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-ink-900">{school.schoolName}</p>
                  <Badge tone="blue">{businessLabel}</Badge>
                  <Badge tone="mint">{school.schoolId}</Badge>
                </div>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {school.email} · {school.year}년 · {school.schoolLevel}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {school.isFirstLogin || school.mustChangePassword ? (
                    <Badge tone="peach">초기 비밀번호 상태</Badge>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-9 px-3 text-xs"
                    icon={<Edit3 className="h-3.5 w-3.5" />}
                    onClick={() => setEditingSchool(school)}
                  >
                    수정
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-9 px-3 text-xs"
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                    loading={resettingUid === school.uid}
                    onClick={() => handleResetPassword(school)}
                  >
                    비밀번호 초기화
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="min-h-9 px-3 text-xs"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    loading={deletingUid === school.uid}
                    onClick={() => handleDelete(school)}
                  >
                    삭제
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </StaticCard>

      <Modal
        open={Boolean(editingSchool)}
        onClose={() => setEditingSchool(null)}
        title="학교 계정 수정"
        footer={
          <Button
            form="school-account-edit-form"
            type="submit"
            icon={<Save className="h-4 w-4" />}
            loading={updating}
          >
            수정 저장
          </Button>
        }
      >
        <form id="school-account-edit-form" className="grid gap-4" onSubmit={handleUpdate}>
          <Field label="학교명">
            <TextInput
              value={editForm.schoolName}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, schoolName: event.target.value }))
              }
              placeholder="예: 전주미래초등학교"
              required
            />
          </Field>
          <Field label="새 비밀번호">
            <TextInput
              type="text"
              value={editForm.newPassword}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, newPassword: event.target.value }))
              }
              placeholder="변경하지 않으려면 비워두세요"
              minLength={6}
            />
            <p className="mt-2 text-xs font-bold text-slate-500">
              비밀번호를 입력하면 해당 학교는 다음 로그인 때 비밀번호 변경 안내를 받습니다.
            </p>
          </Field>
        </form>
      </Modal>
    </div>
  );
}
