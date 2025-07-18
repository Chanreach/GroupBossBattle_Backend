import sequelize from "../config/db.js";
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
import "./associations.js";

export {
  sequelize,
  User,
  Event,
  Boss,
  Category,
  Question,
  AnswerChoice,
  EventBoss,
  BossSession,
  PlayerSession,
  Badge,
  UserBadge,
  Leaderboard,
};
