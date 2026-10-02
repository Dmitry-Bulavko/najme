import {
  UPLOAD_MAX_BYTES,
  attachBusinessImageResponseSchema,
  attachStaffPhotoResponseSchema,
  attachUploadRequestSchema,
  createUploadRequestSchema,
  createUploadResponseSchema,
  type UploadKind,
} from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Platform, StyleSheet, View } from 'react-native';

import { Banner, Button, Text, confirm } from '@/components/ui';
import { ApiError, apiRequest } from '@/lib/api/client';

export const IMAGE_MAX_EDGE_PX = 1600;
export const IMAGE_INPUT_MAX_BYTES = 25 * 1024 * 1024;

type LogoCoverKind = Extract<UploadKind, 'LOGO' | 'COVER'>;
type StaffPhotoKind = Extract<UploadKind, 'STAFF_PHOTO'>;

type BusinessImageUploadBase = {
  businessId: string;
  currentUrl: string | null;
  frame: 'square' | 'wide';
  readOnly?: boolean;
};

export type BusinessImageUploadProps =
  | (BusinessImageUploadBase & {
      kind: LogoCoverKind;
      staffId?: never;
      onChanged: (urls: { logoUrl?: string | null; coverUrl?: string | null }) => void;
    })
  | (BusinessImageUploadBase & {
      kind: StaffPhotoKind;
      staffId: string;
      onChanged: (urls: { photoUrl?: string | null }) => void;
    });

function attachPath(businessId: string, kind: UploadKind, staffId?: string): string {
  if (kind === 'LOGO') return `/businesses/${businessId}/logo`;
  if (kind === 'COVER') return `/businesses/${businessId}/cover`;
  if (!staffId) {
    throw new Error('staffId is required for STAFF_PHOTO');
  }
  return `/businesses/${businessId}/staff/${staffId}/photo`;
}

/**
 * Posts a local JPEG to the S3-compatible presigned POST URL (fields before file).
 */
export function uploadPresignedPost(
  url: string,
  fields: Record<string, string>,
  file: { uri: string; name: string; type: string },
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }
    // React Native FormData file part — uri/name/type shape required by the bridge.
    form.append('file', file as unknown as Blob);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = 60_000;
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error('UPLOAD_STORAGE'));
    };
    xhr.onerror = () => reject(new Error('UPLOAD_NETWORK'));
    xhr.ontimeout = () => reject(new Error('UPLOAD_NETWORK'));
    xhr.send(form);
  });
}

type ManipulatedImage = { uri: string; width: number; height: number };

async function compressJpeg(
  uri: string,
  needsResize: boolean,
  width: number,
  height: number,
  quality: number,
): Promise<ManipulatedImage> {
  let context = ImageManipulator.manipulate(uri);
  if (needsResize) {
    context = context.resize(
      width >= height ? { width: IMAGE_MAX_EDGE_PX } : { height: IMAGE_MAX_EDGE_PX },
    );
  }
  const imageRef = await context.renderAsync();
  return imageRef.saveAsync({ compress: quality, format: SaveFormat.JPEG });
}

/**
 * Logo/cover/staff-photo picker: gallery → resize ≤1600 px JPEG → presign → attach.
 * On Expo web export, preview stays visible; edit actions are hidden (no reliable native picker).
 */
export function BusinessImageUpload(props: BusinessImageUploadProps): ReactElement {
  const { businessId, kind, currentUrl, frame, readOnly = false, onChanged } = props;
  const staffId = kind === 'STAFF_PHOTO' ? props.staffId : undefined;
  const { t } = useTranslation(['business', 'common', 'errors']);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const label =
    kind === 'LOGO'
      ? t('business:upload.logo')
      : kind === 'COVER'
        ? t('business:upload.cover')
        : t('business:upload.photo');
  const canEdit = !readOnly && Platform.OS !== 'web';

  async function pickAndUpload(): Promise<void> {
    setMessage(null);

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: false,
    });
    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];
    if (asset.fileSize != null && asset.fileSize > IMAGE_INPUT_MAX_BYTES) {
      setMessage({
        tone: 'error',
        text: t('business:upload.invalidSize', {
          maxMb: Math.floor(IMAGE_INPUT_MAX_BYTES / (1024 * 1024)),
        }),
      });
      return;
    }

    setBusy(true);
    setProgress(0);
    try {
      const width = asset.width ?? IMAGE_MAX_EDGE_PX;
      const height = asset.height ?? IMAGE_MAX_EDGE_PX;
      const longest = Math.max(width, height);
      const needsResize = longest > IMAGE_MAX_EDGE_PX;

      let quality = 0.85;
      let manipulated = await compressJpeg(asset.uri, needsResize, width, height, quality);

      // Re-compress if still over the API max (best-effort; size from fetch blob when available).
      let blobSize = await probeUriSize(manipulated.uri);
      while (blobSize != null && blobSize > UPLOAD_MAX_BYTES && quality > 0.4) {
        quality -= 0.15;
        manipulated = await compressJpeg(asset.uri, needsResize, width, height, quality);
        blobSize = await probeUriSize(manipulated.uri);
      }
      if (blobSize != null && blobSize > UPLOAD_MAX_BYTES) {
        setMessage({
          tone: 'error',
          text: t('business:upload.invalidSize', {
            maxMb: Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024)),
          }),
        });
        return;
      }

      const contentLength = blobSize ?? UPLOAD_MAX_BYTES;
      const createBody = createUploadRequestSchema.parse({
        kind,
        contentType: 'image/jpeg',
        contentLength,
      });
      const rawPresign = await apiRequest<unknown>(`/businesses/${businessId}/uploads`, {
        method: 'POST',
        body: createBody,
      });
      const presign = createUploadResponseSchema.parse(rawPresign);
      await uploadPresignedPost(
        presign.url,
        presign.fields,
        { uri: manipulated.uri, name: 'upload.jpg', type: 'image/jpeg' },
        setProgress,
      );
      const attachBody = attachUploadRequestSchema.parse({ key: presign.key });
      const rawAttach = await apiRequest<unknown>(attachPath(businessId, kind, staffId), {
        method: 'PUT',
        body: attachBody,
      });
      if (kind === 'STAFF_PHOTO') {
        const attached = attachStaffPhotoResponseSchema.parse(rawAttach);
        (onChanged as (urls: { photoUrl?: string | null }) => void)({
          photoUrl: attached.photoUrl,
        });
      } else {
        const attached = attachBusinessImageResponseSchema.parse(rawAttach);
        (onChanged as (urls: { logoUrl?: string | null; coverUrl?: string | null }) => void)({
          logoUrl: attached.logoUrl,
          coverUrl: attached.coverUrl,
        });
      }
      setMessage({ tone: 'success', text: t('business:upload.success') });
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === 'UPLOAD_STORAGE' || err.message === 'UPLOAD_NETWORK')
      ) {
        setMessage({
          tone: 'error',
          text: t(
            err.message === 'UPLOAD_STORAGE' ? 'errors:UPLOAD_INVALID' : 'errors:INTERNAL_ERROR',
          ),
        });
      } else if (err instanceof ApiError) {
        setMessage({
          tone: 'error',
          text: t(`errors:${err.code}`, { defaultValue: t('errors:HTTP_ERROR') }),
        });
      } else {
        setMessage({ tone: 'error', text: t('errors:INTERNAL_ERROR') });
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function removeImage(): Promise<void> {
    const ok = await confirm({
      title: t('business:upload.removeNamed', { label }),
      confirmLabel: t('business:upload.remove'),
      cancelLabel: t('common:actions.cancel'),
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      if (kind === 'STAFF_PHOTO') {
        await apiRequest<unknown>(attachPath(businessId, kind, staffId), { method: 'DELETE' });
        (onChanged as (urls: { photoUrl?: string | null }) => void)({ photoUrl: null });
      } else {
        const raw = await apiRequest<unknown>(attachPath(businessId, kind, staffId), {
          method: 'DELETE',
        });
        const attached = attachBusinessImageResponseSchema.parse(raw);
        (onChanged as (urls: { logoUrl?: string | null; coverUrl?: string | null }) => void)({
          logoUrl: attached.logoUrl,
          coverUrl: attached.coverUrl,
        });
      }
      setMessage({ tone: 'success', text: t('business:upload.removed') });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setMessage({
        tone: 'error',
        text: t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root} testID={`upload-${kind.toLowerCase()}`}>
      <Text variant="caption" color="text02">
        {label}
      </Text>
      <View style={[styles.frame, frame === 'wide' ? styles.wide : styles.square]}>
        {currentUrl ? (
          <Image
            source={{ uri: currentUrl }}
            style={styles.image}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text variant="caption" color="text03">
            {t('business:upload.empty')}
          </Text>
        )}
      </View>
      {message ? <Banner tone={message.tone} message={message.text} /> : null}
      {progress != null ? (
        <Text variant="caption" color="text03">
          {t('business:upload.uploading', { percent: progress })}
        </Text>
      ) : null}
      {canEdit ? (
        <View style={styles.actions}>
          <Button
            label={
              currentUrl
                ? t('business:upload.replaceNamed', { label })
                : t('business:upload.chooseNamed', { label })
            }
            variant="secondary"
            loading={busy}
            onPress={() => void pickAndUpload()}
          />
          {currentUrl ? (
            <Button
              label={t('business:upload.removeNamed', { label })}
              variant="ghost"
              disabled={busy}
              onPress={() => void removeImage()}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

async function probeUriSize(uri: string): Promise<number | null> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return blob.size;
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing.sm },
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.secondary,
    borderRadius: tokens.radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.base04,
  },
  square: { width: 120, height: 120 },
  wide: { width: '100%', aspectRatio: 16 / 9 },
  image: { width: '100%', height: '100%' },
  actions: { gap: tokens.spacing.sm },
});
