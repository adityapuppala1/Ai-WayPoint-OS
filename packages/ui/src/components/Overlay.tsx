'use client';

import { type ReactNode, useState } from 'react';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { cn } from '../cn';
import { Button } from './Button';
import { TextField } from './Field';
import { IconButton } from './IconButton';
import styles from './Overlay.module.css';

export interface DialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /**
   * `sheet` slides from the bottom (phones) or end edge (desktop). `palette` is for a field
   * with a list that grows and shrinks under it: a sheet resting on the keyboard on phones,
   * a box near the top of the screen on larger ones, so it stays put while the list changes.
   */
  variant?: 'modal' | 'sheet' | 'palette';
  /** Destructive or blocking dialogs should not close on outside click. */
  isDismissable?: boolean;
  role?: 'dialog' | 'alertdialog';
  closeLabel?: string;
}

export function Dialog({
  isOpen,
  onOpenChange,
  title,
  children,
  footer,
  variant = 'modal',
  isDismissable = true,
  role = 'dialog',
  closeLabel = 'Close',
}: DialogProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className={cn(
        styles.overlay,
        variant === 'sheet' && styles.sheetOverlay,
        variant === 'palette' && styles.paletteOverlay,
      )}
    >
      <Modal
        className={cn(
          styles.modal,
          variant === 'sheet' && styles.sheet,
          variant === 'palette' && styles.palette,
        )}
      >
        <AriaDialog className={styles.dialog} role={role}>
          {({ close }) => (
            <>
              <div className={styles.head}>
                <Heading slot="title" className={styles.title}>
                  {title}
                </Heading>
                {isDismissable ? (
                  <IconButton icon="close" label={closeLabel} onPress={close} tooltip={false} />
                ) : null}
              </div>
              {children ? <div className={styles.body}>{children}</div> : null}
              {footer ? <div className={styles.footer}>{footer}</div> : null}
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children?: ReactNode;
  /** Verb-first, names the thing: "Delete my account". */
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  /** For irreversible actions: the person types this word to enable the button. */
  confirmWord?: string;
  confirmWordLabel?: ReactNode;
  tone?: 'danger' | 'primary';
}

/**
 * Destructive confirmation that names the consequence and, for irreversible actions, asks for a
 * typed word. Closes itself once `onConfirm` resolves; if it throws, the dialog stays open so the
 * person can try again or cancel (report the problem from `onConfirm`, e.g. with a toast).
 */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  confirmWord,
  confirmWordLabel,
  tone = 'danger',
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = !confirmWord || typed.trim().toLowerCase() === confirmWord.toLowerCase();
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(o) => {
        if (!o) setTyped('');
        onOpenChange(o);
      }}
      title={title}
      role="alertdialog"
      isDismissable={!busy}
      footer={
        <>
          <Button variant="secondary" onPress={() => onOpenChange(false)} isDisabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            isDisabled={!ready}
            isBusy={busy}
            onPress={async () => {
              setBusy(true);
              let ok = false;
              try {
                await onConfirm();
                ok = true;
              } catch {
                // Stay open: the caller has reported what went wrong.
              } finally {
                setBusy(false);
              }
              if (ok) {
                setTyped('');
                onOpenChange(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="wp-stack">
        {children}
        {confirmWord ? (
          <TextField
            label={confirmWordLabel ?? confirmWord}
            value={typed}
            onChange={setTyped}
            autoComplete="off"
          />
        ) : null}
      </div>
    </Dialog>
  );
}
