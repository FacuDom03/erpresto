export interface JwtPayload {
  /** userId */
  sub: string;
  tenantId: string;
  email: string;
  permissions: string[];
  branchIds: string[];
}

export interface RefreshPayload {
  sub: string;
  sessionId: string;
  tenantId: string;
}
