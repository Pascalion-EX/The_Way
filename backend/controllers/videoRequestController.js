import VideoRequest from "../models/VideoRequestModel.js";
import userModel from "../models/userModel.js";
import transporter from "../config/nodemailer.js";

const VIDEO_REQUEST_EMAIL =
  process.env.VIDEO_REQUEST_EMAIL || "kerolos.a.fam@gmail.com";


// ============================================================
// Helper - escape user supplied text before inserting into email
// ============================================================

const escapeHtml = (value = "") => {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};


// ============================================================
// CREATE VIDEO REQUEST
// Allowed roles will be checked in middleware:
// Pamela, leader, pascal, admin
// ============================================================

export const createVideoRequest = async (req, res) => {
  try {
    const userId = req.userId;

    const {
      title,
      description,
      videoLink,
      referenceLink,
      deadline,
      priority,
    } = req.body;

    // -----------------------------
    // Validate required fields
    // -----------------------------

    if (!title || !description || !videoLink) {
      return res.status(400).json({
        success: false,
        message:
          "Title, description and video link are required.",
      });
    }


    // -----------------------------
    // Get logged-in user
    // -----------------------------

    const user = await userModel
      .findById(userId)
      .select("name email role");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }


    // -----------------------------
    // Create request
    // -----------------------------

    const videoRequest = await VideoRequest.create({
      title,
      description,
      videoLink,
      referenceLink: referenceLink || "",
      deadline: deadline || null,
      priority: priority || "Normal",
      requestedBy: userId,
    });


    // -----------------------------
    // Format deadline
    // -----------------------------

    const formattedDeadline = deadline
      ? new Date(deadline).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "No deadline specified";


    // -----------------------------
    // Email content
    // -----------------------------

    const subject = `New Video Editing Request - ${title}`;

    const textMessage = `
New Video Editing Request

Requested By:
${user.name}

Email:
${user.email}

Title:
${title}

Description:
${description}

Video Link:
${videoLink}

Reference Link:
${referenceLink || "None"}

Priority:
${priority || "Normal"}

Deadline:
${formattedDeadline}

Status:
Pending
    `;


    const htmlMessage = `
      <div
        style="
          font-family: Arial, sans-serif;
          max-width: 650px;
          margin: auto;
          color: #222;
        "
      >

        <h2 style="margin-bottom: 5px;">
          New Video Editing Request
        </h2>

        <p style="color: #666;">
          A new video editing request was submitted through The Way.
        </p>

        <hr />

        <p>
          <strong>Requested By:</strong><br />
          ${escapeHtml(user.name)}
        </p>

        <p>
          <strong>Email:</strong><br />
          ${escapeHtml(user.email)}
        </p>

        <p>
          <strong>Title:</strong><br />
          ${escapeHtml(title)}
        </p>

        <p>
          <strong>Description:</strong><br />
          ${escapeHtml(description).replaceAll("\n", "<br />")}
        </p>

        <p>
          <strong>Video Link:</strong><br />
          <a href="${escapeHtml(videoLink)}">
            ${escapeHtml(videoLink)}
          </a>
        </p>

        <p>
          <strong>Reference Link:</strong><br />

          ${
            referenceLink
              ? `
                <a href="${escapeHtml(referenceLink)}">
                  ${escapeHtml(referenceLink)}
                </a>
              `
              : "None"
          }
        </p>

        <p>
          <strong>Priority:</strong><br />
          ${escapeHtml(priority || "Normal")}
        </p>

        <p>
          <strong>Deadline:</strong><br />
          ${escapeHtml(formattedDeadline)}
        </p>

        <p>
          <strong>Status:</strong><br />
          Pending
        </p>

        <hr />

        <p style="font-size: 13px; color: #777;">
          Request ID:
          ${videoRequest._id}
        </p>

      </div>
    `;


    // -----------------------------
    // Send email
    // -----------------------------

    let emailSent = true;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: VIDEO_REQUEST_EMAIL,
        subject,
        text: textMessage,
        html: htmlMessage,
      });
    } catch (emailError) {
      emailSent = false;

      console.error(
        "Video request email failed:",
        emailError.message
      );
    }


    // -----------------------------
    // Populate requester
    // -----------------------------

    const populatedRequest =
      await VideoRequest.findById(videoRequest._id).populate(
        "requestedBy",
        "name email role"
      );


    return res.status(201).json({
      success: true,

      message: emailSent
        ? "Video editing request submitted successfully."
        : "Request saved successfully, but the email notification could not be sent.",

      emailSent,

      request: populatedRequest,
    });

  } catch (error) {
    console.error(
      "Create video request error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ============================================================
// GET LOGGED-IN USER'S REQUESTS
// Pamela / leader / admin / pascal
// ============================================================

export const getMyVideoRequests = async (req, res) => {
  try {
    const requests = await VideoRequest.find({
      requestedBy: req.userId,
    })
      .populate(
        "requestedBy",
        "name email role"
      )
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      requests,
    });

  } catch (error) {
    console.error(
      "Get my video requests error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ============================================================
// GET ALL REQUESTS
// PASCAL ONLY
// ============================================================

export const getAllVideoRequests = async (req, res) => {
  try {
    const requests = await VideoRequest.find()
      .populate(
        "requestedBy",
        "name email role"
      )
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      requests,
    });

  } catch (error) {
    console.error(
      "Get all video requests error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ============================================================
// GET REQUEST BY ID
// PASCAL ONLY
// ============================================================

export const getVideoRequestById = async (req, res) => {
  try {
    const request =
      await VideoRequest.findById(
        req.params.id
      ).populate(
        "requestedBy",
        "name email role"
      );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Video request not found.",
      });
    }

    return res.status(200).json({
      success: true,
      request,
    });

  } catch (error) {
    console.error(
      "Get video request error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ============================================================
// UPDATE REQUEST
// PASCAL ONLY
// Primarily used for status and notes
// ============================================================

export const updateVideoRequest = async (req, res) => {
  try {
    const {
      title,
      description,
      videoLink,
      referenceLink,
      deadline,
      priority,
      status,
      notes,
    } = req.body;


    const request =
      await VideoRequest.findById(
        req.params.id
      );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Video request not found.",
      });
    }


    if (title !== undefined) {
      request.title = title;
    }

    if (description !== undefined) {
      request.description = description;
    }

    if (videoLink !== undefined) {
      request.videoLink = videoLink;
    }

    if (referenceLink !== undefined) {
      request.referenceLink = referenceLink;
    }

    if (deadline !== undefined) {
      request.deadline = deadline || null;
    }

    if (priority !== undefined) {
      request.priority = priority;
    }

    if (status !== undefined) {
      request.status = status;
    }

    if (notes !== undefined) {
      request.notes = notes;
    }


    await request.save();


    const updatedRequest =
      await VideoRequest.findById(
        request._id
      ).populate(
        "requestedBy",
        "name email role"
      );


    return res.status(200).json({
      success: true,
      message:
        "Video request updated successfully.",
      request: updatedRequest,
    });

  } catch (error) {
    console.error(
      "Update video request error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ============================================================
// DELETE REQUEST
// PASCAL ONLY
// ============================================================

export const deleteVideoRequest = async (req, res) => {
  try {
    const request =
      await VideoRequest.findById(
        req.params.id
      );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Video request not found.",
      });
    }


    await request.deleteOne();


    return res.status(200).json({
      success: true,
      message:
        "Video request deleted successfully.",
    });

  } catch (error) {
    console.error(
      "Delete video request error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};