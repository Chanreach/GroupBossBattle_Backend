import User from "./user.model.js";
import Event from "./event.model.js";
import Boss from "./boss.model.js";
import Category from "./category.model.js";
import Question from "./question.model.js";
import AnswerChoice from "./answer_choice.model.js";
import EventBoss from "./event_boss.model.js";
import PlayerSession from "./player_session.model.js";
import Badge from "./badge.model.js";
import UserBadge from "./user_badge.model.js";
import Leaderboard from "./leaderboard.model.js";

// User and Event associations
User.hasMany(Event, { foreignKey: "creatorId", as: "createdEvents" });
Event.belongsTo(User, { foreignKey: "creatorId", as: "creator" });

// User and Boss associations
User.hasMany(Boss, { foreignKey: "creatorId", as: "createdBosses" });
Boss.belongsTo(User, { foreignKey: "creatorId", as: "creator" });

// User and PlayerSession associations (nullable userId for guests)
User.hasMany(PlayerSession, { foreignKey: "userId", as: "playerSessions" });
PlayerSession.belongsTo(User, { foreignKey: "userId", as: "user" });

// PlayerSession and Event associations
Event.hasMany(PlayerSession, { foreignKey: "eventId", as: "playerSessions" });
PlayerSession.belongsTo(Event, { foreignKey: "eventId", as: "event" });

// User and Question associations
User.hasMany(Question, { foreignKey: "authorId", as: "createdQuestions" });
Question.belongsTo(User, { foreignKey: "authorId", as: "creator" });

// User and Category associations
User.hasMany(Category, { foreignKey: "creatorId", as: "createdCategories" });
Category.belongsTo(User, { foreignKey: "creatorId", as: "creator" });

// EventBoss and Event associations
Event.hasMany(EventBoss, { foreignKey: "eventId", as: "eventBosses" });
EventBoss.belongsTo(Event, {
  foreignKey: "eventId",
  as: "event",
  onDelete: "CASCADE",
});

// EventBoss and Boss associations
Boss.hasMany(EventBoss, { foreignKey: "bossId", as: "eventBosses" });
EventBoss.belongsTo(Boss, {
  foreignKey: "bossId",
  as: "boss",
  onDelete: "CASCADE",
});

// Boss and Category associations
Boss.belongsToMany(Category, {
  through: "boss_categories",
  foreignKey: "bossId",
  otherKey: "categoryId",
  as: "Categories",
});
Category.belongsToMany(Boss, {
  through: "boss_categories",
  foreignKey: "categoryId",
  otherKey: "bossId",
  as: "bosses",
});

// Category and Question associations
Category.hasMany(Question, { foreignKey: "categoryId", as: "questions" });
Question.belongsTo(Category, {
  foreignKey: "categoryId",
  as: "category",
  onDelete: "CASCADE",
});

// Question and AnswerChoice associations
Question.hasMany(AnswerChoice, {
  foreignKey: "questionId",
  as: "answerChoices",
});
AnswerChoice.belongsTo(Question, {
  foreignKey: "questionId",
  as: "question",
  onDelete: "CASCADE",
});

// Badge and UserBadge associations
Badge.hasMany(UserBadge, { foreignKey: "badgeId", as: "userBadges" });
UserBadge.belongsTo(Badge, {
  foreignKey: "badgeId",
  as: "badge",
  onDelete: "CASCADE",
});

// UserBadge and EventBoss associations
EventBoss.hasMany(UserBadge, { foreignKey: "eventBossId", as: "badges" });
UserBadge.belongsTo(EventBoss, {
  foreignKey: "eventBossId",
  as: "eventBossForBadge",
  onDelete: "CASCADE",
});

// UserBadge and Event associations
Event.hasMany(UserBadge, { foreignKey: "eventId", as: "badges" });
UserBadge.belongsTo(Event, {
  foreignKey: "eventId",
  as: "event",
  onDelete: "CASCADE",
});

// PlayerSession and UserBadge associations
PlayerSession.hasMany(UserBadge, { foreignKey: "playerId", as: "badges" });
UserBadge.belongsTo(PlayerSession, { foreignKey: "playerId", as: "playerSession" });

// Leaderboard and EventBoss associations
EventBoss.hasMany(Leaderboard, {
  foreignKey: "eventBossId",
  as: "leaderboardEntries",
});
Leaderboard.belongsTo(EventBoss, {
  foreignKey: "eventBossId",
  as: "eventBoss",
});

// PlayerSession and Leaderboard associations
PlayerSession.hasMany(Leaderboard, {
  foreignKey: "playerId",
  as: "leaderboardEntries",
});
Leaderboard.belongsTo(PlayerSession, {
  foreignKey: "playerId",
  as: "playerSession",
});

export {
  User,
  Event,
  Boss,
  Category,
  Question,
  AnswerChoice,
  EventBoss,
  PlayerSession,
  Badge,
  UserBadge,
  Leaderboard,
};
