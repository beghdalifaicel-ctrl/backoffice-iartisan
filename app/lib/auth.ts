import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me-in-production");

export type SessionPayload = {
  email: string;
  role: "admin" | "client";
  clientId?: string;
};

export async function createToken(payload: SessionPayload) {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("ia-session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function verifyAuth(request: NextRequest): Promise<SessionPayload | null> {
  // Check Authorization header first (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return verifyToken(token);
  }
  // Fallback to cookie-based session
  const cookieToken = request.cookies.get("ia-session")?.value;
  if (cookieToken) {
    return verifyToken(cookieToken);
  }
  // Check query param for cron secret
  const cronSecret = request.nextUrl.searchParams.get("secret");
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    return { email: "system@iartisan.io", role: "admin" };
  }
  return null;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireClient() {
  const session = await getSession();
  if (!session || session.role !== "client" || !session.clientId) {
    throw new Error("Unauthorized");
  }
  return session;
}
