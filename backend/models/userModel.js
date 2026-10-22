import mongoose, { mongo } from "mongoose";
import emailJobSchema from "./emailJobSchema.js";
import { normalizeAuthEmail } from "../services/authEmail.js";
import { AVATAR_IDS } from "../../shared/avatarPresets.mjs";

const userSchema = new mongoose.Schema({
    name: {type:String, required: true},
    avatarId: {type: String, enum: ["", ...AVATAR_IDS], default: ""},
    email: {type:String, required: true, unique:true, validate: {
        validator: (value) => normalizeAuthEmail(value) !== null,
        message: 'A valid single email address is required',
    }},
    password: {type:String, required: true},
    tokenVersion: {type:Number, default: 0, min: 0, validate: Number.isSafeInteger},
    accessDeniedCount: {type:Number, default: 0, min: 0, max: 3, validate: Number.isInteger},
    isBanned: {type:Boolean, default: false},
    bannedAt: {type:Date, default: null},
    banReason: {type:String, default: ''},
    emailFlagged: {type:Boolean, default: false},
    flaggedEmail: {type:String, default: ''},
    verifyOtp: {type:String, default: ''},
    verifyOtpExpireAt: {type:Number, default: 0},
    verifyOtpRequestedAt: {type:Number, default: 0},
    verifyOtpAttempts: {type:Number, default: 0, min: 0, max: 5},
    verifyOtpGeneration: {type:String, default: ''},
    isAccountVerified: {type:Boolean, default: false},
    resetOtp: {type:String, default: ''},
    resetOtpExpireAt: {type:Number, default: 0},
    resetOtpRequestedAt: {type:Number, default: 0},
    resetOtpAttempts: {type:Number, default: 0, min: 0, max: 5},
    resetOtpGeneration: {type:String, default: ''},
    class: {type: Number, default: 0, min: 0, max: 12, validate: Number.isInteger},
    phone: {type: String, default: ''},
    role: {type: [String], enum: ['pascal','admin','leader','parent', 'pamela' ,'unAssigned'],default:['unAssigned']},
    emailJobs: {
        welcome: emailJobSchema,
        verification: emailJobSchema,
        passwordReset: emailJobSchema,
        ban: emailJobSchema,
    },

    
})
for (const kind of ["welcome", "verification", "passwordReset", "ban"]) {
    userSchema.index({ [`emailJobs.${kind}.status`]: 1, [`emailJobs.${kind}.nextAttemptAt`]: 1 });
}
const userModel = mongoose.models.user || mongoose.model('user',
    userSchema
);
export default userModel;
