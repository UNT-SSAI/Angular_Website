import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';
import { environment } from '../../../environments/environment';

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class EmailService {
  private readonly config = environment.emailjs;

  get configured(): boolean {
    return ![
      this.config.serviceId,
      this.config.templateId,
      this.config.publicKey
    ].some((value) => value.startsWith('YOUR_EMAILJS_'));
  }

  async sendContactMessage(message: ContactMessage): Promise<void> {
    if (!this.configured) {
      throw new Error('Email service is not configured yet.');
    }

    await emailjs.send(
      this.config.serviceId,
      this.config.templateId,
      {
        from_name: message.name,
        from_email: message.email,
        subject: message.subject,
        message: message.message,
        to_email: this.config.toEmail
      },
      {
        publicKey: this.config.publicKey
      }
    );
  }
}
