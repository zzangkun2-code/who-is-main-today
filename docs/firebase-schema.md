# Firestore DB Structure

## `admins/{uid}`

Firebase Authentication에서 만든 교육청 관리자 계정의 권한 문서입니다.

```ts
{
  email: string;
  name?: string;
  role: "admin";
  createdAt?: Timestamp;
}
```

## `schools/{uid}`

관리자가 발급한 학교 계정입니다. 관리자는 `schoolId`, 초기 비밀번호, 학교명, 사업유형을 세팅하고, 학교는 `partnerInfo`, `theme`만 입력합니다.

```ts
{
  uid: string;
  email: string; // 예: 26e01@exchange.jbe.kr
  schoolId: string; // 예: 26e01
  schoolName: string;
  businessType: "A" | "B" | "C" | "D";
  year: number; // 예: 2026
  schoolLevel: "초등학교" | "중학교" | "고등학교";
  partnerInfo: string;
  theme: string;
  activityReports: {
    online?: {
      content: string;
      updatedAt: Timestamp;
    };
    fieldTrip?: {
      content: string;
      updatedAt: Timestamp;
    };
    invitation?: {
      content: string;
      updatedAt: Timestamp;
    };
  };
  isFirstLogin: boolean;
  mustChangePassword: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

학교 ID 규칙:

```txt
26e01 = 2026년 초등학교 01번
26m01 = 2026년 중학교 01번
26h01 = 2026년 고등학교 01번
```

## `schools/{uid}/schedules/{scheduleId}`

일정 데이터입니다. 국가는 직접 문자열이 아니라 배열로 저장합니다.

```ts
{
  ownerUid: string;
  schoolName: string;
  type: "online" | "fieldTrip" | "invitation";
  title: string;
  start: string;
  end: string;
  payload: {
    countries: Array<{
      country: string;
      continent: string;
      isOther?: boolean;
    }>;
    // type별 추가 필드
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## `schools/{uid}.activityReports`

학교가 제출하는 텍스트 기반 활동 기록입니다. 수업 활동 내용, 소감, 학습 결과를 사업 탭별로 저장합니다.

```ts
{
  activityReports: {
    online?: {
      content: string;
      updatedAt: Timestamp;
    };
    fieldTrip?: {
      content: string;
      updatedAt: Timestamp;
    };
    invitation?: {
      content: string;
      updatedAt: Timestamp;
    };
  };
}
```

## `faqs/{faqId}`

관리자가 작성하고 학교가 읽는 FAQ입니다.

```ts
{
  category: "online" | "fieldTrip" | "invitation";
  question: string;
  answer: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```
