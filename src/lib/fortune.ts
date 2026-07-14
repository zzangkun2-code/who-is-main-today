export type Gender = "female" | "male";

export type FiveElement = "나무" | "불" | "흙" | "금" | "물";

export type EnergyRelation = "상생" | "같은 기운" | "긴장" | "조율";

export type Person = {
  id: string;
  name: string;
  gender: Gender;
  birthDate: string;
  birthTime: string;
  birthTimeUnknown?: boolean;
  avatarId?: string;
};

export type FortuneCategory = {
  key: "love" | "money" | "health" | "relationship" | "lucky";
  label: string;
  score: number;
  description: string;
};

export type FortuneEnergy = {
  birthElement: FiveElement;
  todayElement: FiveElement;
  timeElement: FiveElement;
  timeEnergy: string;
  relation: EnergyRelation;
  harmonyScore: number;
};

export type DailyFortune = {
  person: Person;
  score: number;
  categories: FortuneCategory[];
  keyword: string;
  summary: string;
  energy: FortuneEnergy;
  winnerPraise: string[];
  runnerUpMessage: string;
};

const categoryLabels: FortuneCategory["label"][] = [
  "연애운",
  "금전운",
  "건강운",
  "대인관계운",
  "오늘의 행운 포인트"
];

const categoryKeys: FortuneCategory["key"][] = [
  "love",
  "money",
  "health",
  "relationship",
  "lucky"
];

const NEW_SCORING_START_DATE = "2026-07-15";

const elementKeywords: Record<FiveElement, string[]> = {
  나무: ["성장", "시작", "확장", "관계", "아이디어", "생기"],
  불: ["표현", "주목", "열정", "명예", "인기", "활력"],
  흙: ["안정", "신뢰", "균형", "책임", "기반", "조율"],
  금: ["판단", "정리", "결실", "금전", "집중", "가치"],
  물: ["지혜", "감성", "소통", "흐름", "직감", "사유"]
};

const elementTone: Record<FiveElement, string> = {
  나무: "새로운 관계와 아이디어가 자라나는",
  불: "표현력과 존재감이 자연스럽게 살아나는",
  흙: "흔들림을 줄이고 중심을 잡아 주는",
  금: "판단과 정리가 또렷해지는",
  물: "감성과 소통의 흐름이 부드럽게 이어지는"
};

const generates: Record<FiveElement, FiveElement> = {
  나무: "불",
  불: "흙",
  흙: "금",
  금: "물",
  물: "나무"
};

const controls: Record<FiveElement, FiveElement> = {
  나무: "흙",
  흙: "물",
  물: "불",
  불: "금",
  금: "나무"
};

const zodiacAnimals = [
  { name: "원숭이", emoji: "🐵" },
  { name: "닭", emoji: "🐔" },
  { name: "개", emoji: "🐶" },
  { name: "돼지", emoji: "🐷" },
  { name: "쥐", emoji: "🐭" },
  { name: "소", emoji: "🐮" },
  { name: "호랑이", emoji: "🐯" },
  { name: "토끼", emoji: "🐰" },
  { name: "용", emoji: "🐲" },
  { name: "뱀", emoji: "🐍" },
  { name: "말", emoji: "🐴" },
  { name: "양", emoji: "🐑" }
];

function hash(input: string) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function pick<T>(items: T[], seed: string) {
  return items[hash(seed) % items.length];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyToNumber(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return Number.NaN;
  const [, year, month, day] = match;
  return Number(year) * 10000 + Number(month) * 100 + Number(day);
}

function shouldUseNewScoring(dateKey: string) {
  const targetDate = dateKeyToNumber(dateKey);
  const startDate = dateKeyToNumber(NEW_SCORING_START_DATE);
  return Number.isFinite(targetDate) && targetDate >= startDate;
}

export function formatKoreanDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

export function getAge(birthDate: string, today = new Date()) {
  const birth = new Date(`${birthDate}T00:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  const birthdayPassed =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() >= birth.getDate());
  if (!birthdayPassed) age -= 1;
  return Math.max(0, age);
}

export function getZodiac(birthDate: string) {
  const year = Number(birthDate.slice(0, 4));
  return zodiacAnimals[year % 12].name;
}

export function getZodiacInfo(birthDate: string) {
  const year = Number(birthDate.slice(0, 4));
  const animal = zodiacAnimals[year % 12];
  return {
    ...animal,
    label: `${animal.emoji} ${animal.name}띠`
  };
}

function getBirthElement(birthDate: string): FiveElement {
  const month = Number(birthDate.slice(5, 7));
  if ([2, 3].includes(month)) return "나무";
  if ([5, 6].includes(month)) return "불";
  if ([1, 11, 12].includes(month)) return "물";
  if ([8, 9].includes(month)) return "금";
  return "흙";
}

function getTodayElement(dateKey: string): FiveElement {
  const [year, month, day] = dateKey.split("-").map(Number);
  const seasonal = getBirthElement(`${year}-${String(month).padStart(2, "0")}-01`);
  const cycle = (year + month * 2 + day * 3) % 5;
  const cycleElement: FiveElement[] = ["나무", "불", "흙", "금", "물"];

  return hash(`${dateKey}|today-element`) % 3 === 0
    ? seasonal
    : cycleElement[cycle];
}

function getTimeEnergy(birthTime: string) {
  const effectiveBirthTime =
    !birthTime || birthTime === "unknown" ? "12:00" : birthTime;
  const hour = Number(effectiveBirthTime.slice(0, 2));
  if (hour >= 5 && hour <= 8) {
    return { element: "나무" as const, label: "차분한 시작의 리듬" };
  }
  if (hour >= 9 && hour <= 12) {
    return { element: "불" as const, label: "밝은 표현의 리듬" };
  }
  if (hour >= 13 && hour <= 16) {
    return { element: "흙" as const, label: "안정적인 조율의 리듬" };
  }
  if (hour >= 17 && hour <= 20) {
    return { element: "금" as const, label: "정리와 집중의 리듬" };
  }
  return { element: "물" as const, label: "부드러운 관찰의 리듬" };
}

function getRelation(
  birthElement: FiveElement,
  todayElement: FiveElement
): EnergyRelation {
  if (birthElement === todayElement) return "같은 기운";
  if (
    generates[todayElement] === birthElement ||
    generates[birthElement] === todayElement
  ) {
    return "상생";
  }
  if (
    controls[todayElement] === birthElement ||
    controls[birthElement] === todayElement
  ) {
    return "긴장";
  }
  return "조율";
}

function relationPhrase(relation: EnergyRelation) {
  if (relation === "상생") {
    return "서로 다른 흐름이 자연스럽게 힘을 보태는 날입니다.";
  }
  if (relation === "같은 기운") {
    return "익숙한 장점이 또렷하게 살아나는 날입니다.";
  }
  if (relation === "긴장") {
    return "속도와 균형을 잘 조절할수록 좋은 방향으로 풀리는 날입니다.";
  }
  return "상황을 부드럽게 조율할 때 기회가 커지는 날입니다.";
}

function buildEnergy(person: Person, dateKey: string): FortuneEnergy {
  const birthElement = getBirthElement(person.birthDate);
  const todayElement = getTodayElement(dateKey);
  const timeEnergy = getTimeEnergy(person.birthTime);
  const relation = getRelation(birthElement, todayElement);
  const relationBoost = {
    상생: 18,
    "같은 기운": 15,
    조율: 10,
    긴장: 6
  }[relation];
  const timeBoost =
    timeEnergy.element === birthElement
      ? 7
      : generates[timeEnergy.element] === birthElement ||
          generates[birthElement] === timeEnergy.element
        ? 5
        : controls[timeEnergy.element] === birthElement ||
            controls[birthElement] === timeEnergy.element
          ? 2
          : 4;
  const personalSeed = `${person.id}|${person.name}|${person.birthDate}|${person.birthTime}|${dateKey}`;
  const harmonyScore = clamp(
    58 + relationBoost + timeBoost + (hash(`${personalSeed}|harmony`) % 17),
    55,
    99
  );

  return {
    birthElement,
    todayElement,
    timeElement: timeEnergy.element,
    timeEnergy: timeEnergy.label,
    relation,
    harmonyScore
  };
}

function scoreLegacyCategory(
  key: FortuneCategory["key"],
  energy: FortuneEnergy,
  seed: string
) {
  const categoryElement: Record<FortuneCategory["key"], FiveElement> = {
    love: "불",
    money: "금",
    health: "흙",
    relationship: "나무",
    lucky: energy.todayElement
  };
  const targetElement = categoryElement[key];
  const matchBoost =
    targetElement === energy.todayElement
      ? 8
      : targetElement === energy.birthElement
        ? 6
        : generates[energy.todayElement] === targetElement ||
            generates[energy.birthElement] === targetElement
          ? 5
          : controls[energy.todayElement] === targetElement
            ? 1
            : 3;

  return clamp(
    58 + Math.round(energy.harmonyScore * 0.26) + matchBoost + (hash(seed) % 12),
    55,
    99
  );
}

function legacyScoreTone(score: number) {
  if (score >= 90) return "매우 밝은";
  if (score >= 82) return "안정적으로 좋은";
  if (score >= 74) return "차분히 올라오는";
  return "천천히 다듬으면 좋아지는";
}

function makeSummary(person: Person, dateKey: string, energy: FortuneEnergy) {
  const todayDate = formatKoreanDate(dateKey);
  const variants = [
    `${todayDate}은 작은 선택이 좋은 결과로 이어질 가능성이 큰 날입니다. ${relationPhrase(energy.relation)} 무리한 확장보다 자연스러운 흐름을 따라가면 편안한 성과가 쌓입니다.`,
    `오늘은 ${elementTone[energy.todayElement]} 분위기가 강하게 느껴지는 날입니다. 주변의 흐름을 읽으며 자신의 속도를 지키면 운이 부드럽게 살아납니다.`,
    `${person.name}님의 오늘은 내면의 리듬을 정돈하기 좋은 흐름입니다. 조화 점수는 ${energy.harmonyScore}점으로, 큰 승부보다 말과 태도의 균형을 맞출 때 좋은 기운이 밖으로 드러납니다.`
  ];
  return pick(variants, `${person.id}|${dateKey}|summary`);
}

function makeCategoryDescription(
  key: FortuneCategory["key"],
  score: number,
  person: Person,
  dateKey: string,
  energy: FortuneEnergy
) {
  const tone = legacyScoreTone(score);
  const birthKeyword = pick(
    elementKeywords[energy.birthElement],
    `${person.id}|${dateKey}|${key}|birth-keyword`
  );
  const todayKeyword = pick(
    elementKeywords[energy.todayElement],
    `${person.id}|${dateKey}|${key}|today-keyword`
  );
  const seed = `${person.id}|${person.name}|${dateKey}|${key}|copy`;

  const copy: Record<FortuneCategory["key"], string[]> = {
    love: [
      `연애운은 ${tone} 편입니다. 오늘은 ${birthKeyword}의 감각과 ${todayKeyword}의 분위기가 어우러져 감정 표현을 서두르기보다 상대의 분위기를 살필 때 더 부드럽습니다.`,
      `오늘은 마음을 크게 드러내기보다 진심의 온도를 안정적으로 전하는 쪽이 좋습니다. 따뜻한 말 한마디가 관계의 기운을 자연스럽게 열어 줍니다.`,
      `${relationPhrase(energy.relation)} 연애운에서는 빠른 결론보다 서로의 속도를 맞추는 태도가 운을 돕고, 작은 배려가 오래 남는 흐름을 만듭니다.`
    ],
    money: [
      `금전운은 ${tone} 흐름입니다. 오늘은 ${todayKeyword}의 감각이 살아나니, 큰 확장보다 지출을 정리하고 필요한 곳에 집중하는 판단이 유리합니다.`,
      `재물의 흐름은 갑작스러운 변화보다 차분한 계산에서 안정됩니다. ${birthKeyword}의 감각을 살려 우선순위를 정하면 작은 선택에서도 실속을 챙기기 좋습니다.`,
      `오늘은 돈의 흐름을 한 번 더 살펴보기 좋은 날입니다. 즉흥적인 소비보다 목록을 정리하고 비교하는 태도가 금전운을 단단하게 받쳐 줍니다.`
    ],
    health: [
      `건강운은 ${tone} 날입니다. 오늘은 몸의 리듬을 천천히 살피며, 무리한 속도보다 회복 시간을 챙기는 태도가 좋습니다.`,
      `몸이 보내는 작은 신호를 듣기 좋은 날입니다. 과하게 밀어붙이기보다 식사, 수분, 짧은 움직임을 고르게 챙기면 하루가 더 안정됩니다.`,
      `오늘은 기운을 밖으로만 쏟기보다 안쪽에서 정리하는 흐름이 있습니다. 숙면과 호흡을 가볍게 다뤄 주면 ${todayKeyword}의 기운이 더 부드럽게 이어집니다.`
    ],
    relationship: [
      `대인관계운은 ${tone} 흐름을 보입니다. 오늘은 ${todayKeyword}의 분위기가 살아나므로, 말의 양보다 태도와 신뢰감이 관계의 기운을 부드럽게 엽니다.`,
      `${relationPhrase(energy.relation)} 의견을 강하게 밀어붙이기보다 상대의 말을 한 번 받아 주면 조율의 힘이 커집니다.`,
      `${birthKeyword}의 장점이 차분히 드러나는 날입니다. 필요한 부탁이나 제안도 부드럽게 꺼내기 좋습니다.`
    ],
    lucky: [
      makeLuckyPoint(person, dateKey, energy),
      makeLuckyPoint(person, `${dateKey}|alt`, energy),
      makeLuckyPoint(person, `${dateKey}|soft`, energy)
    ]
  };

  return pick(copy[key], seed);
}

function makeLuckyPoint(person: Person, seed: string, energy: FortuneEnergy) {
  const luckyColors: Record<FiveElement, string[]> = {
    나무: ["연두색", "싱그러운 초록", "민트"],
    불: ["코랄", "따뜻한 분홍", "맑은 오렌지"],
    흙: ["크림 베이지", "꿀빛 노랑", "부드러운 브라운"],
    금: ["아이보리", "실버", "깔끔한 회색"],
    물: ["네이비", "투명한 블루", "맑은 하늘색"]
  };
  const luckyItems: Record<FiveElement, string[]> = {
    나무: ["작은 메모장", "초록 식물", "가벼운 펜"],
    불: ["따뜻한 음료", "밝은 액세서리", "향기 있는 소품"],
    흙: ["편한 신발", "정리된 가방", "부드러운 담요"],
    금: ["시계", "깔끔한 지갑", "작은 거울"],
    물: ["물병", "이어폰", "차분한 손의 핸드크림"]
  };
  const luckyActions = [
    "아침에 할 일을 세 가지로 정리하기",
    "중요한 말은 한 번 더 고른 뒤 전하기",
    "불필요한 지출 목록을 가볍게 지우기",
    "천천히 걷고 몸의 긴장을 풀어 주기",
    "고마운 사람에게 짧은 안부 전하기"
  ];
  const luckyDirections = ["동쪽", "남쪽", "중앙 자리", "서쪽", "북쪽"];
  const element = energy.todayElement;
  const color = pick(luckyColors[element], `${seed}|color`);
  const item = pick(luckyItems[element], `${seed}|item`);
  const action = pick(luckyActions, `${seed}|action`);
  const direction = pick(luckyDirections, `${seed}|direction`);

  const variants = [
    `오늘의 행운 포인트는 ${color}, ${item}, 그리고 '${action}'입니다. ${direction} 방향의 자리나 동선을 활용하면 마음의 중심을 잡기 좋습니다.`,
    `${item}처럼 손에 익은 물건이 오늘의 기운을 정돈해 줍니다. ${color} 계열의 색을 곁들이고 ${action}를 실천하면 하루의 리듬과 잘 맞습니다.`,
    `행운의 흐름은 ${direction} 쪽에서 차분히 열립니다. ${color}의 작은 포인트를 곁에 두고 ${item}을 챙기면 오늘의 기운이 부담스럽지 않게 이어집니다.`
  ];

  return pick(variants, `${seed}|lucky-copy`);
}

function makeWinnerPraise(
  person: Person,
  dateKey: string,
  keyword: string,
  energy: FortuneEnergy
) {
  const todayDate = formatKoreanDate(dateKey);
  return [
    `${todayDate}은 ${person.name}님의 장점과 오늘의 흐름이 안정적으로 맞물리는 날입니다.`,
    `하루의 리듬이 차분히 받쳐 주면서, ${relationPhrase(energy.relation)}`,
    `조화 점수 ${energy.harmonyScore}점의 흐름 속에서 특히 ${keyword}의 기운이 선명하니, 사람들 앞에서 존재감이 자연스럽게 살아납니다.`,
    `무리하게 앞서기보다 자신의 속도를 지킬수록 더 빛나는 날이에요. 오늘의 주인공으로 자신 있게 하루를 열어도 좋겠습니다.`
  ];
}

function makeRunnerUpMessage(
  person: Person,
  dateKey: string,
  keyword: string,
  energy: FortuneEnergy
) {
  const variants = [
    `오늘은 ${keyword}의 기운이 차분히 살아나는 날입니다. 1등의 흐름에는 살짝 미치지 못했지만, 자기 페이스를 지키면 충분히 좋은 하루가 됩니다.`,
    `${person.name}님의 오늘 흐름은 ${energy.relation} 관계로 이어집니다. 순위보다 중요한 것은 균형이므로, 주변의 흐름을 읽을수록 운이 안정됩니다.`,
    `관계와 선택의 기운이 부드럽게 열려 있습니다. 오늘의 순위보다 자신의 리듬을 믿는 데 강점이 있으니 충분히 좋은 흐름으로 하루를 만들 수 있습니다.`
  ];

  return pick(variants, `${person.id}|${dateKey}|runner`);
}

function calculateLegacyFortune(
  person: Person,
  dateKey = getLocalDateKey()
): DailyFortune {
  const base = `${person.name}|${person.gender}|${person.birthDate}|${person.birthTime}|${dateKey}`;
  const energy = buildEnergy(person, dateKey);
  const keyword = pick(
    [...elementKeywords[energy.birthElement], ...elementKeywords[energy.todayElement]],
    `${base}|keyword`
  );
  const categoryScores = Object.fromEntries(
    categoryKeys.map((key) => [
      key,
      scoreLegacyCategory(key, energy, `${base}|${key}|score`)
    ])
  ) as Record<FortuneCategory["key"], number>;
  const score = clamp(
    Math.round(
      energy.harmonyScore * 0.68 +
        Object.values(categoryScores).reduce((sum, value) => sum + value, 0) *
          0.064 +
        (hash(`${base}|total`) % 8)
    ),
    60,
    99
  );

  const categories = categoryKeys.map((key, index) => {
    const categoryScore = categoryScores[key];
    return {
      key,
      label: categoryLabels[index],
      score: categoryScore,
      description: makeCategoryDescription(
        key,
        categoryScore,
        person,
        dateKey,
        energy
      )
    };
  });

  return {
    person,
    score,
    categories,
    keyword,
    summary: makeSummary(person, dateKey, energy),
    energy,
    winnerPraise: makeWinnerPraise(person, dateKey, keyword, energy),
    runnerUpMessage: makeRunnerUpMessage(person, dateKey, keyword, energy)
  };
}

function getRoomNumberForSeed(person: Person) {
  const roomNumber = (person as Person & { roomNumber?: unknown }).roomNumber;
  return String(roomNumber ?? "local").trim() || "local";
}

function buildNewBaseSeed(person: Person, dateKey: string) {
  return [
    getRoomNumberForSeed(person),
    person.id,
    person.name,
    person.gender,
    person.birthDate,
    person.birthTime,
    dateKey
  ].join("|");
}

function bucketedScore(seed: string) {
  const roll = hash(seed) % 100;
  const inner = hash(`${seed}|inner`);

  if (roll < 16) return 60 + (inner % 10);
  if (roll < 46) return 70 + (inner % 10);
  if (roll < 80) return 80 + (inner % 10);
  return 90 + (inner % 11);
}

function scoreNewCategory(
  key: FortuneCategory["key"],
  energy: FortuneEnergy,
  seed: string
) {
  const categoryElement: Record<FortuneCategory["key"], FiveElement> = {
    love: "불",
    money: "금",
    health: "흙",
    relationship: "나무",
    lucky: energy.todayElement
  };
  const targetElement = categoryElement[key];
  const relationAdjustment = {
    상생: 3,
    "같은 기운": 2,
    조율: 0,
    긴장: -2
  }[energy.relation];
  const elementAdjustment =
    targetElement === energy.todayElement
      ? 3
      : targetElement === energy.birthElement
        ? 2
        : generates[energy.todayElement] === targetElement ||
            generates[energy.birthElement] === targetElement
          ? 1
          : controls[energy.todayElement] === targetElement
            ? -2
            : 0;

  return clamp(bucketedScore(seed) + relationAdjustment + elementAdjustment, 60, 100);
}

function calculateOverallScore(
  categoryScores: Record<FortuneCategory["key"], number>
) {
  const total = categoryKeys.reduce((sum, key) => sum + categoryScores[key], 0);
  return clamp(Math.round(total / categoryKeys.length), 60, 100);
}

function newScoreTone(score: number) {
  if (score >= 90) return "매우 빛나는";
  if (score >= 80) return "좋은 기회가 열리는";
  if (score >= 70) return "무난하지만 작은 선택이 중요한";
  return "조심과 준비가 힘이 되는";
}

const categoryKeywordPool: Record<FortuneCategory["key"], string[]> = {
  love: ["진심", "만남", "따뜻한 말", "설렘"],
  money: ["실속", "정리", "작은 이익", "판단"],
  health: ["회복", "리듬", "가벼움", "휴식"],
  relationship: ["소통", "신뢰", "협력", "배려"],
  lucky: ["작은 행운", "반짝임", "기회", "좋은 타이밍"]
};

function pickUniqueKeywords(pool: string[], seed: string, count = 3) {
  const selected: string[] = [];
  let attempt = 0;

  while (selected.length < count && attempt < pool.length * 4) {
    const keyword = pick(pool, `${seed}|keyword|${attempt}`);
    if (!selected.includes(keyword)) selected.push(keyword);
    attempt += 1;
  }

  return selected.length ? selected : ["집중력", "만남", "작은 행운"];
}

function makeNewKeyword(
  person: Person,
  dateKey: string,
  energy: FortuneEnergy,
  categoryScores: Record<FortuneCategory["key"], number>
) {
  const orderedKeys = [...categoryKeys].sort(
    (a, b) => categoryScores[b] - categoryScores[a]
  );
  const pool = [
    ...elementKeywords[energy.todayElement],
    ...orderedKeys.flatMap((key) => categoryKeywordPool[key])
  ];

  return pickUniqueKeywords(
    pool,
    `${buildNewBaseSeed(person, dateKey)}|new-keyword`
  ).join(" · ");
}

const categoryGoodLines: Record<FortuneCategory["key"], string[]> = {
  love: [
    "마음을 담은 말이 평소보다 부드럽게 전해지기 쉽습니다",
    "작은 관심 표현이 관계의 온도를 살짝 올려 줍니다",
    "상대의 반응을 읽는 감각이 좋아지는 흐름입니다"
  ],
  money: [
    "필요한 것과 미뤄도 되는 것을 구분하기 좋은 날입니다",
    "작은 절약이나 정리가 생각보다 큰 만족으로 이어질 수 있습니다",
    "실속 있는 선택을 발견하기 쉬운 흐름입니다"
  ],
  health: [
    "몸과 마음의 리듬을 다시 맞추기 좋은 날입니다",
    "가벼운 움직임이 컨디션을 부드럽게 끌어올립니다",
    "휴식의 질을 높이면 하루의 안정감이 커집니다"
  ],
  relationship: [
    "사람들과의 흐름이 자연스럽게 맞아떨어질 수 있습니다",
    "짧은 대화 속에서도 좋은 인상을 남기기 쉽습니다",
    "협력과 배려가 관계의 분위기를 밝게 만듭니다"
  ],
  lucky: [
    "작은 우연이 기분 좋은 방향으로 이어질 수 있습니다",
    "평소 지나치던 선택지에서 반짝이는 힌트를 얻기 쉽습니다",
    "소소한 물건이나 색감이 하루의 기분을 잘 받쳐 줍니다"
  ]
};

const categoryCautionLines: Record<FortuneCategory["key"], string[]> = {
  love: [
    "마음이 앞서면 말의 온도가 조금 세게 느껴질 수 있습니다",
    "기대가 커질수록 상대의 속도를 함께 살피는 편이 좋습니다",
    "중요한 감정 표현은 한 번 더 다듬어 전하면 좋습니다"
  ],
  money: [
    "즉흥적인 소비는 만족보다 아쉬움을 남길 수 있습니다",
    "좋아 보이는 제안도 조건을 차분히 확인하는 편이 좋습니다",
    "작은 지출이 겹치지 않도록 목록을 가볍게 정리해 주세요"
  ],
  health: [
    "무리해서 속도를 내면 피로가 조금 빨리 쌓일 수 있습니다",
    "컨디션이 괜찮아 보여도 쉬어 가는 시간을 놓치지 않는 편이 좋습니다",
    "몸이 보내는 작은 신호를 가볍게 넘기지 않는 것이 좋습니다"
  ],
  relationship: [
    "농담이나 짧은 말이 다르게 받아들여질 수 있으니 톤을 살펴 주세요",
    "서두른 판단보다 한 번 더 듣는 태도가 관계를 편안하게 만듭니다",
    "모두를 맞추려다 자신의 리듬을 잃지 않도록 조심해 주세요"
  ],
  lucky: [
    "행운을 크게 잡으려 하기보다 작게 확인하는 태도가 좋습니다",
    "한 번에 많은 일을 벌리면 좋은 흐름이 흩어질 수 있습니다",
    "기분에만 기대기보다 작은 준비를 곁들이면 더 안정적입니다"
  ]
};

const categoryAdviceLines: Record<FortuneCategory["key"], string[]> = {
  love: [
    "먼저 안부를 묻거나 고마움을 짧게 전해 보세요.",
    "답을 서두르지 말고 대화의 여백을 조금 남겨 보세요.",
    "부드러운 표현 하나가 오늘의 분위기를 바꿀 수 있습니다."
  ],
  money: [
    "결제 전 한 번만 더 비교하면 실속을 챙기기 좋습니다.",
    "오늘의 지출 기준을 간단히 정해 두면 마음이 편해집니다.",
    "작은 정리부터 시작하면 금전운이 안정적으로 이어집니다."
  ],
  health: [
    "물, 식사, 짧은 산책처럼 기본을 챙기면 충분합니다.",
    "잠깐의 스트레칭이나 깊은 호흡이 좋은 전환점이 됩니다.",
    "오늘은 오래 버티기보다 자주 회복하는 쪽이 유리합니다."
  ],
  relationship: [
    "상대의 말을 한 박자 더 듣고 답하면 흐름이 좋아집니다.",
    "부탁이나 제안은 짧고 분명하게 전하는 편이 좋습니다.",
    "가벼운 칭찬 한마디가 관계의 문을 부드럽게 열어 줍니다."
  ],
  lucky: [
    "눈에 잘 보이는 곳에 작은 행운 아이템을 하나 두세요.",
    "망설이던 일을 아주 작게 시작해 보면 좋은 신호가 옵니다.",
    "오늘의 좋은 타이밍은 천천히 살필수록 잘 보입니다."
  ]
};

function makeNewCategoryDescription(
  key: FortuneCategory["key"],
  score: number,
  person: Person,
  dateKey: string
) {
  const seed = `${buildNewBaseSeed(person, dateKey)}|${key}|new-copy`;
  const tone = newScoreTone(score);
  const good = pick(categoryGoodLines[key], `${seed}|good`);
  const caution = pick(categoryCautionLines[key], `${seed}|caution`);
  const advice = pick(categoryAdviceLines[key], `${seed}|advice`);

  return `${categoryLabels[categoryKeys.indexOf(key)]}은 ${tone} 흐름입니다. ${good}. 다만 ${caution}. ${advice}`;
}

function makeNewSummary(
  person: Person,
  dateKey: string,
  keyword: string,
  categoryScores: Record<FortuneCategory["key"], number>
) {
  const todayDate = formatKoreanDate(dateKey);
  const orderedKeys = [...categoryKeys].sort(
    (a, b) => categoryScores[b] - categoryScores[a]
  );
  const strongest = orderedKeys[0];
  const softest = orderedKeys[orderedKeys.length - 1];
  const seed = `${buildNewBaseSeed(person, dateKey)}|new-summary`;
  const good = pick(categoryGoodLines[strongest], `${seed}|summary-good`);
  const caution = pick(categoryCautionLines[softest], `${seed}|summary-caution`);
  const advice = pick(categoryAdviceLines[softest], `${seed}|summary-advice`);

  return `${todayDate}의 키워드는 ${keyword}입니다. 오늘은 ${good}. 특히 작은 제안이나 대화 속에서 뜻밖의 기회가 피어날 수 있습니다. 다만 ${caution}. ${advice}`;
}

function makeNewWinnerPraise(
  person: Person,
  dateKey: string,
  keyword: string,
  score: number
) {
  const todayDate = formatKoreanDate(dateKey);
  return [
    `${todayDate}은 ${person.name}님의 좋은 흐름이 또렷하게 살아나는 날입니다.`,
    `종합점수 ${score}점은 다섯 가지 운세가 고르게 받쳐 준 결과예요.`,
    `특히 ${keyword}의 분위기가 선명하니, 사람들 앞에서 존재감이 자연스럽게 빛날 수 있습니다.`,
    `다만 좋은 흐름일수록 말과 선택을 한 번 더 다듬으면 오늘의 주인공다운 하루가 더 편안하게 이어집니다.`
  ];
}

function makeNewRunnerUpMessage(
  person: Person,
  dateKey: string,
  keyword: string,
  score: number
) {
  const variants = [
    `${person.name}님의 오늘은 ${keyword}의 흐름이 살아 있는 ${score}점의 하루입니다. 순위보다 중요한 것은 자기 페이스이니, 작은 선택을 차분히 이어가면 충분히 좋은 날이 됩니다.`,
    `오늘은 아쉽게 주인공 자리를 살짝 비켜섰지만 ${keyword}의 기운은 분명히 있습니다. 무리하게 따라가기보다 잘 맞는 타이밍을 고르면 흐름이 안정됩니다.`,
    `${score}점의 운세는 조심할 부분과 좋은 가능성이 함께 있는 신호입니다. 주변의 속도에 휩쓸리지 않고 필요한 말만 또렷하게 전해 보세요.`
  ];

  return pick(variants, `${person.id}|${dateKey}|new-runner`);
}

function calculateNewFortune(
  person: Person,
  dateKey = getLocalDateKey()
): DailyFortune {
  const base = buildNewBaseSeed(person, dateKey);
  const energy = buildEnergy(person, dateKey);
  const categoryScores = Object.fromEntries(
    categoryKeys.map((key) => [
      key,
      scoreNewCategory(key, energy, `${base}|${key}|new-score`)
    ])
  ) as Record<FortuneCategory["key"], number>;
  const score = calculateOverallScore(categoryScores);
  const keyword = makeNewKeyword(person, dateKey, energy, categoryScores);
  const categories = categoryKeys.map((key, index) => {
    const categoryScore = categoryScores[key];
    return {
      key,
      label: categoryLabels[index],
      score: categoryScore,
      description: makeNewCategoryDescription(
        key,
        categoryScore,
        person,
        dateKey
      )
    };
  });

  return {
    person,
    score,
    categories,
    keyword,
    summary: makeNewSummary(person, dateKey, keyword, categoryScores),
    energy,
    winnerPraise: makeNewWinnerPraise(person, dateKey, keyword, score),
    runnerUpMessage: makeNewRunnerUpMessage(person, dateKey, keyword, score)
  };
}

export function calculateFortune(
  person: Person,
  dateKey = getLocalDateKey()
): DailyFortune {
  return shouldUseNewScoring(dateKey)
    ? calculateNewFortune(person, dateKey)
    : calculateLegacyFortune(person, dateKey);
}

export function rankFortunes(people: Person[], dateKey = getLocalDateKey()) {
  return people
    .map((person) => calculateFortune(person, dateKey))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        hash(`${b.person.id}|${dateKey}|tie`) -
        hash(`${a.person.id}|${dateKey}|tie`)
      );
    });
}
