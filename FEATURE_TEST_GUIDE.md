# Simple Feature Test Guide

Use photographer account in dashboard. Use Incognito/private window for client tests. Real email tests need SMTP + available monthly email quota.

## 1. Gallery category

**Go:** Client Gallery → Galleries → New Gallery

**Test:** Choose `Wedding` → Save → Reopen → category must stay. Choose `Custom label` → type `Newborn` → Save → Reopen → `Newborn` must stay.

**Does:** Groups galleries by type.

## 2. Client Emails

**Go:** Client Gallery → Galleries → Create/Edit Gallery → Client Emails

**Test:** Add `client@example.com` → Save → Reopen → email must stay.

**Does:** These people receive **Gallery Published** automation. This is not gallery email-access/login setting. Emails must not appear publicly.

## 3. Homepage category filters

**Go:** Client Gallery → Homepage → Show gallery categories

**Test:** Enable → Save → open public homepage → click `Wedding`, `Travel`, `All` → gallery list must filter.

## 4. Featured galleries

**Go:** Client Gallery → Homepage → Featured Galleries & Categories

**Test:** Select published galleries → Save → open public homepage → selected galleries must appear first.

## 5. Email templates

**Go:** Client Gallery → Settings → Email Templates

**Test:** Filter purpose/category/language → open template → edit → Save → Reload → changes must stay.

**New template:** New Template → add name, subject, message, button → Save → Reload → template must remain editable.

**Languages:** English, Spanish, French, German, Greek, Arabic. Arabic must display right-to-left.

**Important:** Template only stores email design/content. It sends nothing until used by campaign or automation.

## 6. Admin email templates

**Go:** `/admin/email-templates`

**Test:** Filter → open template → edit purpose/category/language → Save → Reload → changes must stay.

## 7. Manual/scheduled email campaign

**Go:** Client Gallery → Marketing → Email

**Test:** Create email → choose template + gallery → schedule a few minutes ahead → client must receive it → button must open chosen gallery.

## 8. Automation email editor

**Go:** Client Gallery → Marketing → Automations

**Test:** Create/open automation → Edit email → change subject/message/button → Save automated email → reopen → changes must stay.

Available triggers: New subscriber, Gallery published, Client download, Client favorite.

## 9. New Subscriber automation

**Go:** Marketing → Automations → New Automation → New subscriber

**Test:** Choose template → enable → Incognito public gallery → submit marketing opt-in → email must arrive once.

**Receiver:** New opted-in subscriber.

## 10. Gallery Published automation

**Go:**

`Gallery → Draft → add Client Emails → Save`

`Marketing → Automations → New → Gallery published → enable`

**Test:** Change gallery Draft → Published → Save → Client Emails must receive gallery link.

**Receiver:** Gallery **Client Emails** + clients previously registered on that gallery.

**Important:** Saving already-published gallery again must not resend.

## 11. Client Download automation

**Go:** Marketing → Automations → New → Client download

**Test:** Enable → Incognito public gallery → enter client email → download photo/gallery → same client must receive email once.

**Receiver:** Person who downloaded. Gallery Client Emails list is not used.

**Repeat test:** Same gallery + same automation + same email must not resend. Use new email to test again.

## 12. Client Favorite automation

**Go:** Marketing → Automations → New → Client favorite

**Test:** Enable → Incognito public gallery → enter client email → favorite photo → same client must receive email once.

**Receiver:** Person who favorited. Remove/re-add must not resend for same gallery/automation/email.

## 13. Automation tokens and safety

Use in Gallery Published, Download, or Favorite email:

- `{{galleryName}}` → real gallery name
- `{{clientEmail}}` → receiver email
- `{{event}}` → event name

**Test:** Add tokens → trigger new event → received email must show real values. Pause automation → new event must send nothing.

## 14. Animated logo reveal

**Go:** Gallery → Design → Cover → Motion & Logo Reveal

**Test:** Enable → choose reveal style/duration → Save → open public gallery in new Incognito window → intro must play.

Also test: Skip intro → gallery opens immediately. Only once per session → refresh → intro does not replay.

## 15. Cover entrance motion

**Go:** Gallery → Design → Cover → Motion & Logo Reveal

**Test:** Try None, Fade in, Slow cinematic zoom, Rise in → Save each → reload public gallery → selected motion must appear.

## 16. Homepage trusted-by animation

**Go:** Public main homepage `/` → Trusted by professionals

**Test:** Scroll to logos → animation must be smooth, no jump/flicker. Reduced-motion mode → content stays visible without unnecessary motion.

## 17. Album Designer

**Go:** Client Gallery → Album Designer

**Test:** New album → select gallery → choose size/cover → Auto-design → edit spreads → Save → leave/reopen → design must stay → Export album plan.

**Does:** Photographer designs album from client gallery photos. Client cannot design/approve it. No email, order, or payment connection.

## 18. Client Blog

**Go:** Client Gallery → Blog

**Test:** Create Draft → confirm not public → Publish → open public homepage → post must appear in Journal / Latest Stories.

**Public pages:** `/home/<site-slug>/blog` and `/home/<site-slug>/blog/<post-slug>`. Configured photographer subdomain also uses `/blog`.

Test search, category, language, Featured post, cover, and article page.

## 19. Admin Blog

**Go:** `/admin/blogs`

**Test:** Create/edit/publish post → open `/blog` → post must appear → open `/blog/<slug>` → detail page must work.

## 20. Favorite ZIP download

**Go:** Public gallery → My Favorites

**Test:** Favorite 3 photos → select only 1 → Download selected → ZIP must contain exactly 1. Select 2 → ZIP must contain exactly 2.

## 21. Bookings, Events, and Co-workers

**Go:** Client Gallery → Bookings  
**URL:** `/dashboard/client-gallery/bookings`

### Co-workers

Co-workers → Add co-worker → enter name/email/phone/role → Save → Edit → deactivate/delete.

**Does:** Stores staff and lets photographer assign them to services/events. It does not create staff login or invitation.

### Booking types

Booking Types → New booking type → add name/duration/price/currency/location → assign co-worker → enable online booking → Save.

### Booking settings

Settings → enable Online booking → set timezone/hours/slot interval/booking window → choose auto-confirm → Save → Copy public link.

### Client booking

Open `/book/<username-or-user-id>` in Incognito → choose service/date/time → enter client details → Submit.

**Pass:** Booking appears in Bookings tab. Owner + client receive email when SMTP works.

### Manage booking

Bookings → open request → Confirm → Complete or Cancel → status must update.

### Manage event

Calendar → Add event → add title/start/end/location/notes → assign co-worker → Save → event must appear → edit it → Save → changes must stay.

**Not included:** Event delete button, co-worker login/invite, co-worker notification email, Google Calendar sync, online booking payment.

## 22. Quick email troubleshooting

No email? Check:

- Automation enabled
- Correct trigger + gallery scope
- SMTP configured
- Monthly email quota available
- New test email used for Download/Favorite repeat test
- Gallery Published has Client Emails
- New Subscriber client opted in

## 23. Final quick check

Gallery create/edit/upload → public PIN/email access → downloads → favorites → homepage/search → templates after login again → mobile layout. Everything must still work.
