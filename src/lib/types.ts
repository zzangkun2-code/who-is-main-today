export type UserRole = "admin" | "school";

export type BusinessType = "A" | "B" | "C" | "D";

export type ProgramType = "online" | "fieldTrip" | "invitation";

export type SchoolLevel = "초등학교" | "중학교" | "고등학교";

export type Continent =
  | "동북아시아"
  | "동남아시아"
  | "서남/중앙아시아"
  | "오세아니아"
  | "유럽"
  | "북미"
  | "남미"
  | "아프리카/중동";

export type CountrySelection = {
  country: string;
  continent: Continent;
  isOther?: boolean;
};

export type SchoolProfile = {
  uid: string;
  email: string;
  schoolId: string;
  displayName?: string;
  schoolName: string;
  partnerInfo: string;
  theme: string;
  businessType: BusinessType;
  year: number;
  schoolLevel: SchoolLevel;
  isFirstLogin?: boolean;
  mustChangePassword?: boolean;
  activityReports?: Partial<Record<ProgramType, ActivityReport>>;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type OnlinePayload = {
  classTime: string;
  koreanStudentCount: number;
  countries: CountrySelection[];
  partnerSchool: string;
};

export type FieldTripPayload = {
  countries: CountrySelection[];
  visitingCity: string;
  visitingSchoolName: string;
  studentCount: number;
  teacherCount: number;
};

export type InvitationPayload = {
  countries: CountrySelection[];
  visitingSchoolName: string;
  visitingStudentCount: number;
  visitingTeacherCount: number;
  koreanStudentCount: number;
};

export type SchedulePayload = OnlinePayload | FieldTripPayload | InvitationPayload;

export type ScheduleItem = {
  id?: string;
  ownerUid: string;
  schoolName: string;
  type: ProgramType;
  title: string;
  start: string;
  end: string;
  payload: SchedulePayload;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ActivityReport = {
  content: string;
  updatedAt?: unknown;
};

export type CalendarDraft = {
  type: ProgramType;
  start: string;
  end: string;
};

export type FaqCategory = ProgramType;

export type FaqItem = {
  id?: string;
  category: FaqCategory;
  question: string;
  answer: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type SchoolAccountCreateInput = {
  schoolId: string;
  email: string;
  initialPassword: string;
  schoolName: string;
  businessType: BusinessType;
};

export type SchoolAccountUpdateInput = {
  uid: string;
  schoolName?: string;
  newPassword?: string;
};
