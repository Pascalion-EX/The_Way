import express from "express";

import {
  createVideoRequest,
  getMyVideoRequests,
  getAllVideoRequests,
  getVideoRequestById,
  updateVideoRequest,
  deleteVideoRequest,
} from "../controllers/videoRequestController.js";

import userAuth from "../middleware/userAuth.js";

import {
  videoRequestUserOnly,
  pascalOnly,
} from "../middleware/videoRequestAuth.js";


const videoRequestRouter = express.Router();


// ============================================================
// USER ROUTES
//
// Allowed roles:
// Pamela
// leader
// pascal
// admin
// ============================================================


// ------------------------------------------------------------
// Create video editing request
//
// POST
// /api/video-requests
// ------------------------------------------------------------

videoRequestRouter.post(
  "/",
  userAuth,
  videoRequestUserOnly,
  createVideoRequest
);


// ------------------------------------------------------------
// Get logged-in user's own requests
//
// GET
// /api/video-requests/my
// ------------------------------------------------------------

videoRequestRouter.get(
  "/my",
  userAuth,
  videoRequestUserOnly,
  getMyVideoRequests
);


// ============================================================
// PASCAL MANAGEMENT ROUTES
// ============================================================


// ------------------------------------------------------------
// Get ALL video editing requests
//
// GET
// /api/video-requests
// ------------------------------------------------------------

videoRequestRouter.get(
  "/",
  userAuth,
  pascalOnly,
  getAllVideoRequests
);


// ------------------------------------------------------------
// Get one request
//
// GET
// /api/video-requests/:id
// ------------------------------------------------------------

videoRequestRouter.get(
  "/:id",
  userAuth,
  pascalOnly,
  getVideoRequestById
);


// ------------------------------------------------------------
// Update request
//
// PUT
// /api/video-requests/:id
//
// Used for:
// status
// notes
// priority
// deadline
// etc.
// ------------------------------------------------------------

videoRequestRouter.put(
  "/:id",
  userAuth,
  pascalOnly,
  updateVideoRequest
);


// ------------------------------------------------------------
// Delete request
//
// DELETE
// /api/video-requests/:id
// ------------------------------------------------------------

videoRequestRouter.delete(
  "/:id",
  userAuth,
  pascalOnly,
  deleteVideoRequest
);


export default videoRequestRouter;