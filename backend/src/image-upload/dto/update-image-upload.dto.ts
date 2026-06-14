import { PartialType } from '@nestjs/swagger';
import { CreateImageUploadDto } from './create-image-upload.dto';

export class UpdateImageUploadDto extends PartialType(CreateImageUploadDto) {}
