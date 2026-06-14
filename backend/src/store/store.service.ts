import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreatePriceSheetDto } from './dto/create-price-sheet.dto';
import { CreateStoreProductDto } from './dto/create-store-product.dto';
import { UpdatePriceSheetDto } from './dto/update-price-sheet.dto';
import { UpdateStoreProductDto } from './dto/update-store-product.dto';
import { StoreCoupon, StoreCouponDocument } from './entities/store-coupon.entity';
import { StoreCustomer, StoreCustomerDocument } from './entities/store-customer.entity';
import { StoreOrder, StoreOrderDocument } from './entities/store-order.entity';
import { StorePriceSheet, StorePriceSheetDocument } from './entities/store-price-sheet.entity';
import { StoreProduct, StoreProductDocument } from './entities/store-product.entity';
import { StoreSetting, StoreSettingDocument } from './entities/store-setting.entity';
import { StoreShipping, StoreShippingDocument } from './entities/store-shipping.entity';
import { StoreTax, StoreTaxDocument } from './entities/store-tax.entity';

@Injectable()
export class StoreService {
  constructor(
    @InjectModel(StorePriceSheet.name)
    private readonly priceSheetModel: Model<StorePriceSheetDocument>,
    @InjectModel(StoreProduct.name)
    private readonly productModel: Model<StoreProductDocument>,
    @InjectModel(StoreOrder.name)
    private readonly orderModel: Model<StoreOrderDocument>,
    @InjectModel(StoreCustomer.name)
    private readonly customerModel: Model<StoreCustomerDocument>,
    @InjectModel(StoreCoupon.name)
    private readonly couponModel: Model<StoreCouponDocument>,
    @InjectModel(StoreTax.name)
    private readonly taxModel: Model<StoreTaxDocument>,
    @InjectModel(StoreShipping.name)
    private readonly shippingModel: Model<StoreShippingDocument>,
    @InjectModel(StoreSetting.name)
    private readonly settingModel: Model<StoreSettingDocument>,
  ) {}

  async dashboard(userId: string) {
    const [orders, customers, products, coupons] = await Promise.all([
      this.orderModel.find({ userId }).sort({ createdAt: -1 }).lean(),
      this.customerModel.countDocuments({ userId }),
      this.productModel.countDocuments({ userId }),
      this.couponModel.countDocuments({ userId }),
    ]);
    const paidOrders = orders.filter((order) => order.paymentStatus === 'paid' && order.status !== 'cancelled');
    const revenue = paidOrders.reduce((sum, order) => sum + (order.total ?? 0), 0);
    const pending = orders.filter((order) => ['pending', 'processing'].includes(order.status)).length;
    const statusCounts = orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      revenue,
      orderCount: orders.length,
      customerCount: customers,
      productCount: products,
      couponCount: coupons,
      pending,
      averageOrderValue: paidOrders.length ? revenue / paidOrders.length : 0,
      statusCounts,
      recentOrders: orders.slice(0, 6),
    };
  }

  async getSettings(userId: string) {
    const settings = await this.settingModel.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          globalStatus: false,
          currency: 'BDT',
          orderDelay: '6 Hours',
          maintainMarkup: true,
          roundPricesUpTo: '.00',
          paymentMethods: {
            stripe: { enabled: false, accountLink: '' },
            paypal: { enabled: false, accountLink: '' },
            offline: { enabled: false, instructions: '' },
          },
          links: [],
          domain: { hostname: '', dnsTarget: 'store.pixieset.local', verified: false },
          giftCardSharingEmail: '',
          termsOfSale: '',
          digitalImageLicense: '',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return settings.toObject();
  }

  async updateSettings(userId: string, dto: any) {
    const settings = await this.settingModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          globalStatus: Boolean(dto.globalStatus),
          currency: dto.currency ?? 'BDT',
          orderDelay: dto.orderDelay ?? '6 Hours',
          maintainMarkup: Boolean(dto.maintainMarkup),
          roundPricesUpTo: dto.roundPricesUpTo ?? '.00',
          paymentMethods: dto.paymentMethods ?? {},
          links: dto.links ?? [],
          domain: dto.domain ?? {},
          giftCardSharingEmail: dto.giftCardSharingEmail ?? '',
          termsOfSale: dto.termsOfSale ?? '',
          digitalImageLicense: dto.digitalImageLicense ?? '',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return settings.toObject();
  }

  async findPriceSheets(userId: string, collectionId?: string) {
    const query = collectionId ? { userId, collectionIds: collectionId } : { userId };
    const sheets = await this.priceSheetModel.find(query).sort({ createdAt: -1 }).lean();
    const ids = sheets.map((sheet) => sheet._id.toString());
    const counts = await this.productModel.aggregate([
      { $match: { userId, priceSheetId: { $in: ids } } },
      { $group: { _id: '$priceSheetId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((item) => [item._id, item.count]));

    return sheets.map((sheet) => ({
      ...sheet,
      productCount: countMap.get(sheet._id.toString()) ?? 0,
      collectionCount: sheet.collectionIds?.length ?? 0,
    }));
  }

  async createPriceSheet(userId: string, dto: CreatePriceSheetDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Price sheet name is required');
    if (dto.isDefault) await this.priceSheetModel.updateMany({ userId }, { $set: { isDefault: false } });

    const sheet = await this.priceSheetModel.create({
      userId,
      name: dto.name.trim(),
      isDefault: Boolean(dto.isDefault),
      collectionIds: dto.collectionIds ?? [],
      minimumOrderAmount: dto.minimumOrderAmount ?? 0,
      fulfillment: 'self-fulfilled',
    });

    return sheet.toObject();
  }

  async findPriceSheet(userId: string, id: string) {
    const sheet = await this.priceSheetModel.findOne({ _id: id, userId }).lean();
    if (!sheet) throw new NotFoundException('Price sheet not found');
    const products = await this.productModel
      .find({ userId, priceSheetId: id })
      .sort({ type: 1, category: 1, createdAt: -1 })
      .lean();

    return {
      ...sheet,
      productCount: products.length,
      collectionCount: sheet.collectionIds?.length ?? 0,
      products,
    };
  }

  async updatePriceSheet(userId: string, id: string, dto: UpdatePriceSheetDto) {
    const sheet = await this.priceSheetModel.findOne({ _id: id, userId });
    if (!sheet) throw new NotFoundException('Price sheet not found');
    if (dto.isDefault) await this.priceSheetModel.updateMany({ userId, _id: { $ne: id } }, { $set: { isDefault: false } });
    if (dto.name !== undefined) sheet.name = dto.name.trim();
    if (dto.isDefault !== undefined) sheet.isDefault = dto.isDefault;
    if (dto.collectionIds !== undefined) sheet.collectionIds = dto.collectionIds;
    if (dto.minimumOrderAmount !== undefined) sheet.minimumOrderAmount = dto.minimumOrderAmount;
    await sheet.save();
    return sheet.toObject();
  }

  async removePriceSheet(userId: string, id: string) {
    const sheet = await this.priceSheetModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!sheet) throw new NotFoundException('Price sheet not found');
    await this.productModel.deleteMany({ userId, priceSheetId: id });
    return sheet;
  }

  async createProduct(userId: string, priceSheetId: string, dto: CreateStoreProductDto) {
    await this.assertPriceSheet(userId, priceSheetId);
    if (!dto.name?.trim()) throw new BadRequestException('Product name is required');

    const product = await this.productModel.create({
      userId,
      priceSheetId,
      ...dto,
      name: dto.name.trim(),
      description: dto.description ?? '',
      price: dto.price ?? 0,
      extraShipping: dto.extraShipping ?? 0,
      category: dto.type === 'digital-download' ? 'Digital Downloads' : dto.category ?? 'Prints',
      images: dto.images ?? [],
      downloadType: dto.type === 'digital-download' ? dto.downloadType ?? 'single-photo' : undefined,
      downloadSize: dto.type === 'digital-download' ? dto.downloadSize ?? 'High Resolution Original (Full res)' : undefined,
      options: dto.options ?? [],
      noImageRequired: Boolean(dto.noImageRequired),
      exemptFromSalesTax: Boolean(dto.exemptFromSalesTax),
      limitOnePerCheckout: Boolean(dto.limitOnePerCheckout),
      allowBulkPurchase: Boolean(dto.allowBulkPurchase),
    });

    return product.toObject();
  }

  async updateProduct(userId: string, priceSheetId: string, productId: string, dto: UpdateStoreProductDto) {
    await this.assertPriceSheet(userId, priceSheetId);
    const product = await this.productModel.findOne({ _id: productId, userId, priceSheetId });
    if (!product) throw new NotFoundException('Product not found');
    Object.assign(product, dto);
    if (dto.name !== undefined) product.name = dto.name.trim();
    if (dto.type === 'digital-download' && !product.downloadSize) {
      product.downloadSize = 'High Resolution Original (Full res)';
    }
    await product.save();
    return product.toObject();
  }

  async removeProduct(userId: string, priceSheetId: string, productId: string) {
    const product = await this.productModel.findOneAndDelete({ _id: productId, userId, priceSheetId }).lean();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findOrders(userId: string) {
    return this.orderModel.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  async createOrder(userId: string, dto: any) {
    const customer = await this.upsertCustomerFromOrder(userId, dto.customer ?? {});
    if (!customer) throw new BadRequestException('Customer is required');
    const items = await Promise.all((dto.items ?? []).map(async (item) => {
      const quantity = Number(item.quantity ?? 1);
      const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
      const product = item.productId
        ? await this.productModel.findOne({ _id: item.productId, userId }).lean()
        : null;
      return {
        productId: item.productId,
        name: item.name ?? product?.name ?? 'Product',
        type: item.type ?? product?.type ?? 'self-fulfilled',
        quantity,
        unitPrice,
        total: quantity * unitPrice,
      };
    }));
    const shippingMethod = dto.shippingMethodId
      ? await this.shippingModel.findOne({ _id: dto.shippingMethodId, userId }).lean()
      : null;
    const extraShipping = await this.resolveExtraShipping(userId, items);
    const subtotal = Number(dto.subtotal ?? items.reduce((sum, item) => sum + item.total, 0));
    const shipping =
      dto.shipping !== undefined
        ? Number(dto.shipping)
        : Number(shippingMethod?.price ?? extraShipping ?? 0);
    const tax =
      dto.tax !== undefined
        ? Number(dto.tax)
        : await this.resolveTax(userId, items, subtotal, shipping, customer.address);
    const discount = Number(dto.discount ?? 0);
    const total = Number(dto.total ?? Math.max(0, subtotal + tax + shipping - discount));
    const order = await this.orderModel.create({
      userId,
      orderNumber: dto.orderNumber || `ORD-${Date.now()}`,
      customerId: customer._id.toString(),
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
      },
      items,
      subtotal,
      tax,
      shipping,
      shippingMethodId: shippingMethod?._id?.toString() ?? dto.shippingMethodId,
      shippingMethodName: shippingMethod?.name ?? dto.shippingMethodName ?? '',
      shippingNote: dto.shippingNote ?? shippingMethod?.region ?? '',
      discount,
      total,
      status: dto.status ?? 'pending',
      paymentStatus: dto.paymentStatus ?? 'paid',
      trackingNumber: dto.trackingNumber ?? '',
      trackingUrl: dto.trackingUrl ?? '',
      note: dto.note ?? '',
    });
    await this.recalculateCustomer(userId, customer.email);
    return order.toObject();
  }

  async updateOrder(userId: string, id: string, dto: any) {
    const order = await this.orderModel.findOne({ _id: id, userId });
    if (!order) throw new NotFoundException('Order not found');
    Object.assign(order, dto);
    await order.save();
    if (order.customer?.email) await this.recalculateCustomer(userId, order.customer.email);
    return order.toObject();
  }

  async removeOrder(userId: string, id: string) {
    const order = await this.orderModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!order) throw new NotFoundException('Order not found');
    if (order.customer?.email) await this.recalculateCustomer(userId, order.customer.email);
    return order;
  }

  async findCustomers(userId: string) {
    return this.customerModel.find({ userId }).sort({ totalSpent: -1, createdAt: -1 }).lean();
  }

  async createCustomer(userId: string, dto: any) {
    if (!dto.email?.trim()) throw new BadRequestException('Customer email is required');
    const customer = await this.customerModel.findOneAndUpdate(
      { userId, email: dto.email.toLowerCase().trim() },
      {
        $set: {
          name: dto.name?.trim() || dto.email,
          phone: dto.phone ?? '',
          address: dto.address ?? {},
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return customer.toObject();
  }

  async updateCustomer(userId: string, id: string, dto: any) {
    const customer = await this.customerModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: dto },
      { new: true },
    ).lean();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async findCoupons(userId: string) {
    return this.couponModel.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  async saveCoupon(userId: string, dto: any) {
    if (!dto.code?.trim()) throw new BadRequestException('Coupon code is required');
    const coupon = await this.couponModel.findOneAndUpdate(
      { userId, code: dto.code.toUpperCase().trim() },
      {
        $set: {
          name: dto.name?.trim() || dto.code.toUpperCase().trim(),
          discountType: dto.discountType ?? 'percent',
          amount: Number(dto.amount ?? 0),
          active: dto.active ?? true,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return coupon.toObject();
  }

  async deleteCoupon(userId: string, id: string) {
    const coupon = await this.couponModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async findTaxes(userId: string) {
    return this.taxModel.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  async saveTax(userId: string, dto: any) {
    const { _id, ...payload } = dto;
    const tax = dto._id
      ? await this.taxModel.findOneAndUpdate({ _id: dto._id, userId }, { $set: payload }, { new: true })
      : await this.taxModel.create({
          userId,
          name: dto.name?.trim() || 'Sales Tax',
          region: dto.region ?? '',
          rate: Number(dto.rate ?? 0),
          applyShipping: dto.applyShipping ?? true,
          applyDigitalDownloads: dto.applyDigitalDownloads ?? true,
          active: dto.active ?? true,
        });
    if (!tax) throw new NotFoundException('Tax rate not found');
    return tax.toObject();
  }

  async deleteTax(userId: string, id: string) {
    const tax = await this.taxModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!tax) throw new NotFoundException('Tax rate not found');
    return tax;
  }

  async findShipping(userId: string) {
    return this.shippingModel.find({ userId }).sort({ createdAt: -1 }).lean();
  }

  async saveShipping(userId: string, dto: any) {
    const { _id, ...payload } = dto;
    const shipping = dto._id
      ? await this.shippingModel.findOneAndUpdate({ _id: dto._id, userId }, { $set: payload }, { new: true })
      : await this.shippingModel.create({
          userId,
          name: dto.name?.trim() || 'Standard Shipping',
          region: dto.region ?? '',
          shipInternational: Boolean(dto.shipInternational),
          price: Number(dto.price ?? 0),
          freeOver: Number(dto.freeOver ?? 0),
          active: dto.active ?? true,
        });
    if (!shipping) throw new NotFoundException('Shipping rate not found');
    return shipping.toObject();
  }

  async deleteShipping(userId: string, id: string) {
    const shipping = await this.shippingModel.findOneAndDelete({ _id: id, userId }).lean();
    if (!shipping) throw new NotFoundException('Shipping rate not found');
    return shipping;
  }

  private async assertPriceSheet(userId: string, priceSheetId: string) {
    const sheet = await this.priceSheetModel.exists({ _id: priceSheetId, userId });
    if (!sheet) throw new NotFoundException('Price sheet not found');
  }

  private async upsertCustomerFromOrder(userId: string, customer: any) {
    const email = customer.email?.toLowerCase().trim();
    if (!email) throw new BadRequestException('Customer email is required');
    return this.customerModel.findOneAndUpdate(
      { userId, email },
      {
        $set: {
          name: customer.name?.trim() || email,
          phone: customer.phone ?? '',
          address: customer.address ?? {},
          lastOrderAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  private async recalculateCustomer(userId: string, email: string) {
    const orders = await this.orderModel.find({ userId, 'customer.email': email }).lean();
    const paidOrders = orders.filter((order) => order.paymentStatus === 'paid' && order.status !== 'cancelled');
    await this.customerModel.updateOne(
      { userId, email },
      {
        $set: {
          orderCount: orders.length,
          totalSpent: paidOrders.reduce((sum, order) => sum + (order.total ?? 0), 0),
          lastOrderAt: orders[0]?.createdAt,
        },
      },
    );
  }

  private async resolveExtraShipping(
    userId: string,
    items: { productId?: string; quantity: number }[],
  ) {
    const productIds = items.map((item) => item.productId).filter(Boolean);
    if (!productIds.length) return 0;
    const products = await this.productModel
      .find({ userId, _id: { $in: productIds } })
      .select('_id extraShipping')
      .lean();
    const shippingMap = new Map(
      products.map((product) => [product._id.toString(), product.extraShipping ?? 0]),
    );
    return items.reduce(
      (sum, item) => sum + (item.productId ? shippingMap.get(item.productId) ?? 0 : 0) * item.quantity,
      0,
    );
  }

  private async resolveTax(
    userId: string,
    items: { type: string; total: number }[],
    subtotal: number,
    shipping: number,
    address?: Record<string, unknown>,
  ) {
    const country = typeof address?.country === 'string' ? address.country : undefined;
    const tax = await this.taxModel
      .findOne({
        userId,
        active: true,
        ...(country ? { $or: [{ region: country }, { region: 'All' }] } : {}),
      })
      .sort({ createdAt: -1 })
      .lean();
    if (!tax?.rate) return 0;
    const digitalTotal = items
      .filter((item) => item.type === 'digital-download')
      .reduce((sum, item) => sum + item.total, 0);
    const taxableProducts = tax.applyDigitalDownloads === false
      ? subtotal - digitalTotal
      : subtotal;
    const taxableShipping = tax.applyShipping ? shipping : 0;
    return ((taxableProducts + taxableShipping) * tax.rate) / 100;
  }
}
