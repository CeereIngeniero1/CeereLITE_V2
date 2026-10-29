import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACCESS_COOKIE, cookieSecure } from '../auth/auth-cookies';

@Injectable()
export class PrintService {
  constructor(private readonly config: ConfigService) {}

  async htmlToPdf(html: string, accessToken: string): Promise<Buffer> {
    let chromium: typeof import('playwright').chromium;
    try {
      ({ chromium } = await import('playwright'));
    } catch {
      throw new ServiceUnavailableException('PDF no disponible');
    }

    const apiBase = this.config
      .getOrThrow<string>('API_PUBLIC_BASE_URL')
      .replace(/\/$/, '');
    let origin: URL;
    try {
      origin = new URL(apiBase);
    } catch {
      throw new ServiceUnavailableException('PDF no disponible');
    }

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      if (accessToken) {
        await context.addCookies([
          {
            name: ACCESS_COOKIE,
            value: accessToken,
            domain: origin.hostname,
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
            secure: cookieSecure(this.config),
          },
        ]);
      }
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
      const pdf = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
      });
      return Buffer.from(pdf);
    } catch {
      throw new ServiceUnavailableException('No se pudo generar el PDF');
    } finally {
      await browser.close();
    }
  }
}
