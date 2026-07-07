import type { Gender, Person } from "@/lib/fortune";

export type Member = Person & {
  roomNumber: string;
  createdAt: string;
  updatedAt: string;
};

export type GroupRoom = {
  roomNumber: string;
  /**
   * localStorage 단계의 임시 필드입니다.
   * 실제 Firebase, Google Sheets, 서버 DB 저장 시에는 평문 password 대신
   * 서버에서 생성한 passwordHash만 저장해야 합니다.
   */
  password?: string;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
};

export type MemberInput = {
  name: string;
  gender: Gender;
  birthDate: string;
  birthTime: string;
  avatarId?: string;
};

export type GroupSession = {
  roomNumber: string;
};
