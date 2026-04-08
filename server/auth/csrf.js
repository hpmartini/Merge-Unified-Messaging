import { doubleCsrf } from "csrf-csrf";

const csrfOptions = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || "super-secret-fallback-csrf-key",
  getSessionIdentifier: () => "stateless",
  cookieName: "x-csrf-token",
  cookieOptions: {
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    httpOnly: true,
  },
  size: 64,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  getTokenFromRequest: (req) => req.headers["x-csrf-token"] || req.headers["csrf-token"],
});

export const invalidCsrfTokenError = csrfOptions.invalidCsrfTokenError;
export const generateToken = csrfOptions.generateCsrfToken;
export const validateRequest = csrfOptions.validateRequest;
export const doubleCsrfProtection = csrfOptions.doubleCsrfProtection;
