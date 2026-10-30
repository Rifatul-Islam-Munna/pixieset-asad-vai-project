import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { CollectionsService } from './collections.service';

/**
 * Applied to every `public/collections/:identifier…` route. When a gallery
 * has General → "Mobile only" switched on, the request must come from the
 * Gallerista app: it sends `x-gallerista-app` (the shared MOBILE_APP_KEY) on
 * every public gallery call, so any QR code or link for the gallery opens in
 * the app. Older QR codes may also carry a per-gallery key that the app sends
 * as `x-gallerista-mobile-key`. Browsers send neither, so the website can't
 * show the gallery and no public side route (images, downloads, favorites…)
 * can be used to reach its photos.
 */
@Injectable()
export class MobileOnlyGalleryGuard implements CanActivate {
  constructor(private readonly collectionsService: CollectionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const identifier = request.params?.identifier;
    if (!identifier) return true;
    const header = request.headers?.['x-gallerista-mobile-key'];
    const appHeader = request.headers?.['x-gallerista-app'];
    await this.collectionsService.assertPublicMobileAccess(
      String(identifier),
      typeof request.query?.siteSlug === 'string' ? request.query.siteSlug : undefined,
      Array.isArray(header) ? header[0] : header,
      Array.isArray(appHeader) ? appHeader[0] : appHeader,
    );
    return true;
  }
}
