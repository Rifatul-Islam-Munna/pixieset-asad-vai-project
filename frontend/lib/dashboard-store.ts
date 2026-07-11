import { create } from "zustand";
import type { CustomCoverTemplate } from "@/lib/home-cms";

export type PresetEditorPanel =
  | "general"
  | "design"
  | "privacy"
  | "download"
  | "favorite"
  | "store";

export type PresetDesignSettings = {
  cover: string;
  coverSmallTitle: string;
  coverTitle: string;
  coverDate: string;
  coverButtonText: string;
  showCoverSmallTitle: boolean;
  showCoverTitle: boolean;
  showCoverDate: boolean;
  showCoverButton: boolean;
  typography: string;
  customFontName?: string;
  customFontDataUrl?: string;
  color: string;
  gridStyle: "Vertical" | "Horizontal";
  thumbnailSize: "Regular" | "Large";
  gridSpacing: "Regular" | "Large";
  navigationStyle: "Icon Only" | "Icon & Text";
  customCoverTemplate?: CustomCoverTemplate;
};

export type PresetDownloadSettings = {
  photoDownload: boolean;
  highResolution: boolean;
  highResolutionSize: "Original" | "3600px";
  webSize: boolean;
  webSizePx: "2048px" | "1024px" | "640px";
  videoDownload: boolean;
  downloadPin: boolean;
  downloadPinCode: string;
  restrictDownloads: boolean;
  limitDownloads: boolean;
  limitPinUsage: string;
};

export type PresetGeneralSettings = {
  collectionTags: string;
  photoSets: string;
  defaultWatermark: string;
  emailRegistration: boolean;
  galleryAssist: boolean;
  slideshow: boolean;
  socialSharing: boolean;
  language: string;
};

export type PresetFavoriteSettings = {
  favoritePhotos: boolean;
  favoriteNotes: boolean;
  maxFavorites: string;
  description: string;
};

export type PresetStoreSettings = {
  storeStatus: boolean;
  priceSheet: string;
  productPreview: boolean;
};

export type PresetItem = {
  id: string;
  name: string;
  collectionId?: string;
  general: PresetGeneralSettings;
  design: PresetDesignSettings;
  download: PresetDownloadSettings;
  favorite: PresetFavoriteSettings;
  store: PresetStoreSettings;
  updatedAt: string;
};

export type WatermarkItem = {
  id: string;
  name: string;
  type: "text" | "image";
  text: string;
  font: string;
  color: string;
  scale: number;
  opacity: number;
  position: { x: number; y: number };
  image: string;
  applyDownloads: boolean;
};

export type EmailTemplateItem = {
  id: string;
  name: string;
  subject: string;
  previewText: string;
  title: string;
  message: string;
  buttonText: string;
  buttonLink: string;
  buttonColor: string;
  footerText: string;
  image: string;
  updatedAt: string;
};

export type DashboardSettingRecord<T = unknown> = {
  _id: string;
  type: "watermark" | "preset" | "email-template" | "branding";
  localId: string;
  name: string;
  data: T;
};

type DashboardState = {
  activeNav: string;
  collapsed: boolean;
  wizardOpen: boolean;
  wizardStep: 1 | 2 | 3;
  collectionName: string;
  eventDate: string;
  coverDesign: string;
  photos: string[];
  libraryQuery: string;
  campaignBuilderOpen: boolean;
  campaignTemplate: string;
  campaignSubject: string;
  campaignPreviewText: string;
  campaignMessage: string;
  campaignImage: string;
  campaignButtonText: string;
  campaignButtonLink: string;
  campaignButtonColor: string;
  campaignFooterText: string;
  campaignTab: "email" | "recipients";
  campaignSearch: string;
  showCampaignTemplates: boolean;
  selectedRecipients: string[];
  watermarkType: "text" | "image";
  watermarkText: string;
  watermarkFont: string;
  watermarkColor: string;
  watermarkScale: number;
  watermarkOpacity: number;
  watermarkPosition: { x: number; y: number };
  watermarkImage: string;
  watermarkApplyDownloads: boolean;
  watermarkSaved: boolean;
  watermarkItems: WatermarkItem[];
  activeWatermarkId: string;
  presetEditorPanel: PresetEditorPanel;
  presetCollectionId: string;
  presetName: string;
  presetGeneral: PresetGeneralSettings;
  presetDesign: PresetDesignSettings;
  presetDownload: PresetDownloadSettings;
  presetFavorite: PresetFavoriteSettings;
  presetStore: PresetStoreSettings;
  presetSaved: boolean;
  presetItems: PresetItem[];
  activePresetId: string;
  emailTemplates: EmailTemplateItem[];
  activeEmailTemplateId: string;
  emailTemplateSaved: boolean;
  setActiveNav: (value: string) => void;
  toggleCollapsed: () => void;
  startWizard: () => void;
  setWizardStep: (value: 1 | 2 | 3) => void;
  setCollectionName: (value: string) => void;
  setEventDate: (value: string) => void;
  setCoverDesign: (value: string) => void;
  setLibraryQuery: (value: string) => void;
  startCampaignBuilder: (template?: string, buttonLink?: string) => void;
  setCampaignTemplate: (value: string) => void;
  setCampaignSubject: (value: string) => void;
  setCampaignPreviewText: (value: string) => void;
  setCampaignMessage: (value: string) => void;
  setCampaignImage: (value: string) => void;
  setCampaignButtonText: (value: string) => void;
  setCampaignButtonLink: (value: string) => void;
  setCampaignButtonColor: (value: string) => void;
  setCampaignFooterText: (value: string) => void;
  setCampaignTab: (value: "email" | "recipients") => void;
  setCampaignSearch: (value: string) => void;
  setShowCampaignTemplates: (value: boolean) => void;
  toggleRecipient: (value: string) => void;
  closeCampaignBuilder: () => void;
  addSamplePhotos: () => void;
  resetWizard: () => void;
  setWatermarkType: (value: "text" | "image") => void;
  setWatermarkText: (value: string) => void;
  setWatermarkFont: (value: string) => void;
  setWatermarkColor: (value: string) => void;
  setWatermarkScale: (value: number) => void;
  setWatermarkOpacity: (value: number) => void;
  setWatermarkPosition: (value: { x: number; y: number }) => void;
  setWatermarkImage: (value: string) => void;
  setWatermarkApplyDownloads: (value: boolean) => void;
  addWatermarkDraft: () => void;
  selectWatermark: (id: string) => void;
  saveWatermarkSettings: () => void;
  setPresetEditorPanel: (value: PresetEditorPanel) => void;
  setPresetCollectionId: (value: string) => void;
  setPresetName: (value: string) => void;
  setPresetGeneral: (value: Partial<PresetGeneralSettings>) => void;
  setPresetDesign: (value: Partial<PresetDesignSettings>) => void;
  setPresetDownload: (value: Partial<PresetDownloadSettings>) => void;
  setPresetFavorite: (value: Partial<PresetFavoriteSettings>) => void;
  setPresetStore: (value: Partial<PresetStoreSettings>) => void;
  savePresetSettings: () => void;
  addPresetDraft: () => void;
  selectPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  addEmailTemplateDraft: () => void;
  selectEmailTemplate: (id: string) => void;
  updateEmailTemplate: (value: Partial<EmailTemplateItem>) => void;
  saveEmailTemplate: () => void;
  deleteEmailTemplate: (id: string) => void;
  hydrateDashboardSettings: (settings: DashboardSettingRecord[]) => void;
};

const samplePhotos = [
  "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1508808787069-421e7986016e?auto=format&fit=crop&w=500&q=80",
];

const defaultFooterText = "";

const defaultEmailTemplates: EmailTemplateItem[] = [];

const emptyPresetGeneral: PresetGeneralSettings = {
  collectionTags: "",
  photoSets: "",
  defaultWatermark: "No watermark",
  emailRegistration: false,
  galleryAssist: false,
  slideshow: true,
  socialSharing: true,
  language: "English",
};

const emptyPresetDesign: PresetDesignSettings = {
  cover: "Center",
  coverSmallTitle: "Avery Studio",
  coverTitle: "Sarah & Daniel",
  coverDate: "June 14, 2026",
  coverButtonText: "View Gallery",
  showCoverSmallTitle: true,
  showCoverTitle: true,
  showCoverDate: true,
  showCoverButton: true,
  typography: "Classic",
  customFontName: "",
  customFontDataUrl: "",
  color: "White",
  gridStyle: "Vertical",
  thumbnailSize: "Regular",
  gridSpacing: "Regular",
  navigationStyle: "Icon Only",
};

const emptyPresetDownload: PresetDownloadSettings = {
  photoDownload: true,
  highResolution: true,
  highResolutionSize: "3600px",
  webSize: true,
  webSizePx: "1024px",
  videoDownload: false,
  downloadPin: false,
  downloadPinCode: "1234",
  restrictDownloads: false,
  limitDownloads: false,
  limitPinUsage: "",
};

const emptyPresetFavorite: PresetFavoriteSettings = {
  favoritePhotos: true,
  favoriteNotes: true,
  maxFavorites: "",
  description: "",
};

const emptyPresetStore: PresetStoreSettings = {
  storeStatus: true,
  priceSheet: "",
  productPreview: false,
};

const defaultPresetItems: PresetItem[] = [
  {
    id: "builtin-clean-classic",
    name: "Clean Classic",
    general: { ...emptyPresetGeneral, photoSets: "Highlights, Ceremony, Portraits" },
    design: { ...emptyPresetDesign, cover: "Center", typography: "Classic", color: "White", gridStyle: "Vertical", gridSpacing: "Regular" },
    download: { ...emptyPresetDownload },
    favorite: { ...emptyPresetFavorite },
    store: { ...emptyPresetStore, storeStatus: false },
    updatedAt: "Built in",
  },
  {
    id: "builtin-modern-story",
    name: "Modern Story",
    general: { ...emptyPresetGeneral, photoSets: "Story, Favorites", socialSharing: true },
    design: { ...emptyPresetDesign, cover: "Left", typography: "Modern", color: "Sand", gridStyle: "Horizontal", thumbnailSize: "Large", gridSpacing: "Large", navigationStyle: "Icon & Text" },
    download: { ...emptyPresetDownload, downloadPin: true },
    favorite: { ...emptyPresetFavorite, favoriteNotes: false },
    store: { ...emptyPresetStore, storeStatus: true },
    updatedAt: "Built in",
  },
];

const readEmailTemplates = () => {
  return defaultEmailTemplates;
};

const writeEmailTemplates = (templates: EmailTemplateItem[]) => {
  return templates;
};

export const useDashboardStore = create<DashboardState>((set) => {
  const initialEmailTemplates = readEmailTemplates();

  return ({
  activeNav: "Collections",
  collapsed: false,
  wizardOpen: false,
  wizardStep: 1,
  collectionName: "",
  eventDate: "",
  coverDesign: "Left",
  photos: [],
  libraryQuery: "",
  campaignBuilderOpen: false,
  campaignTemplate: "",
  campaignSubject: "",
  campaignPreviewText: "",
  campaignMessage: "",
  campaignImage: "",
  campaignButtonText: "Open Gallery",
  campaignButtonLink: "Collection URL",
  campaignButtonColor: "#444444",
  campaignFooterText: defaultFooterText,
  campaignTab: "email",
  campaignSearch: "",
  showCampaignTemplates: false,
  selectedRecipients: [],
  watermarkType: "text",
  watermarkText: "",
  watermarkFont: "Times New Roman",
  watermarkColor: "#ffffff",
  watermarkScale: 42,
  watermarkOpacity: 90,
  watermarkPosition: { x: 15, y: 85 },
  watermarkImage: "",
  watermarkApplyDownloads: false,
  watermarkSaved: false,
  watermarkItems: [],
  activeWatermarkId: "",
  presetEditorPanel: "general",
  presetCollectionId: "",
  presetName: "",
  presetGeneral: emptyPresetGeneral,
  presetDesign: emptyPresetDesign,
  presetDownload: emptyPresetDownload,
  presetFavorite: emptyPresetFavorite,
  presetStore: emptyPresetStore,
  presetSaved: false,
  presetItems: defaultPresetItems,
  activePresetId: defaultPresetItems[0].id,
  emailTemplates: initialEmailTemplates,
  activeEmailTemplateId: initialEmailTemplates[0]?.id ?? "",
  emailTemplateSaved: true,
  setActiveNav: (value) => set({ activeNav: value }),
  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
  startWizard: () =>
    set({ activeNav: "Collections", wizardOpen: true, wizardStep: 1 }),
  setWizardStep: (value) => set({ wizardStep: value }),
  setCollectionName: (value) => set({ collectionName: value }),
  setEventDate: (value) => set({ eventDate: value }),
  setCoverDesign: (value) => set({ coverDesign: value }),
  setLibraryQuery: (value) => set({ libraryQuery: value }),
  startCampaignBuilder: (template = "New Campaign", buttonLink) =>
    set((state) => {
      const savedTemplate = state.emailTemplates.find(
        (item) => item.id === template || item.name === template,
      );

      if (savedTemplate) {
        return {
          campaignBuilderOpen: true,
          campaignTemplate: savedTemplate.title,
          campaignSubject: savedTemplate.subject,
          campaignPreviewText: savedTemplate.previewText,
          campaignMessage: savedTemplate.message,
          campaignButtonText: savedTemplate.buttonText,
          campaignButtonLink: buttonLink ?? savedTemplate.buttonLink,
          campaignButtonColor: savedTemplate.buttonColor,
          campaignFooterText: savedTemplate.footerText,
          campaignImage: savedTemplate.image,
          campaignTab: "email",
          showCampaignTemplates: false,
        };
      }

      return {
      campaignBuilderOpen: true,
      campaignTemplate: template,
      campaignSubject: "",
      campaignPreviewText: "",
      campaignMessage: "",
      campaignButtonText: "Open Gallery",
      campaignButtonLink: buttonLink ?? "Collection URL",
      campaignButtonColor: "#444444",
      campaignFooterText: defaultFooterText,
      campaignImage: "",
      campaignTab: "email",
      showCampaignTemplates: false,
    };
    }),
  setCampaignTemplate: (value) => set({ campaignTemplate: value }),
  setCampaignSubject: (value) => set({ campaignSubject: value }),
  setCampaignPreviewText: (value) => set({ campaignPreviewText: value }),
  setCampaignMessage: (value) => set({ campaignMessage: value }),
  setCampaignImage: (value) => set({ campaignImage: value }),
  setCampaignButtonText: (value) => set({ campaignButtonText: value }),
  setCampaignButtonLink: (value) => set({ campaignButtonLink: value }),
  setCampaignButtonColor: (value) => set({ campaignButtonColor: value }),
  setCampaignFooterText: (value) => set({ campaignFooterText: value }),
  setCampaignSearch: (value) => set({ campaignSearch: value }),
  setShowCampaignTemplates: (value) => set({ showCampaignTemplates: value }),
  setCampaignTab: (value) => set({ campaignTab: value }),
  toggleRecipient: (value) =>
    set((state) => ({
      selectedRecipients: state.selectedRecipients.includes(value)
        ? state.selectedRecipients.filter((item) => item !== value)
        : [...state.selectedRecipients, value],
    })),
  closeCampaignBuilder: () => set({ campaignBuilderOpen: false }),
  addSamplePhotos: () => set({ photos: samplePhotos }),
  resetWizard: () =>
    set({
      activeNav: "Collections",
      wizardOpen: false,
      wizardStep: 1,
      collectionName: "",
      eventDate: "",
      coverDesign: "Left",
      photos: [],
    }),
  setWatermarkType: (value) => set({ watermarkType: value, watermarkSaved: false }),
  setWatermarkText: (value) => set({ watermarkText: value, watermarkSaved: false }),
  setWatermarkFont: (value) => set({ watermarkFont: value, watermarkSaved: false }),
  setWatermarkColor: (value) => set({ watermarkColor: value, watermarkSaved: false }),
  setWatermarkScale: (value) => set({ watermarkScale: value, watermarkSaved: false }),
  setWatermarkOpacity: (value) => set({ watermarkOpacity: value, watermarkSaved: false }),
  setWatermarkPosition: (value) => set({ watermarkPosition: value, watermarkSaved: false }),
  setWatermarkImage: (value) => set({ watermarkImage: value, watermarkSaved: false }),
  setWatermarkApplyDownloads: (value) =>
    set({ watermarkApplyDownloads: value, watermarkSaved: false }),
  addWatermarkDraft: () =>
    set((state) => {
      const id = `wm-${Date.now()}`;
      const draft: WatermarkItem = {
        id,
        name: "Untitled text watermark",
        type: "text",
        text: "",
        font: "Times New Roman",
        color: "#ffffff",
        scale: 42,
        opacity: 90,
        position: { x: 15, y: 85 },
        image: "",
        applyDownloads: false,
      };

      return {
        activeWatermarkId: id,
        watermarkItems: [...state.watermarkItems, draft],
        watermarkType: draft.type,
        watermarkText: draft.text,
        watermarkFont: draft.font,
        watermarkColor: draft.color,
        watermarkScale: draft.scale,
        watermarkOpacity: draft.opacity,
        watermarkPosition: draft.position,
        watermarkImage: draft.image,
        watermarkApplyDownloads: draft.applyDownloads,
        watermarkSaved: false,
      };
    }),
  selectWatermark: (id) =>
    set((state) => {
      const item = state.watermarkItems.find((watermark) => watermark.id === id);
      if (!item) return {};
      return {
        activeWatermarkId: item.id,
        watermarkType: item.type,
        watermarkText: item.text,
        watermarkFont: item.font,
        watermarkColor: item.color,
        watermarkScale: item.scale,
        watermarkOpacity: item.opacity,
        watermarkPosition: item.position,
        watermarkImage: item.image,
        watermarkApplyDownloads: item.applyDownloads,
        watermarkSaved: true,
      };
    }),
  saveWatermarkSettings: () =>
    set((state) => {
      const id = state.activeWatermarkId;
      const saved: WatermarkItem = {
        id,
        name:
          state.watermarkType === "text"
            ? `${state.watermarkText || "Untitled"} text watermark`
            : "Image watermark",
        type: state.watermarkType,
        text: state.watermarkText,
        font: state.watermarkFont,
        color: state.watermarkColor,
        scale: state.watermarkScale,
        opacity: state.watermarkOpacity,
        position: state.watermarkPosition,
        image: state.watermarkImage,
        applyDownloads: state.watermarkApplyDownloads,
      };
      const exists = state.watermarkItems.some((item) => item.id === id);
      return {
        activeWatermarkId: id,
        watermarkItems: exists
          ? state.watermarkItems.map((item) => (item.id === id ? saved : item))
          : [...state.watermarkItems, saved],
        watermarkSaved: true,
      };
    }),
  setPresetEditorPanel: (value) => set({ presetEditorPanel: value }),
  setPresetCollectionId: (value) =>
    set({ presetCollectionId: value, presetSaved: false }),
  setPresetName: (value) => set({ presetName: value, presetSaved: false }),
  setPresetGeneral: (value) =>
    set((state) => ({
      presetGeneral: { ...state.presetGeneral, ...value },
      presetSaved: false,
    })),
  setPresetDesign: (value) =>
    set((state) => ({
      presetDesign: { ...state.presetDesign, ...value },
      presetSaved: false,
    })),
  setPresetDownload: (value) =>
    set((state) => ({
      presetDownload: { ...state.presetDownload, ...value },
      presetSaved: false,
    })),
  setPresetFavorite: (value) =>
    set((state) => ({
      presetFavorite: { ...state.presetFavorite, ...value },
      presetSaved: false,
    })),
  setPresetStore: (value) =>
    set((state) => ({
      presetStore: { ...state.presetStore, ...value },
      presetSaved: false,
    })),
  savePresetSettings: () =>
    set((state) => {
      const id = state.activePresetId || `preset-${Date.now()}`;
      const saved: PresetItem = {
        id,
        name: state.presetName || "Untitled Preset",
        collectionId: state.presetCollectionId || undefined,
        general: state.presetGeneral,
        design: { ...emptyPresetDesign, ...state.presetDesign },
        download: { ...emptyPresetDownload, ...state.presetDownload },
        favorite: state.presetFavorite,
        store: state.presetStore,
        updatedAt: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      };
      const exists = state.presetItems.some((preset) => preset.id === id);

      return {
        activePresetId: id,
        presetName: saved.name,
        presetCollectionId: saved.collectionId ?? "",
        presetItems: exists
          ? state.presetItems.map((preset) => (preset.id === id ? saved : preset))
          : [saved, ...state.presetItems],
        presetSaved: true,
      };
    }),
  addPresetDraft: () =>
    set((state) => {
      const id = `preset-${Date.now()}`;
      const draft: PresetItem = {
        id,
        name: "Untitled Preset",
        general: emptyPresetGeneral,
        design: emptyPresetDesign,
        download: emptyPresetDownload,
        favorite: emptyPresetFavorite,
        store: emptyPresetStore,
        updatedAt: "Draft",
      };

      return {
        presetItems: [draft, ...state.presetItems],
        activePresetId: id,
        presetName: draft.name,
        presetCollectionId: draft.collectionId ?? "",
        presetGeneral: draft.general,
        presetDesign: draft.design,
        presetDownload: draft.download,
        presetFavorite: draft.favorite,
        presetStore: draft.store,
        presetEditorPanel: "general",
        presetSaved: false,
      };
    }),
  selectPreset: (id) =>
    set((state) => {
      const preset = state.presetItems.find((item) => item.id === id);
      if (!preset) return {};

      return {
        activePresetId: preset.id,
        presetName: preset.name,
        presetCollectionId: preset.collectionId ?? "",
        presetGeneral: preset.general,
        presetDesign: { ...emptyPresetDesign, ...preset.design },
        presetDownload: { ...emptyPresetDownload, ...preset.download },
        presetFavorite: { ...emptyPresetFavorite, ...preset.favorite },
        presetStore: preset.store,
        presetEditorPanel: "general",
        presetSaved: true,
      };
    }),
  deletePreset: (id) =>
    set((state) => {
      const presetItems = state.presetItems.filter((preset) => preset.id !== id);
      const nextPreset = presetItems[0];

      return {
        presetItems,
        activePresetId: nextPreset?.id ?? "",
        presetName: nextPreset?.name ?? "",
        presetCollectionId: nextPreset?.collectionId ?? "",
        presetGeneral: nextPreset?.general ?? emptyPresetGeneral,
        presetDesign: nextPreset ? { ...emptyPresetDesign, ...nextPreset.design } : emptyPresetDesign,
        presetDownload: nextPreset ? { ...emptyPresetDownload, ...nextPreset.download } : emptyPresetDownload,
        presetFavorite: nextPreset?.favorite ?? emptyPresetFavorite,
        presetStore: nextPreset?.store ?? emptyPresetStore,
        presetSaved: true,
      };
    }),
  addEmailTemplateDraft: () =>
    set((state) => {
      const id = `tpl-${Date.now()}`;
      const template: EmailTemplateItem = {
        id,
        name: "Untitled Template",
        subject: "",
        previewText: "",
        title: "Untitled Template",
        message: "",
        buttonText: "Open Gallery",
        buttonLink: "Collection URL",
        buttonColor: "#22bda7",
        footerText: defaultFooterText,
        image: "",
        updatedAt: "Draft",
      };

      const emailTemplates = [template, ...state.emailTemplates];
      writeEmailTemplates(emailTemplates);

      return {
        emailTemplates,
        activeEmailTemplateId: id,
        emailTemplateSaved: false,
      };
    }),
  selectEmailTemplate: (id) => set({ activeEmailTemplateId: id, emailTemplateSaved: true }),
  updateEmailTemplate: (value) =>
    set((state) => {
      const emailTemplates = state.emailTemplates.map((template) =>
        template.id === state.activeEmailTemplateId
          ? { ...template, ...value }
          : template,
      );
      writeEmailTemplates(emailTemplates);

      return {
        emailTemplates,
        emailTemplateSaved: false,
      };
    }),
  saveEmailTemplate: () =>
    set((state) => {
      const emailTemplates = state.emailTemplates.map((template) =>
        template.id === state.activeEmailTemplateId
          ? { ...template, updatedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }
          : template,
      );
      writeEmailTemplates(emailTemplates);

      return {
        emailTemplates,
        emailTemplateSaved: true,
      };
    }),
  deleteEmailTemplate: (id) =>
    set((state) => {
      const emailTemplates = state.emailTemplates.filter((template) => template.id !== id);
      writeEmailTemplates(emailTemplates);
      return {
        emailTemplates,
        activeEmailTemplateId: emailTemplates[0]?.id ?? "",
        emailTemplateSaved: true,
      };
    }),
  hydrateDashboardSettings: (settings) =>
    set((state) => {
      const watermarks = settings
        .filter((setting) => setting.type === "watermark")
        .map((setting) => setting.data as WatermarkItem);
      const emailTemplates = settings
        .filter((setting) => setting.type === "email-template")
        .map((setting) => setting.data as EmailTemplateItem);
      const presetItems = settings
        .filter((setting) => setting.type === "preset")
        .map((setting) => {
          const data = setting.data as Partial<PresetItem> & {
            presetName?: string;
            presetGeneral?: PresetGeneralSettings;
            presetDesign?: PresetDesignSettings;
            presetDownload?: PresetDownloadSettings;
            presetFavorite?: PresetFavoriteSettings;
            presetStore?: PresetStoreSettings;
          };

          return {
            id: data.id ?? setting.localId,
            name: data.name ?? data.presetName ?? setting.name,
            collectionId: data.collectionId,
            general: data.general ?? data.presetGeneral ?? emptyPresetGeneral,
            design: { ...emptyPresetDesign, ...(data.design ?? data.presetDesign ?? {}) },
            download: { ...emptyPresetDownload, ...(data.download ?? data.presetDownload ?? {}) },
            favorite: { ...emptyPresetFavorite, ...(data.favorite ?? data.presetFavorite ?? {}) },
            store: data.store ?? data.presetStore ?? emptyPresetStore,
            updatedAt: data.updatedAt ?? "Saved",
          } satisfies PresetItem;
        });
      const combinedPresets = [...presetItems, ...defaultPresetItems.filter((builtIn) => !presetItems.some((item) => item.id === builtIn.id))];
      const activePreset = combinedPresets[0];

      if (emailTemplates.length) {
        writeEmailTemplates(emailTemplates);
      }

      return {
        watermarkItems: watermarks.length ? watermarks : state.watermarkItems,
        activeWatermarkId: watermarks[0]?.id ?? state.activeWatermarkId,
        emailTemplates: emailTemplates.length ? emailTemplates : state.emailTemplates,
        activeEmailTemplateId: emailTemplates[0]?.id ?? state.activeEmailTemplateId,
        presetItems: combinedPresets,
        activePresetId: activePreset?.id ?? state.activePresetId,
        presetName: activePreset?.name ?? state.presetName,
        presetCollectionId: activePreset?.collectionId ?? state.presetCollectionId,
        presetGeneral: activePreset?.general ?? state.presetGeneral,
        presetDesign: activePreset ? { ...emptyPresetDesign, ...activePreset.design } : state.presetDesign,
        presetDownload: activePreset ? { ...emptyPresetDownload, ...activePreset.download } : state.presetDownload,
        presetFavorite: activePreset ? { ...emptyPresetFavorite, ...activePreset.favorite } : state.presetFavorite,
        presetStore: activePreset?.store ?? state.presetStore,
        watermarkSaved: true,
        emailTemplateSaved: true,
        presetSaved: true,
      };
    }),
  });
});
