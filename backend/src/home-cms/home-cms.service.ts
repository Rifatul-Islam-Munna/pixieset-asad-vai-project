import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UpdateHomeCmsDto } from './dto/update-home-cms.dto';
import { HomeCms, HomeCmsDocument } from './entities/home-cms.entity';

@Injectable()
export class HomeCmsService {
  constructor(@InjectModel(HomeCms.name) private readonly homeCmsModel: Model<HomeCmsDocument>) {}

  async getHomeCms() {
    const cms = await this.homeCmsModel.findOneAndUpdate(
      { key: 'home' },
      { $setOnInsert: { key: 'home', content: {}, media: { heroMediaType: 'image', heroMediaUrl: '' }, defaultLanguage: 'en' } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return cms.toObject();
  }

  async updateHomeCms(dto: UpdateHomeCmsDto) {
    const cms = await this.homeCmsModel.findOneAndUpdate(
      { key: 'home' },
      {
        $set: {
          content: dto.content ?? {},
          media: dto.media ?? { heroMediaType: 'image', heroMediaUrl: '' },
          defaultLanguage: dto.defaultLanguage ?? 'en',
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return cms.toObject();
  }
}
