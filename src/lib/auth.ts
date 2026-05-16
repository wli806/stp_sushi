import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

export type JWTPayload = {
  userId: string;
  username: string;
  role: string;
};

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<JWTPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("未登录");
  }
  return session;
}

export async function requireOwner(): Promise<JWTPayload> {
  const session = await requireAuth();
  if (session.role !== "OWNER" && session.role !== "MANAGER") {
    throw new Error("权限不足");
  }
  return session;
}

export async function requireStrictOwner(): Promise<JWTPayload> {
  const session = await requireAuth();
  if (session.role !== "OWNER") {
    throw new Error("权限不足");
  }
  return session;
}

export async function requireRoot(): Promise<JWTPayload> {
  const session = await requireAuth();
  if (session.username !== "root") {
    throw new Error("权限不足");
  }
  return session;
}
