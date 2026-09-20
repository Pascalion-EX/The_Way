import childProfilemodel from "../models/childProfileModel.js";

// ==========================================
// CREATE CHILD PROFILE
// ==========================================
export const createChildProfile = async (req, res) => {
  try {
    const {
      name,
      grade,
      firstParent,
      secondParent,
      firstParentNumber,
      secondParentNumber,
      allergies,
      address,
    } = req.body;

    // Required fields
    if (!name || grade === undefined) {
      return res.status(400).json({
        success: false,
        message: "Name and grade are required",
      });
    }

    // Validate grade
    if (grade < 1 || grade > 12) {
      return res.status(400).json({
        success: false,
        message: "Grade must be between 1 and 12",
      });
    }

    const childProfile = await childProfilemodel.create({
      name,
      grade,
      firstParent,
      secondParent,
      firstParentNumber,
      secondParentNumber,
      allergies,
      address,
    });

    return res.status(201).json({
      success: true,
      message: "Child profile created successfully",
      childProfile,
    });
  } catch (error) {
    console.error("Create child profile error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// GET ALL CHILD PROFILES
// ==========================================
export const getAllChildProfiles = async (req, res) => {
  try {
    const children = await childProfilemodel
      .find()
      .sort({ grade: 1, name: 1 });

    return res.status(200).json({
      success: true,
      count: children.length,
      children,
    });
  } catch (error) {
    console.error("Get children error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// GET CHILD PROFILE BY ID
// ==========================================
export const getChildProfileById = async (req, res) => {
  try {
    const { id } = req.params;

    const childProfile = await childProfilemodel.findById(id);

    if (!childProfile) {
      return res.status(404).json({
        success: false,
        message: "Child profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      childProfile,
    });
  } catch (error) {
    console.error("Get child profile error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// GET CHILDREN BY GRADE
// ==========================================
export const getChildrenByGrade = async (req, res) => {
  try {
    const { grade } = req.params;

    const gradeNumber = Number(grade);

    if (Number.isNaN(gradeNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid grade",
      });
    }

    const children = await childProfilemodel
      .find({ grade: gradeNumber })
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: children.length,
      children,
    });
  } catch (error) {
    console.error("Get children by grade error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// UPDATE CHILD PROFILE
// ==========================================
export const updateChildProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      grade,
      firstParent,
      secondParent,
      firstParentNumber,
      secondParentNumber,
      allergies,
      address,
    } = req.body;

    if (grade !== undefined && (grade < 1 || grade > 12)) {
      return res.status(400).json({
        success: false,
        message: "Grade must be between 1 and 12",
      });
    }

    const childProfile = await childProfilemodel.findByIdAndUpdate(
      id,
      {
        name,
        grade,
        firstParent,
        secondParent,
        firstParentNumber,
        secondParentNumber,
        allergies,
        address,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!childProfile) {
      return res.status(404).json({
        success: false,
        message: "Child profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Child profile updated successfully",
      childProfile,
    });
  } catch (error) {
    console.error("Update child profile error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// DELETE CHILD PROFILE
// ==========================================
export const deleteChildProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const childProfile = await childProfilemodel.findByIdAndDelete(id);

    if (!childProfile) {
      return res.status(404).json({
        success: false,
        message: "Child profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Child profile deleted successfully",
    });
  } catch (error) {
    console.error("Delete child profile error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};