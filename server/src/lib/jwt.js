import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  // Fail loudly at startup rather than silently signing tokens with `undefined`.
  throw new Error("JWT_SECRET environment variable is required.");
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
