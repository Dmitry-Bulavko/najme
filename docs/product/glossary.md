# Glossary

Use these terms consistently in code, API, UI keys and docs.

| Term                  | Meaning                                                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User**              | A person with an account. Can act as a client and/or be a member of one or more businesses.                                                                       |
| **Client**            | A user booking services. Not a separate account type — the client mode of any user.                                                                               |
| **Guest**             | A walk-in or phone client without a Najme account, recorded on a walk-in booking by name (required) and phone (optional). Receives no notifications.              |
| **Business**          | A service provider listed on the platform: a salon, clinic, company or solo specialist. Has a timezone and a category.                                            |
| **Member**            | A user's membership in a business with a role: `OWNER`, `ADMIN`, `STAFF`.                                                                                         |
| **Staff member**      | A bookable resource of a business (usually a person). May be linked to a member account or exist without one.                                                     |
| **Service**           | Something a business sells: name, duration, price, buffer times, the staff who can perform it.                                                                    |
| **Category**          | Platform-level classification (hair, nails, transfer…). Admin-managed, translated.                                                                                |
| **Working hours**     | Weekly recurring availability of a staff member (per weekday, possibly several intervals).                                                                        |
| **Time off**          | A one-off interval when a staff member is unavailable (vacation, sick day, break).                                                                                |
| **Slot**              | A computed start time at which a service can be booked with a staff member. Never stored; derived from hours, time off and bookings.                              |
| **Booking**           | A reservation of a staff member for a service at a time range, by a client or, for a walk-in booking, for a guest. Has a status and a source.                     |
| **Booking status**    | `PENDING` (awaiting business confirmation), `CONFIRMED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`.                                                                     |
| **Booking source**    | `Booking.source`: `CLIENT` (an online self-booking by a client with an account) or `BUSINESS` (a walk-in booking created by a member).                            |
| **Walk-in booking**   | A booking a business member creates for a guest (walk-in or phone call; `source = BUSINESS`). Starts `CONFIRMED`; may be created before the business is approved. |
| **Confirmation mode** | Business setting: bookings are auto-confirmed or require manual confirmation.                                                                                     |
| **Mode**              | UI mode of the app: client mode or business mode (for users who are members of a business).                                                                       |
| **Platform admin**    | A user with `User.isPlatformAdmin = true` (a flag, not a role; unrelated to the member role `ADMIN`). Moderates businesses and, from M6, runs the admin area.     |
| **Moderation status** | `Business.status`: `PENDING_APPROVAL` (default), `APPROVED`, `REJECTED`, `SUSPENDED`. Only `APPROVED` businesses are listed and can be self-booked by clients.    |
| **Locale**            | UI language code: `en`, `me`, `ru`, `tr` (see ADR-0004).                                                                                                          |

## Workflow terms

| Term                  | Meaning                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase PR**          | The pull request `cursor/alpha → main` that carries one roadmap phase, implemented in Cursor. Merged with a merge commit when the phase is done (ADR-0012).          |
| **Reviewer (Claude)** | Claude in the reviewer role: reviews every task Cursor hands off, posts the verdict on the issue and merges the phase PR; it does not write feature code (ADR-0012). |
