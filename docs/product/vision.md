# Product vision

## One-liner

Najme is a cross-platform booking platform for small service businesses in Montenegro: businesses
manage services, staff and schedules; clients find a specialist and book a time slot in a few taps.

## Problem

Service discovery and booking in Montenegro happen in scattered Telegram/Viber/WhatsApp chats and
phone calls. There is no single place to compare providers, see real availability, or book without
back-and-forth messaging. Small businesses keep their calendars on paper or in messengers and lose
bookings to no-shows and double bookings.

## Users and modes

The product is **one app** (web + iOS + Android). Any signed-in user can switch between two modes.

### Client mode

- Browse and search businesses by category, city and free text.
- View a business page: services, prices, durations, staff, photos, address, reviews.
- Pick a service → staff (or "any") → free slot → book.
- Manage own bookings: upcoming/past, cancel or reschedule within the business's policy.
- Receive confirmations and reminders (push, email, Telegram).
- Leave a review after a completed booking.

### Business mode

A **business** can be a salon with several staff members, a clinic, or a solo specialist (a
business with one staff member).

- Create and edit the business profile (name, category, description, address/city, photos,
  contacts).
- Manage **staff**: invite members, set roles (owner / admin / staff), link staff to services.
- Manage **services**: name, description, duration, price, which staff can perform them.
- Manage **working hours** per staff member and **time off** (holidays, breaks).
- **Calendar**: day/week view per staff member, create bookings manually (walk-ins, phone calls),
  confirm/decline/cancel/reschedule bookings.
- Receive notifications about new and changed bookings.

### Platform admin

- Moderate businesses before they become publicly visible.
- Manage the category catalogue (with translations).
- Handle reports and remove abusive content.

## Categories (initial, admin-managed)

Transfer, cleaning, dentist, nails, hair, massage, beauty, repair, babysitting, tutoring. The
catalogue is dynamic — admins add categories; each has names in all UI locales.

## Market and languages

- Montenegro first: Podgorica, Budva, Kotor, Bar, Herceg Novi, Tivat, Nikšić, Ulcinj.
- Audiences: locals, Russian-/Ukrainian-speaking and Turkish residents, tourists.
- UI locales: English (default), Crnogorski/Srpski (Latin), Russian, Turkish. See ADR-0004.

## MVP scope

1. Accounts: email + password, Google, Apple (iOS); profile language.
2. Businesses with staff, services, working hours and time off.
3. Booking engine: availability, slot booking without double bookings, confirmation, cancel and
   reschedule.
4. Marketplace discovery: categories, search, public business pages (SEO on web).
5. Notifications: push, email, Telegram bot; reminders.
6. Reviews after completed bookings; admin moderation.

## Non-goals for MVP

- Online payments and deposits (clients pay on site).
- In-app chat between client and business.
- SMS / WhatsApp / Viber notifications.
- Paid promotion or subscriptions (monetization comes after the alpha).
- Multi-country support.

## Success criteria for the alpha

- 20+ real businesses onboarded with live schedules.
- Clients complete bookings end-to-end on web and mobile in all four locales.
- Zero double bookings; reminders delivered.
