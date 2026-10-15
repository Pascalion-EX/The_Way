import User from "../models/userModel.js";
import { normalizeAuthEmail } from "./authEmail.js";

export async function findUserByAuthEmail(suppliedEmail) {
  const email = normalizeAuthEmail(suppliedEmail);
  if (!email) return null;
  // New accounts always use the normalized identity. Keep an indexed exact
  // fallback for legacy accounts whose stored mailbox contains case/spaces.
  // Both filters contain validated strings only, never client-owned operators.
  const user = await User.findOne({ email });
  if (user || suppliedEmail === email) return user;
  return User.findOne({ email: suppliedEmail });
}
