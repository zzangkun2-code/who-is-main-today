"use client";

import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { AlertCircle, Building2, LockKeyhole, LogIn, Mail, School } from "lucide-react";
import { FormEvent, useState } from "react";
import { hasFirebaseConfig, requireAuth } from "@/lib/firebase";
import { isAdminUser } from "@/lib/firestore";
import { loginIdToEmail } from "@/lib/school-id";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { StaticCard } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Input";

const roleTabs: Array<{
  role: UserRole;
  title: string;
  helper: string;
  icon: typeof Building2;
}> = [
  {
    role: "admin",
    title: "교육청",
    helper: "관리자 이메일 계정",
    icon: Building2
  },
  {
    role: "school",
    title: "참여학교",
    helper: "예: 26e01",
    icon: School
  }
];

export function LoginScreen() {
  const [activeRole, setActiveRole] = useState<UserRole>("school");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const authEmail = loginIdToEmail(loginId, activeRole === "school");
      const result = await signInWithEmailAndPassword(requireAuth(), authEmail, password);
      const admin = await isAdminUser(result.user.uid, result.user.email);

      if (activeRole === "admin" && !admin) {
        await signOut(requireAuth());
        setError("관리자 계정이 아닙니다. 교육청 관리자 이메일로 로그인해 주세요.");
        return;
      }

      if (activeRole === "school" && admin) {
        await signOut(requireAuth());
        setError("관리자 계정은 교육청 탭에서 로그인해 주세요.");
      }
    } catch {
      setError("ID 또는 비밀번호를 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-4xl">
        <div className="mb-7 text-center">
          <img
            src="/logo.png"
            alt="앱 로고"
            className="mx-auto h-auto max-h-56 w-full max-w-3xl rounded-card bg-white object-contain px-4 py-3 shadow-soft"
          />
        </div>

        <StaticCard className="mx-auto max-w-2xl p-5 sm:p-7">
          <div className="grid grid-cols-2 gap-2 rounded-card bg-skysoft-50 p-2">
            {roleTabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeRole === tab.role;
              return (
                <button
                  key={tab.role}
                  type="button"
                  className={cn(
                    "focus-ring flex min-h-20 flex-col items-center justify-center gap-1 rounded-card px-3 text-center transition hover:-translate-y-0.5",
                    selected ? "bg-white text-skysoft-700 shadow-soft" : "text-slate-500"
                  )}
                  onClick={() => {
                    setActiveRole(tab.role);
                    setLoginId("");
                    setError(null);
                  }}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-base font-black">{tab.title}</span>
                  <span className="text-xs font-bold">{tab.helper}</span>
                </button>
              );
            })}
          </div>

          {!hasFirebaseConfig ? (
            <div className="mt-5 flex items-start gap-3 rounded-card border border-peach-200 bg-peach-50 px-4 py-3 text-peach-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-extrabold">
                `.env.local`에 Firebase 설정값을 넣으면 이메일/비밀번호 로그인을 사용할 수 있습니다.
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 flex items-start gap-3 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-extrabold">{error}</p>
            </div>
          ) : null}

          <form className="mt-6 grid gap-4" onSubmit={handleLogin}>
            <Field label={activeRole === "admin" ? "관리자 이메일" : "학교 ID"}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <TextInput
                  type={activeRole === "admin" ? "email" : "text"}
                  value={loginId}
                  onChange={(event) => setLoginId(event.target.value)}
                  placeholder={activeRole === "admin" ? "예: admin@jbe.go.kr" : "예: 26e01"}
                  className="pl-11"
                  required
                />
              </div>
              {activeRole === "school" ? (
                <p className="mt-2 text-xs font-bold text-slate-500">
                  학교 ID만 입력하면 앱이 자동으로 @exchange.jbe.kr을 붙여 로그인합니다.
                </p>
              ) : null}
            </Field>
            <Field label="비밀번호">
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <TextInput
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="발급받은 비밀번호"
                  className="pl-11"
                  required
                />
              </div>
            </Field>
            <Button
              type="submit"
              icon={<LogIn className="h-4 w-4" />}
              loading={loading}
              disabled={!hasFirebaseConfig}
            >
              로그인
            </Button>
          </form>
        </StaticCard>
      </section>
    </main>
  );
}
