import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GitHubCmsService } from './github-cms.service';
import { clearOfficerAuthToken, setOfficerAuthToken } from '../auth/officer-auth-token.store';

export type OfficerRole = 'Super Admin' | 'President' | 'Vice President' | 'Event Coordinator' | 'Technical Lead' | 'Research Lead' | 'Marketing Lead' | 'Secretary' | 'Treasurer';

export interface OfficerSession {
  isOfficer: true;
  name: string;
  role: OfficerRole;
  email: string;
  loginTime: string;
  expiresAt: string;
}

export interface OfficerRegistryEntry {
  name: string;
  email: string;
  role: OfficerRole;
  active: boolean;
}

interface PendingOtpTicket {
  email: string;
  ticket: string;
  resendAttempts: number;
}

@Injectable({ providedIn: 'root' })
export class OfficerSessionService {
  private readonly router = inject(Router);
  private readonly github = inject(GitHubCmsService);
  private readonly storageKey = 'officerSession';
  private readonly otpKey = 'officerPendingOtp';
  private readonly registryKey = 'ssai-officer-registry';
  private readonly registryPath = 'public/assets/data/officers.json';
  private readonly registryUrl = '/assets/data/officers.json';
  private publishQueue = Promise.resolve();
  private readonly warningShown = signal(false);
  private readonly defaultRegistry: OfficerRegistryEntry[] = [
    {
      name: 'Sesha Siva Sankar',
      email: 'SeshaSivaSankar@my.unt.edu',
      role: 'Super Admin',
      active: true
    }
  ];

  readonly session = signal<OfficerSession | null>(null);
  readonly officers = signal<OfficerRegistryEntry[]>(this.readRegistry());
  readonly now = signal(Date.now());
  readonly message = signal('');
  readonly isOfficer = computed(() => !!this.session() && this.now() < new Date(this.session()!.expiresAt).getTime());
  readonly countdown = computed(() => {
    const session = this.session();
    if (!session) return '00:00';
    const remaining = Math.max(0, new Date(session.expiresAt).getTime() - this.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });
  readonly shouldWarn = computed(() => {
    const session = this.session();
    if (!session || this.warningShown()) return false;
    const remaining = new Date(session.expiresAt).getTime() - this.now();
    return remaining > 0 && remaining <= 120000;
  });

  constructor() {
    this.restoreSession();
    void this.loadOfficerRegistry();
    setInterval(() => this.tick(), 1000);
    setInterval(() => this.validateSession(true), 30000);
  }

  async sendOtp(email: string, resend = false): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = this.readPendingOtp();
    const resendAttempts = resend && existing?.email === normalizedEmail ? existing.resendAttempts + 1 : 0;
    if (resendAttempts > 3) {
      return { ok: false, message: 'Maximum resend attempts reached. Please try again later.' };
    }

    let result: { ok: boolean; message: string; ticket?: string };
    try {
      const response = await fetch('/api/officer-otp-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail })
      });
      result = await response.json();
    } catch {
      return { ok: false, message: 'Unable to send verification code. Please try again later.' };
    }

    if (!result.ok || !result.ticket) {
      sessionStorage.removeItem(this.otpKey);
      return { ok: false, message: result.message || 'Unable to send verification code. Please try again later.' };
    }

    const pending: PendingOtpTicket = { email: normalizedEmail, ticket: result.ticket, resendAttempts };
    sessionStorage.setItem(this.otpKey, JSON.stringify(pending));
    return { ok: true, message: result.message };
  }

  async verifyOtp(email: string, otp: string): Promise<{ ok: true; session: OfficerSession } | { ok: false; message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const pending = this.readPendingOtp();
    if (!pending || pending.email !== normalizedEmail) {
      return { ok: false, message: 'Please request a new verification code.' };
    }

    let result: { ok: boolean; message?: string; token?: string; session?: OfficerSession };
    try {
      const response = await fetch('/api/officer-otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, otp: otp.trim(), ticket: pending.ticket })
      });
      result = await response.json();
    } catch {
      return { ok: false, message: 'Unable to verify the code. Please try again.' };
    }

    if (!result.ok || !result.token || !result.session) {
      return { ok: false, message: result.message || 'Invalid verification code.' };
    }

    sessionStorage.removeItem(this.otpKey);
    setOfficerAuthToken(result.token);
    localStorage.setItem(this.storageKey, JSON.stringify(result.session));
    this.session.set(result.session);
    this.warningShown.set(false);
    this.message.set(`Welcome ${result.session.name}`);
    return { ok: true, session: result.session };
  }

  /**
   * UI-only gate for showing/hiding admin controls. The real authorization boundary is
   * server-side in api/github-cms.js, which checks the signed session token's role against
   * api/_lib/roles.js - this must stay in sync with that mapping but is not itself trusted.
   */
  canManage(area: 'leadership' | 'events' | 'projects' | 'galleries' | 'officers'): boolean {
    if (!this.requireActiveSession()) return false;
    const role = this.session()?.role;
    if (role === 'Super Admin') return true;
    if (area === 'events') return role === 'Event Coordinator' || role === 'Research Lead' || role === 'President' || role === 'Vice President';
    if (area === 'galleries') return role === 'Marketing Lead' || role === 'Event Coordinator' || role === 'President' || role === 'Vice President';
    if (area === 'projects') return role === 'Technical Lead' || role === 'Research Lead' || role === 'President' || role === 'Vice President';
    if (area === 'leadership') return role === 'President' || role === 'Vice President';
    return false;
  }

  logout(message = 'You have been logged out successfully.'): void {
    localStorage.removeItem(this.storageKey);
    sessionStorage.removeItem(this.otpKey);
    clearOfficerAuthToken();
    this.session.set(null);
    this.warningShown.set(false);
    this.message.set(message);
    void this.router.navigateByUrl('/');
  }

  requireActiveSession(): boolean {
    return this.validateSession(false);
  }

  dismissWarning(): void {
    this.warningShown.set(true);
  }

  addOfficer(officer: OfficerRegistryEntry): void {
    if (!this.canManage('officers')) return;
    this.officers.set([...this.officers(), { ...officer, email: officer.email.trim() }]);
    this.saveRegistry();
  }

  updateOfficer(index: number, officer: OfficerRegistryEntry): void {
    if (!this.canManage('officers')) return;
    this.officers.set(this.officers().map((item, itemIndex) => itemIndex === index ? { ...officer, email: officer.email.trim() } : item));
    this.saveRegistry();
  }

  deactivateOfficer(index: number): void {
    if (!this.canManage('officers')) return;
    this.officers.set(this.officers().map((item, itemIndex) => itemIndex === index ? { ...item, active: false } : item));
    this.saveRegistry();
  }

  deleteOfficer(index: number): void {
    if (this.session()?.role !== 'Super Admin') return;
    this.officers.set(this.officers().filter((_, itemIndex) => itemIndex !== index));
    this.saveRegistry();
  }

  private normalizeRole(value: string): OfficerRole {
    const roles: OfficerRole[] = ['Super Admin', 'President', 'Vice President', 'Event Coordinator', 'Technical Lead', 'Research Lead', 'Marketing Lead', 'Secretary', 'Treasurer'];
    return roles.find((role) => role.toLowerCase() === value.trim().toLowerCase()) ?? 'President';
  }

  private readRegistry(): OfficerRegistryEntry[] {
    try {
      const stored = JSON.parse(localStorage.getItem(this.registryKey) || 'null') as OfficerRegistryEntry[] | null;
      return stored?.length ? stored : this.defaultRegistry;
    } catch {
      return this.defaultRegistry;
    }
  }

  private saveRegistry(): void {
    localStorage.setItem(this.registryKey, JSON.stringify(this.officers()));
    this.message.set('Saving officer registry to the public CMS...');
    this.publishQueue = this.publishQueue
      .then(() => this.github.saveJson(this.registryPath, this.officers()))
      .then(() => this.message.set('Officer registry published. Other devices can use the updated access list.'))
      .catch((error) => {
        console.error('Officer registry publish failed', error);
        this.message.set(`Officer registry saved only on this browser. Public CMS publish failed: ${this.errorMessage(error)}`);
      });
  }

  private async loadOfficerRegistry(): Promise<void> {
    const registry = await this.fetchOfficerRegistry();
    if (registry) {
      const normalized = registry.length ? registry.map((entry) => ({
        ...entry,
        name: entry.name.trim(),
        email: entry.email.trim(),
        role: this.normalizeRole(entry.role),
        active: entry.active !== false
      })) : this.defaultRegistry;
      this.officers.set(normalized);
      localStorage.setItem(this.registryKey, JSON.stringify(normalized));
    }
  }

  private async fetchOfficerRegistry(): Promise<OfficerRegistryEntry[] | null> {
    try {
      const response = await fetch(this.liveRegistryUrl(), { cache: 'no-store' });
      if (response.ok) return await response.json() as OfficerRegistryEntry[];
      const fallback = await fetch(this.registryUrl, { cache: 'no-store' });
      return fallback.ok ? await fallback.json() as OfficerRegistryEntry[] : null;
    } catch {
      try {
        const fallback = await fetch(this.registryUrl, { cache: 'no-store' });
        return fallback.ok ? await fallback.json() as OfficerRegistryEntry[] : null;
      } catch {
        return null;
      }
    }
  }

  private liveRegistryUrl(): string {
    const { owner, repo, branch } = this.github.settings();
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${this.registryPath}?t=${Date.now()}`;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'check GitHub CMS/Vercel token settings.';
  }

  private restoreSession(): void {
    const stored = localStorage.getItem(this.storageKey);
    if (!stored) return;
    try {
      this.session.set(JSON.parse(stored) as OfficerSession);
      this.validateSession(false);
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }

  private tick(): void {
    this.now.set(Date.now());
    this.validateSession(true);
  }

  private validateSession(showExpiredMessage: boolean): boolean {
    const session = this.session();
    if (!session) return false;
    if (Date.now() < new Date(session.expiresAt).getTime()) return true;
    localStorage.removeItem(this.storageKey);
    clearOfficerAuthToken();
    this.session.set(null);
    this.warningShown.set(false);
    if (showExpiredMessage) {
      this.message.set('Officer session has expired. Please verify your email again.');
    }
    void this.router.navigateByUrl('/');
    return false;
  }

  private readPendingOtp(): PendingOtpTicket | null {
    const stored = sessionStorage.getItem(this.otpKey);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as PendingOtpTicket;
    } catch {
      sessionStorage.removeItem(this.otpKey);
      return null;
    }
  }

}
