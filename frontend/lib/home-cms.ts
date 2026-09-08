import { GALLERY_LANGUAGES, type GalleryLanguage } from "@/lib/gallery-language";
import { CLIENT_GALLERY_CATEGORIES } from "@/lib/gallery-categories";

export type HomeLanguage = "en" | "gr";

export const EMAIL_TEMPLATE_LANGUAGES = GALLERY_LANGUAGES;
export const EMAIL_TEMPLATE_CATEGORIES = [
  "Gallery Delivery",
  "Reminder",
  "Thank You",
  "Album & Print",
  "Booking",
  "Marketing",
] as const;
export type EmailTemplateCategory = (typeof EMAIL_TEMPLATE_CATEGORIES)[number];

export type HomeCmsData = {
  seo: SiteSeo;
  auth: AuthCms;
  brand: BrandSettings;
  legal: Record<HomeLanguage, LegalPages>;
  coverTemplates: CustomCoverTemplate[];
  emailTemplates: EmailTemplateItem[];
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
  eyebrowText?: string;
  showImage?: boolean;
  category?: EmailTemplateCategory | string;
  galleryCategory?: string;
  customGalleryCategoryLabel?: string;
  language?: GalleryLanguage | string;
  updatedAt: string;
  source?: "admin" | "user";
  sourceTemplateId?: string;
};

type CoreEmailTemplateCategory = EmailTemplateCategory;
type LocalizedEmailCopy = { subject: string; previewText: string; title: string; message: string; buttonText: string; footerText: string };

const localizedEmailCopy: Record<GalleryLanguage, Record<CoreEmailTemplateCategory, LocalizedEmailCopy>> = {
  English: {
    "Gallery Delivery": { subject: "Your photos are ready", previewText: "Your gallery is ready to view.", title: "Your photos are ready", message: "Your gallery is ready. We hope you love reliving these moments. Use the button below to view, favorite, and download your photos.", buttonText: "View Gallery", footerText: "Thank you for trusting us with your memories." },
    Reminder: { subject: "A quick reminder about your gallery", previewText: "Your gallery is still waiting for you.", title: "Your gallery is waiting", message: "Just a friendly reminder that your photo gallery is ready. Open it anytime to view your images, choose favorites, and download the moments you love.", buttonText: "Open Gallery", footerText: "Questions? Reply to this email and we'll be happy to help." },
    "Thank You": { subject: "Thank you — your gallery is here", previewText: "A small thank-you and your finished gallery.", title: "Thank you", message: "Thank you for choosing us to photograph your story. Your finished gallery is now available and ready to share with the people you love.", buttonText: "See Your Photos", footerText: "With gratitude, your photography team." },
    "Album & Print": { subject: "Turn your favorite photos into something lasting", previewText: "Albums and prints are ready when you are.", title: "Your story deserves to be held", message: "Your favorite photographs can become a beautiful album or finished prints made for your home. Open your gallery to choose the moments you want to keep in print.", buttonText: "Choose Favorites", footerText: "Need help choosing an album or print size? Reply and we'll guide you." },
    Booking: { subject: "Ready to plan your next session?", previewText: "Choose a date for your next photo session.", title: "Let's create something new", message: "If you've been thinking about another session, now is a great time to reserve a date. Use the button below to view availability and start planning.", buttonText: "Book a Session", footerText: "We'd love to photograph your next chapter." },
    Marketing: { subject: "A little something from the studio", previewText: "News, inspiration, and an update from us.", title: "From the studio", message: "We wanted to share a little inspiration and the latest from the studio. Take a look and discover what's new for your next photography experience.", buttonText: "Explore More", footerText: "Thanks for being part of our photography community." },
  },
  Spanish: {
    "Gallery Delivery": { subject: "Tus fotos están listas", previewText: "Tu galería ya está lista para ver.", title: "Tus fotos están listas", message: "Tu galería está lista. Esperamos que disfrutes reviviendo estos momentos. Usa el botón para ver, marcar favoritas y descargar tus fotos.", buttonText: "Ver galería", footerText: "Gracias por confiar en nosotros para guardar tus recuerdos." },
    Reminder: { subject: "Un recordatorio sobre tu galería", previewText: "Tu galería sigue esperándote.", title: "Tu galería te espera", message: "Solo un recordatorio amistoso: tu galería de fotos está lista. Puedes abrirla cuando quieras para ver tus imágenes, elegir favoritas y descargarlas.", buttonText: "Abrir galería", footerText: "¿Tienes preguntas? Responde a este correo y estaremos encantados de ayudarte." },
    "Thank You": { subject: "Gracias — tu galería ya está aquí", previewText: "Un pequeño agradecimiento y tu galería terminada.", title: "Gracias", message: "Gracias por elegirnos para fotografiar tu historia. Tu galería final ya está disponible y lista para compartir con las personas que quieres.", buttonText: "Ver tus fotos", footerText: "Con gratitud, tu equipo de fotografía." },
    "Album & Print": { subject: "Convierte tus fotos favoritas en algo para siempre", previewText: "Álbumes e impresiones listos cuando tú quieras.", title: "Tu historia merece estar en tus manos", message: "Tus fotografías favoritas pueden convertirse en un álbum precioso o en impresiones terminadas para tu hogar. Abre la galería y elige los momentos que quieres conservar en papel.", buttonText: "Elegir favoritas", footerText: "¿Necesitas ayuda con el álbum o el tamaño de impresión? Responde a este correo y te orientamos." },
    Booking: { subject: "¿Listos para planear la próxima sesión?", previewText: "Elige una fecha para tu próxima sesión de fotos.", title: "Creemos algo nuevo", message: "Si estás pensando en otra sesión, este es un buen momento para reservar una fecha. Usa el botón para ver la disponibilidad y empezar a planear.", buttonText: "Reservar sesión", footerText: "Nos encantará fotografiar el siguiente capítulo de tu historia." },
    Marketing: { subject: "Algo especial desde el estudio", previewText: "Novedades, inspiración y una actualización del estudio.", title: "Desde el estudio", message: "Queríamos compartir un poco de inspiración y las últimas novedades del estudio. Descubre qué hay de nuevo para tu próxima experiencia fotográfica.", buttonText: "Descubrir más", footerText: "Gracias por formar parte de nuestra comunidad fotográfica." },
  },
  French: {
    "Gallery Delivery": { subject: "Vos photos sont prêtes", previewText: "Votre galerie est prête à être découverte.", title: "Vos photos sont prêtes", message: "Votre galerie est prête. Nous espérons que vous aimerez revivre ces moments. Utilisez le bouton pour voir, ajouter vos favoris et télécharger vos photos.", buttonText: "Voir la galerie", footerText: "Merci de nous avoir confié vos souvenirs." },
    Reminder: { subject: "Petit rappel concernant votre galerie", previewText: "Votre galerie vous attend toujours.", title: "Votre galerie vous attend", message: "Petit rappel amical : votre galerie photo est prête. Ouvrez-la quand vous le souhaitez pour voir vos images, choisir vos favoris et les télécharger.", buttonText: "Ouvrir la galerie", footerText: "Une question ? Répondez à cet e-mail, nous serons ravis de vous aider." },
    "Thank You": { subject: "Merci — votre galerie est prête", previewText: "Un petit merci accompagné de votre galerie finale.", title: "Merci", message: "Merci de nous avoir choisis pour photographier votre histoire. Votre galerie finale est maintenant disponible et prête à être partagée avec vos proches.", buttonText: "Voir vos photos", footerText: "Avec toute notre gratitude, votre équipe photo." },
    "Album & Print": { subject: "Donnez une vie durable à vos photos préférées", previewText: "Albums et tirages sont prêts quand vous l'êtes.", title: "Votre histoire mérite d'être imprimée", message: "Vos photographies préférées peuvent devenir un bel album ou des tirages finis pour votre intérieur. Ouvrez votre galerie et choisissez les moments que vous souhaitez conserver sur papier.", buttonText: "Choisir mes favoris", footerText: "Besoin d'aide pour choisir un album ou un format ? Répondez à cet e-mail et nous vous guiderons." },
    Booking: { subject: "Prêts à organiser votre prochaine séance ?", previewText: "Choisissez une date pour votre prochaine séance photo.", title: "Créons quelque chose de nouveau", message: "Si vous pensez à une nouvelle séance, c'est le bon moment pour réserver une date. Utilisez le bouton pour consulter les disponibilités et commencer à préparer votre séance.", buttonText: "Réserver une séance", footerText: "Nous serions ravis de photographier votre prochain chapitre." },
    Marketing: { subject: "Quelques nouvelles du studio", previewText: "Actualités, inspiration et nouveautés du studio.", title: "Depuis le studio", message: "Nous souhaitions partager un peu d'inspiration et les dernières nouvelles du studio. Découvrez ce qui est nouveau pour votre prochaine expérience photo.", buttonText: "Découvrir", footerText: "Merci de faire partie de notre communauté photo." },
  },
  German: {
    "Gallery Delivery": { subject: "Deine Fotos sind fertig", previewText: "Deine Galerie ist jetzt bereit.", title: "Deine Fotos sind fertig", message: "Deine Galerie ist fertig. Wir wünschen dir viel Freude beim Wiedererleben dieser Momente. Über den Button kannst du deine Fotos ansehen, favorisieren und herunterladen.", buttonText: "Galerie ansehen", footerText: "Danke, dass du uns deine Erinnerungen anvertraut hast." },
    Reminder: { subject: "Eine kurze Erinnerung an deine Galerie", previewText: "Deine Galerie wartet noch auf dich.", title: "Deine Galerie wartet", message: "Eine freundliche Erinnerung: Deine Fotogalerie ist bereit. Öffne sie jederzeit, um deine Bilder anzusehen, Favoriten auszuwählen und sie herunterzuladen.", buttonText: "Galerie öffnen", footerText: "Fragen? Antworte einfach auf diese E-Mail – wir helfen gerne." },
    "Thank You": { subject: "Danke — deine Galerie ist da", previewText: "Ein kleines Dankeschön und deine fertige Galerie.", title: "Danke", message: "Danke, dass du uns gewählt hast, um deine Geschichte festzuhalten. Deine fertige Galerie ist jetzt verfügbar und kann mit deinen Lieblingsmenschen geteilt werden.", buttonText: "Fotos ansehen", footerText: "Mit herzlichem Dank, dein Fotografie-Team." },
    "Album & Print": { subject: "Mach aus deinen Lieblingsfotos etwas Bleibendes", previewText: "Alben und Prints warten auf deine Auswahl.", title: "Deine Geschichte gehört in deine Hände", message: "Deine Lieblingsfotos können zu einem hochwertigen Album oder zu fertigen Prints für dein Zuhause werden. Öffne deine Galerie und wähle die Momente aus, die du gedruckt bewahren möchtest.", buttonText: "Favoriten auswählen", footerText: "Du brauchst Hilfe bei Album oder Printformat? Antworte einfach auf diese E-Mail." },
    Booking: { subject: "Bereit für deine nächste Fotosession?", previewText: "Wähle einen Termin für deine nächste Fotosession.", title: "Lass uns etwas Neues schaffen", message: "Wenn du über eine weitere Session nachdenkst, ist jetzt ein guter Zeitpunkt, einen Termin zu reservieren. Über den Button kannst du freie Termine sehen und mit der Planung beginnen.", buttonText: "Session buchen", footerText: "Wir freuen uns darauf, dein nächstes Kapitel zu fotografieren." },
    Marketing: { subject: "Neuigkeiten aus dem Studio", previewText: "Inspiration, Neuigkeiten und ein Update von uns.", title: "Aus dem Studio", message: "Wir möchten ein wenig Inspiration und die neuesten Neuigkeiten aus dem Studio mit dir teilen. Entdecke, was es für dein nächstes Fotoerlebnis Neues gibt.", buttonText: "Mehr entdecken", footerText: "Danke, dass du Teil unserer Fotografie-Community bist." },
  },
  Greek: {
    "Gallery Delivery": { subject: "Οι φωτογραφίες σας είναι έτοιμες", previewText: "Η γκαλερί σας είναι έτοιμη για προβολή.", title: "Οι φωτογραφίες σας είναι έτοιμες", message: "Η γκαλερί σας είναι έτοιμη. Ελπίζουμε να απολαύσετε ξανά αυτές τις στιγμές. Χρησιμοποιήστε το κουμπί για να δείτε, να επιλέξετε αγαπημένες και να κατεβάσετε τις φωτογραφίες σας.", buttonText: "Προβολή γκαλερί", footerText: "Σας ευχαριστούμε που μας εμπιστευτήκατε τις αναμνήσεις σας." },
    Reminder: { subject: "Μια μικρή υπενθύμιση για τη γκαλερί σας", previewText: "Η γκαλερί σας εξακολουθεί να σας περιμένει.", title: "Η γκαλερί σας περιμένει", message: "Μια φιλική υπενθύμιση ότι η γκαλερί φωτογραφιών σας είναι έτοιμη. Ανοίξτε την όποτε θέλετε για να δείτε τις εικόνες, να επιλέξετε αγαπημένες και να τις κατεβάσετε.", buttonText: "Άνοιγμα γκαλερί", footerText: "Έχετε ερωτήσεις; Απαντήστε σε αυτό το email και θα χαρούμε να βοηθήσουμε." },
    "Thank You": { subject: "Ευχαριστούμε — η γκαλερί σας είναι εδώ", previewText: "Ένα μικρό ευχαριστώ μαζί με την ολοκληρωμένη γκαλερί σας.", title: "Ευχαριστούμε", message: "Σας ευχαριστούμε που μας επιλέξατε για να φωτογραφίσουμε την ιστορία σας. Η ολοκληρωμένη γκαλερί είναι τώρα διαθέσιμη και έτοιμη να τη μοιραστείτε με τους αγαπημένους σας.", buttonText: "Δείτε τις φωτογραφίες", footerText: "Με ευγνωμοσύνη, η φωτογραφική σας ομάδα." },
    "Album & Print": { subject: "Κάντε τις αγαπημένες σας φωτογραφίες κάτι διαχρονικό", previewText: "Άλμπουμ και εκτυπώσεις είναι έτοιμα όταν είστε κι εσείς.", title: "Η ιστορία σας αξίζει να μείνει στα χέρια σας", message: "Οι αγαπημένες σας φωτογραφίες μπορούν να γίνουν ένα όμορφο άλμπουμ ή ποιοτικές εκτυπώσεις για το σπίτι. Ανοίξτε τη γκαλερί και επιλέξτε τις στιγμές που θέλετε να κρατήσετε τυπωμένες.", buttonText: "Επιλέξτε αγαπημένες", footerText: "Χρειάζεστε βοήθεια με άλμπουμ ή μέγεθος εκτύπωσης; Απαντήστε σε αυτό το email." },
    Booking: { subject: "Έτοιμοι να σχεδιάσουμε την επόμενη φωτογράφιση;", previewText: "Επιλέξτε ημερομηνία για την επόμενη φωτογράφισή σας.", title: "Ας δημιουργήσουμε κάτι νέο", message: "Αν σκέφτεστε μια νέα φωτογράφιση, τώρα είναι μια καλή στιγμή να κρατήσετε ημερομηνία. Χρησιμοποιήστε το κουμπί για να δείτε τη διαθεσιμότητα και να ξεκινήσετε τον σχεδιασμό.", buttonText: "Κράτηση φωτογράφισης", footerText: "Θα χαρούμε να φωτογραφίσουμε το επόμενο κεφάλαιο της ιστορίας σας." },
    Marketing: { subject: "Νέα από το στούντιο", previewText: "Έμπνευση, νέα και μια ενημέρωση από εμάς.", title: "Από το στούντιο", message: "Θέλαμε να μοιραστούμε λίγη έμπνευση και τα τελευταία νέα του στούντιο. Ανακαλύψτε τι νέο υπάρχει για την επόμενη φωτογραφική σας εμπειρία.", buttonText: "Ανακαλύψτε περισσότερα", footerText: "Ευχαριστούμε που είστε μέρος της φωτογραφικής μας κοινότητας." },
  },
  Arabic: {
    "Gallery Delivery": { subject: "صوركم أصبحت جاهزة", previewText: "معرض الصور جاهز الآن للمشاهدة.", title: "صوركم أصبحت جاهزة", message: "معرض الصور الخاص بكم جاهز. نتمنى أن تستمتعوا باستعادة هذه اللحظات. استخدموا الزر لمشاهدة الصور واختيار المفضلة وتنزيلها.", buttonText: "عرض المعرض", footerText: "شكرًا لثقتكم بنا لحفظ ذكرياتكم." },
    Reminder: { subject: "تذكير بسيط بمعرض الصور", previewText: "معرض الصور ما زال بانتظاركم.", title: "معرض الصور بانتظاركم", message: "مجرد تذكير ودي بأن معرض الصور جاهز. يمكنكم فتحه في أي وقت لمشاهدة الصور واختيار المفضلة وتنزيل اللحظات التي تحبونها.", buttonText: "فتح المعرض", footerText: "هل لديكم أي سؤال؟ ردوا على هذا البريد وسنسعد بمساعدتكم." },
    "Thank You": { subject: "شكرًا لكم — معرض الصور جاهز", previewText: "رسالة شكر صغيرة مع معرضكم النهائي.", title: "شكرًا لكم", message: "شكرًا لاختياركم لنا لتوثيق قصتكم. أصبح معرض الصور النهائي متاحًا الآن وجاهزًا للمشاركة مع من تحبون.", buttonText: "مشاهدة الصور", footerText: "مع خالص الامتنان، فريق التصوير." },
    "Album & Print": { subject: "حوّلوا صوركم المفضلة إلى ذكرى تدوم", previewText: "الألبومات والمطبوعات جاهزة عندما تكونون جاهزين.", title: "قصتكم تستحق أن تبقى بين أيديكم", message: "يمكن أن تتحول صوركم المفضلة إلى ألبوم جميل أو مطبوعات أنيقة لمنزلكم. افتحوا المعرض واختاروا اللحظات التي تريدون الاحتفاظ بها مطبوعة.", buttonText: "اختيار المفضلة", footerText: "هل تحتاجون مساعدة في اختيار الألبوم أو مقاس الطباعة؟ ردوا على هذا البريد وسنساعدكم." },
    Booking: { subject: "هل أنتم مستعدون للتخطيط للجلسة القادمة؟", previewText: "اختاروا موعدًا لجلسة التصوير القادمة.", title: "لنصنع شيئًا جديدًا", message: "إذا كنتم تفكرون في جلسة تصوير جديدة، فهذا وقت مناسب لحجز موعد. استخدموا الزر لمشاهدة المواعيد المتاحة والبدء في التخطيط.", buttonText: "حجز جلسة", footerText: "يسعدنا أن نوثق الفصل القادم من قصتكم." },
    Marketing: { subject: "جديد من الاستوديو", previewText: "أخبار وإلهام وتحديث جديد منا.", title: "من الاستوديو", message: "أردنا أن نشارككم بعض الإلهام وآخر أخبار الاستوديو. اكتشفوا ما هو جديد لتجربة التصوير القادمة.", buttonText: "اكتشفوا المزيد", footerText: "شكرًا لكونكم جزءًا من مجتمعنا الفوتوغرافي." },
  },
};

const coreTemplateColors: Record<CoreEmailTemplateCategory, string> = {
  "Gallery Delivery": "#1C1C1C",
  Reminder: "#6F57D9",
  "Thank You": "#B48A58",
  "Album & Print": "#86684A",
  Booking: "#2E6E68",
  Marketing: "#6337D8",
};

const purposeEmailTemplates: EmailTemplateItem[] = EMAIL_TEMPLATE_LANGUAGES.flatMap((language) =>
  EMAIL_TEMPLATE_CATEGORIES.map((category) => {
    const copy = localizedEmailCopy[language][category];
    const slug = `${language}-${category}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      id: `admin-${slug}`,
      name: `${category} · ${language}`,
      category,
      language,
      ...copy,
      buttonLink: "Collection URL",
      buttonColor: coreTemplateColors[category],
      image: "",
      eyebrowText: "Client Gallery",
      showImage: true,
      updatedAt: "Pre-built",
      source: "admin" as const,
    };
  }),
);

const galleryCategoryEmailTemplates: EmailTemplateItem[] = EMAIL_TEMPLATE_LANGUAGES.flatMap((language) =>
  CLIENT_GALLERY_CATEGORIES.map((galleryCategory) => {
    const copy = localizedEmailCopy[language]["Gallery Delivery"];
    const slug = `${language}-${galleryCategory}-gallery`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      id: `admin-category-${slug}`,
      name: `${galleryCategory} · ${language}`,
      category: "Gallery Delivery",
      galleryCategory,
      language,
      ...copy,
      buttonLink: "Collection URL",
      buttonColor: coreTemplateColors["Gallery Delivery"],
      image: "",
      eyebrowText: galleryCategory === "Custom label" ? "Client Gallery" : galleryCategory,
      showImage: true,
      updatedAt: "Pre-built",
      source: "admin" as const,
    };
  }),
);

export const defaultEmailTemplates: EmailTemplateItem[] = [
  ...purposeEmailTemplates,
  ...galleryCategoryEmailTemplates,
];

const legacyEmailCategory: Record<string, CoreEmailTemplateCategory> = {
  "admin-gallery-ready": "Gallery Delivery",
  "admin-friendly-reminder": "Reminder",
  "admin-thank-you": "Thank You",
};

function mergeCmsEmailTemplates(value: EmailTemplateItem[] | undefined) {
  const saved = (Array.isArray(value) ? value : []).map((template) => ({
    ...template,
    category: template.category || legacyEmailCategory[template.id] || "Gallery Delivery",
    language: template.language || "English",
    source: "admin" as const,
  }));
  const templateKey = (template: EmailTemplateItem) =>
    `${template.language || "English"}::${template.category || "Gallery Delivery"}::${template.galleryCategory || ""}`;
  const covered = new Set(saved.map(templateKey));
  const missingDefaults = defaultEmailTemplates.filter((template) => !covered.has(templateKey(template)));
  return [...saved, ...missingDefaults];
}

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

export type HomeMarqueeItem = { id: string; type: "text" | "logo" | "image" | "video"; text: string; image: string; url?: string };

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
    titleFontSizePx: number;
    subtitle: string;
    subtitleFontSizePx: number;
    cta: string;
    secondaryCta: string;
    videoUrl: string;
    ratingText: string;
    avatarImages: string[];
  };
  marquee: {
    enabled: boolean;
    durationSeconds: number;
    items: HomeMarqueeItem[];
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
  clientGallery: {
    eyebrow: string;
    title: string;
    subtitle: string;
    tabs: GalleryTab[];
  };
  photographerTypes: {
    eyebrow: string;
    title: string;
    subtitle: string;
    tabs: GalleryTab[];
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
    brandText: string;
    logoUrl: string;
    description: string;
    copyright: string;
    columns: { title: string; links: FooterLink[] }[];
  };
};

export type GalleryTab = {
  value: string;
  label: string;
  image: string;
  mediaType?: "image" | "video";
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
    brandText: "Gallerista",
    brandImageUrl: "",
    accentColor: "#22bda7",
  },
  coverTemplates: [],
  emailTemplates: defaultEmailTemplates,
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
    siteTitle: "Gallerista",
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
    loginTitle: "Log in | Gallerista",
    loginDescription: "Log in to your Gallerista workspace.",
    loginKeywords: "Gallerista login, photographer workspace login",
    registerTitle: "Create account | Gallerista",
    registerDescription: "Create your Gallerista photography workspace.",
    registerKeywords:
      "create photography website, client gallery account, photographer store",
  },
  auth: {
    brand: "Gallerista",
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
        brand: "GALLERISTA",
        products: "Products",
        examples: "Examples",
        pricing: "Pricing",
        login: "Log In",
        cta: "Get Started",
      },
      hero: {
        eyebrow: "GALLERISTA PHOTOGRAPHER PLATFORM",
        title: "Your Moments.",
        accentTitle: "Beautifully",
        endingTitle: "Presented.",
        titleFontSizePx: 46,
        subtitle:
          "Industry-leading photo galleries, website and business tools to streamline your workflow and grow your photography business.",
        subtitleFontSizePx: 16,
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
      marquee: {
        enabled: true,
        durationSeconds: 28,
        items: [
          { id: "delivery", type: "text", text: "BEAUTIFUL CLIENT DELIVERY", image: "" },
          { id: "proofing", type: "text", text: "ONLINE PROOFING", image: "" },
          { id: "favorites", type: "text", text: "CLIENT FAVORITES", image: "" },
          { id: "sales", type: "text", text: "PRINT & DIGITAL SALES", image: "" },
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
          "From weddings to landscapes and everything in between, Gallerista is built to elevate your business - and make your work look its best.",
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
      clientGallery: {
        eyebrow: "CLIENT GALLERY",
        title: "The ultimate photo gallery that redefined the industry.",
        subtitle: "Deliver beautiful galleries, simplify proofing, and sell more with a client experience built around your brand.",
        tabs: [
          { value: "share", label: "Share Photos", image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1500&q=85" },
          { value: "delivery", label: "Digital delivery", image: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1500&q=85" },
          { value: "proofing", label: "Online proofing", image: "https://images.unsplash.com/photo-1507501336603-6e31db2be093?auto=format&fit=crop&w=1500&q=85" },
          { value: "sell", label: "Sell photos", image: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=1500&q=85" },
        ],
      },
      photographerTypes: {
        eyebrow: "DESIGNED FOR EVERY WORKFLOW",
        title: "Made for all photographers.",
        subtitle: "From weddings to landscapes and everything in between, Gallerista is built to elevate your business—and make your work look its best.",
        tabs: [
          { value: "wedding", label: "Wedding", image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1500&q=85" },
          { value: "portrait", label: "Portrait", image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1500&q=85" },
          { value: "family", label: "Family", image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1500&q=85" },
          { value: "seniors", label: "Seniors", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1500&q=85" },
          { value: "events", label: "Events", image: "https://images.unsplash.com/photo-1507501336603-6e31db2be093?auto=format&fit=crop&w=1500&q=85" },
          { value: "adventure", label: "Adventure", image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1500&q=85" },
          { value: "commercial", label: "Commercial", image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1500&q=85" },
          { value: "sports", label: "Sports", image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1500&q=85" },
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
              "The four main Gallerista tools we currently use are essential in providing a seamless and professional experience for our clients.",
          },
          {
            name: "Bek Rogers",
            site: "bekrogersphoto.com",
            image:
              "https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?auto=format&fit=crop&w=120&q=80",
            quote:
              "Gallerista has given me the ease of delivering galleries through the same platform that houses my website.",
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
        title: "Start using Gallerista today for free",
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
        brandText: "Gallerista",
        logoUrl: "",
        description:
          "An all-in-one platform for modern photographers, offering client photo galleries, websites, online stores and studio management software tools.",
        copyright: "Copyright 2026 Gallerista. Made with love in Vancity.",
        columns: [
          {
            title: "Products",
            links: ["Client Gallery", "Store Gallery", "Mobile Gallery App"],
          },
          {
            title: "Company",
            links: ["About", "Pricing", "Contact"],
          },
          {
            title: "Resources",
            links: ["Help Center", "Blog", "Community"],
          },
          {
            title: "Legal",
            links: ["Terms of Service", "Privacy Policy", "Cookies"],
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
    titleFontSizePx: 52,
    subtitle:
      "ÎšÎ¿ÏÏ…Ï†Î±Î¯ÎµÏ‚ Î³ÎºÎ±Î»ÎµÏÎ¯ Ï†Ï‰Ï„Î¿Î³ÏÎ±Ï†Î¹ÏŽÎ½, Î¹ÏƒÏ„Î¿ÏƒÎµÎ»Î¯Î´ÎµÏ‚ ÎºÎ±Î¹ ÎµÏÎ³Î±Î»ÎµÎ¯Î± ÎµÏ€Î¹Ï‡ÎµÎ¯ÏÎ·ÏƒÎ·Ï‚ Î³Î¹Î± ÎºÎ±Î»ÏÏ„ÎµÏÎ· ÏÎ¿Î® ÎµÏÎ³Î±ÏƒÎ¯Î±Ï‚.",
    subtitleFontSizePx: 17,
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
  if (!seo.faviconUrl?.trim()) {
    seo.faviconUrl = brand.logoUrl?.trim() || brand.brandImageUrl?.trim() || "";
  }
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
      titleFontSizePx: Math.min(
        96,
        Math.max(24, Number(savedHero.titleFontSizePx) || defaultHomeCms.content[lang].hero.titleFontSizePx),
      ),
      subtitleFontSizePx: Math.min(
        40,
        Math.max(12, Number(savedHero.subtitleFontSizePx) || defaultHomeCms.content[lang].hero.subtitleFontSizePx),
      ),
      avatarImages:
        Array.isArray(
          (savedHero as Partial<HomeContent["hero"]>).avatarImages,
        ) && (savedHero as Partial<HomeContent["hero"]>).avatarImages!.length
          ? (savedHero as Partial<HomeContent["hero"]>).avatarImages!
          : defaultHomeCms.content[lang].hero.avatarImages,
    };
    const savedMarquee = content[lang].marquee ?? fallback.marquee;
    content[lang].marquee = {
      ...fallback.marquee,
      ...savedMarquee,
      durationSeconds: Math.min(120, Math.max(8, Number(savedMarquee.durationSeconds) || fallback.marquee.durationSeconds)),
      items: Array.isArray(savedMarquee.items) ? savedMarquee.items : fallback.marquee.items,
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
    content[lang].clientGallery = {
      ...fallback.clientGallery,
      ...(content[lang].clientGallery ?? {}),
      tabs:
        Array.isArray(content[lang].clientGallery?.tabs) &&
        content[lang].clientGallery.tabs.length
          ? content[lang].clientGallery.tabs
          : fallback.clientGallery.tabs,
    };
    content[lang].photographerTypes = {
      ...fallback.photographerTypes,
      ...(content[lang].photographerTypes ?? {}),
      tabs:
        Array.isArray(content[lang].photographerTypes?.tabs) &&
        content[lang].photographerTypes.tabs.length
          ? content[lang].photographerTypes.tabs
          : fallback.photographerTypes.tabs,
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
    const savedFooterColumns = Array.isArray(content[lang].footer?.columns)
      ? content[lang].footer.columns
      : [];
    content[lang].footer = {
      ...fallback.footer,
      ...(content[lang].footer ?? {}),
      columns: Array.from({ length: 4 }, (_, index) => ({
        ...fallback.footer.columns[index],
        ...(savedFooterColumns[index] ?? {}),
        links: Array.isArray(savedFooterColumns[index]?.links)
          ? savedFooterColumns[index].links
          : fallback.footer.columns[index].links,
      })),
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
    emailTemplates: mergeCmsEmailTemplates(data?.emailTemplates),
    media,
    content,
  };
}
