import type { Gender, Person } from "@/lib/fortune";

export type Member = Person & {
  roomNumber: string;
  createdAt: string;
  updatedAt: string;
};

export type GroupRoom = {
  roomNumber: string;
  /**
   * 현재 클라이언트 호환을 위해 password/passwordHash를 함께 지원합니다.
   * 실제 운영에서는 평문 password 대신 서버에서 생성한 passwordHash만 저장해야 합니다.
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
