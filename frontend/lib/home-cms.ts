export type HomeLanguage = "en" | "gr";

export type HomeCmsData = {
  seo: SiteSeo;
  auth: AuthCms;
  brand: BrandSettings;
  legal: Record<HomeLanguage, LegalPages>;
  coverTemplates: CustomCoverTemplate[];
  content: Record<HomeLanguage, HomeContent>;
  media: {
    heroMediaType: "image" | "video";
    heroMediaUrl: string;
  };
  defaultLanguage: HomeLanguage;
};

export type LegalPages = {
  terms: { title: string; content: string };
  privacy: { title: string; content: string };
};

export type BrandSettings = {
  logoUrl: string;
  brandText: string;
  brandImageUrl: string;
  accentColor: string;
};

export type CustomCoverElement = {
  id: string;
  type: "title" | "subtitle" | "date" | "button" | "brandText" | "logo" | "line";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  opacity: number;
  align?: "left" | "center" | "right";
};

export type CustomCoverTemplate = {
  id: string;
  name: string;
  backgroundImage: string;
  overlayOpacity: number;
  gridOpacity: number;
  lineOpacity: number;
  elements: CustomCoverElement[];
};

export type SiteSeo = {
  siteTitle: string;
  siteDescription: string;
  siteKeywords: string;
  siteCanonicalUrl: string;
  siteImageUrl: string;
  googleTagManagerId: string;
  robots: string;
  twitterCard: string;
  extraMetaTags: SeoMetaTag[];
  jsonLd: string;
  faviconUrl: string;
  loginTitle: string;
  loginDescription: string;
  loginKeywords: string;
  registerTitle: string;
  registerDescription: string;
  registerKeywords: string;
};

export type SeoMetaTag = {
  type: "name" | "property" | "httpEquiv";
  key: string;
  value: string;
};

export type AuthCms = {
  brand: string;
  loginTitle: string;
  loginSubtitle: string;
  loginImageUrl: string;
  loginImageSide: "left" | "right";
  registerTitle: string;
  registerSubtitle: string;
  registerImageUrl: string;
  registerImageSide: "left" | "right";
};

export type HomeContent = {
  nav: { brand: string; products: string; examples: string; pricing: string; login: string; cta: string };
  hero: { eyebrow: string; title: string; subtitle: string; cta: string };
  gallery: { title: string; subtitle: string; tabs: GalleryTab[]; productTabs: string[]; cartLabel: string };
  products: { title: string; price: string; description?: string; href?: string }[];
  workflow: { eyebrow: string; title: string; subtitle: string; tabs: GalleryTab[]; cardText: string };
  testimonials: { eyebrow: string; title: string; subtitle: string; items: Testimonial[] };
  cta: { title: string; subtitle: string; button: string; desktopName: string; desktopSubtitle: string; invoiceTitle: string; invoiceText: string; galleryName: string; images: string[] };
  footer: { description: string; copyright: string; columns: { title: string; links: FooterLink[] }[] };
};

export type GalleryTab = { value: string; label: string; image: string; title?: string };
export type Testimonial = { name: string; site: string; image: string; quote: string };
export type FooterLink = string | { label: string; url: string };

const image = "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=900&q=80";

export const defaultHomeCms: HomeCmsData = {
  defaultLanguage: "en",
  brand: {
    logoUrl: "",
    brandText: "Nikoset",
    brandImageUrl: "",
    accentColor: "#22bda7",
  },
  coverTemplates: [],
  legal: {
    en: {
      terms: { title: "Terms of Service", content: "These Terms of Service govern your use of Gallerista.\n\nBy creating an account, you agree to use the service lawfully and to protect access to your account. You retain ownership of content you upload." },
      privacy: { title: "Privacy Policy", content: "This Privacy Policy explains how Gallerista handles account, gallery, and customer information.\n\nWe use submitted information to provide and secure the service. We do not sell personal information." },
    },
    gr: {
      terms: { title: "Όροι Παροχής Υπηρεσιών", content: "Οι παρόντες όροι διέπουν τη χρήση του Gallerista.\n\nΜε τη δημιουργία λογαριασμού συμφωνείτε να χρησιμοποιείτε νόμιμα την υπηρεσία και να προστατεύετε την πρόσβαση στον λογαριασμό σας." },
      privacy: { title: "Πολιτική Απορρήτου", content: "Η παρούσα πολιτική εξηγεί πώς το Gallerista διαχειρίζεται τα στοιχεία λογαριασμού, γκαλερί και πελατών.\n\nΧρησιμοποιούμε τα στοιχεία για την παροχή και ασφάλεια της υπηρεσίας." },
    },
  },
  seo: {
    siteTitle: "Nikoset",
    siteDescription: "An all-in-one platform for modern photographers with client galleries, websites, stores, and studio tools.",
    siteKeywords: "photography platform, client galleries, photo store, photographer website, studio tools",
    siteCanonicalUrl: "",
    siteImageUrl: "",
    googleTagManagerId: "",
    robots: "index, follow",
    twitterCard: "summary_large_image",
    extraMetaTags: [],
    jsonLd: "",
    faviconUrl: "",
    loginTitle: "Log in | Nikoset",
    loginDescription: "Log in to your Nikoset workspace.",
    loginKeywords: "Nikoset login, photographer workspace login",
    registerTitle: "Create account | Nikoset",
    registerDescription: "Create your Nikoset photography workspace.",
    registerKeywords: "create photography website, client gallery account, photographer store",
  },
  auth: {
    brand: "Nikoset",
    loginTitle: "Log in to your workspace",
    loginSubtitle: "Client Gallery",
    loginImageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
    loginImageSide: "right",
    registerTitle: "Create your account",
    registerSubtitle: "Start workspace",
    registerImageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
    registerImageSide: "left",
  },
  media: {
    heroMediaType: "image",
    heroMediaUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=2400&q=80",
  },
  content: {
    en: {
      nav: { brand: "NIKOSET", products: "Products", examples: "Examples", pricing: "Pricing", login: "Log In", cta: "Get Started" },
      hero: {
        eyebrow: "NIKOSET PHOTOGRAPHER PLATFORM",
        title: "Designed for photographers.\nBuilt to help you grow.",
        subtitle: "Industry-leading photo galleries, website and business tools to streamline your workflow and grow your photography business.",
        cta: "Get Started",
      },
      gallery: {
        title: "The ultimate photo gallery that\nredefined the industry.",
        subtitle: "Trusted by more than a million photographers today, Client Gallery turns every photo delivery into an unforgettable brand moment.",
        productTabs: ["PRINTS", "WALL ART", "CARDS", "ALBUMS & BOOKS"],
        cartLabel: "Shopping Cart",
        tabs: [
          { value: "share", label: "Share photos", image, title: "Client Gallery" },
          { value: "delivery", label: "Digital delivery", image, title: "Download Delivery" },
          { value: "proofing", label: "Online proofing", image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80", title: "Proofing Gallery" },
          { value: "sell", label: "Sell photos", image, title: "Print Store" },
        ],
      },
      products: [
        { title: "Client Gallery", price: "Share, deliver, proof and sell", description: "Beautiful client collections with favorites, downloads and face search.", href: "/dashboard/client-gallery" },
        { title: "Store Gallery", price: "Prints and downloads", description: "Sell print products, digital downloads and wall art from any collection.", href: "/dashboard/store-gallery" },
        { title: "Mobile Gallery App", price: "Installable photo apps", description: "Create mobile-first gallery apps clients can save to their phones.", href: "/dashboard/mobile-gallery" },
      ],
      workflow: {
        eyebrow: "DESIGNED FOR EVERY WORKFLOW",
        title: "Made for all photographers.",
        subtitle: "From weddings to landscapes and everything in between, Nikoset is built to elevate your business - and make your work look its best.",
        cardText: "Booking, payment, and client details in one polished flow.",
        tabs: [
          { value: "wedding", label: "Wedding", image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1300&q=80" },
          { value: "portrait", label: "Portrait", image: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=1300&q=80" },
          { value: "family", label: "Family", image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1300&q=80" },
          { value: "seniors", label: "Seniors", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1300&q=80" },
          { value: "events", label: "Events", image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1300&q=80" },
          { value: "adventure", label: "Adventure", image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1300&q=80" },
          { value: "commercial", label: "Commercial", image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1300&q=80" },
          { value: "sports", label: "Sports", image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1300&q=80" },
        ],
      },
      testimonials: {
        eyebrow: "TRUSTED BY PROFESSIONALS",
        title: "\"Truly the go-to photographer platform\"",
        subtitle: "Become part of a growing community of photographers, artists, entrepreneurs, creators, makers and movers - you're in good company here.",
        items: [
          { name: "Reem Photography", site: "dreemteamweddings.com", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80", quote: "The four main Nikoset tools we currently use are essential in providing a seamless and professional experience for our clients." },
          { name: "Bek Rogers", site: "bekrogersphoto.com", image: "https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?auto=format&fit=crop&w=120&q=80", quote: "Nikoset has given me the ease of delivering galleries through the same platform that houses my website." },
          { name: "Chris Joubert", site: "chrisjoubert.com", image: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=120&q=80", quote: "I started with client galleries, then created my website on it, then the print store, and now invoices and documents are on it too." },
        ],
      },
      cta: {
        title: "Start using Nikoset today for free",
        subtitle: "Free forever. Upgrade when you need to.",
        button: "Get Started",
        desktopName: "MORGAN WELLS",
        desktopSubtitle: "MODERN PORTRAIT PHOTOGRAPHY",
        invoiceTitle: "Invoice #1104",
        invoiceText: "Download PDF\nDue date\nFebruary 21, 2025",
        galleryName: "ISLA BENNETT",
        images: [
          "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1500&q=80",
          "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=500&q=80",
          "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
          "https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?auto=format&fit=crop&w=240&q=80",
          "https://images.unsplash.com/photo-1524503033411-c9566986fc8f?auto=format&fit=crop&w=240&q=80",
          "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=240&q=80",
        ],
      },
      footer: {
        description: "An all-in-one platform for modern photographers, offering client photo galleries, websites, online stores and studio management software tools.",
        copyright: "Copyright 2026 Nikoset. Made with love in Vancity.",
        columns: [
          { title: "Products", links: ["Client Gallery", "Website", "Studio Manager", "Store", "Mobile Gallery App", "Photo Editor", "Examples", "Pricing"] },
          { title: "Resources", links: ["Help & Support", "Nikoset Blog", "Apps & Plugins", "Service Status"] },
          { title: "Company", links: ["About", "Careers", "Terms Of Service", "Privacy Policy"] },
        ],
      },
    },
    gr: {} as HomeContent,
  },
};

defaultHomeCms.content.gr = JSON.parse(JSON.stringify(defaultHomeCms.content.en));
Object.assign(defaultHomeCms.content.gr, {
  nav: { brand: "Gallerista", products: "Προϊόντα", examples: "Παραδείγματα", pricing: "Τιμές", login: "Σύνδεση", cta: "Ξεκινήστε" },
  hero: { eyebrow: "Gallerista", title: "Σχεδιασμένο για φωτογράφους.\nΔημιουργήθηκε για να αναπτυχθείτε.", subtitle: "Κορυφαίες γκαλερί φωτογραφιών, ιστοσελίδες και εργαλεία επιχείρησης για καλύτερη ροή εργασίας.", cta: "Ξεκινήστε" },
  gallery: { ...defaultHomeCms.content.gr.gallery, title: "Η απόλυτη γκαλερί φωτογραφιών που επαναπροσδιορίζει τον κλάδο.", subtitle: "Παραδώστε όμορφα τις φωτογραφίες σας και προσφέρετε μια αξέχαστη εμπειρία στους πελάτες σας.", cartLabel: "Καλάθι" },
  workflow: { ...defaultHomeCms.content.gr.workflow, eyebrow: "ΣΧΕΔΙΑΣΜΕΝΟ ΓΙΑ ΚΑΘΕ ΡΟΗ ΕΡΓΑΣΙΑΣ", title: "Εργαλεία για κάθε φωτογράφο.", subtitle: "Από γάμους έως τοπία, όλα όσα χρειάζεστε σε ένα μέρος." },
  testimonials: { ...defaultHomeCms.content.gr.testimonials, eyebrow: "ΕΜΠΙΣΤΕΥΟΝΤΑΙ ΟΙ ΕΠΑΓΓΕΛΜΑΤΙΕΣ", title: "Η πλατφόρμα των φωτογράφων.", subtitle: "Γίνετε μέρος μιας αναπτυσσόμενης δημιουργικής κοινότητας." },
  cta: { ...defaultHomeCms.content.gr.cta, title: "Ξεκινήστε με το Gallerista σήμερα δωρεάν.", subtitle: "Δωρεάν για πάντα. Αναβαθμίστε όταν το χρειαστείτε.", button: "Ξεκινήστε" },
  footer: { ...defaultHomeCms.content.gr.footer, description: "Η ολοκληρωμένη πλατφόρμα για σύγχρονους φωτογράφους, γκαλερί πελατών και ηλεκτρονικά καταστήματα." },
});

export function mergeHomeCms(data?: Partial<HomeCmsData> | null): HomeCmsData {
  const media = { ...defaultHomeCms.media, ...(data?.media ?? {}) };
  if (!media.heroMediaUrl?.trim()) media.heroMediaUrl = defaultHomeCms.media.heroMediaUrl;
  if (media.heroMediaType !== "video") media.heroMediaType = "image";
  const auth = { ...defaultHomeCms.auth, ...(data?.auth ?? {}) };
  if (auth.loginImageSide !== "left") auth.loginImageSide = "right";
  if (auth.registerImageSide !== "right") auth.registerImageSide = "left";
  if (!auth.loginImageUrl?.trim()) auth.loginImageUrl = defaultHomeCms.auth.loginImageUrl;
  if (!auth.registerImageUrl?.trim()) auth.registerImageUrl = defaultHomeCms.auth.registerImageUrl;

  const seo = { ...defaultHomeCms.seo, ...(data?.seo ?? {}) };
  if (!Array.isArray(seo.extraMetaTags)) seo.extraMetaTags = [];
  if (seo.twitterCard !== "summary") seo.twitterCard = "summary_large_image";

  const incomingGr = data?.content?.gr;
  const grMatchesEnglish = incomingGr && data?.content?.en && JSON.stringify(incomingGr) === JSON.stringify(data.content.en);
  const content = {
    en: { ...defaultHomeCms.content.en, ...(data?.content?.en ?? {}) },
    gr: { ...defaultHomeCms.content.gr, ...(grMatchesEnglish ? {} : incomingGr ?? {}) },
  };
  (["en", "gr"] as HomeLanguage[]).forEach((lang) => {
    const titles = content[lang].products?.map((product) => product.title).join("|");
    if (titles === "Canvas|Metal Print|Standout") {
      content[lang].products = defaultHomeCms.content[lang].products;
    }
  });

  return {
    defaultLanguage: data?.defaultLanguage === "gr" ? "gr" : "en",
    seo,
    auth,
    brand: { ...defaultHomeCms.brand, ...(data?.brand ?? {}) },
    legal: {
      en: {
        terms: { ...defaultHomeCms.legal.en.terms, ...(data?.legal?.en?.terms ?? {}) },
        privacy: { ...defaultHomeCms.legal.en.privacy, ...(data?.legal?.en?.privacy ?? {}) },
      },
      gr: {
        terms: { ...defaultHomeCms.legal.gr.terms, ...(data?.legal?.gr?.terms ?? {}) },
        privacy: { ...defaultHomeCms.legal.gr.privacy, ...(data?.legal?.gr?.privacy ?? {}) },
      },
    },
    coverTemplates: Array.isArray(data?.coverTemplates) ? data.coverTemplates : [],
    media,
    content,
  };
}
