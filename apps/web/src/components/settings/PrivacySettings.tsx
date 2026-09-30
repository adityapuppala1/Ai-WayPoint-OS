'use client';

import type { Consents, MyProgrammes, TrustedContact } from '@waypoint/api/client';
import {
  Button,
  ConfirmDialog,
  IconButton,
  LinkButton,
  Panel,
  SelectField,
  Switch,
  TextField,
  toast,
} from '@waypoint/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ApiProblem, api } from '@/lib/api';
import { ALL_CONSENTS } from '@/lib/options';
import { ProgrammesPanel } from './ProgrammesPanel';
import styles from './settings.module.css';

export function PrivacySettings({
  consents: initial,
  contacts: initialContacts,
  retention,
  programmes,
  lostOrganisations,
}: {
  consents: Consents;
  contacts: TrustedContact[];
  retention: number | null;
  programmes: MyProgrammes;
  /** Organisations with no other owner or admin: deleting the account deletes them too. */
  lostOrganisations: string[];
}) {
  const t = useTranslations('settings');
  const c = useTranslations('consents');
  const common = useTranslations('common');
  const errors = useTranslations('errors');
  const router = useRouter();
  const [consents, setConsents] = useState(initial);
  const [contacts, setContacts] = useState(initialContacts);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', relation: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmChats, setConfirmChats] = useState(false);
  const [confirmAccount, setConfirmAccount] = useState(false);

  const toggle = async (purpose: (typeof ALL_CONSENTS)[number], granted: boolean) => {
    setConsents((cur) => ({ ...cur, [purpose]: granted }));
    try {
      const next = await api<Consents>('/api/me/consents', {
        method: 'PUT',
        json: { [purpose]: granted },
      });
      setConsents(next);
      toast({ title: t('consentSaved'), tone: 'safe' }, 2000);
      router.refresh();
    } catch {
      setConsents((cur) => ({ ...cur, [purpose]: !granted }));
      toast({ title: errors('generic'), tone: 'danger' });
    }
  };

  const addContact = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      const created = await api<TrustedContact>('/api/me/trusted-contacts', {
        json: {
          name: form.name,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          relation: form.relation.trim() || undefined,
        },
      });
      setContacts((all) => [created, ...all]);
      setForm({ name: '', phone: '', email: '', relation: '' });
      setAdding(false);
    } catch (err) {
      setFormError(
        err instanceof ApiProblem ? (err.issues[0]?.message ?? err.message) : errors('generic'),
      );
    }
  };

  return (
    <div className={styles.stack}>
      <Panel title={t('consentsTitle')} as="section">
        <div className={styles.form}>
          {ALL_CONSENTS.map((purpose) => (
            <Switch
              key={purpose}
              isSelected={consents[purpose]}
              onChange={(v) => void toggle(purpose, v)}
              description={c(`${purpose}Hint`)}
            >
              {c(purpose)}
            </Switch>
          ))}
        </div>
      </Panel>

      <ProgrammesPanel
        programmes={programmes.programmes}
        countingAllowed={consents.org_aggregates}
      />

      <Panel title={t('trustedTitle')} description={t('trustedLead')} as="section" id="trusted">
        <div className={styles.form}>
          {contacts.length ? (
            <ul className={styles.contacts}>
              {contacts.map((ct) => (
                <li key={ct.id}>
                  <div>
                    <p className="wp-strong">{ct.name}</p>
                    <p className="wp-secondary">
                      {[ct.relation, ct.phone, ct.email].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <IconButton
                    icon="delete"
                    label={`${common('remove')}: ${ct.name}`}
                    onPress={async () => {
                      await api(`/api/me/trusted-contacts/${ct.id}`, { method: 'DELETE' }).catch(
                        () => undefined,
                      );
                      setContacts((all) => all.filter((x) => x.id !== ct.id));
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="wp-secondary">{t('trustedEmpty')}</p>
          )}
          {adding ? (
            <form className={styles.form} onSubmit={addContact}>
              <TextField
                label={t('trustedName')}
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                isRequired
                maxLength={60}
              />
              <div className={styles.pair}>
                <TextField
                  label={t('trustedPhone')}
                  type="tel"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  maxLength={20}
                />
                <TextField
                  label={t('trustedEmail')}
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  maxLength={120}
                />
              </div>
              <TextField
                label={t('trustedRelation')}
                optionalLabel={common('optional')}
                value={form.relation}
                onChange={(v) => setForm({ ...form, relation: v })}
                maxLength={40}
              />
              {formError ? (
                <p className="wp-secondary" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="wp-row">
                <Button
                  type="submit"
                  variant="primary"
                  isDisabled={!form.name.trim() || (!form.phone.trim() && !form.email.trim())}
                >
                  {common('save')}
                </Button>
                <Button variant="quiet" onPress={() => setAdding(false)}>
                  {common('cancel')}
                </Button>
              </div>
            </form>
          ) : contacts.length < 3 ? (
            <div>
              <Button variant="secondary" icon="add" onPress={() => setAdding(true)}>
                {t('trustedAdd')}
              </Button>
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel title={t('retentionTitle')} as="section">
        <SelectField
          label={t('retentionTitle')}
          selectedKey={retention === null ? 'forever' : String(retention)}
          onSelectionChange={async (k) => {
            const value = k === 'forever' ? null : Number(k);
            await api('/api/me/profile', {
              method: 'PATCH',
              json: { conversationRetentionDays: value },
            }).catch(() => undefined);
            toast({ title: t('saved'), tone: 'safe' }, 2000);
          }}
          options={[
            { id: '7', label: t('retention7') },
            { id: '30', label: t('retention30') },
            { id: '90', label: t('retention90') },
            { id: '365', label: t('retention365') },
            { id: 'forever', label: t('retentionForever') },
          ]}
        />
      </Panel>

      <Panel title={t('exportTitle')} description={t('exportBody')} as="section">
        <div className="wp-row">
          <LinkButton href={'/api/me/export' as Route} variant="secondary" icon="download" download>
            {t('exportButton')}
          </LinkButton>
          <Button variant="quiet" icon="delete" onPress={() => setConfirmChats(true)}>
            {t('deleteChats')}
          </Button>
        </div>
      </Panel>

      <Panel
        title={t('deleteTitle')}
        description={t('deleteBody')}
        as="section"
        className={styles.dangerZone}
      >
        <div>
          <Button variant="danger" icon="delete" onPress={() => setConfirmAccount(true)}>
            {t('deleteButton')}
          </Button>
        </div>
      </Panel>

      <ConfirmDialog
        isOpen={confirmChats}
        onOpenChange={setConfirmChats}
        title={t('deleteChats')}
        confirmLabel={common('delete')}
        cancelLabel={common('cancel')}
        tone="danger"
        onConfirm={async () => {
          await api('/api/ask/conversations', { method: 'DELETE' }).catch(() => undefined);
          router.refresh();
        }}
      >
        <p>{t('deleteChatsConfirm')}</p>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={confirmAccount}
        onOpenChange={setConfirmAccount}
        title={t('deleteTitle')}
        confirmLabel={t('deleteButton')}
        cancelLabel={common('cancel')}
        tone="danger"
        confirmWord="DELETE"
        confirmWordLabel={t('deleteConfirmWord')}
        onConfirm={async () => {
          try {
            await api('/api/me', { method: 'DELETE', json: { confirm: 'DELETE' } });
          } catch (err) {
            toast({ title: errors('generic'), tone: 'danger' });
            throw err;
          }
          toast({ title: t('deleted'), tone: 'safe' });
          router.push('/welcome' as Route);
          router.refresh();
        }}
      >
        <p>{t('deleteBody')}</p>
        {lostOrganisations.length ? (
          <p>
            {t('deleteOrganisations', {
              count: lostOrganisations.length,
              names: lostOrganisations.join(', '),
            })}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
