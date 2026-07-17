import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from '../utils/toast';

/**
 * Fetch local and cloud draft payload for a given key, picking the latest.
 */
export async function fetchDraftPayload(draftKey) {
  if (!draftKey) return null;
  let localPayload = null;
  try {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      localPayload = JSON.parse(saved);
    }
  } catch (err) {
    console.error('Error reading local draft:', err);
  }

  if (!navigator.onLine) return localPayload;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      const { data: cloudRes, error } = await supabase
        .from('form_drafts')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('draft_key', draftKey)
        .maybeSingle();

      if (!error && cloudRes && cloudRes.data) {
        const cloudTimestamp = new Date(cloudRes.updated_at).getTime();
        const localTimestamp = localPayload?.timestamp || 0;
        if (cloudTimestamp > localTimestamp || !localPayload) {
          const cloudPayload = {
            data: cloudRes.data,
            extraMeta: cloudRes.extra_meta || {},
            timestamp: cloudTimestamp,
            fromCloud: true
          };
          localStorage.setItem(draftKey, JSON.stringify(cloudPayload));
          return cloudPayload;
        }
      }
    }
  } catch (err) {
    console.error('Error fetching cloud draft:', err);
  }

  return localPayload;
}

/**
 * Custom hook to manage form draft persistence in localStorage & Supabase cloud, and auto-save on offline events.
 * 
 * @param {string} draftKey - Unique key namespace for storing draft in localStorage & cloud.
 * @param {Object|Function} initialFormState - Initial state of the form.
 * @returns {Object} Draft utilities and form state management.
 */
export default function useFormDraft(draftKey, initialFormState) {
  const [form, setForm] = useState(initialFormState);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftInfo, setDraftInfo] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Keep a ref to current form state & initial state so offline listener can access latest values
  const formRef = useRef(form);
  const initialFormRef = useRef(initialFormState);
  const extraMetaRef = useRef({});

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  // Helper to check if current form has meaningful changes compared to initial state
  const isFormDirty = useCallback((currentForm) => {
    if (!currentForm) return false;
    const initial = typeof initialFormRef.current === 'function' 
      ? initialFormRef.current() 
      : initialFormRef.current;
    try {
      return JSON.stringify(currentForm) !== JSON.stringify(initial);
    } catch {
      return true;
    }
  }, []);

  // Check localStorage and cloud for existing draft
  const checkDraft = useCallback(async (syncOnly = false) => {
    if (!draftKey) return null;
    let localPayload = null;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.data) {
          setHasDraft(true);
          setDraftInfo(parsed);
          localPayload = parsed;
        }
      }
    } catch (err) {
      console.error('Error reading draft from localStorage:', err);
    }

    if (!localPayload) {
      setHasDraft(false);
      setDraftInfo(null);
    }

    if (syncOnly || !navigator.onLine) return localPayload;

    // Async cloud check
    try {
      const cloudPayload = await fetchDraftPayload(draftKey);
      if (cloudPayload && cloudPayload.data) {
        setHasDraft(true);
        setDraftInfo(cloudPayload);
        return cloudPayload;
      }
    } catch (err) {
      console.error('Error checking cloud draft inside hook:', err);
    }

    return localPayload;
  }, [draftKey]);

  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (mounted) checkDraft();
    });
    return () => { mounted = false; };
  }, [checkDraft]);

  // Save current or provided form state as draft (local + cloud)
  const saveDraft = useCallback((formDataOverride = null, extraMeta = {}, notify = true) => {
    if (!draftKey) return false;
    const dataToSave = formDataOverride || formRef.current;
    extraMetaRef.current = extraMeta;

    // Don't save if empty/identical to initial state unless forced
    if (!formDataOverride && !isFormDirty(dataToSave)) {
      return false;
    }

    const timestamp = Date.now();
    const draftPayload = {
      data: dataToSave,
      extraMeta: extraMeta,
      timestamp: timestamp,
    };

    try {
      localStorage.setItem(draftKey, JSON.stringify(draftPayload));
      setHasDraft(true);
      setDraftInfo(draftPayload);
    } catch (err) {
      console.error('Error saving draft to localStorage:', err);
      return false;
    }

    // Background cloud upsert when online
    if (navigator.onLine) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) {
          supabase.from('form_drafts').upsert({
            user_id: session.user.id,
            draft_key: draftKey,
            data: dataToSave,
            extra_meta: extraMeta,
            updated_at: new Date(timestamp).toISOString()
          }, { onConflict: 'user_id, draft_key' }).then(({ error }) => {
            if (error) console.error('Error syncing draft to cloud:', error);
          });
        }
      }).catch(err => console.error('Error getting session for cloud draft:', err));
    }

    if (notify) {
      toast.draft('Record saved as draft', 'Your form entries have been saved locally and backed up to the cloud.');
    }

    return true;
  }, [draftKey, isFormDirty]);

  // Restore draft into form state
  const restoreDraft = useCallback((onRestoreExtraMeta = null, notify = true) => {
    if (!draftInfo || !draftInfo.data) {
      // If sync read hasn't settled or state is empty, read from local synchronously
      try {
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.data) {
            setForm(parsed.data);
            if (typeof onRestoreExtraMeta === 'function' && parsed.extraMeta) {
              onRestoreExtraMeta(parsed.extraMeta);
            }
            if (notify) {
              toast.success('Draft restored', 'We loaded your previously saved form entries.');
            }
            return true;
          }
        }
      } catch (err) {
        console.error('Error in synchronous restore:', err);
      }
      return false;
    }

    if (draftInfo && draftInfo.data) {
      setForm(draftInfo.data);
      if (typeof onRestoreExtraMeta === 'function' && draftInfo.extraMeta) {
        onRestoreExtraMeta(draftInfo.extraMeta);
      }
      if (notify) {
        toast.success('Draft restored', 'We loaded your previously saved form entries.');
      }
      return true;
    }
    return false;
  }, [draftInfo, draftKey]);

  // Clear draft from localStorage, cloud, and state
  const clearDraft = useCallback((notify = false) => {
    if (!draftKey) return;
    try {
      localStorage.removeItem(draftKey);
    } catch (err) {
      console.error('Error clearing draft from localStorage:', err);
    }
    setHasDraft(false);
    setDraftInfo(null);

    if (navigator.onLine) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) {
          supabase.from('form_drafts').delete()
            .eq('user_id', session.user.id)
            .eq('draft_key', draftKey)
            .then(({ error }) => {
              if (error) console.error('Error deleting cloud draft:', error);
            });
        }
      }).catch(err => console.error('Error clearing cloud draft:', err));
    }

    if (notify) {
      toast.info('Draft discarded', 'Saved form entries have been cleared.');
    }
  }, [draftKey]);

  // Offline/Online status detection & auto-save on network drop
  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      // Auto-save immediately when network drops if form is dirty
      if (isFormDirty(formRef.current)) {
        saveDraft(formRef.current, extraMetaRef.current, false);
      }
    };

    const handleOnline = () => {
      setIsOffline(false);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [saveDraft, isFormDirty]);

  // Reset form to initial state
  const resetForm = useCallback((newInitialState = null) => {
    const nextInitial = newInitialState || (typeof initialFormRef.current === 'function'
      ? initialFormRef.current()
      : initialFormRef.current);
    if (newInitialState) {
      initialFormRef.current = newInitialState;
    }
    setForm(nextInitial);
  }, []);

  return {
    form,
    setForm,
    resetForm,
    hasDraft,
    draftInfo,
    saveDraft,
    restoreDraft,
    clearDraft,
    checkDraft,
    isOffline,
  };
}

