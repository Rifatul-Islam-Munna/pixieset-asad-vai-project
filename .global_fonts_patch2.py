from pathlib import Path
root = Path(r'D:\client-project\pixieset-asad-vai-project')

def patch(rel, old, new, count=1):
    path = root / rel
    text = path.read_text(encoding='utf-8')
    found = text.count(old)
    if found < count:
        raise RuntimeError(f'pattern not found enough: {rel} ({found} < {count})')
    path.write_text(text.replace(old, new, count), encoding='utf-8')
    print('patched', rel)
patch('backend/src/home-cms/home-cms.controller.ts',
'''import { Body, Controller, Get, Header, Patch, UseGuards } from '@nestjs/common';''',
'''import { Body, Controller, Delete, Get, Header, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { cwd } from 'process';''')

patch('backend/src/home-cms/home-cms.controller.ts',
'''@Controller('home-cms')
export class HomeCmsController {''',
'''const fontUploadDir = join(cwd(), 'uploads');
const fontUploadOptions = {
  storage: diskStorage({ destination: (_req, _file, cb) => { if (!existsSync(fontUploadDir)) mkdirSync(fontUploadDir, { recursive: true }); cb(null, fontUploadDir); }, filename: (_req, file, cb) => cb(null, `admin-font-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`) }),
  limits: { fileSize: 20 * 1024 * 1024 },
};

@Controller('home-cms')
export class HomeCmsController {''')
patch('backend/src/home-cms/home-cms.controller.ts',
'''  @Patch()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0')''',
'''  @Post('fonts')
  @ApiConsumes('multipart/form-data')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  @UseInterceptors(FileInterceptor('file', fontUploadOptions))
  async uploadFont(@UploadedFile() file: Express.Multer.File) {
    const data = await this.homeCmsService.uploadFont(file);
    return { message: 'Font uploaded', data };
  }

  @Delete('fonts/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.ADMIN)
  async removeFont(@Param('id') id: string) {
    const data = await this.homeCmsService.removeFont(id);
    return { message: 'Font removed from library', data };
  }

  @Patch()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0')''')
patch('frontend/lib/home-cms.ts',
'''  coverTemplates: CustomCoverTemplate[];
  emailTemplates: EmailTemplateItem[];
  content: Record<HomeLanguage, HomeContent>;''',
'''  coverTemplates: CustomCoverTemplate[];
  emailTemplates: EmailTemplateItem[];
  fonts: GlobalFontItem[];
  content: Record<HomeLanguage, HomeContent>;''')
patch('frontend/lib/home-cms.ts',
'''export type EmailTemplateItem = {''',
'''export type GlobalFontItem = {
  id: string;
  name: string;
  url: string;
  fileName: string;
  format?: string;
  createdAt?: string;
};

export type EmailTemplateItem = {''')
patch('frontend/lib/home-cms.ts',
'''  coverTemplates: [],
  emailTemplates: defaultEmailTemplates,
  legal:''',
'''  coverTemplates: [],
  emailTemplates: defaultEmailTemplates,
  fonts: [],
  legal:''')
patch('frontend/lib/home-cms.ts',
'''    emailTemplates:
      Array.isArray(data?.emailTemplates) && data.emailTemplates.length
        ? data.emailTemplates.map((template) => ({ ...template, source: "admin" as const }))
        : defaultEmailTemplates,
    media,''',
'''    emailTemplates:
      Array.isArray(data?.emailTemplates) && data.emailTemplates.length
        ? data.emailTemplates.map((template) => ({ ...template, source: "admin" as const }))
        : defaultEmailTemplates,
    fonts: Array.isArray(data?.fonts)
      ? data.fonts.filter((font) => Boolean(font?.id && font?.name && font?.url))
      : [],
    media,''')
patch('frontend/actions/admin.ts',
'''import { mergeHomeCms, type HomeCmsData } from "@/lib/home-cms";''',
'''import { mergeHomeCms, type GlobalFontItem, type HomeCmsData } from "@/lib/home-cms";''')
patch('frontend/actions/admin.ts',
'''export async function getAdminHomeCms() {
  return adminRequest<HomeCmsData>("/home-cms");
}''',
'''export async function uploadAdminFont(formData: FormData) {
  const token = (await cookies()).get("access_token")?.value;
  const response = await fetch(`${apiBaseUrl()}/home-cms/fonts`, {
    method: "POST",
    headers: { access_token: token ?? "" },
    body: formData,
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) redirect("/login");
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message ?? "Font upload failed");
  revalidatePath("/admin/fonts");
  return payload?.data as { font: GlobalFontItem; fonts: GlobalFontItem[] };
}

export async function removeAdminFont(id: string) {
  const data = await adminRequest<{ removed: boolean; fonts: GlobalFontItem[] }>(`/home-cms/fonts/${encodeURIComponent(id)}`, { method: "DELETE" });
  revalidatePath("/admin/fonts");
  return data;
}

export async function getAdminHomeCms() {
  return adminRequest<HomeCmsData>("/home-cms");
}''')
patch('frontend/components/dashboard/admin-resource-shell.tsx',
'''import { BarChart3, FileImage, Mail, Newspaper, Package, ShoppingBag } from "lucide-react";''',
'''import { BarChart3, FileImage, Mail, Newspaper, Package, ShoppingBag, Type } from "lucide-react";''')
patch('frontend/components/dashboard/admin-resource-shell.tsx',
'''  { href: "/admin/email-templates", label: "Email templates", icon: Mail },
  { href: "/admin/default-products", label: "Default products", icon: ShoppingBag },''',
'''  { href: "/admin/email-templates", label: "Email templates", icon: Mail },
  { href: "/admin/fonts", label: "Fonts", icon: Type },
  { href: "/admin/default-products", label: "Default products", icon: ShoppingBag },''')
patch('frontend/components/dashboard/admin-resource-shell.tsx',
'''  active: "covers" | "emails" | "products" | "blogs";''',
'''  active: "covers" | "emails" | "fonts" | "products" | "blogs";''')
patch('frontend/components/dashboard/admin-resource-shell.tsx',
'''    : active === "blogs"
        ? "/admin/blogs"
        : "/admin/default-products";''',
'''    : active === "fonts"
      ? "/admin/fonts"
      : active === "blogs"
        ? "/admin/blogs"
        : "/admin/default-products";''')
patch('frontend/components/dashboard/admin-dashboard.tsx',
'''import { BarChart3, Check, Clock3, Copy, Edit3, Euro, ExternalLink, FileImage, FileText, GripVertical, HardDrive, Images, Loader2, LogOut, Mail, Menu, MessageCircle, Newspaper, Package, PlusCircle, Search, Send, ShieldCheck, ShoppingBag, Trash2, Users, X } from "lucide-react";''',
'''import { BarChart3, Check, Clock3, Copy, Edit3, Euro, ExternalLink, FileImage, FileText, GripVertical, HardDrive, Images, Loader2, LogOut, Mail, Menu, MessageCircle, Newspaper, Package, PlusCircle, Search, Send, ShieldCheck, ShoppingBag, Trash2, Type, Users, X } from "lucide-react";''')
patch('frontend/components/dashboard/admin-dashboard.tsx',
'''<Link href="/admin/email-templates" className={navClass(false)}><Mail className="size-4" />Email Templates</Link>
<Link href="/admin/default-products" className={navClass(false)}><ShoppingBag className="size-4" />Default Products</Link>''',
'''<Link href="/admin/email-templates" className={navClass(false)}><Mail className="size-4" />Email Templates</Link>
<Link href="/admin/fonts" className={navClass(false)}><Type className="size-4" />Fonts</Link>
<Link href="/admin/default-products" className={navClass(false)}><ShoppingBag className="size-4" />Default Products</Link>''')
