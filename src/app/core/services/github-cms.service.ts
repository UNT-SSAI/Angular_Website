import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { MediaAsset, MediaCategory } from '../../shared/models/content.models';
import { getOfficerAuthToken } from '../auth/officer-auth-token.store';

class GitHubCmsRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string
  ) {
    super(message);
  }
}

export interface GitHubCmsSettings {
  owner: string;
  repo: string;
  branch: string;
}

@Injectable({ providedIn: 'root' })
export class GitHubCmsService {
  private readonly mediaResetVersion = '2026-06-01-server-cms-reset';
  private readonly mediaResetKey = 'ssai-media-library-reset-version';
  private readonly mediaKey = 'ssai-media-library';
  private readonly writeConflictRetries = 2;

  readonly settings = signal<GitHubCmsSettings>(this.readSettings());
  readonly media = signal<MediaAsset[]>(this.readMedia());
  readonly status = signal('');

  isConfigured(): boolean {
    const settings = this.settings();
    return !!settings.owner && !!settings.repo && !!settings.branch;
  }

  async uploadImage(file: File, category: MediaCategory, metadata: Pick<MediaAsset, 'galleryId'> = {}): Promise<MediaAsset> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files can be uploaded to this field.');
    }

    return this.uploadMedia(file, category, metadata);
  }

  async uploadMedia(file: File, category: MediaCategory, metadata: Pick<MediaAsset, 'galleryId'> = {}): Promise<MediaAsset> {
    const uploadFile = file.type.startsWith('image/') ? await this.prepareImageForUpload(file) : file;
    if (!this.isConfigured()) {
      throw new Error('GitHub CMS is not configured. Save GitHub CMS settings first.');
    }

    const safeName = this.safeFileName(uploadFile.name);
    const path = `public/assets/uploads/${category}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const content = await this.fileToBase64(uploadFile);
    await this.putFile(path, content, `Upload ${category} media: ${safeName}`);
    const { owner, repo, branch } = this.settings();
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    const asset = this.recordAsset({
      id: `${Date.now()}-${crypto.randomUUID()}`,
      name: safeName,
      category,
      url,
      path,
      ...metadata,
      size: uploadFile.size,
      type: uploadFile.type,
      uploadedAt: new Date().toISOString()
    });
    this.status.set(`${file.name} uploaded to GitHub.`);
    return asset;
  }

  async saveJson(path: string, data: unknown): Promise<void> {
    if (!this.isConfigured()) {
      this.status.set('GitHub CMS is not configured. Changes are saved only in this browser until Settings are configured.');
      throw new Error('GitHub CMS storage is not configured.');
    }
    const content = this.textToBase64(JSON.stringify(data, null, 2));
    await this.putFile(path, content, `Update ${path}`);
    this.status.set(`${path} saved to GitHub.`);
  }

  async deleteAsset(asset: MediaAsset): Promise<void> {
    if (asset.path && this.isConfigured()) {
      await this.deleteFile(asset.path, `Delete media: ${asset.name}`);
    }
    this.media.set(this.media().filter((item) => item.id !== asset.id));
    this.persistMedia();
  }

  async replaceAsset(asset: MediaAsset, file: File): Promise<MediaAsset> {
    await this.deleteAsset(asset);
    return this.uploadImage(file, asset.category);
  }

  clearMediaLibrary(): void {
    this.media.set([]);
    localStorage.removeItem(this.mediaKey);
    localStorage.setItem(this.mediaResetKey, this.mediaResetVersion);
    this.status.set('CMS media library cleared.');
  }

  private async putFile(path: string, content: string, message: string): Promise<void> {
    for (let attempt = 0; attempt <= this.writeConflictRetries; attempt += 1) {
      const existing = await this.getFile(path);
      try {
        await this.request(path, {
          method: 'PUT',
          body: JSON.stringify({
            message,
            content,
            branch: this.settings().branch,
            ...(existing?.sha ? { sha: existing.sha } : {})
          })
        });
        return;
      } catch (error) {
        if (!this.isShaConflict(error) || attempt === this.writeConflictRetries) {
          throw error;
        }
        await this.wait(350 * (attempt + 1));
      }
    }
  }

  private async deleteFile(path: string, message: string): Promise<void> {
    const existing = await this.getFile(path);
    if (!existing?.sha) return;
    await this.request(path, {
      method: 'DELETE',
      body: JSON.stringify({
        message,
        sha: existing.sha,
        branch: this.settings().branch
      })
    });
  }

  private async getFile(path: string): Promise<{ sha?: string } | null> {
    try {
      return await this.request(path, { method: 'GET' }) as { sha?: string };
    } catch {
      return null;
    }
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const { owner, repo, branch } = this.settings();
    const authToken = getOfficerAuthToken();
    if (!authToken) {
      throw new Error('Officer session is required to publish CMS changes.');
    }
    const response = await fetch(environment.githubCms.apiPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ owner, repo, branch, path, init })
    });
    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new GitHubCmsRequestError(this.parseErrorMessage(message, response.status), response.status, message);
    }
    return response.json();
  }

  private isShaConflict(error: unknown): boolean {
    return error instanceof GitHubCmsRequestError
      && error.status === 409
      && (error.body.includes('expected') || error.body.includes('sha'));
  }

  private parseErrorMessage(body: string, status: number): string {
    if (!body) return `GitHub request failed: ${status}`;
    try {
      const parsed = JSON.parse(body) as { message?: string };
      return parsed.message || `GitHub request failed: ${status}`;
    } catch {
      return body;
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private recordAsset(asset: MediaAsset): MediaAsset {
    this.media.set([asset, ...this.media()]);
    this.persistMedia();
    return asset;
  }

  private readSettings(): GitHubCmsSettings {
    localStorage.removeItem('ssai-github-cms-settings');
    return {
      owner: environment.githubCms.owner,
      repo: environment.githubCms.repo,
      branch: environment.githubCms.branch || 'main'
    };
  }

  private readMedia(): MediaAsset[] {
    try {
      if (localStorage.getItem(this.mediaResetKey) !== this.mediaResetVersion) {
        localStorage.removeItem(this.mediaKey);
        localStorage.setItem(this.mediaResetKey, this.mediaResetVersion);
        return [];
      }
      return JSON.parse(localStorage.getItem(this.mediaKey) || '[]') as MediaAsset[];
    } catch {
      return [];
    }
  }

  private persistMedia(): void {
    localStorage.setItem(this.mediaKey, JSON.stringify(this.media()));
  }

  private safeFileName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/(^-|-$)/g, '') || 'image.png';
  }

  private async prepareImageForUpload(file: File): Promise<File> {
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 900_000) {
      return file;
    }

    try {
      const dataUrl = await this.readAsDataUrl(file);
      const image = await this.loadImage(dataUrl);
      const maxDimension = 1600;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return file;

      context.drawImage(image, 0, 0, width, height);
      const blob = await this.canvasToBlob(canvas, 'image/jpeg', 0.82);
      if (!blob || blob.size >= file.size) return file;

      return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-optimized.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
    } catch {
      return file;
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to read image file.'));
      image.src = src;
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  private fileToBase64(file: File): Promise<string> {
    return file.arrayBuffer().then((buffer) => {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      bytes.forEach((byte) => binary += String.fromCharCode(byte));
      return btoa(binary);
    });
  }

  private textToBase64(value: string): string {
    let binary = '';
    new TextEncoder().encode(value).forEach((byte) => binary += String.fromCharCode(byte));
    return btoa(binary);
  }

  private readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

}
