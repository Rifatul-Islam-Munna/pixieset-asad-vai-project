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
  type:
    "title" | "subtitle" | "date" | "button" | "brandText" | "logo" | "line";
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
  nav: {
    brand: string;
    products: string;
    examples: string;
    pricing: string;
    login: string;
    cta: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    accentTitle: string;
    endingTitle: string;
    subtitle: string;
    cta: string;
    secondaryCta: string;
    videoUrl: string;
    ratingText: string;
    avatarImages: string[];
  };
  gallery: {
    title: string;
    subtitle: string;
    tabs: GalleryTab[];
    productTabs: string[];
    cartLabel: string;
  };
  products: {
    title: string;
    price: string;
    description?: string;
    href?: string;
  }[];
  featureCards: FeatureCard[];
  showcase: {
    eyebrow: string;
    title: string;
    subtitle: string;
    bullets: string[];
    button: string;
    cardTitle: string;
    cardDate: string;
    cardButton: string;
  };
  stats: { value: string; label: string }[];
  trustHeading: string;
  workflow: {
    eyebrow: string;
    title: string;
    subtitle: string;
    tabs: GalleryTab[];
    cardText: string;
  };
  testimonials: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: Testimonial[];
  };
  brandLogos: BrandLogo[];
  cta: {
    title: string;
    subtitle: string;
    button: string;
    trialText: string;
    noCardText: string;
    desktopName: string;
    desktopSubtitle: string;
    invoiceTitle: string;
    invoiceText: string;
    galleryName: string;
    images: string[];
  };
  footer: {
    description: string;
    copyright: string;
    columns: { title: string; links: FooterLink[] }[];
  };
};

export type GalleryTab = {
  value: string;
  label: string;
  image: string;
  href?: string;
  title?: string;
  icon?: string;
};
export type FeatureCard = { title: string; text: string; icon: string };
export type BrandLogo = { name: string; image: string; url?: string };
export type Testimonial = {
  name: string;
  site: string;
  image: string;
  quote: string;
};
export type FooterLink = string | { label: string; url: string };

const image =
  "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=900&q=80";

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
      terms: {
        title: "Terms of Service",
        content:
          "These Terms of Service govern your use of Gallerista.\n\nBy creating an account, you agree to use the service lawfully and to protect access to your account. You retain ownership of content you upload.",
      },
      privacy: {
        title: "Privacy Policy",
        content:
          "This Privacy Policy explains how Gallerista handles account, gallery, and customer information.\n\nWe use submitted information to provide and secure the service. We do not sell personal information.",
      },
    },
    gr: {
      terms: {
        title: "ÎŒÏÎ¿Î¹ Î Î±ÏÎ¿Ï‡Î®Ï‚ Î¥Ï€Î·ÏÎµÏƒÎ¹ÏŽÎ½",
        content:
          "ÎŸÎ¹ Ï€Î±ÏÏŒÎ½Ï„ÎµÏ‚ ÏŒÏÎ¿Î¹ Î´Î¹Î­Ï€Î¿Ï…Î½ Ï„Î· Ï‡ÏÎ®ÏƒÎ· Ï„Î¿Ï… Gallerista.\n\nÎœÎµ Ï„Î· Î´Î·Î¼Î¹Î¿Ï…ÏÎ³Î¯Î± Î»Î¿Î³Î±ÏÎ¹Î±ÏƒÎ¼Î¿Ï ÏƒÏ…Î¼Ï†Ï‰Î½ÎµÎ¯Ï„Îµ Î½Î± Ï‡ÏÎ·ÏƒÎ¹Î¼Î¿Ï€Î¿Î¹ÎµÎ¯Ï„Îµ Î½ÏŒÎ¼Î¹Î¼Î± Ï„Î·Î½ Ï…Ï€Î·ÏÎµÏƒÎ¯Î± ÎºÎ±Î¹ Î½Î± Ï€ÏÎ¿ÏƒÏ„Î±Ï„ÎµÏÎµÏ„Îµ Ï„Î·Î½ Ï€ÏÏŒÏƒÎ²Î±ÏƒÎ· ÏƒÏ„Î¿Î½ Î»Î¿Î³Î±ÏÎ¹Î±ÏƒÎ¼ÏŒ ÏƒÎ±Ï‚.",
      },
      privacy: {
        title: "Î Î¿Î»Î¹Ï„Î¹ÎºÎ® Î‘Ï€Î¿ÏÏÎ®Ï„Î¿Ï…",
        content:
          "Î— Ï€Î±ÏÎ¿ÏÏƒÎ± Ï€Î¿Î»Î¹Ï„Î¹ÎºÎ® ÎµÎ¾Î·Î³ÎµÎ¯ Ï€ÏŽÏ‚ Ï„Î¿ Gallerista Î´Î¹Î±Ï‡ÎµÎ¹ÏÎ¯Î¶ÎµÏ„Î±Î¹ Ï„Î± ÏƒÏ„Î¿Î¹Ï‡ÎµÎ¯Î± Î»Î¿Î³Î±ÏÎ¹Î±ÏƒÎ¼Î¿Ï, Î³ÎºÎ±Î»ÎµÏÎ¯ ÎºÎ±Î¹ Ï€ÎµÎ»Î±Ï„ÏŽÎ½.\n\nÎ§ÏÎ·ÏƒÎ¹Î¼Î¿Ï€Î¿Î¹Î¿ÏÎ¼Îµ Ï„Î± ÏƒÏ„Î¿Î¹Ï‡ÎµÎ¯Î± Î³Î¹Î± Ï„Î·Î½ Ï€Î±ÏÎ¿Ï‡Î® ÎºÎ±Î¹ Î±ÏƒÏ†Î¬Î»ÎµÎ¹Î± Ï„Î·Ï‚ Ï…Ï€Î·ÏÎµÏƒÎ¯Î±Ï‚.",
      },
    },
  },
  seo: {
    siteTitle: "Nikoset",
    siteDescription:
      "An all-in-one platform for modern photographers with client galleries, websites, stores, and studio tools.",
    siteKeywords:
      "photography platform, client galleries, photo store, photographer website, studio tools",
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
    registerKeywords:
      "create photography website, client gallery account, photographer store",
  },
  auth: {
    brand: "Nikoset",
    loginTitle: "Log in to your workspace",
    loginSubtitle: "Client Gallery",
    loginImageUrl:
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
    loginImageSide: "right",
    registerTitle: "Create your account",
    registerSubtitle: "Start workspace",
    registerImageUrl:
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
    registerImageSide: "left",
  },
  media: {
    heroMediaType: "image",
    heroMediaUrl:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=2400&q=80",
  },
  content: {
    en: {
      nav: {
        brand: "NIKOSET",
        products: "Products",
        examples: "Examples",
        pricing: "Pricing",
        login: "Log In",
        cta: "Get Started",
      },
      hero: {
        eyebrow: "NIKOSET PHOTOGRAPHER PLATFORM",
        title: "Your Moments.",
        accentTitle: "Beautifully",
        endingTitle: "Presented.",
        subtitle:
          "Industry-leading photo galleries, website and business tools to streamline your workflow and grow your photography business.",
        cta: "Get Started",
        secondaryCta: "Watch Video",
        videoUrl: "",
        ratingText: "Loved by 2,000+ photographers worldwide",
        avatarImages: [
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
          "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80",
        ],
      },
      gallery: {
        title: "The ultimate photo gallery that\nredefined the industry.",
        subtitle:
          "Trusted by more than a million photographers today, Client Gallery turns every photo delivery into an unforgettable brand moment.",
        productTabs: ["PRINTS", "WALL ART", "CARDS", "ALBUMS & BOOKS"],
        cartLabel: "Shopping Cart",
        tabs: [
          {
            value: "main",
            label: "Main gallery",
            image,
            href: "/register",
            title: "Jessica & Michael",
          },
          {
            value: "left-top",
            label: "Left top gallery",
            image:
              "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=900&q=80",
            href: "/register",
            title: "Portrait Gallery",
          },
          {
            value: "left-bottom",
            label: "Left bottom gallery",
            image:
              "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
            href: "/register",
            title: "Outdoor Gallery",
          },
          {
            value: "right-top",
            label: "Right top gallery",
            image:
              "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
            href: "/register",
            title: "Portrait Collection",
          },
          {
            value: "right-bottom",
            label: "Right bottom gallery",
            image:
              "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=900&q=80",
            href: "/register",
            title: "Event Gallery",
          },
        ],
      },
      products: [
        {
          title: "Client Gallery",
          price: "Share, deliver, proof and sell",
          description:
            "Beautiful client collections with favorites, downloads and face search.",
          href: "/dashboard/client-gallery",
        },
        {
          title: "Store Gallery",
          price: "Prints and downloads",
          description:
            "Sell print products, digital downloads and wall art from any collection.",
          href: "/dashboard/store-gallery",
        },
        {
          title: "Mobile Gallery App",
          price: "Installable photo apps",
          description:
            "Create mobile-first gallery apps clients can save to their phones.",
          href: "/dashboard/mobile-gallery",
        },
      ],
      featureCards: [
        {
          title: "All in the Cloud",
          text: "Secure storage and lightning fast delivery.",
          icon: "CloudUpload",
        },
        {
          title: "Private & Secure",
          text: "Password protection and privacy controls.",
          icon: "LockKeyhole",
        },
        {
          title: "AI-Powered",
          text: "Smart search finds photos instantly.",
          icon: "Sparkles",
        },
        {
          title: "Built to Sell",
          text: "Beautiful stores to sell prints and downloads.",
          icon: "ShoppingBag",
        },
        {
          title: "Works Everywhere",
          text: "Perfect on any device, any time.",
          icon: "Smartphone",
        },
      ],
      showcase: {
        eyebrow: "For every photographer",
        title: "Galleries as beautiful as your work",
        subtitle:
          "Create unlimited galleries with a premium experience your clients will love.",
        bullets: [
          "Unlimited galleries",
          "Custom branding",
          "Client favorites",
          "Download protection",
          "Slideshow & sharing",
        ],
        button: "Explore Features",
        cardTitle: "Jessica & Michael",
        cardDate: "May 25, 2024",
        cardButton: "View Gallery",
      },
      stats: [
        { value: "2,000+", label: "Photographers" },
        { value: "1M+", label: "Galleries Delivered" },
        { value: "50M+", label: "Photos Uploaded" },
        { value: "120+", label: "Countries Worldwide" },
      ],
      trustHeading: "Trusted by professionals",
      workflow: {
        eyebrow: "DESIGNED FOR EVERY WORKFLOW",
        title: "Made for all photographers.",
        subtitle:
          "From weddings to landscapes and everything in between, Nikoset is built to elevate your business - and make your work look its best.",
        cardText: "Booking, payment, and client details in one polished flow.",
        tabs: [
          {
            value: "wedding",
            label: "Wedding",
            icon: "Landmark",
            image:
              "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1300&q=80",
          },
          {
            value: "travel",
            label: "Travel",
            icon: "Plane",
            image:
              "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1300&q=80",
          },
          {
            value: "food",
            label: "Food",
            icon: "Utensils",
            image:
              "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1300&q=80",
          },
          {
            value: "sports",
            label: "Sports",
            icon: "Volleyball",
            image:
              "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1300&q=80",
          },
          {
            value: "events",
            label: "Events",
            icon: "CalendarDays",
            image:
              "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1300&q=80",
          },
          {
            value: "portraits",
            label: "Portraits",
            icon: "UserRound",
            image:
              "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=1300&q=80",
          },
        ],
      },
      testimonials: {
        eyebrow: "TRUSTED BY PROFESSIONALS",
        title: '"Truly the go-to photographer platform"',
        subtitle:
          "Become part of a growing community of photographers, artists, entrepreneurs, creators, makers and movers - you're in good company here.",
        items: [
          {
            name: "Reem Photography",
            site: "dreemteamweddings.com",
            image:
              "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
            quote:
              "The four main Nikoset tools we currently use are essential in providing a seamless and professional experience for our clients.",
          },
          {
            name: "Bek Rogers",
            site: "bekrogersphoto.com",
            image:
              "https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?auto=format&fit=crop&w=120&q=80",
            quote:
              "Nikoset has given me the ease of delivering galleries through the same platform that houses my website.",
          },
          {
            name: "Chris Joubert",
            site: "chrisjoubert.com",
            image:
              "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=120&q=80",
            quote:
              "I started with client galleries, then created my website on it, then the print store, and now invoices and documents are on it too.",
          },
        ],
      },
      brandLogos: [
        { name: "Nikon", image: "", url: "" },
        { name: "Canon", image: "", url: "" },
        { name: "SONY", image: "", url: "" },
        { name: "FUJIFILM", image: "", url: "" },
        { name: "dji", image: "", url: "" },
        { name: "Profoto", image: "", url: "" },
        { name: "Adobe", image: "", url: "" },
      ],
      cta: {
        title: "Start using Nikoset today for free",
        subtitle: "Free forever. Upgrade when you need to.",
        button: "Get Started",
        trialText: "14-day free trial",
        noCardText: "No credit card required",
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
        description:
          "An all-in-one platform for modern photographers, offering client photo galleries, websites, online stores and studio management software tools.",
        copyright: "Copyright 2026 Nikoset. Made with love in Vancity.",
        columns: [
          {
            title: "Products",
            links: ["Client Gallery", "Store Gallery", "Mobile Gallery App"],
          },
          {
            title: "Pages",
            links: ["Pricing", "Terms of Service", "Privacy Policy"],
          },
        ],
      },
    },
    gr: {} as HomeContent,
  },
};

defaultHomeCms.content.gr = JSON.parse(
  JSON.stringify(defaultHomeCms.content.en),
);
Object.assign(defaultHomeCms.content.gr, {
  nav: {
    brand: "Gallerista",
    products: "Î ÏÎ¿ÏŠÏŒÎ½Ï„Î±",
    examples: "Î Î±ÏÎ±Î´ÎµÎ¯Î³Î¼Î±Ï„Î±",
    pricing: "Î¤Î¹Î¼Î­Ï‚",
    login: "Î£ÏÎ½Î´ÎµÏƒÎ·",
    cta: "ÎžÎµÎºÎ¹Î½Î®ÏƒÏ„Îµ",
  },
  hero: {
    eyebrow: "Gallerista",
    title:
      "Î£Ï‡ÎµÎ´Î¹Î±ÏƒÎ¼Î­Î½Î¿ Î³Î¹Î± Ï†Ï‰Ï„Î¿Î³ÏÎ¬Ï†Î¿Ï…Ï‚.\nÎ”Î·Î¼Î¹Î¿Ï…ÏÎ³Î®Î¸Î·ÎºÎµ Î³Î¹Î± Î½Î± Î±Î½Î±Ï€Ï„Ï…Ï‡Î¸ÎµÎ¯Ï„Îµ.",
    subtitle:
      "ÎšÎ¿ÏÏ…Ï†Î±Î¯ÎµÏ‚ Î³ÎºÎ±Î»ÎµÏÎ¯ Ï†Ï‰Ï„Î¿Î³ÏÎ±Ï†Î¹ÏŽÎ½, Î¹ÏƒÏ„Î¿ÏƒÎµÎ»Î¯Î´ÎµÏ‚ ÎºÎ±Î¹ ÎµÏÎ³Î±Î»ÎµÎ¯Î± ÎµÏ€Î¹Ï‡ÎµÎ¯ÏÎ·ÏƒÎ·Ï‚ Î³Î¹Î± ÎºÎ±Î»ÏÏ„ÎµÏÎ· ÏÎ¿Î® ÎµÏÎ³Î±ÏƒÎ¯Î±Ï‚.",
    cta: "ÎžÎµÎºÎ¹Î½Î®ÏƒÏ„Îµ",
  },
  gallery: {
    ...defaultHomeCms.content.gr.gallery,
    title:
      "Î— Î±Ï€ÏŒÎ»Ï…Ï„Î· Î³ÎºÎ±Î»ÎµÏÎ¯ Ï†Ï‰Ï„Î¿Î³ÏÎ±Ï†Î¹ÏŽÎ½ Ï€Î¿Ï… ÎµÏ€Î±Î½Î±Ï€ÏÎ¿ÏƒÎ´Î¹Î¿ÏÎ¯Î¶ÎµÎ¹ Ï„Î¿Î½ ÎºÎ»Î¬Î´Î¿.",
    subtitle:
      "Î Î±ÏÎ±Î´ÏŽÏƒÏ„Îµ ÏŒÎ¼Î¿ÏÏ†Î± Ï„Î¹Ï‚ Ï†Ï‰Ï„Î¿Î³ÏÎ±Ï†Î¯ÎµÏ‚ ÏƒÎ±Ï‚ ÎºÎ±Î¹ Ï€ÏÎ¿ÏƒÏ†Î­ÏÎµÏ„Îµ Î¼Î¹Î± Î±Î¾Î­Ï‡Î±ÏƒÏ„Î· ÎµÎ¼Ï€ÎµÎ¹ÏÎ¯Î± ÏƒÏ„Î¿Ï…Ï‚ Ï€ÎµÎ»Î¬Ï„ÎµÏ‚ ÏƒÎ±Ï‚.",
    cartLabel: "ÎšÎ±Î»Î¬Î¸Î¹",
  },
  workflow: {
    ...defaultHomeCms.content.gr.workflow,
    eyebrow: "Î£Î§Î•Î”Î™Î‘Î£ÎœÎ•ÎÎŸ Î“Î™Î‘ ÎšÎ‘Î˜Î• Î¡ÎŸÎ— Î•Î¡Î“Î‘Î£Î™Î‘Î£",
    title: "Î•ÏÎ³Î±Î»ÎµÎ¯Î± Î³Î¹Î± ÎºÎ¬Î¸Îµ Ï†Ï‰Ï„Î¿Î³ÏÎ¬Ï†Î¿.",
    subtitle:
      "Î‘Ï€ÏŒ Î³Î¬Î¼Î¿Ï…Ï‚ Î­Ï‰Ï‚ Ï„Î¿Ï€Î¯Î±, ÏŒÎ»Î± ÏŒÏƒÎ± Ï‡ÏÎµÎ¹Î¬Î¶ÎµÏƒÏ„Îµ ÏƒÎµ Î­Î½Î± Î¼Î­ÏÎ¿Ï‚.",
  },
  testimonials: {
    ...defaultHomeCms.content.gr.testimonials,
    eyebrow: "Î•ÎœÎ Î™Î£Î¤Î•Î¥ÎŸÎÎ¤Î‘Î™ ÎŸÎ™ Î•Î Î‘Î“Î“Î•Î›ÎœÎ‘Î¤Î™Î•Î£",
    title: "Î— Ï€Î»Î±Ï„Ï†ÏŒÏÎ¼Î± Ï„Ï‰Î½ Ï†Ï‰Ï„Î¿Î³ÏÎ¬Ï†Ï‰Î½.",
    subtitle:
      "Î“Î¯Î½ÎµÏ„Îµ Î¼Î­ÏÎ¿Ï‚ Î¼Î¹Î±Ï‚ Î±Î½Î±Ï€Ï„Ï…ÏƒÏƒÏŒÎ¼ÎµÎ½Î·Ï‚ Î´Î·Î¼Î¹Î¿Ï…ÏÎ³Î¹ÎºÎ®Ï‚ ÎºÎ¿Î¹Î½ÏŒÏ„Î·Ï„Î±Ï‚.",
  },
  cta: {
    ...defaultHomeCms.content.gr.cta,
    title: "ÎžÎµÎºÎ¹Î½Î®ÏƒÏ„Îµ Î¼Îµ Ï„Î¿ Gallerista ÏƒÎ®Î¼ÎµÏÎ± Î´Ï‰ÏÎµÎ¬Î½.",
    subtitle:
      "Î”Ï‰ÏÎµÎ¬Î½ Î³Î¹Î± Ï€Î¬Î½Ï„Î±. Î‘Î½Î±Î²Î±Î¸Î¼Î¯ÏƒÏ„Îµ ÏŒÏ„Î±Î½ Ï„Î¿ Ï‡ÏÎµÎ¹Î±ÏƒÏ„ÎµÎ¯Ï„Îµ.",
    button: "ÎžÎµÎºÎ¹Î½Î®ÏƒÏ„Îµ",
  },
  footer: {
    ...defaultHomeCms.content.gr.footer,
    description:
      "Î— Î¿Î»Î¿ÎºÎ»Î·ÏÏ‰Î¼Î­Î½Î· Ï€Î»Î±Ï„Ï†ÏŒÏÎ¼Î± Î³Î¹Î± ÏƒÏÎ³Ï‡ÏÎ¿Î½Î¿Ï…Ï‚ Ï†Ï‰Ï„Î¿Î³ÏÎ¬Ï†Î¿Ï…Ï‚, Î³ÎºÎ±Î»ÎµÏÎ¯ Ï€ÎµÎ»Î±Ï„ÏŽÎ½ ÎºÎ±Î¹ Î·Î»ÎµÎºÏ„ÏÎ¿Î½Î¹ÎºÎ¬ ÎºÎ±Ï„Î±ÏƒÏ„Î®Î¼Î±Ï„Î±.",
  },
});

export function mergeHomeCms(data?: Partial<HomeCmsData> | null): HomeCmsData {
  const media = { ...defaultHomeCms.media, ...(data?.media ?? {}) };
  if (!media.heroMediaUrl?.trim())
    media.heroMediaUrl = defaultHomeCms.media.heroMediaUrl;
  if (media.heroMediaType !== "video") media.heroMediaType = "image";
  const brand = { ...defaultHomeCms.brand, ...(data?.brand ?? {}) };
  const auth = {
    ...defaultHomeCms.auth,
    ...(data?.auth ?? {}),
    brand: brand.brandText || defaultHomeCms.auth.brand,
  };
  if (auth.loginImageSide !== "left") auth.loginImageSide = "right";
  if (auth.registerImageSide !== "right") auth.registerImageSide = "left";
  if (!auth.loginImageUrl?.trim())
    auth.loginImageUrl = defaultHomeCms.auth.loginImageUrl;
  if (!auth.registerImageUrl?.trim())
    auth.registerImageUrl = defaultHomeCms.auth.registerImageUrl;

  const seo = { ...defaultHomeCms.seo, ...(data?.seo ?? {}) };
  if (!Array.isArray(seo.extraMetaTags)) seo.extraMetaTags = [];
  if (seo.twitterCard !== "summary") seo.twitterCard = "summary_large_image";

  const incomingGr = data?.content?.gr;
  const grMatchesEnglish =
    incomingGr &&
    data?.content?.en &&
    JSON.stringify(incomingGr) === JSON.stringify(data.content.en);
  const content = {
    en: { ...defaultHomeCms.content.en, ...(data?.content?.en ?? {}) },
    gr: {
      ...defaultHomeCms.content.gr,
      ...(grMatchesEnglish ? {} : (incomingGr ?? {})),
    },
  };
  (["en", "gr"] as HomeLanguage[]).forEach((lang) => {
    const fallback = defaultHomeCms.content[lang];
    content[lang].nav = { ...fallback.nav, ...(content[lang].nav ?? {}) };
    content[lang].products =
      Array.isArray(content[lang].products) && content[lang].products.length
        ? content[lang].products
        : fallback.products;
    const titles = content[lang].products
      .map((product) => product.title)
      .join("|");
    if (titles === "Canvas|Metal Print|Standout") {
      content[lang].products = defaultHomeCms.content[lang].products;
    }
    if (
      !Array.isArray(content[lang].featureCards) ||
      !content[lang].featureCards.length
    ) {
      content[lang].featureCards = defaultHomeCms.content[lang].featureCards;
    }
    if (
      !Array.isArray(content[lang].brandLogos) ||
      !content[lang].brandLogos.length
    ) {
      content[lang].brandLogos = defaultHomeCms.content[lang].brandLogos;
    }
    const savedHero = content[lang].hero ?? defaultHomeCms.content[lang].hero;
    const savedHeadingLines = String(savedHero.title ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const needsHeadingMigration =
      !(savedHero as Partial<HomeContent["hero"]>).accentTitle &&
      !(savedHero as Partial<HomeContent["hero"]>).endingTitle &&
      savedHeadingLines.length > 1;
    content[lang].hero = {
      ...defaultHomeCms.content[lang].hero,
      ...savedHero,
      title: needsHeadingMigration ? savedHeadingLines[0] : savedHero.title,
      accentTitle: needsHeadingMigration
        ? (savedHeadingLines[1] ??
          defaultHomeCms.content[lang].hero.accentTitle)
        : ((savedHero as Partial<HomeContent["hero"]>).accentTitle ??
          defaultHomeCms.content[lang].hero.accentTitle),
      endingTitle: needsHeadingMigration
        ? savedHeadingLines.slice(2).join(" ")
        : ((savedHero as Partial<HomeContent["hero"]>).endingTitle ??
          defaultHomeCms.content[lang].hero.endingTitle),
      avatarImages:
        Array.isArray(
          (savedHero as Partial<HomeContent["hero"]>).avatarImages,
        ) && (savedHero as Partial<HomeContent["hero"]>).avatarImages!.length
          ? (savedHero as Partial<HomeContent["hero"]>).avatarImages!
          : defaultHomeCms.content[lang].hero.avatarImages,
    };
    const savedGalleryTabs = Array.isArray(content[lang].gallery?.tabs)
      ? content[lang].gallery.tabs
      : [];
    const fallbackGalleryTabs = defaultHomeCms.content[lang].gallery.tabs;
    content[lang].gallery = {
      ...defaultHomeCms.content[lang].gallery,
      ...(content[lang].gallery ?? {}),
      tabs: Array.from({ length: 5 }, (_, index) => ({
        ...fallbackGalleryTabs[index],
        ...(savedGalleryTabs[index] ?? {}),
        href:
          savedGalleryTabs[index]?.href ||
          fallbackGalleryTabs[index]?.href ||
          "/register",
      })),
    };
    content[lang].showcase = {
      ...defaultHomeCms.content[lang].showcase,
      ...(content[lang].showcase ?? {}),
      bullets: Array.isArray(content[lang].showcase?.bullets)
        ? content[lang].showcase.bullets
        : defaultHomeCms.content[lang].showcase.bullets,
    };
    content[lang].stats =
      Array.isArray(content[lang].stats) && content[lang].stats.length
        ? content[lang].stats
        : defaultHomeCms.content[lang].stats;
    content[lang].trustHeading =
      content[lang].trustHeading || defaultHomeCms.content[lang].trustHeading;
    content[lang].cta = {
      ...fallback.cta,
      ...(content[lang].cta ?? {}),
      images:
        Array.isArray(content[lang].cta?.images) &&
        content[lang].cta.images.length
          ? content[lang].cta.images.filter(Boolean)
          : fallback.cta.images,
    };
    content[lang].workflow = {
      ...fallback.workflow,
      ...(content[lang].workflow ?? {}),
      tabs:
        Array.isArray(content[lang].workflow?.tabs) &&
        content[lang].workflow.tabs.length
          ? content[lang].workflow.tabs
          : fallback.workflow.tabs,
    };
    content[lang].testimonials = {
      ...fallback.testimonials,
      ...(content[lang].testimonials ?? {}),
      items:
        Array.isArray(content[lang].testimonials?.items) &&
        content[lang].testimonials.items.length
          ? content[lang].testimonials.items
          : fallback.testimonials.items,
    };
    content[lang].footer = {
      ...fallback.footer,
      ...(content[lang].footer ?? {}),
      columns:
        Array.isArray(content[lang].footer?.columns) &&
        content[lang].footer.columns.length
          ? content[lang].footer.columns
          : fallback.footer.columns,
    };
  });

  return {
    defaultLanguage: data?.defaultLanguage === "gr" ? "gr" : "en",
    seo,
    auth,
    brand,
    legal: {
      en: {
        terms: {
          ...defaultHomeCms.legal.en.terms,
          ...(data?.legal?.en?.terms ?? {}),
        },
        privacy: {
          ...defaultHomeCms.legal.en.privacy,
          ...(data?.legal?.en?.privacy ?? {}),
        },
      },
      gr: {
        terms: {
          ...defaultHomeCms.legal.gr.terms,
          ...(data?.legal?.gr?.terms ?? {}),
        },
        privacy: {
          ...defaultHomeCms.legal.gr.privacy,
          ...(data?.legal?.gr?.privacy ?? {}),
        },
      },
    },
    coverTemplates: Array.isArray(data?.coverTemplates)
      ? data.coverTemplates
      : [],
    media,
    content,
  };
}
