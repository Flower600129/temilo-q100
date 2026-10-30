import { useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/components/screen-frame';
import { FormError } from '@/components/form-parts';
import { colors, serif } from '@/ui/theme';
import { copy } from '@/ui/copy';
export function ConfirmAction({ label, title, description, confirmLabel = copy.confirmDelete, onConfirm, onComplete }: {
  label: string; title: string; description: string; confirmLabel?: string; onConfirm: () => Promise<void>; onComplete?: () => void;
}) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  async function confirm() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try { await onConfirm(); setOpen(false); onComplete?.(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not complete this action. Try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <><ActionButton label={label} secondary onPress={() => { setError(null); setOpen(true); }} />
    <ConfirmDialog open={open} title={title} description={description} confirmLabel={confirmLabel} busy={busy} error={error}
      onConfirm={() => void confirm()} onCancel={() => setOpen(false)} /></>;
}

// Standalone confirmation dialog for decisions raised by the page itself
// (for example leaving a task with unsaved candidate edits).
export function ConfirmDialog({ open, title, description, confirmLabel, busy = false, error = null, onConfirm, onCancel }: {
  open: boolean; title: string; description: string; confirmLabel: string; busy?: boolean; error?: string | null; onConfirm: () => void; onCancel: () => void;
}) {
  return <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) onCancel(); }}>
    <View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.body}>{description}</Text>
      <FormError error={error} />
      <ActionButton label={busy ? copy.saving : confirmLabel} disabled={busy} onPress={onConfirm} />
      <ActionButton label={copy.cancel} secondary disabled={busy} onPress={onCancel} />
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center', padding: 22 },
  dialog: { width: '100%', maxWidth: 430, backgroundColor: colors.paper, borderRadius: 18, padding: 24, gap: 18 },
  title: { fontFamily: serif, fontSize: 27, color: colors.ink }, body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
});
