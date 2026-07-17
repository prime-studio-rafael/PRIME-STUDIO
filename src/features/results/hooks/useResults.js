import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteResult, fetchResult, fetchResults, updateResultStatus } from '../api/resultsClient.js';
const REVIEW_MESSAGE_TIMEOUT_MS = 5000;
export default function useResults(enabled) {
  const [results, setResults] = useState([]); const [status, setStatus] = useState('idle'); const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); const [mutationPending, setMutationPending] = useState(false);
  const [reviewMessage, setReviewMessage] = useState(''); const reviewMessageTimer = useRef(null);
  const load = useCallback(async () => { setStatus('loading'); setError(''); try { setResults(await fetchResults()); setStatus('ready'); } catch (nextError) { setError(nextError.message || 'Não foi possível carregar os resultados locais.'); setStatus('error'); throw nextError; } }, []);
  useEffect(() => { if (enabled && status === 'idle') load().catch(() => {}); }, [enabled, load, status]);
  useEffect(() => () => { if (reviewMessageTimer.current) clearTimeout(reviewMessageTimer.current); }, []);
  const dismissReviewMessage = useCallback(() => { if (reviewMessageTimer.current) clearTimeout(reviewMessageTimer.current); setReviewMessage(''); }, []);
  const open = useCallback(async (id) => { setError(''); dismissReviewMessage(); try { const detail = await fetchResult(id); setSelected(detail); return detail; } catch (nextError) { setError(nextError.message); throw nextError; } }, [dismissReviewMessage]);
  const close = useCallback(() => { setSelected(null); }, []);
  const setReviewStatus = useCallback(async (id, reviewStatus) => { setMutationPending(true); setError(''); try { const updated = await updateResultStatus(id, reviewStatus); setResults((current) => current.map((result) => result.id === id ? updated : result)); setSelected((current) => current?.id === id ? updated : current); return updated; } catch (nextError) { setError(nextError.message); throw nextError; } finally { setMutationPending(false); } }, []);
  const reviewAndAdvance = useCallback(async (id, reviewStatus) => {
    setMutationPending(true); setError('');
    try {
      await updateResultStatus(id, reviewStatus);
      const freshList = await fetchResults();
      setResults(freshList);
      const currentIndex = freshList.findIndex((result) => result.id === id);
      const next = freshList.slice(currentIndex + 1).find((result) => result.reviewStatus === 'pending');
      if (next) {
        setSelected(next);
      } else {
        setSelected(null);
        if (reviewMessageTimer.current) clearTimeout(reviewMessageTimer.current);
        setReviewMessage('Revisão concluída. Não há mais resultados pendentes.');
        reviewMessageTimer.current = setTimeout(() => setReviewMessage(''), REVIEW_MESSAGE_TIMEOUT_MS);
      }
    } catch (nextError) {
      setError(nextError.message);
      throw nextError;
    } finally { setMutationPending(false); }
  }, []);
  const remove = useCallback(async (id) => { setMutationPending(true); setError(''); try { await deleteResult(id); setResults((current) => current.filter((result) => result.id !== id)); setSelected(null); } catch (nextError) { setError(nextError.message); throw nextError; } finally { setMutationPending(false); } }, []);
  return { results, status, error, selected, mutationPending, reviewMessage, load, open, close, setReviewStatus, reviewAndAdvance, dismissReviewMessage, remove };
}
