import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useNavigation } from 'expo-router';
import { useIsFocused, usePreventRemove } from '@react-navigation/native';
import { ConfirmDialog } from '@/components/confirm-action';
import { usePageActions } from '@/context/page-actions';
import { copy } from '@/ui/copy';

// One real dirty predicate per editor. Successful save or an explicit transfer
// to an in-memory gift draft may authorize navigation; failed writes cannot.
export function useUnsavedChanges(dirty: boolean) {
  const navigation = useNavigation(); const focused = useIsFocused();
  const actions = usePageActions();
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [replay, setReplay] = useState<(() => void) | null>(null);
  const enabled = dirty && focused && !authorized;
  const allowNavigation = (action: () => void) => { setAuthorized(true); setReplay(() => action); };
  const requestLeave = (action: () => void) => { if (enabled) setPending(() => action); else action(); };
  const current = useRef({ requestLeave }); current.current = { requestLeave };
  usePreventRemove(enabled, ({ data }) => { setPending(() => () => navigation.dispatch(data.action)); });
  useEffect(() => { if (focused) setAuthorized(false); }, [focused]);
  useEffect(() => { if (authorized && replay) { setReplay(null); replay(); } }, [authorized, replay]);
  const leave = actions?.leave;
  useEffect(() => {
    if (!focused || !leave) return;
    const handler = (action: () => void) => current.current.requestLeave(action);
    leave.current = handler;
    return () => { if (leave.current === handler) leave.current = null; };
  }, [focused, leave]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [enabled]);
  return { allowNavigation, requestLeave, dialog: <ConfirmDialog open={Boolean(pending)} title={copy.leaveTitle}
    description={copy.leaveDescription} confirmLabel={copy.discard} onCancel={() => setPending(null)}
    onConfirm={() => { const action = pending; setPending(null); if (action) allowNavigation(action); }} /> };
}
