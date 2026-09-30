# #76 — Add S3-compatible object storage and photo uploads

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/76
- Status: Implemented
- Related: ADR-0014, `docs/architecture/data-model.md` (Photo keys), #74

## Goal

Presigned uploads to S3-compatible storage (MinIO in dev/CI, Lightsail later). API stores keys,
exposes absolute URLs, validates attach with `HeadObject`.

## Approach

- Abstract `ObjectStorage` (Mailer pattern) + `S3ObjectStorage` via `@aws-sdk/client-s3` and
  `@aws-sdk/s3-presigned-post`; `FakeObjectStorage` for most e2e.
- Lazy S3 client construction so API boot does not require MinIO.
- MinIO + `minio-init` in `compose.dev.yml`; CI `ci` job gets a MinIO service and one real
  presigned-POST integration test.

## Changes

| Area / path        | Change                                                  |
| ------------------ | ------------------------------------------------------- |
| ADR-0014           | Object storage decision                                 |
| contracts          | upload schemas; `UPLOAD_INVALID`                        |
| api `storage/`     | ObjectStorage seam, S3 + fake, uploads controller       |
| businesses / staff | attach/delete logo, cover, photo; derive URLs from keys |
| compose / CI / env | MinIO; `STORAGE_*`                                      |
| i18n               | `errors.UPLOAD_INVALID`                                 |

### Contracts / API

- `POST /businesses/:businessId/uploads` `{kind, contentType, contentLength}` →
  `{key, url, fields, expiresAt}` (OWNER/ADMIN).
- `PUT` / `DELETE` `/businesses/:businessId/logo|cover` and
  `/businesses/:businessId/staff/:staffId/photo` with `{key}` on PUT.
- Kinds: `LOGO` | `COVER` | `STAFF_PHOTO`. Content types: jpeg/png/webp; length 1…5 MB.

### Data model

No schema change — keys already exist. Responses map keys → absolute URLs.

## Test plan

- Unit: key builder, content-type → ext, URL join; FakeObjectStorage.
- e2e: fake storage — presign shape, attach happy path, wrong prefix → 422, delete clears URL.
- Integration (CI + local MinIO): real presigned POST + attach + public GET 200.

## Risks and open questions

- Production bucket credentials arrive in M7; local/CI use MinIO defaults.

## Implementation notes

- `ObjectStorage` is provided by `StorageModule`; HTTP lives in `UploadsModule` to avoid a Nest
  cycle with `BusinessesModule`.
- CI starts MinIO with `docker run` (GitHub Actions service containers cannot pass `server /data`).
- Fake storage covers attach validation e2e; `uploads-minio.e2e-spec.ts` hits real MinIO when
  reachable (required in CI).
