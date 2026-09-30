# ADR-0014: Object storage

- Status: Accepted
- Date: 2026-09-30

## Context

Business logos, covers and staff photos must be uploaded from web and mobile without proxying
file bytes through the API. The database already stores object keys (`logoKey`, `coverKey`,
`photoKey`), never URLs. Production will use Lightsail object storage (bucket created in M7);
dev and CI need a local S3-compatible stand-in.

## Decision

- **S3-compatible storage** behind an abstract `ObjectStorage` seam. Production uses Lightsail
  Object Storage; **MinIO** runs in `compose.dev.yml` and CI. Clients never talk to a
  Najme-specific upload protocol — only standard S3 presigned POST.
- **Keys:** `businesses/<businessId>/<logo|cover|staff>/<uuidv7>.<ext>` where `ext` is derived
  from the declared `contentType` (`jpg` / `png` / `webp`).
- **Presigned POST** (not PUT): policy pins the object key and `Content-Type`, enforces
  `content-length-range` 1…5 MB, expires in 10 minutes. jpeg / png / webp only.
- **Public read** via `STORAGE_PUBLIC_BASE_URL` (path-style for MinIO:
  `{base}/{key}`). API responses expose absolute `logoUrl` / `coverUrl` / `photoUrl` or `null`.
- **No server-side resize**; clients downscale before upload. Orphan cleanup is deferred.
- **Lazy client:** constructing `S3ObjectStorage` must not open a network connection at Nest
  bootstrap, so the API smoke check still passes when MinIO is down.
- **Attach / delete:** after a successful browser upload, `PUT` endpoints verify the object with
  `HeadObject` (type + size) under the business prefix, then store the key. Replacing a photo
  deletes the previous object best-effort (log failures, never fail the request).

## Consequences

- Required env: `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`,
  `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_BASE_URL`,
  `STORAGE_FORCE_PATH_STYLE`.
- Mobile devices on a LAN must use the machine’s LAN IP in `STORAGE_PUBLIC_BASE_URL`, not
  `localhost` (document in `local-dev.md`).
- A new `UPLOAD_INVALID` error covers wrong prefix, missing object, or type/size mismatch on
  attach.
