import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe
} from "firebase/firestore";
import { requireDb } from "@/lib/firebase";
import type {
  FaqCategory,
  FaqItem,
  ProgramType,
  ScheduleItem,
  SchoolProfile
} from "@/lib/types";

type ErrorHandler = (error: Error) => void;

function sortSchedules(items: ScheduleItem[]) {
  return [...items].sort((a, b) => a.start.localeCompare(b.start));
}

export async function isAdminUser(uid: string) {
  const snapshot = await getDoc(doc(requireDb(), "admins", uid));
  return snapshot.exists();
}

export function subscribeSchoolProfile(
  uid: string,
  onChange: (profile: SchoolProfile | null) => void,
  onError?: ErrorHandler
): Unsubscribe {
  return onSnapshot(
    doc(requireDb(), "schools", uid),
    (snapshot) => {
      onChange(snapshot.exists() ? ({ uid, ...snapshot.data() } as SchoolProfile) : null);
    },
    onError
  );
}

export async function saveSchoolProfile(profile: SchoolProfile) {
  const ref = doc(requireDb(), "schools", profile.uid);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      ...profile,
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function updateSchoolProfile(uid: string, profile: Partial<SchoolProfile>) {
  await updateDoc(doc(requireDb(), "schools", uid), {
    ...profile,
    updatedAt: serverTimestamp()
  });
}

export function subscribeSchedules(
  uid: string,
  onChange: (items: ScheduleItem[]) => void,
  onError?: ErrorHandler
): Unsubscribe {
  return onSnapshot(
    collection(requireDb(), "schools", uid, "schedules"),
    (snapshot) => {
      onChange(
        sortSchedules(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ScheduleItem)
        )
      );
    },
    onError
  );
}

export function subscribeAllSchedules(
  onChange: (items: ScheduleItem[]) => void,
  onError?: ErrorHandler
): Unsubscribe {
  return onSnapshot(
    collectionGroup(requireDb(), "schedules"),
    (snapshot) => {
      onChange(
        sortSchedules(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ScheduleItem)
        )
      );
    },
    onError
  );
}

export async function upsertSchedule(uid: string, item: ScheduleItem) {
  const { id, ...payload } = item;
  if (id) {
    await updateDoc(doc(requireDb(), "schools", uid, "schedules", id), {
      ...payload,
      updatedAt: serverTimestamp()
    });
    return id;
  }

  const created = await addDoc(collection(requireDb(), "schools", uid, "schedules"), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return created.id;
}

export async function deleteSchedule(uid: string, scheduleId: string) {
  await deleteDoc(doc(requireDb(), "schools", uid, "schedules", scheduleId));
}

export function subscribeSchools(
  onChange: (items: SchoolProfile[]) => void,
  onError?: ErrorHandler
): Unsubscribe {
  return onSnapshot(
    collection(requireDb(), "schools"),
    (snapshot) => {
      onChange(
        snapshot.docs
          .map((item) => ({ uid: item.id, ...item.data() }) as SchoolProfile)
          .sort((a, b) => a.schoolName.localeCompare(b.schoolName, "ko"))
      );
    },
    onError
  );
}

export async function saveActivityReport(uid: string, type: ProgramType, content: string) {
  await updateDoc(doc(requireDb(), "schools", uid), {
    [`activityReports.${type}`]: {
      content,
      updatedAt: serverTimestamp()
    },
    updatedAt: serverTimestamp()
  });
}

export function subscribeFaqs(
  onChange: (items: FaqItem[]) => void,
  onError?: ErrorHandler
): Unsubscribe {
  return onSnapshot(
    collection(requireDb(), "faqs"),
    (snapshot) => {
      onChange(
        snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }) as FaqItem)
          .sort((a, b) => a.category.localeCompare(b.category))
      );
    },
    onError
  );
}

export function subscribeFaqsByCategory(
  category: FaqCategory,
  onChange: (items: FaqItem[]) => void,
  onError?: ErrorHandler
): Unsubscribe {
  return onSnapshot(
    collection(requireDb(), "faqs"),
    (snapshot) => {
      onChange(
        snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }) as FaqItem)
          .filter((item) => item.category === category)
      );
    },
    onError
  );
}

export async function upsertFaq(item: FaqItem) {
  const { id, ...payload } = item;
  if (id) {
    await updateDoc(doc(requireDb(), "faqs", id), {
      ...payload,
      updatedAt: serverTimestamp()
    });
    return id;
  }

  const created = await addDoc(collection(requireDb(), "faqs"), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return created.id;
}

export async function deleteFaq(faqId: string) {
  await deleteDoc(doc(requireDb(), "faqs", faqId));
}
