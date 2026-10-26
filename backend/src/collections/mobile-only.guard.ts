import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { CollectionsService } from './collections.service';

/**
 * Applied to every `public/collections/:identifier…` route. When a gallery
 * has General → "Mobile only" switched on, the request must carry the
 * `x-gallerista-mobile-key` header that only the Gallerista app gets (from
 * the gallery's QR code). Browsers never send it, so the website can't show
 * the gallery and no public side route (images, downloads, favorites…) can
 * be used to reach its photos.
 */
@Injectable()
export class MobileOnlyGalleryGuard implements CanActivate {
  constructor(private readonly collectionsService: CollectionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const identifier = request.params?.identifier;
    if (!identifier) return true;
    const header = request.headers?.['x-gallerista-mobile-key'];
    await this.collectionsService.assertPublicMobileAccess(
      String(identifier),
      typeof request.query?.siteSlug === 'string' ? request.query.siteSlug : undefined,
      Array.isArray(header) ? header[0] : header,
    );
    return true;
  }
}
