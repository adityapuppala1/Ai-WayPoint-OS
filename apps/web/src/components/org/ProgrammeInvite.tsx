'use client';

import { Button, ConfirmDialog, LinkButton, toast } from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { api, problemKey } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import styles from './org.module.css';

/** The ways to bring people in: link, code, a ready-made message, a poster, the QR code. */
export function ProgrammeInvite({
  orgId,
  programmeId,
  programme,
  organisation,
  joinCode,
  joinCodeDisplay,
  joinUrl,
  k,
  canManage,
  closed,
  qr,
}: {
  orgId: string;
  programmeId: string;
  programme: string;
  organisation: string;
  joinCode: string;
  joinCodeDisplay: string;
  joinUrl: string;
  k: number;
  canManage: boolean;
  closed: boolean;
  qr: ReactNode;
}) {
  const t = useTranslations('org');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  const copy = async (text: string, done: string) => {
    toast(
      (await copyText(text))
        ? { title: done, tone: 'safe' }
        : { title: errors('generic'), tone: 'danger' },
      2500,
    );
  };

  return (
    <div className={styles.invite}>
      <div className={styles.inviteText}>
        <div>
          <p className="wp-meta">{t('joinCode')}</p>
          <span className={styles.bigCode} data-testid="join-code">
            {joinCodeDisplay}
          </span>
        </div>
        <div className={styles.linkBox}>
          <p className="wp-meta">{t('joinLink')}</p>
          <p className={styles.linkValue} dir="ltr">
            {joinUrl}
          </p>
        </div>
        {closed ? null : (
          <div className="wp-row">
            <Button
              variant="primary"
              icon="link"
              onPress={() => void copy(joinUrl, t('linkCopied'))}
            >
              {t('copyLink')}
            </Button>
            <Button
              variant="secondary"
              icon="copy"
              onPress={() =>
                void copy(
                  t('inviteMessage', {
                    programme,
                    organisation,
                    link: joinUrl,
                    code: joinCodeDisplay,
                    k,
                  }),
                  t('messageCopied'),
                )
              }
            >
              {t('copyMessage')}
            </Button>
            <Button
              variant="quiet"
              icon="ticket"
              onPress={() => void copy(joinCodeDisplay, t('codeCopied'))}
            >
              {t('copyCode')}
            </Button>
            <LinkButton
              variant="quiet"
              icon="print"
              href={`/poster/${joinCode}` as Route}
              target="_blank"
            >
              {t('printPoster')}
            </LinkButton>
            {canManage ? (
              <Button variant="quiet" icon="retry" onPress={() => setConfirm(true)}>
                {t('newCode')}
              </Button>
            ) : null}
          </div>
        )}
      </div>
      {closed ? null : qr}

      <ConfirmDialog
        isOpen={confirm}
        onOpenChange={setConfirm}
        title={t('newCodeTitle')}
        confirmLabel={t('newCodeConfirm')}
        cancelLabel={common('cancel')}
        tone="primary"
        onConfirm={async () => {
          try {
            await api(`/api/org/${orgId}/programmes/${programmeId}/code`, { method: 'POST' });
          } catch (err) {
            toast({ title: errors(problemKey(err)), tone: 'danger' });
            throw err;
          }
          toast({ title: t('newCodeDone'), tone: 'safe' }, 2500);
          router.refresh();
        }}
      >
        <p>{t('newCodeBody')}</p>
      </ConfirmDialog>
    </div>
  );
}
