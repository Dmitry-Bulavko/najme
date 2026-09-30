# ADR-0014: Object storage

- Status: Accepted
- Date: 2026-09-30
- Amended: 2026-09-30 — Docker image source (Pigsty community MinIO)

## Context

Business logos, covers and staff photos must be uploaded from web and mobile without proxying
file bytes through the API. The database already stores object keys (`logoKey`, `coverKey`,
`photoKey`), never URLs. Production will use Lightsail object storage (bucket created in M7);
dev and CI need a local S3-compatible stand-in.

Upstream MinIO stopped publishing Docker Hub images; `minio/minio` and `minio/mc` return 404.
The last official Quay tags are frozen and miss later security fixes.

## Decision

- **S3-compatible storage** behind an abstract `ObjectStorage` seam. Production uses Lightsail
  Object Storage; **MinIO** (via the maintained Pigsty community image
  `pgsty/minio:RELEASE.2026-06-18T00-00-00Z`) runs in `compose.dev.yml` and CI. Clients never talk
  to a Najme-specific upload protocol — only standard S3 presigned POST.
- Bucket / policy init is a small Node script (`apps/api/scripts/storage-init.mjs`) on
  `@aws-sdk/client-s3`, shared by compose `minio-init` and CI — no separate `mc` image. CORS for
  browser uploads is set on the server via `MINIO_API_CORS_ALLOW_ORIGIN` (`PutBucketCors` is not
  implemented on the Pigsty image).
- **Keys:** `businesses/<businessId>/<logo|cover|staff>/<uuidv7>.<ext>` where `ext` is derived
  from the declared `contentType` (`jpg` / `png` / `webp`).
- **Presigned POST** (not PUT): policy pins the object key and `Content-Type`, enforces
  `content-length-range` 1…5 MiB, expires in 10 minutes. jpeg / png / webp only. CI proves policy
  enforcement with negative POSTs (wrong type / oversized → 403 from storage).
- **Public read** via `STORAGE_PUBLIC_BASE_URL` (path-style for MinIO:
  `{base}/{key}`). API responses expose absolute `logoUrl` / `coverUrl` / `photoUrl` or `null`.
- **No server-side resize**; clients downscale before upload. Orphan cleanup is deferred.
- **Lazy client:** constructing `S3ObjectStorage` must not open a network connection at Nest
  bootstrap, so the API smoke check still passes when MinIO is down.
- **Attach / delete:** after a successful browser upload, `PUT` endpoints verify the object with
  `HeadObject` (type + size + extension match) under the strict key shape, then store the key.
  Replacing a photo deletes the previous object best-effort when no other row still references it.
  A staff photo key already attached to another member is rejected (`UPLOAD_INVALID`).

## Consequences

- Required env: `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`,
  `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_BASE_URL`,
  `STORAGE_FORCE_PATH_STYLE` — wired through compose.prod, smoke, deploy.yml and deploy.md.
- Mobile devices on a LAN must use the machine’s LAN IP in **both** `STORAGE_ENDPOINT` (presign
  URL) and `STORAGE_PUBLIC_BASE_URL`, not `localhost` (document in `local-dev.md`).
- A new `UPLOAD_INVALID` error covers wrong prefix, missing object, shared staff key, or
  type/size mismatch on attach.
