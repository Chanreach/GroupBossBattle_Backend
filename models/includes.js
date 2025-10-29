import {
  User,
  Event,
  Boss,
  Category,
  Question,
  AnswerChoice,
  EventBoss,
  Badge,
  UserBadge,
  Leaderboard,
} from "./index.js";

export const creatorInclude = [{ model: User, as: "creator" }];
export const authorInclude = [{ model: User, as: "author" }];
export const userInclude = [{ model: User, as: "user" }];
export const eventInclude = [{ model: Event, as: "event" }];
export const badgeInclude = [{ model: Badge, as: "badge" }];
export const bossInclude = [{ model: Boss, as: "boss" }];
export const eventBossInclude = [{ model: EventBoss, as: "eventBoss" }];
export const categoriesInclude = [{ model: Category, as: "categories" }];
export const categoryInclude = [{ model: Category, as: "category" }];
export const questionsInclude = [{ model: Question, as: "questions" }];
export const answerChoicesInclude = [
  { model: AnswerChoice, as: "answerChoices" },
];
export const eventBossesInclude = [{ model: EventBoss, as: "eventBosses" }];

export const eventIncludes = ({
  includeCreator = false,
  includeEventBosses = false,
  includeBoss = false,
  includeCategories = false,
} = {}) => {
  const includes = [];

  if (includeCreator) includes.push(...creatorInclude);

  if (includeEventBosses) {
    const eventBossesAssoc = { ...eventBossesInclude[0] };
    eventBossesAssoc.include = [];

    if (includeBoss) {
      const bossAssoc = { ...bossInclude[0] };
      bossAssoc.include = [];

      if (includeCategories) {
        bossAssoc.include.push(...categoriesInclude);
      }

      eventBossesAssoc.include.push(bossAssoc);
    }

    includes.push(eventBossesAssoc);
  }
  return includes;
};

export const bossIncludes = ({
  includeCreator = false,
  includeEventBosses = false,
  includeCategories = false,
  includeQuestions = false,
  includeAnswerChoices = false,
} = {}) => {
  const includes = [];

  if (includeCreator) includes.push(...creatorInclude);
  if (includeEventBosses) includes.push(...eventBossesInclude);

  if (includeCategories) {
    const categoriesAssoc = { ...categoriesInclude[0] };
    categoriesAssoc.include = [];

    if (includeQuestions) {
      const questionsAssoc = { ...questionsInclude[0] };
      questionsAssoc.include = [];

      if (includeAnswerChoices) {
        questionsAssoc.include.push(...answerChoicesInclude);
      }

      categoriesAssoc.include.push(questionsAssoc);
    }

    includes.push(categoriesAssoc);
  }
  return includes;
};

export const categoryIncludes = ({
  includeCreator = false,
  includeQuestions = false,
  includeAnswerChoices = false,
} = {}) => {
  const includes = [];

  if (includeCreator) includes.push(...creatorInclude);

  if (includeQuestions) {
    const questionsAssoc = { ...questionsInclude[0] };
    questionsAssoc.include = [];

    if (includeAnswerChoices) {
      questionsAssoc.include.push(...answerChoicesInclude);
    }

    includes.push(questionsAssoc);
  }

  return includes;
};

export const questionIncludes = ({
  includeAuthor = false,
  includeCategory = false,
  includeAnswerChoices = false,
} = {}) => {
  const includes = [];

  if (includeAuthor) includes.push(...authorInclude);

  if (includeCategory) includes.push(...categoryInclude);

  if (includeAnswerChoices) includes.push(...answerChoicesInclude);

  return includes;
};

export const eventBossIncludes = ({
  includeEvent = false,
  includeBoss = false,
  includeCreator = false,
  includeCategories = false,
  includeQuestions = false,
  includeAnswerChoices = false,
} = {}) => {
  const includes = [];

  if (includeEvent) includes.push(...eventInclude);

  if (includeBoss) {
    const bossAssoc = { ...bossInclude[0] };
    bossAssoc.include = [];

    if (includeCreator) {
      bossAssoc.include.push(...creatorInclude);
    }

    if (includeCategories) {
      const categoriesAssoc = { ...categoriesInclude[0] };
      categoriesAssoc.include = [];

      if (includeQuestions) {
        const questionsAssoc = { ...questionsInclude[0] };
        questionsAssoc.include = [];

        if (includeAnswerChoices) {
          questionsAssoc.include.push(...answerChoicesInclude);
        }

        categoriesAssoc.include.push(questionsAssoc);
      }

      bossAssoc.include.push(categoriesAssoc);
    }

    includes.push(bossAssoc);
  }

  return includes;
};

export const userBadgeIncludes = ({
  includeUser = false,
  includeBadge = false,
  includeEventBoss = false,
  includeEvent = false,
} = {}) => {
  const includes = [];

  if (includeUser) includes.push(...userInclude);

  if (includeBadge) includes.push(...badgeInclude);

  if (includeEventBoss) includes.push(...eventBossInclude);

  if (includeEvent) includes.push(...eventInclude);

  return includes;
};
