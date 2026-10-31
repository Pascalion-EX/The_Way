import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import Lesson from "../models/lessonModel.js";
import Game from "../models/gamesModel.js";
import Activity from "../models/activitiesModel.js";
import Chant from "../models/chantModel.js";
import User from "../models/userModel.js";
import { getLessons, getLessonById } from "../controllers/lessonController.js";
import { getAllGames, getGameById } from "../controllers/gameController.js";
import { getAllActivities, getActivityById } from "../controllers/activitiesController.js";
import { getAllChants, getChantById } from "../controllers/chantController.js";

const userId = "6ab26b08171afea3091f04b3";
const creatorId = new mongoose.Types.ObjectId("6ab26b08171afea3091f04b4");
const clone = (value) => JSON.parse(JSON.stringify(value));
const content = "Complete content must remain available only on the detail page. ".repeat(300);

async function request(controller, query = {}, id) {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = clone(body); return this; },
  };
  await controller({ userId, query, params: { id, lessonId: id } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  return res.body;
}

const cases = [
  { name: "lessons", model: Lesson, list: getLessons, detail: getLessonById, key: "lesson", fields: ["_id", "title", "name", "image", "year"], contentKey: "body" },
  { name: "games", model: Game, list: getAllGames, detail: getGameById, key: "game", fields: ["_id", "name", "image"], contentKey: "explanation" },
  { name: "activities", model: Activity, list: getAllActivities, detail: getActivityById, key: "activity", fields: ["_id", "name", "image"], contentKey: "explanation" },
  { name: "chants", model: Chant, list: getAllChants, detail: getChantById, key: "chant", fields: ["_id", "title", "image", "isFavorite"], contentKey: "lyrics" },
];

for (const entry of cases) {
  test(`${entry.name} lists return small cards and fetch complete content by ID`, async (t) => {
    const records = Array.from({ length: 7 }, (_, index) => ({
      _id: new mongoose.Types.ObjectId(), title: `Title ${index}`, name: `Name ${index}`,
      image: `/uploads/${"a".repeat(64)}.webp`, year: 3, body: content,
      partitions: [{ title: "Introduction", body: content }], explanation: content, materials: content,
      lyrics: { arabic: "", coptic: "", english: content }, video: "https://www.youtube.com/embed/M7lc1UVf-VE", audio: "https://example.com/audio.mp3",
      category: "Kids", favorites: index % 2 ? [] : [new mongoose.Types.ObjectId(userId)],
      createdBy: creatorId, createdAt: new Date(), updatedAt: new Date(), futureContent: content,
    }));
    let populationReads = 0;
    const queries = [];
    // Keep real Mongoose query construction and casting, replacing database I/O.
    t.mock.method(entry.model.collection, "countDocuments", async () => records.length);
    t.mock.method(entry.model.collection, "find", (filter, options) => {
      if (entry.model === Lesson && options.projection?.variantGroup) {
        return { toArray: async () => [{ _id: records[0]._id, name: records[0].name, variantGroup: null }] };
      }
      queries.push({ filter, options });
      const fields = options.projection;
      assert.deepEqual(Object.keys(fields).sort(), [...entry.fields].sort(), "MongoDB must project only card fields");
      if (entry.model === Chant) {
        assert.deepEqual(fields.isFavorite, { $in: [new mongoose.Types.ObjectId(userId), { $ifNull: ["$favorites", []] }] });
      }
      const result = records.slice(options.skip || 0, (options.skip || 0) + (options.limit || records.length)).map((record) => ({
        ...Object.fromEntries(Object.entries(record).filter(([key]) => fields[key] === 1)),
        ...(entry.model === Chant ? { isFavorite: record.favorites.length > 0 } : {}),
      }));
      return { toArray: async () => result };
    });
    t.mock.method(entry.model.collection, "findOne", async () => records[0]);
    t.mock.method(User.collection, "find", () => {
      populationReads++;
      return { toArray: async () => [{ _id: creatorId, name: "Creator", email: "creator@example.com", role: ["leader"] }] };
    });

    for (const query of [{}, { page: "1" }, { page: "2", search: "content" }]) {
      const result = await request(entry.list, query);
      const cards = result[entry.name];
      assert.equal(cards.length, query.page === "2" ? 1 : query.page ? 6 : 7);
      for (const card of cards) assert.deepEqual(Object.keys(card).sort(), [...entry.fields].sort());
      assert.ok(JSON.stringify(result).length < 2500, "Large content must not be included in cards");
      assert.equal(populationReads, 0, "Card requests do not load author records");
      if (query.page) {
        assert.deepEqual(result.pagination, { page: Number(query.page), pageSize: 6, totalItems: 7, totalPages: 2 });
      }
    }
    if (entry.model !== Chant) {
      assert.ok(queries.at(-1).filter.$or.some((part) => Object.hasOwn(part, entry.contentKey)), "Search can still match full content");
    } else {
      const result = await request(entry.list, { favoriteOnly: "true", category: "Kids" });
      assert.equal(String(queries.at(-1).filter.favorites), userId);
      assert.equal(queries.at(-1).filter.category, "Kids");
      assert.equal(result.chants[0].isFavorite, true);
      assert.equal(result.chants[1].isFavorite, false);
    }
    const detail = await request(entry.detail, {}, String(records[0]._id));
    assert.deepEqual(detail[entry.key][entry.contentKey], records[0][entry.contentKey]);
    assert.equal(detail[entry.key].video, records[0].video);
  });
}
