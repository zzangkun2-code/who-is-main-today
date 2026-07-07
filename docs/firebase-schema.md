# who-is-main-today Firestore schema

## `groupRooms/{roomNumber}`

그룹방 기본 정보입니다.

```ts
{
  roomNumber: string;
  password: string;
  createdAt: string;
  updatedAt: string;
}
```

현재 localStorage fallback 및 클라이언트 호환을 위해 `password` 필드를 사용합니다.
실제 운영 보안을 강화할 때는 서버 API route, Firebase Functions, Firebase Auth 등을 통해 `passwordHash` 방식으로 교체하세요.

## `groupRooms/{roomNumber}/members/{memberId}`

그룹방 안의 후보자 정보입니다.

```ts
{
  id: string;
  roomNumber: string;
  name: string;
  gender: "female" | "male";
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  avatarId: string;
  createdAt: string;
  updatedAt: string;
}
```

후보자는 반드시 해당 그룹방의 하위 컬렉션에 저장됩니다.
예를 들어 `1001`번 방의 후보자는 `groupRooms/1001/members/{memberId}`에만 저장됩니다.
