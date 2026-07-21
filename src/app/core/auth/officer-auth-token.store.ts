const AUTH_TOKEN_KEY = 'officerAuthToken';

export function getOfficerAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setOfficerAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearOfficerAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}
