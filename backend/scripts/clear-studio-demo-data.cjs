const mongoose = require("mongoose");
const USER_ID = "6b01f579d0b316b46de00419";
const uri = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/pixieset-asad-vai-project";
(async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  const studio = await db.collection("studiorecords").deleteMany({
    userId: USER_ID,
    title: { $regex: "^DEMO - " },
    description: { $regex: "^DEMO DATA ONLY" },
  });
  const services = await db.collection("bookingservices").deleteMany({
    userId: USER_ID, name: { $regex: "^DEMO - " },
  });
  const events = await db.collection("bookingevents").deleteMany({
    userId: USER_ID, title: { $regex: "^DEMO - " },
  });
  console.log(JSON.stringify({
    deleted: {
      studioRecords: studio.deletedCount,
      sessionTypes: services.deletedCount,
      calendarEvents: events.deletedCount,
    },
  }));
})().catch(error => {
  console.error("CLEANUP_FAILED", error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
