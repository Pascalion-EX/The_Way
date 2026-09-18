import mongoose from "mongoose";

const childProfileschema = new mongoose.Schema(
    {
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
        firstParentNumber: {
            type: Number,
            default: 0,
        },
        secondParentNumber: {
            type: Number,
            default: 0,
        },
        allergies: {
            type: [String],
            enum: ["Milk","Eggs","Peanuts","Tree nuts","Wheat","Soybeans","Fish","Crustacean shellfish","Sesame","Legume (beans)"],
            default: [],
        },
        address:{
            type : String,
            default: "",
            trim: true
        },
        
    }
)
const childProfilemodel = mongoose.models.childProfile || mongoose.model("childprofile",childProfileschema);
export default childProfilemodel;