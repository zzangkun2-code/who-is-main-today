import type { Gender } from "@/lib/fortune";

export type AvatarAccessory =
  | "bow"
  | "flower"
  | "star"
  | "moon"
  | "ribbon"
  | "cap"
  | "glasses"
  | "leaf"
  | "spark"
  | "none";

export type AvatarMood = "smile" | "bright" | "calm" | "wink";

export type AvatarHairStyle = "soft" | "round" | "side" | "long" | "bob" | "wave";

export type AvatarDefinition = {
  id: string;
  gender: Gender;
  label: string;
  hair: string;
  outfit: string;
  detail: string;
  skin: string;
  accessory: AvatarAccessory;
  mood: AvatarMood;
  hairStyle: AvatarHairStyle;
};

const femaleAvatars: AvatarDefinition[] = [
  {
    id: "female-sakura",
    gender: "female",
    label: "벚꽃 리본",
    hair: "#5A3C67",
    outfit: "#FF8FB8",
    detail: "#FFD46B",
    skin: "#FFD6BB",
    accessory: "bow",
    mood: "smile",
    hairStyle: "long"
  },
  {
    id: "female-mint",
    gender: "female",
    label: "민트 별빛",
    hair: "#3F5168",
    outfit: "#78D7C6",
    detail: "#A88BE8",
    skin: "#FFD8C2",
    accessory: "star",
    mood: "bright",
    hairStyle: "bob"
  },
  {
    id: "female-peach",
    gender: "female",
    label: "복숭아 꽃",
    hair: "#6A4057",
    outfit: "#FFB179",
    detail: "#FF7FA3",
    skin: "#FFD2B4",
    accessory: "flower",
    mood: "wink",
    hairStyle: "wave"
  },
  {
    id: "female-lavender",
    gender: "female",
    label: "라벤더 달",
    hair: "#4E4671",
    outfit: "#BFA0FF",
    detail: "#FFE28A",
    skin: "#FFD8C4",
    accessory: "moon",
    mood: "calm",
    hairStyle: "long"
  },
  {
    id: "female-coral",
    gender: "female",
    label: "코랄 리본",
    hair: "#7C4A58",
    outfit: "#FF7D8D",
    detail: "#7DDCD2",
    skin: "#FFD4B7",
    accessory: "ribbon",
    mood: "smile",
    hairStyle: "bob"
  },
  {
    id: "female-sky",
    gender: "female",
    label: "하늘 반짝",
    hair: "#384D73",
    outfit: "#8FCBFF",
    detail: "#FFD36E",
    skin: "#FFD9C3",
    accessory: "spark",
    mood: "bright",
    hairStyle: "soft"
  },
  {
    id: "female-forest",
    gender: "female",
    label: "초록 잎새",
    hair: "#445B4C",
    outfit: "#8ED28F",
    detail: "#F7BF67",
    skin: "#FFD2B6",
    accessory: "leaf",
    mood: "calm",
    hairStyle: "wave"
  },
  {
    id: "female-berry",
    gender: "female",
    label: "베리 안경",
    hair: "#5D354E",
    outfit: "#C46FE8",
    detail: "#FF9FBE",
    skin: "#FFD6BF",
    accessory: "glasses",
    mood: "smile",
    hairStyle: "round"
  },
  {
    id: "female-lemon",
    gender: "female",
    label: "레몬 별",
    hair: "#675237",
    outfit: "#FFD66E",
    detail: "#FF94B4",
    skin: "#FFD9BD",
    accessory: "star",
    mood: "wink",
    hairStyle: "bob"
  },
  {
    id: "female-rose",
    gender: "female",
    label: "장미 물결",
    hair: "#6A314B",
    outfit: "#F178A7",
    detail: "#A5DAFF",
    skin: "#FFD1B4",
    accessory: "flower",
    mood: "bright",
    hairStyle: "long"
  }
];

const maleAvatars: AvatarDefinition[] = [
  {
    id: "male-ocean",
    gender: "male",
    label: "바다 캡",
    hair: "#35435F",
    outfit: "#6F8DF7",
    detail: "#79D8C2",
    skin: "#FFD4B8",
    accessory: "cap",
    mood: "smile",
    hairStyle: "side"
  },
  {
    id: "male-forest",
    gender: "male",
    label: "숲의 잎새",
    hair: "#344F42",
    outfit: "#7FCF8A",
    detail: "#FFD26D",
    skin: "#FFD6BA",
    accessory: "leaf",
    mood: "calm",
    hairStyle: "soft"
  },
  {
    id: "male-sun",
    gender: "male",
    label: "햇살 별",
    hair: "#5A4935",
    outfit: "#FFB14E",
    detail: "#83C7FF",
    skin: "#FFD3B3",
    accessory: "star",
    mood: "bright",
    hairStyle: "round"
  },
  {
    id: "male-indigo",
    gender: "male",
    label: "인디고 안경",
    hair: "#333A55",
    outfit: "#7A6FE8",
    detail: "#FFB2C7",
    skin: "#FFD8C2",
    accessory: "glasses",
    mood: "smile",
    hairStyle: "side"
  },
  {
    id: "male-mint",
    gender: "male",
    label: "민트 반짝",
    hair: "#3C5360",
    outfit: "#63CFC2",
    detail: "#B99AF2",
    skin: "#FFD5BB",
    accessory: "spark",
    mood: "wink",
    hairStyle: "soft"
  },
  {
    id: "male-cocoa",
    gender: "male",
    label: "코코아 달",
    hair: "#55423C",
    outfit: "#B88764",
    detail: "#FFE08B",
    skin: "#FFD1AE",
    accessory: "moon",
    mood: "calm",
    hairStyle: "round"
  },
  {
    id: "male-berry",
    gender: "male",
    label: "베리 캡",
    hair: "#4E3A58",
    outfit: "#B66FE6",
    detail: "#FF91A9",
    skin: "#FFD7BE",
    accessory: "cap",
    mood: "bright",
    hairStyle: "side"
  },
  {
    id: "male-coral",
    gender: "male",
    label: "코랄 리본",
    hair: "#60404C",
    outfit: "#FF8478",
    detail: "#8EE0D7",
    skin: "#FFD4B7",
    accessory: "ribbon",
    mood: "smile",
    hairStyle: "soft"
  },
  {
    id: "male-cloud",
    gender: "male",
    label: "구름 별빛",
    hair: "#3F4B65",
    outfit: "#9BCBFF",
    detail: "#F7C867",
    skin: "#FFD9C3",
    accessory: "star",
    mood: "calm",
    hairStyle: "round"
  },
  {
    id: "male-lime",
    gender: "male",
    label: "라임 잎새",
    hair: "#465444",
    outfit: "#B7DB69",
    detail: "#7BB7FF",
    skin: "#FFD5B8",
    accessory: "leaf",
    mood: "wink",
    hairStyle: "side"
  }
];

export const avatarOptions: Record<Gender, AvatarDefinition[]> = {
  female: femaleAvatars,
  male: maleAvatars
};

function hashString(input: string) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function getAvatarOptions(gender: Gender) {
  return avatarOptions[gender];
}

export function isAvatarIdForGender(
  avatarId: unknown,
  gender: Gender
): avatarId is string {
  return (
    typeof avatarId === "string" &&
    avatarOptions[gender].some((avatar) => avatar.id === avatarId)
  );
}

export function getDefaultAvatarId(gender: Gender, seed: string = gender) {
  const options = getAvatarOptions(gender);
  return options[hashString(seed) % options.length].id;
}

export function getAvatarById(
  avatarId: unknown,
  gender: Gender,
  seed: string = gender
) {
  return (
    avatarOptions[gender].find((avatar) => avatar.id === avatarId) ??
    avatarOptions[gender].find(
      (avatar) => avatar.id === getDefaultAvatarId(gender, seed)
    ) ??
    avatarOptions[gender][0]
  );
}
