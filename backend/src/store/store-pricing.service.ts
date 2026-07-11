import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CollectionImage, CollectionImageDocument } from 'src/collections/entities/collection-image.entity';
import { StoreCoupon, StoreCouponDocument } from './entities/store-coupon.entity';
import { StoreCropData } from './entities/store-order.entity';
import { StoreProduct, StoreProductDocument } from './entities/store-product.entity';
import { StoreShipping, StoreShippingDocument } from './entities/store-shipping.entity';
import { StoreTax, StoreTaxDocument } from './entities/store-tax.entity';
import { ResolvedCollectionStore, StoreCatalogService } from './store-catalog.service';

export type StoreCustomerInput = {
  name: string;
  email: string;
  phone: string;
  address: {
    country: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  };
};

@Injectable()
export class StorePricingService {
  constructor(
    private readonly catalog: StoreCatalogService,
    @InjectModel(CollectionImage.name)
    private readonly imageModel: Model<CollectionImageDocument>,
    @InjectModel(StoreProduct.name)
    private readonly productModel: Model<StoreProductDocument>,
    @InjectModel(StoreCoupon.name)
    private readonly couponModel: Model<StoreCouponDocument>,
    @InjectModel(StoreTax.name)
    private readonly taxModel: Model<StoreTaxDocument>,
    @InjectModel(StoreShipping.name)
    private readonly shippingModel: Model<StoreShippingDocument>,
  ) {}

  async price(identifier: string, body: any, siteSlug?: string) {
    const resolved = await this.catalog.resolve(identifier, true, siteSlug);
    return this.priceResolved(resolved, body);
  }

  async priceResolved(resolved: ResolvedCollectionStore, body: any) {
    if (!resolved.sheet) throw new BadRequestException('No price sheet is assigned to this collection');
    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
    if (!rawItems.length) throw new BadRequestException('Cart is empty');

    const productIdStrings = Array.from(new Set<string>(
      rawItems
        .map((item: any) => String(item.productId || ''))
        .filter((id: string) => Types.ObjectId.isValid(id)),
    ));
    const productIds = productIdStrings.map((id) => new Types.ObjectId(id));
    const products = await this.productModel.find({
      _id: { $in: productIds },
      userId: resolved.userId,
      priceSheetId: resolved.sheet._id.toString(),
      active: { $ne: false },
    }).lean();
    const productMap = new Map(products.map((product: any) => [product._id.toString(), product]));

    const imageIdStrings = Array.from(new Set<string>(
      rawItems
        .map((item: any) => String(item.imageId || ''))
        .filter((id: string) => Types.ObjectId.isValid(id)),
    ));
    const imageIds = imageIdStrings.map((id) => new Types.ObjectId(id));
    const images = imageIds.length
      ? await this.imageModel.find({
          _id: { $in: imageIds },
          collectionId: resolved.collection._id.toString(),
        }).lean()
      : [];
    const imageMap = new Map(images.map((image: any) => [image._id.toString(), image]));

    const taxRows: Array<{ item: any; product: any }> = [];
    const items = rawItems.map((raw: any) => {
      const product: any = productMap.get(String(raw.productId));
      if (!product) throw new BadRequestException('A cart product is no longer available');
      const variants = (product.variants ?? []).filter((variant: any) => !variant.hidden);
      const variant = variants.length
        ? variants.find((entry: any) => entry.id === raw.variantId)
        : undefined;
      if (variants.length && !variant) {
        throw new BadRequestException(`${product.name}: choose an available variation`);
      }
      const image: any = raw.imageId ? imageMap.get(String(raw.imageId)) : undefined;
      const requiresPhoto = product.requiresPhoto !== false && !product.noImageRequired;
      if (requiresPhoto && !image) {
        throw new BadRequestException(`${product.name}: choose a collection photo`);
      }
      const quantity = product.limitOnePerCheckout
        ? 1
        : Math.max(1, Math.min(99, Number(raw.quantity ?? 1)));
      const unitPrice = Number(variant?.price ?? product.price ?? 0);
      const isDigital = product.type === 'digital-download';
      const extraShipping = isDigital
        ? 0
        : Number(variant?.extraShipping ?? product.extraShipping ?? 0) * quantity;
      const item = {
        productId: product._id.toString(),
        collectionId: resolved.collection._id.toString(),
        imageId: image?._id?.toString(),
        imageUrl: image?.url || raw.imageUrl || '',
        name: product.name,
        type: product.type,
        variantId: variant?.id || raw.variantId,
        variantLabel: variant?.label || raw.variantLabel || '',
        options: variant?.options || raw.options || {},
        crop: product.allowCrop === false ? undefined : this.crop(raw.crop),
        quantity,
        unitPrice,
        extraShipping,
        total: unitPrice * quantity,
        fulfillmentStatus: 'pending' as const,
      };
      taxRows.push({ item, product });
      return item;
    });

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const customer = this.customer(body.customer);
    const hasPhysicalItems = taxRows.some(({ product }) => product.type !== 'digital-download');
    const physicalSubtotal = taxRows
      .filter(({ product }) => product.type !== 'digital-download')
      .reduce((sum, { item }) => sum + item.total, 0);
    const extraShipping = hasPhysicalItems
      ? items.reduce((sum, item) => sum + item.extraShipping, 0)
      : 0;

    let shippingMethod: any = null;
    if (hasPhysicalItems && body.shippingMethodId) {
      shippingMethod = await this.shippingModel.findOne({
        _id: body.shippingMethodId,
        userId: resolved.userId,
        active: true,
      }).lean();
      if (!shippingMethod) throw new BadRequestException('The selected shipping method is unavailable');
      if (!this.shippingApplies(shippingMethod, customer.address.country)) {
        throw new BadRequestException('The selected shipping method is not available for this country');
      }
    }

    let shippingBase = Number(shippingMethod?.price ?? 0);
    if (shippingMethod?.freeOver && physicalSubtotal >= Number(shippingMethod.freeOver)) shippingBase = 0;
    const shipping = hasPhysicalItems ? shippingBase + extraShipping : 0;

    const couponCode = String(body.couponCode ?? '').trim().toUpperCase();
    const coupon = couponCode
      ? await this.couponModel.findOne({
          userId: resolved.userId,
          code: couponCode,
          active: true,
          $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: new Date() } }],
        }).lean()
      : null;
    const discount = coupon
      ? coupon.discountType === 'percent'
        ? Math.min(subtotal, subtotal * Number(coupon.amount ?? 0) / 100)
        : Math.min(subtotal, Number(coupon.amount ?? 0))
      : 0;

    const tax = await this.tax(
      resolved.userId,
      taxRows,
      subtotal,
      discount,
      shipping,
      customer.address,
    );
    const total = Math.max(0, subtotal + shipping + tax - discount);
    const minimumOrderAmount = Number(
      resolved.config.minimumOrderAmount || resolved.sheet.minimumOrderAmount || 0,
    );
    if (total < minimumOrderAmount) {
      throw new BadRequestException(`Minimum order amount is ${minimumOrderAmount.toFixed(2)}`);
    }

    return {
      resolved,
      items,
      customer,
      professionalInfo: this.professional(body.professionalInfo),
      subtotal,
      shipping,
      tax,
      discount,
      total,
      minimumOrderAmount,
      currency: resolved.config.currency,
      shippingMethod,
      coupon,
      hasPhysicalItems,
      requiresShipping: hasPhysicalItems,
    };
  }

  customer(input: any): StoreCustomerInput {
    const value = input ?? {};
    return {
      name: String(value.name ?? '').trim(),
      email: String(value.email ?? '').trim().toLowerCase(),
      phone: String(value.phone ?? '').trim(),
      address: {
        country: String(value.address?.country ?? value.country ?? '').trim(),
        line1: String(value.address?.line1 ?? value.addressLine1 ?? '').trim(),
        line2: String(value.address?.line2 ?? value.addressLine2 ?? '').trim(),
        city: String(value.address?.city ?? value.city ?? '').trim(),
        state: String(value.address?.state ?? value.state ?? '').trim(),
        postalCode: String(value.address?.postalCode ?? value.postalCode ?? '').trim(),
      },
    };
  }

  private professional(input: any) {
    if (!input) return undefined;
    return {
      company: String(input.company ?? '').trim(),
      taxId: String(input.taxId ?? '').trim(),
      invoiceNote: String(input.invoiceNote ?? '').trim(),
    };
  }

  private crop(input: any): StoreCropData | undefined {
    if (!input || typeof input !== 'object') return undefined;
    return {
      x: Number(input.x ?? 0),
      y: Number(input.y ?? 0),
      width: Number(input.width ?? 0),
      height: Number(input.height ?? 0),
      zoom: Number(input.zoom ?? 1),
      rotation: Number(input.rotation ?? 0),
      aspectRatio: String(input.aspectRatio ?? ''),
      fit: input.fit === 'cover' ? 'cover' : 'contain',
    };
  }

  private shippingApplies(method: any, country: string) {
    const region = String(method?.region ?? '').trim().toLowerCase();
    const destination = String(country ?? '').trim().toLowerCase();
    if (!region || region === 'all' || region === 'worldwide') return true;
    if (destination && region === destination) return true;
    return Boolean(method?.shipInternational);
  }

  private async tax(
    userId: string,
    rows: Array<{ item: any; product: any }>,
    subtotal: number,
    discount: number,
    shipping: number,
    address: Record<string, unknown>,
  ) {
    const country = typeof address.country === 'string' ? address.country.trim() : '';
    const rules = await this.taxModel.find({ userId, active: true }).sort({ createdAt: -1 }).lean();
    const normalizedCountry = country.toLowerCase();
    const rule = rules.find((entry) => String(entry.region ?? '').trim().toLowerCase() === normalizedCountry)
      ?? rules.find((entry) => ['all', ''].includes(String(entry.region ?? '').trim().toLowerCase()));
    if (!rule?.rate) return 0;

    const eligibleRows = rows.filter(({ product }) => {
      if (product.exemptFromSalesTax) return false;
      if (product.type === 'digital-download' && rule.applyDigitalDownloads === false) return false;
      return true;
    });
    const eligibleSubtotal = eligibleRows.reduce((sum, { item }) => sum + item.total, 0);
    const eligibleDiscount = subtotal > 0 ? discount * (eligibleSubtotal / subtotal) : 0;
    const productBase = Math.max(0, eligibleSubtotal - eligibleDiscount);
    const shippingBase = rule.applyShipping ? shipping : 0;
    return (productBase + shippingBase) * Number(rule.rate) / 100;
  }
}
