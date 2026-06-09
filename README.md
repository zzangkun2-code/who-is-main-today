# 국제교류수업사업 관리 웹앱

전북특별자치도교육청의 국제교류수업사업을 관리하는 Next.js + Firebase 웹앱입니다. 인증은 Firebase Email/Password Auth로 통일되어 있으며, 회원가입은 없습니다. 교육청 관리자가 참여학교 계정을 직접 발급합니다.

## 설치 명령어

```bash
npm install
npm run dev
```

## 핵심 라이브러리

- Next.js / React / TypeScript
- Tailwind CSS
- Firebase Auth, Firestore
- Firebase Admin SDK
- FullCalendar
- lucide-react

## 디렉토리 구조

```txt
src/
  app/
    api/admin/schools/route.ts
    globals.css
    layout.tsx
    page.tsx
  components/
    admin/
      AdminCalendar.tsx
      AdminDashboard.tsx
      FaqManager.tsx
      SchoolAccountManager.tsx
      SchoolCard.tsx
    activity/
      ActivityReportManager.tsx
    calendar/
      ScheduleDetailModal.tsx
      ScheduleCalendar.tsx
      ScheduleFormModal.tsx
    dashboard/
      SchoolTabs.tsx
      UserDashboard.tsx
    faq/
      FaqViewerModal.tsx
    ui/
    AppRouter.tsx
    AuthProvider.tsx
    LoginScreen.tsx
    MissingProfileNotice.tsx
    PasswordChangeModal.tsx
  lib/
    admin-api.ts
    constants.ts
    csv.ts
    firebase-admin.ts
    firebase.ts
    firestore.ts
    types.ts
    utils.ts
docs/
  firebase-schema.md
firestore.rules
```

## Firebase 설정

`.env.example`을 `.env.local`로 복사한 뒤 Firebase 웹 앱 설정 값과 Admin SDK 서비스 계정 값을 넣습니다.

```bash
cp .env.example .env.local
```

Firebase Console에서 Email/Password 로그인을 활성화하고 Firestore를 생성합니다.

관리자 준비 순서:

1. Firebase Auth에서 교육청 공용 관리자 이메일/비밀번호 계정을 생성합니다.
2. 생성된 관리자 UID로 Firestore에 `admins/{uid}` 문서를 만듭니다.
3. 관리자 계정으로 로그인한 뒤 앱의 `계정 발급` 메뉴에서 `26e01` 형식의 학교 ID와 초기 비밀번호를 생성합니다.

학교 ID 규칙:

```txt
26e01 = 2026년 초등학교 01번
26m01 = 2026년 중학교 01번
26h01 = 2026년 고등학교 01번
```

학교는 로그인 화면에서 `26e01`만 입력합니다. 앱이 내부적으로 `26e01@exchange.jbe.kr`로 바꿔 Firebase Auth에 로그인합니다.

활동 기록 구조:

- 참여학교는 각 사업 탭에서 활동 내용, 학생 소감, 학습 결과를 텍스트로 제출합니다.
- 활동 기록은 `schools/{학교 UID}` 문서의 `activityReports` 필드에 저장됩니다.
- 관리자는 학교 관리 화면의 `활동 기록` 탭에서 제출 내용을 읽기 전용으로 확인합니다.

보안 구조:

- 참여학교는 `schools/{본인 UID}`와 그 하위 일정만 읽고 씁니다.
- 참여학교는 `faqs` 컬렉션을 읽기만 할 수 있습니다.
- `admins/{관리자 UID}` 문서가 있는 관리자 계정은 Firestore 전체 권한을 가집니다.
