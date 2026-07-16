import { useCallback, useEffect, useRef, useState } from 'react';
import { generateImage } from '../api/generationClient.js';

export default function useGeneration() {
  const [state, setState] = useState({ status: 'idle', result: null, error: null, referenceSnapshot: null });
  const busyRef = useRef(false);
  const snapshotUrlRef = useRef(null);

  const releaseSnapshotUrl = useCallback(() => {
    if (snapshotUrlRef.current) {
      URL.revokeObjectURL(snapshotUrlRef.current);
      snapshotUrlRef.current = null;
    }
  }, []);

  useEffect(() => releaseSnapshotUrl, [releaseSnapshotUrl]);

  const generate = useCallback(async (input) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    releaseSnapshotUrl();
    const referenceSnapshot = createReferenceSnapshot(input);
    snapshotUrlRef.current = referenceSnapshot?.garment.previewUrl || null;
    setState({ status: 'preparing', result: null, error: null, referenceSnapshot });

    try {
      setState((current) => ({ ...current, status: 'generating' }));
      const result = await generateImage(input);
      setState({ status: 'success', result, error: null, referenceSnapshot });
      return result;
    } catch (error) {
      releaseSnapshotUrl();
      setState({ status: 'error', result: null, error, referenceSnapshot: null });
      return null;
    } finally {
      busyRef.current = false;
    }
  }, [releaseSnapshotUrl]);

  const reset = useCallback(() => {
    if (busyRef.current) return;
    releaseSnapshotUrl();
    setState({ status: 'idle', result: null, error: null, referenceSnapshot: null });
  }, [releaseSnapshotUrl]);

  return { ...state, generate, reset };
}

function createReferenceSnapshot({ template, garmentFile, garmentAssessment }) {
  if (!template || !garmentFile) return null;
  const previewUrl = URL.createObjectURL(garmentFile);

  return Object.freeze({
    startedAt: new Date().toISOString(),
    template: Object.freeze({
      id: template.id,
      label: template.label,
      publicUrl: template.publicUrl,
      mimeType: template.mimeType || null,
      width: template.width ?? null,
      height: template.height ?? null,
      aspectRatio: template.aspectRatio ?? null,
      quality: template.quality ?? null,
      warnings: Object.freeze([...(template.warnings || [])]),
    }),
    garment: Object.freeze({
      previewUrl,
      name: garmentFile.name,
      mimeType: garmentFile.type,
      sizeBytes: garmentFile.size,
      width: garmentAssessment?.inspection?.width ?? null,
      height: garmentAssessment?.inspection?.height ?? null,
      realFormat: garmentAssessment?.inspection?.format ?? null,
      aspectRatio: garmentAssessment?.inspection?.aspectRatio ?? null,
      orientation: garmentAssessment?.inspection?.orientation ?? null,
      quality: garmentAssessment?.quality ?? null,
      warnings: Object.freeze([...(garmentAssessment?.warnings || [])]),
    }),
  });
}
