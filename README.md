# 오늘의 주인공은?

`who-is-main-today`는 그룹방에 모인 사람들 중 오늘 가장 빛나는 사람을 뽑아보는 Next.js + Firebase 웹앱입니다.

## 실행

```bash
npm install
npm run dev
```

## 주요 기능

- 그룹방 개설 / 기존 그룹방 로그인
- 그룹방별 후보자 저장
- 후보자 입력, 수정, 삭제
- 날짜별 고정 운세 점수
- 1~3등 시상대와 1등 축하 팝업
- 전체 순위 보기
- 사람별 5가지 상세 운세 보기
- Firestore 기본 저장, localStorage fallback
- 모바일 반응형 UI

## 환경변수

프로젝트 루트의 `.env.local` 파일에 Firebase Web App 설정값을 넣습니다.
Vercel 배포 환경에서는 `.env.local`이 자동으로 올라가지 않으므로 Vercel 프로젝트의 Environment Variables에도 같은 값을 추가해야 합니다.

```txt
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

`.env.local.example` 파일을 복사해서 사용할 수 있습니다.

```bash
cp .env.local.example .env.local
```

## Firebase / Firestore 구조

Firestore에는 아래 구조로 저장됩니다.

```txt
groupRooms/{roomNumber}
  roomNumber
  password
  createdAt
  updatedAt

groupRooms/{roomNumber}/members/{memberId}
  id
  roomNumber
  name
  gender
  birthDate
  birthTime
  avatarId
  createdAt
  updatedAt
```

현재 클라이언트 단계에서는 호환을 위해 `password` 필드를 사용합니다. 실제 서비스에서 보안을 강화하려면 서버 API route, Firebase Functions, Firebase Auth 등을 통해 `passwordHash` 방식으로 바꾸는 것이 안전합니다.

## Firebase Console에서 확인할 것

1. Firebase 프로젝트 ID가 `.env.local`의 `NEXT_PUBLIC_FIREBASE_PROJECT_ID`와 같은지 확인합니다.
2. Firestore Database가 생성되어 있는지 확인합니다.
3. Firestore Rules에서 그룹방 생성과 후보자 저장이 허용되는지 확인합니다.
4. Vercel에도 같은 `NEXT_PUBLIC_FIREBASE_*` 환경변수를 등록한 뒤 Redeploy합니다.

## localStorage fallback

Firebase 연결 또는 권한 문제가 있으면 개발 중 앱이 완전히 멈추지 않도록 localStorage fallback이 동작합니다.
fallback 저장 키는 `who-is-main-today` 기준으로 관리됩니다.

- `who-is-main-today-rooms`
- `who-is-main-today-room-members:{roomNumber}`

예전 테스트 단계에서 사용한 저장 키가 브라우저에 남아 있으면 가능한 범위에서 새 키로 자동 마이그레이션합니다.

## 관리자 모드

관리자 모드 진입용 임시 키는 `0202 / 0425`입니다.
실제 서비스에서는 이 방식 대신 Firebase Auth 또는 서버 API에서 관리자 인증을 처리하는 것이 안전합니다.
