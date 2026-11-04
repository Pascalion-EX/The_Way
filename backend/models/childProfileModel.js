import mongoose from "mongoose";

const childProfileschema = new mongoose.Schema(
    {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            default: null,
            immutable: true,
        },
        name :{
            type: String,
            required: true,
            trim : true,
        },
        grade: {
            type: Number,
            required: true,
        },
        firstParent: {
            type: String,
            trim:true,
            default: "",
        },
        secondParent: {
            type: String,
            trim: true,
            default: "",
        },
        firstParentJob: {
            type: String,
            trim: true,
            default: "",
        },
        secondParentJob: {
            type: String,
            trim: true,
            default: "",
        },
        firstParentNumber: {
            type: Number,
            default: 0,
        },
        secondParentNumber: {
            type: Number,
            default: 0,
        },
        allergies: {
            type: String,
            trim: true,
            default: "",
            // Keep allergy lists from existing profiles readable as text.
            cast: (value) => mongoose.Schema.Types.String.cast()(
                Array.isArray(value) ? value.join(", ") : value
            ),
            required:false,
        },
        address:{
            type : String,
            default: "",
            trim: true
        },
        
    }
)
childProfileschema.index({ grade: 1, name: 1 });
childProfileschema.index({ createdBy: 1, grade: 1, name: 1 });
const childProfilemodel = mongoose.models.childProfile || mongoose.model("childprofile",childProfileschema);
export default childProfilemodel;
