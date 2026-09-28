# Glossary

Use these terms consistently in code, API, UI keys and docs.

| Term                  | Meaning                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **User**              | A person with an account. Can act as a client and/or be a member of one or more businesses.                                          |
| **Client**            | A user booking services. Not a separate account type — the client mode of any user.                                                  |
| **Business**          | A service provider listed on the platform: a salon, clinic, company or solo specialist. Has a timezone and a category.               |
| **Member**            | A user's membership in a business with a role: `OWNER`, `ADMIN`, `STAFF`.                                                            |
| **Staff member**      | A bookable resource of a business (usually a person). May be linked to a member account or exist without one.                        |
| **Service**           | Something a business sells: name, duration, price, buffer times, the staff who can perform it.                                       |
| **Category**          | Platform-level classification (hair, nails, transfer…). Admin-managed, translated.                                                   |
| **Working hours**     | Weekly recurring availability of a staff member (per weekday, possibly several intervals).                                           |
| **Time off**          | A one-off interval when a staff member is unavailable (vacation, sick day, break).                                                   |
| **Slot**              | A computed start time at which a service can be booked with a staff member. Never stored; derived from hours, time off and bookings. |
| **Booking**           | A reservation of a staff member for a service at a time range, by a client. Has a status.                                            |
| **Booking status**    | `PENDING` (awaiting business confirmation), `CONFIRMED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`.                                        |
| **Confirmation mode** | Business setting: bookings are auto-confirmed or require manual confirmation.                                                        |
| **Mode**              | UI mode of the app: client mode or business mode (for users who are members of a business).                                          |
| **Locale**            | UI language code: `en`, `me`, `ru`, `tr` (see ADR-0004).                                                                             |
