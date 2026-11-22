import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ExpressRequest } from '../lib/auth.guard';
import { StudioProjectService } from './studio-project.service';

@Controller('studio/projects')
@UseGuards(AuthGuard)
export class StudioProjectController {
  constructor(private readonly projects: StudioProjectService) {}

  @Get(':id/overview')
  overview(@Req() req: ExpressRequest, @Param('id') id: string) {
    return this.projects.overview(req.user.id, id).then(data => ({ data }));
  }

  @Post(':id/notes')
  addNote(@Req() req: ExpressRequest, @Param('id') id: string,
    @Body() body: Record<string, unknown>) {
    return this.projects.addNote(req.user.id, id, body.text).then(data => ({ data }));
  }

  @Delete(':id/notes/:noteId')
  deleteNote(@Req() req: ExpressRequest, @Param('id') id: string,
    @Param('noteId') noteId: string) {
    return this.projects.deleteNote(req.user.id, id, noteId).then(data => ({ data }));
  }

  @Post(':id/collections')
  linkGallery(@Req() req: ExpressRequest, @Param('id') id: string,
    @Body() body: Record<string, unknown>) {
    return this.projects.linkGallery(req.user.id, id, String(body.collectionId || ''))
      .then(data => ({ data }));
  }

  @Delete(':id/collections/:collectionId')
  unlinkGallery(@Req() req: ExpressRequest, @Param('id') id: string,
    @Param('collectionId') collectionId: string) {
    return this.projects.unlinkGallery(req.user.id, id, collectionId).then(data => ({ data }));
  }
}
