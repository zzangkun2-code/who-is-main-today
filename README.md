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
- Firestore 기본 저장
- Firebase 연결 실패 시 localStorage fallback
- 같은 그룹방 후보 목록 실시간 동기화
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

## Firestore 저장 구조

Firestore에는 아래 구조로 저장됩니다.

```txt
groupRooms/{roomNumber}
  roomNumber
  password 또는 passwordHash
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

후보자 목록은 `groupRooms/{roomNumber}/members` 하위 컬렉션을 기준으로 읽고 씁니다.
같은 그룹방 번호로 접속한 모든 기기는 같은 Firestore 데이터를 봅니다.

## localStorage fallback

localStorage는 기본 저장소가 아닙니다. 아래 상황에서만 사용합니다.

- Firebase 환경변수가 없거나 Firestore 연결이 실패한 경우
- 개발 중 네트워크 또는 권한 문제로 임시 테스트가 필요한 경우
- 기존 브라우저에 남아 있던 후보 데이터를 Firestore가 비어 있을 때 이전하기 위한 경우

fallback 저장 키는 `who-is-main-today` 기준으로 관리됩니다.

- `who-is-main-today-rooms`
- `who-is-main-today-room-members:{roomNumber}`

앱 화면에서 `서버 저장 모드`가 보이면 Firestore를 사용 중입니다.
`임시 저장 모드`가 보이면 현재 기기 localStorage에만 저장 중이므로 Firebase 설정과 Firestore Rules를 확인해야 합니다.

## Firestore Rules

현재 저장소의 `firestore.rules` 파일은 `groupRooms`와 `members` 구조를 허용하도록 작성되어 있습니다.
Firebase Console 또는 Firebase CLI로 Rules를 배포해야 실제 배포 앱에서 Firestore 쓰기가 작동합니다.

```bash
firebase deploy --only firestore:rules
```

개발 테스트만 빠르게 확인해야 할 때는 아래처럼 열어둘 수 있습니다.
단, 이 규칙은 실제 서비스에는 안전하지 않습니다.

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /groupRooms/{roomNumber} {
      allow read, write: if true;

      match /members/{memberId} {
        allow read, write: if true;
      }
    }
  }
}
```

실제 운영에서는 Firebase Auth, 서버 API route, Firebase Functions, `passwordHash` 등을 사용해 방 생성/수정/삭제 권한을 더 안전하게 보호해야 합니다.

## Firebase Console에서 확인할 것

1. Firebase 프로젝트 ID가 `.env.local`의 `NEXT_PUBLIC_FIREBASE_PROJECT_ID`와 같은지 확인합니다.
2. Firestore Database가 생성되어 있는지 확인합니다.
3. Firestore Rules에서 `groupRooms`와 `members` 읽기/쓰기가 허용되어 있는지 확인합니다.
4. Vercel에도 같은 `NEXT_PUBLIC_FIREBASE_*` 환경변수를 등록한 뒤 Redeploy합니다.

## 테스트 방법

1. 컴퓨터 브라우저에서 방 `1001`을 만들고 후보자를 추가합니다.
2. 같은 브라우저를 새로고침해서 후보자가 남아 있는지 확인합니다.
3. 시크릿 창이나 다른 브라우저에서 같은 방 `1001`로 로그인합니다.
4. 후보자 목록이 동일하게 보이는지 확인합니다.
5. 한쪽에서 후보자를 추가/수정/삭제했을 때 다른 쪽 화면에 자동 반영되는지 확인합니다.
6. 휴대폰에서 같은 Vercel 주소로 접속한 뒤 같은 방에 로그인해 후보자 목록이 보이는지 확인합니다.

## 관리자 모드

관리자 모드 진입용 임시 키는 `0202 / 0425`입니다.
실제 서비스에서는 이 방식 대신 Firebase Auth 또는 서버 API에서 관리자 인증을 처리하는 것이 안전합니다.
