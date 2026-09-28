# Open product questions

Questions that block or shape future work. `/manager` asks the user when a task depends on one,
then moves the answer to **Resolved** (and to an ADR if it is architectural).

## Open

| #   | Question                                                                                                                                | Needed by | Default if unanswered                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------- |
| Q1  | Email provider: AWS SES or Resend?                                                                                                      | M5        | AWS SES (already on AWS, cheapest)                          |
| Q2  | Transfers need pickup/drop-off addresses and passenger count. Generic "custom booking fields" per service, or a transfer-specific flow? | M3        | Generic custom fields per service (text/number/select)      |
| Q3  | Default confirmation mode for new businesses: auto-confirm or manual?                                                                   | M3        | Auto-confirm, switchable per business                       |
| Q4  | Cancellation policy: how late may a client cancel/reschedule? Per business setting?                                                     | M3        | Per-business setting, default 2 hours before start          |
| Q5  | Monetization after alpha: subscription for businesses, paid promotion, or commission?                                                   | Post-M7   | —                                                           |
| Q6  | Can clients book without an account (phone/email only)?                                                                                 | M3        | No — account required (reduces no-shows, enables reminders) |
| Q7  | Are business-entered texts (service names, descriptions) translated? Manually per locale or machine translation?                        | M4        | Single language chosen by the business; no translation      |
| Q8  | Moderation: must every business be approved before it is publicly listed?                                                               | M6        | Yes, manual approval by platform admin                      |

## Resolved

| #   | Question                          | Decision                                                              | Date       |
| --- | --------------------------------- | --------------------------------------------------------------------- | ---------- |
| R1  | Solo specialists or salons?       | Salons with multiple staff from the first release (solo = one staff). | 2026-09-28 |
| R2  | Notification channels in MVP      | Expo push, email, Telegram bot. SMS/WhatsApp/Viber after MVP.         | 2026-09-28 |
| R3  | One app or separate business app? | One app on web and mobile; business users switch into business mode.  | 2026-09-28 |
| R4  | Default UI language               | English; plus Crnogorski/Srpski (Latin), Russian, Turkish.            | 2026-09-28 |
