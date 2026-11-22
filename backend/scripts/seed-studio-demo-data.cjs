const mongoose = require("mongoose");
const { randomBytes } = require("node:crypto");
const USER_ID = "6b01f579d0b316b46de00419";
const EMAIL = "islamrifat117@gmail.com";
const PREFIX = "DEMO - ";
const BATCH = "studio-demo-2026-11-22";
const uri = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/pixieset-asad-vai-project";
const token = () => randomBytes(32).toString("hex");
const paragraph = (text) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const now = new Date();
const plusDays = (n) => new Date(now.getTime() + n * 86400000);
const base = (kind, title, status, type, extra = {}) => ({
  _id: new mongoose.Types.ObjectId(), userId: USER_ID, kind, title: PREFIX + title,
  status, type, email: "", phone: "", contactId: "", projectId: "",
  description: "DEMO DATA ONLY - fictional sample for Studio Manager QA. No email or payment has been sent.",
  amount: 0, currency: "EUR", archived: false, details: { demoBatch: BATCH, ...(extra.details || {}) },
  createdAt: new Date(now.getTime() - (extra.age || 0) * 86400000), updatedAt: now,
  ...(extra.fields || {}),
});
async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  const user = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(USER_ID), email: EMAIL });
  if (!user) throw new Error("The expected local Studio account was not found; no demo data was written.");
  if (process.argv.includes("--clear")) {
    const studio = await db.collection("studiorecords").deleteMany({
      userId: USER_ID, title: { $regex: "^DEMO - " }, description: { $regex: "^DEMO DATA ONLY" },
    });
    const services = await db.collection("bookingservices").deleteMany({ userId: USER_ID, name: { $regex: "^DEMO - " } });
    const events = await db.collection("bookingevents").deleteMany({ userId: USER_ID, title: { $regex: "^DEMO - " } });
    console.log(JSON.stringify({ cleared: { studioRecords: studio.deletedCount, sessionTypes: services.deletedCount, calendarEvents: events.deletedCount } }));
    return;
  }
  const already = await db.collection("studiorecords").countDocuments({ userId: USER_ID, "details.demoBatch": BATCH });
  if (already) { console.log("Demo data already exists:", already, "Studio records. Run with --clear before reseeding."); return; }

  const contacts = [
    base("contacts", "Amina Rahman", "client", "client", { details: { firstName: "Amina", lastName: "Rahman", company: "Amina & Co.", address: "Gulshan Avenue", city: "Dhaka", country: "Bangladesh" }, fields: { email: "amina.rahman@example.com", phone: "+8801700000101" } }),
    base("contacts", "Farhan Ahmed", "lead", "lead", { details: { firstName: "Farhan", lastName: "Ahmed", company: "Northstar Studio", address: "Banani Road 11", city: "Dhaka", country: "Bangladesh" }, fields: { email: "farhan.ahmed@example.com", phone: "+8801700000102" } }),
    base("contacts", "Nabila Chowdhury", "client", "client", { details: { firstName: "Nabila", lastName: "Chowdhury", company: "Nabila Creative", address: "Dhanmondi 27", city: "Dhaka", country: "Bangladesh" }, fields: { email: "nabila.chowdhury@example.com", phone: "+8801700000103" } }),
  ];
  await db.collection("studiorecords").insertMany(contacts);

  const projects = [
    base("projects", "Amina & Rafi Wedding", "booked", "wedding", { age: 1, details: { location: "Radisson Blu, Dhaka" }, fields: { contactId: String(contacts[0]._id), email: contacts[0].email, date: plusDays(12) } }),
    base("projects", "Farhan Portrait Session", "inquiry", "portrait", { age: 2, details: { location: "Gulshan Studio" }, fields: { contactId: String(contacts[1]._id), email: contacts[1].email, date: plusDays(5) } }),
    base("projects", "Nabila Brand Campaign", "post-production", "commercial", { age: 3, details: { location: "Dhanmondi, Dhaka" }, fields: { contactId: String(contacts[2]._id), email: contacts[2].email, date: plusDays(-2) } }),
  ];
  // Project details only allow the location and additional-client fields.
  projects.forEach(project => { delete project.details.demoBatch; });
  await db.collection("studiorecords").insertMany(projects);

  const invoiceData = [
    { name: "Wedding Photography Deposit", number: "DEMO-INV-001", contact: 0, project: 0, lines: [{ name: "Wedding coverage deposit", quantity: 1, unitPrice: 600 }], taxPercent: 5, total: 630, due: 14 },
    { name: "Portrait Session Balance", number: "DEMO-INV-002", contact: 1, project: 1, lines: [{ name: "Portrait session", quantity: 1, unitPrice: 350 }, { name: "Retouched images", quantity: 5, unitPrice: 20 }], taxPercent: 5, discountPercent: 10, total: 425.25, due: 21 },
    { name: "Brand Campaign Final Invoice", number: "DEMO-INV-003", contact: 2, project: 2, lines: [{ name: "Brand photography package", quantity: 1, unitPrice: 900 }], taxPercent: 0, total: 900, due: 28 },
  ];
  const invoices = invoiceData.map((v, i) => base("invoices", v.name, "draft", "invoice", {
    age: i, details: { number: v.number, lines: v.lines, subtotal: v.lines.reduce((s, x) => s + x.quantity * x.unitPrice, 0), discountPercent: v.discountPercent || 0, discount: v.discountPercent ? 45 : 0, taxPercent: v.taxPercent, tax: v.total - (v.lines.reduce((s, x) => s + x.quantity * x.unitPrice, 0) - (v.discountPercent ? 45 : 0)), total: v.total, notes: "DEMO DATA ONLY - no payment requested.", businessName: "Gallerista Demo Studio", brandColor: "#6337d8" },
    fields: { contactId: String(contacts[v.contact]._id), projectId: String(projects[v.project]._id), email: contacts[v.contact].email, amount: v.total, dueDate: plusDays(v.due), token: token() },
  }));
  await db.collection("studiorecords").insertMany(invoices);

  const documents = [
    base("documents", "Wedding Photography Agreement", "draft", "contract", { details: { contentDoc: paragraph("DEMO CONTRACT - fictional sample content for preview testing only. This is not a legal agreement."), content: "DEMO CONTRACT - fictional sample content for preview testing only.", variables: {}, photographerName: "Gallerista Demo Studio", photographerEmail: "studio@example.com", clientSignerName: "Amina Rahman", clientSignerEmail: "amina.rahman@example.com", accentColor: "#6337d8" }, fields: { contactId: String(contacts[0]._id), projectId: String(projects[0]._id), email: contacts[0].email, token: token() } }),
    base("documents", "Portrait Session Questionnaire", "draft", "questionnaire", { details: { fields: [{ name: "session_goal", label: "What is the main goal of your session?", type: "textarea", required: true }, { name: "preferred_style", label: "Preferred photography style", type: "radio", required: true, options: "Natural,Editorial,Classic" }, { name: "session_date", label: "Preferred date", type: "date", required: false }], accentColor: "#6337d8" }, fields: { contactId: String(contacts[1]._id), projectId: String(projects[1]._id), email: contacts[1].email, token: token() } }),
    base("documents", "Brand Photography Proposal", "draft", "quote", { details: { quoteItems: [{ id: "brand-package", type: "standard", title: "Brand photography package", description: "Sample quote line", quantity: 1, unitPrice: 1200, options: [] }, { id: "extra-images", type: "optional", title: "Additional edited images", description: "Optional sample add-on", quantity: 1, unitPrice: 0, options: [{ id: "ten-images", name: "10 additional images", description: "Sample add-on", quantity: 1, unitPrice: 180 }] }], discountPercent: 0, taxPercent: 0, autoCreateInvoice: false, accentColor: "#6337d8", notes: "DEMO DATA ONLY - sample proposal." }, fields: { contactId: String(contacts[2]._id), projectId: String(projects[2]._id), email: contacts[2].email, amount: 1200, token: token() } }),
  ];
  await db.collection("studiorecords").insertMany(documents);

  const forms = [
    base("forms", "New Client Inquiry Form", "draft", "contact-form", { details: { fields: [{ name: "full_name", label: "Your full name", type: "text", required: true }, { name: "email", label: "Email address", type: "text", required: true }, { name: "event_date", label: "Event date", type: "date", required: false }, { name: "message", label: "Tell us about your project", type: "textarea", required: false }], accentColor: "#6337d8" }, fields: { token: token() } }),
    base("forms", "Wedding Photography Inquiry", "draft", "contact-form", { age: 1, details: { fields: [{ name: "couple_names", label: "Couple names", type: "text", required: true }, { name: "venue", label: "Venue", type: "text", required: false }, { name: "guest_count", label: "Expected guests", type: "select", options: "Under 50,50-100,100-200,200+", required: false }], accentColor: "#6337d8" }, fields: { token: token() } }),
    base("forms", "Portrait Session Request", "draft", "contact-form", { age: 2, details: { fields: [{ name: "name", label: "Your name", type: "text", required: true }, { name: "session_type", label: "Session type", type: "radio", options: "Individual,Family,Couple", required: true }], accentColor: "#6337d8" }, fields: { token: token() } }),
  ];
  await db.collection("studiorecords").insertMany(forms);

  const templates = [
    base("templates", "Wedding Contract Starter", "active", "contract", { details: { contentDoc: paragraph("DEMO TEMPLATE - sample photography agreement wording."), content: "DEMO TEMPLATE - sample photography agreement wording.", variables: {}, photographerName: "Gallerista Demo Studio", accentColor: "#6337d8" } }),
    base("templates", "Photography Invoice Starter", "active", "invoice", { details: { lines: [{ name: "Photography session", quantity: 1, unitPrice: 250 }], discountPercent: 0, taxPercent: 0, notes: "Sample template only." } }),
    base("templates", "Session Confirmation Email", "active", "email", { details: { content: "Hello {{client_name}},\n\nYour photography session details are ready. This is a demo email template and has not been sent.\n\nThank you,\nGallerista Demo Studio" } }),
  ];
  await db.collection("studiorecords").insertMany(templates);

  const discounts = [
    base("discounts", "Demo Welcome Discount", "active", "percentage", { details: { code: "DEMO10", discountType: "percentage", value: 10, description: "Sample 10% discount - not applied automatically." } }),
    base("discounts", "Demo Mini Session Offer", "active", "fixed", { details: { code: "DEMOMINI25", discountType: "fixed", value: 25, description: "Sample fixed discount - not applied automatically." } }),
    base("discounts", "Demo Returning Client Offer", "inactive", "percentage", { details: { code: "DEMORETURN15", discountType: "percentage", value: 15, description: "Sample inactive discount." } }),
  ];
  await db.collection("studiorecords").insertMany(discounts);

  const availability = [1, 2, 3, 4, 5].map(day => ({ day, enabled: true, start: "09:00", end: "17:00" }));
  const services = [
    { name: PREFIX + "Wedding Full Day", description: "DEMO DATA ONLY - private draft session type.", sessionStyle: "full", durationMinutes: 480, price: 1200, location: "Dhaka, Bangladesh", projectType: "wedding", sessionColor: "#6337d8" },
    { name: PREFIX + "Portrait Mini Session", description: "DEMO DATA ONLY - private draft mini session.", sessionStyle: "mini", durationMinutes: 45, price: 180, location: "Gulshan Studio, Dhaka", projectType: "portrait", sessionColor: "#8b5cf6" },
    { name: PREFIX + "Brand Photography Session", description: "DEMO DATA ONLY - private draft commercial session.", sessionStyle: "full", durationMinutes: 120, price: 450, location: "Dhanmondi, Dhaka", projectType: "commercial", sessionColor: "#0ea5e9" },
  ].map((v, i) => ({ _id: new mongoose.Types.ObjectId(), userId: USER_ID, ...v, bookingVisibility: "private", status: "draft", timezone: "Asia/Dhaka", createProjectOnBooking: false, projectStage: "inquiry", availability, sessionDates: [], intakeFields: [], paymentPolicy: "none", bookingRules: { minNoticeHours: 24, maxAdvanceDays: 120, slotIntervalMinutes: 30, autoConfirm: false }, confirmationMessage: "Demo session type only. No booking will be confirmed.", currency: "EUR", coworkerIds: [], active: true, createdAt: new Date(now.getTime() - i * 86400000), updatedAt: now }));
  await db.collection("bookingservices").insertMany(services);

  const events = [
    { title: "Studio walkthrough - Amina", day: 1, duration: 60, contact: 0, project: 0, service: 0, location: "Dhaka Studio" },
    { title: "Portrait planning - Farhan", day: 3, duration: 45, contact: 1, project: 1, service: 1, location: "Gulshan Studio" },
    { title: "Brand shoot prep - Nabila", day: 5, duration: 120, contact: 2, project: 2, service: 2, location: "Dhanmondi Studio" },
  ].map(v => ({ _id: new mongoose.Types.ObjectId(), userId: USER_ID, title: PREFIX + v.title, kind: "event", status: "pending", startAt: plusDays(v.day), endAt: new Date(plusDays(v.day).getTime() + v.duration * 60000), allDay: false, location: v.location, notes: "DEMO DATA ONLY - fictional calendar sample, not a real appointment.", clientName: contacts[v.contact].title.replace(PREFIX, ""), clientEmail: contacts[v.contact].email, contactId: String(contacts[v.contact]._id), projectId: String(projects[v.project]._id), serviceId: String(services[v.service]._id), serviceName: services[v.service].name, source: "dashboard", createdAt: now, updatedAt: now }));
  await db.collection("bookingevents").insertMany(events);

  console.log("SEEDED", JSON.stringify({ batch: BATCH, counts: { contacts: contacts.length, projects: projects.length, invoices: invoices.length, documents: documents.length, forms: forms.length, templates: templates.length, discounts: discounts.length, sessionTypes: services.length, calendarEvents: events.length } }));
}
main().then(() => mongoose.disconnect()).catch(async e => { console.error("SEED_FAILED", e.stack || e.message); try { await mongoose.disconnect(); } catch {} process.exit(1); });
