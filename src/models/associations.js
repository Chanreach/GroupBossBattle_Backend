import User from "./user.model.js";
import Event from "./event.model.js";
import Boss from "./boss.model.js";
import Category from "./category.model.js";
import Question from "./question.model.js";
import AnswerChoice from "./answer_choice.model.js";
import EventBoss from "./event_boss.model.js";
import BossSession from "./boss_session.model.js";
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

// User and PlayerSession associations
User.hasMany(PlayerSession, { foreignKey: "userId", as: "playerSessions" });
PlayerSession.belongsTo(User, { foreignKey: "userId", as: "user" });

// User and UserBadge associations
User.hasMany(UserBadge, { foreignKey: "userId", as: "badges" });
UserBadge.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
  onDelete: "CASCADE",
});

// User and Leaderboard associations
User.hasMany(Leaderboard, { foreignKey: "userId", as: "leaderboards" });
Leaderboard.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
  onDelete: "CASCADE",
});

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

// BossSession and EventBoss associations
EventBoss.hasMany(BossSession, { foreignKey: "eventBossId", as: "sessions" });
BossSession.belongsTo(EventBoss, {
  foreignKey: "eventBossId",
  as: "eventBoss",
  onDelete: "CASCADE",
});

// BossSession and PlayerSession associations
BossSession.hasMany(PlayerSession, {
  foreignKey: "bossSessionId",
  as: "players",
});
PlayerSession.belongsTo(BossSession, {
  foreignKey: "bossSessionId",
  as: "bossSession",
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

// UserBadge and Badge associations
Badge.hasMany(UserBadge, { foreignKey: "badgeId", as: "userBadges" });
UserBadge.belongsTo(Badge, { foreignKey: "badgeId", as: "badge" });

// UserBadge and BossSession associations
UserBadge.belongsTo(BossSession, {
  foreignKey: "bossSessionId",
  as: "bossSession",
});
BossSession.hasMany(UserBadge, {
  foreignKey: "bossSessionId",
  as: "badgesEarned",
});

// Leaderboard and Event associations
Event.hasMany(Leaderboard, { foreignKey: "eventId", as: "leaderboards" });
Leaderboard.belongsTo(Event, {
  foreignKey: "eventId",
  as: "event",
  onDelete: "CASCADE",
});

// Leaderboard and EventBoss associations
EventBoss.hasMany(Leaderboard, {
  foreignKey: "eventBossId",
  as: "leaderboards",
});
Leaderboard.belongsTo(EventBoss, {
  foreignKey: "eventBossId",
  as: "eventBoss",
  onDelete: "CASCADE",
});
