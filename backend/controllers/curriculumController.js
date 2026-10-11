import mongoose from "mongoose";
import curriculumModel from "../models/curriculumModel.js";
import lessonModel from "../models/lessonModel.js";
import userModel from "../models/userModel.js";
import { curriculumGraph, validateCurriculumTree } from "../utils/curriculumTree.js";

const allowedRoles = ["pascal", "admin", "leader", "pamela"];
const validId = (id) => typeof id === "string" && mongoose.isObjectIdOrHexString(id);
const fail = (res, status, message) => res.status(status).json({ success: false, message });

const canEdit = async (req, res) => {
  const user = await userModel.findById(req.userId);
  if (!user) {
    fail(res, 404, "User not found");
    return false;
  }
  const roles = Array.isArray(user.role) ? user.role : [user.role];
  if (!roles.some((role) => allowedRoles.includes(role))) {
    fail(res, 403, "You are not allowed to manage curriculum");
    return false;
  }
  return true;
};

const validateInput = async (body, res, partial = false) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail(res, 400, "A curriculum request body is required");
    return null;
  }
  const data = {};
  if (!partial || Object.hasOwn(body, "name")) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      fail(res, 400, "Curriculum name is required and must be a non-empty string");
      return null;
    }
    data.name = body.name.trim();
  }
  if (!partial || Object.hasOwn(body, "nodes")) {
    const nodes = Object.hasOwn(body, "nodes") ? body.nodes : [];
    const treeError = validateCurriculumTree(nodes);
    if (treeError) {
      fail(res, 400, treeError);
      return null;
    }
    if (nodes.some((node) => !validId(node.lesson))) {
      fail(res, 400, "Each node must reference a valid lesson id in its lesson field");
      return null;
    }
    const lessonIds = [...new Set(nodes.map((node) => node.lesson.toLowerCase()))];
    if (lessonIds.length) {
      const count = await lessonModel.countDocuments({ _id: mongoose.trusted({ $in: lessonIds }) });
      if (count !== lessonIds.length) {
        fail(res, 400, "One or more referenced lessons do not exist");
        return null;
      }
    }
    data.nodes = nodes.map(({ id, lesson, parentId }) => ({ id, lesson, parentId }));
  }
  if (partial && !Object.keys(data).length) {
    fail(res, 400, "Supply name or nodes to update the curriculum");
    return null;
  }
  return data;
};

const populateCurriculum = (curriculum) => curriculum.populate("nodes.lesson");
const serialize = (curriculum) => ({
  ...curriculum.toObject(),
  graph: curriculumGraph(curriculum),
});

const handleError = (res, error) => {
  if (error.name === "ValidationError" || error.name === "CastError") {
    return fail(res, 400, error.message);
  }
  if (error.name === "VersionError" || error.name === "DocumentNotFoundError") {
    return fail(res, 409, "Curriculum changed while you were editing. Reload and try again.");
  }
  console.error("Curriculum error:", error);
  return fail(res, 500, "Unable to process curriculum request");
};

export const createCurriculum = async (req, res) => {
  try {
    if (!(await canEdit(req, res))) return;
    const data = await validateInput(req.body, res);
    if (!data) return;
    const curriculum = await curriculumModel.create({ ...data, createdBy: req.userId });
    await populateCurriculum(curriculum);
    return res.status(201).json({ success: true, curriculum: serialize(curriculum) });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getCurricula = async (req, res) => {
  try {
    const curriculum = await curriculumModel.find().sort({ createdAt: -1 }).populate("nodes.lesson");
    return res.status(200).json({ success: true, curriculum: curriculum.map(serialize) });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getCurriculumById = async (req, res) => {
  try {
    if (!validId(req.params.curriculumId)) return fail(res, 400, "Invalid curriculum id");
    const curriculum = await curriculumModel.findById(req.params.curriculumId).populate("nodes.lesson");
    if (!curriculum) return fail(res, 404, "Curriculum not found");
    return res.status(200).json({ success: true, curriculum: serialize(curriculum) });
  } catch (error) {
    return handleError(res, error);
  }
};

export const updateCurriculum = async (req, res) => {
  try {
    if (!(await canEdit(req, res))) return;
    if (!validId(req.params.curriculumId)) return fail(res, 400, "Invalid curriculum id");
    const curriculum = await curriculumModel.findById(req.params.curriculumId);
    if (!curriculum) return fail(res, 404, "Curriculum not found");
    const data = await validateInput(req.body, res, true);
    if (!data) return;
    curriculum.set(data);
    await curriculum.save();
    await populateCurriculum(curriculum);
    return res.status(200).json({ success: true, curriculum: serialize(curriculum) });
  } catch (error) {
    return handleError(res, error);
  }
};

export const deleteCurriculum = async (req, res) => {
  try {
    if (!(await canEdit(req, res))) return;
    if (!validId(req.params.curriculumId)) return fail(res, 400, "Invalid curriculum id");
    const curriculum = await curriculumModel.findByIdAndDelete(req.params.curriculumId);
    if (!curriculum) return fail(res, 404, "Curriculum not found");
    return res.status(200).json({ success: true, message: "Curriculum deleted successfully" });
  } catch (error) {
    return handleError(res, error);
  }
};
