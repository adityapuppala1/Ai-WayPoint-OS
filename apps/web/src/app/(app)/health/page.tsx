import { health as healthService } from '@waypoint/api';
import { PageHeader, Panel } from '@waypoint/ui';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { EmptyNote } from '@/components/EmptyNote';
import { CareGuide } from '@/components/health/CareGuide';
import { DayCheckin } from '@/components/health/DayCheckin';
import { Reminders } from '@/components/health/Reminders';
import { WeekBars } from '@/components/health/WeekBars';
import { JumpLink } from '@/components/JumpLink';
import { ltr } from '@/lib/bidi';
import { requireViewer } from '@/lib/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('health');
  return { title: t('title'), description: t('lead') };
}

export default async function HealthPage() {
  const viewer = await requireViewer('/health');
  const [t, format] = await Promise.all([getTranslations('health'), getFormatter()]);
  const view = await healthService.healthOverview(viewer.db, viewer.user.id, viewer.profile);
  const emergency = view.care.emergencyNumber;

  return (
    <div className="wp-page">
      <div className="wp-section">
        <PageHeader module="health" title={t('title')} lead={t('lead')} />
        <p className="wp-secondary">
          {t('notMedical')}{' '}
          {emergency ? (
            <a href={`tel:${emergency}`}>{t('emergencyLine', { number: ltr(emergency) })}</a>
          ) : (
            t('emergencyNoNumber')
          )}
        </p>
      </div>

      <Panel
        title={t('todayTitle')}
        description={`${t('todayLead')} ${t('dayFor', {
          date: format.dateTime(new Date(`${view.today.date}T12:00:00Z`), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'UTC',
          }),
        })}`}
        as="section"
        id="today"
      >
        <DayCheckin day={view.today} />
      </Panel>

      <Panel title={t('weekTitle')} description={t('weekLead')} as="section">
        {view.week.loggedDays ? (
          <WeekBars week={view.week} />
        ) : (
          <EmptyNote action={<JumpLink to="today">{t('logToday')}</JumpLink>}>
            {t('weekEmpty')}
          </EmptyNote>
        )}
      </Panel>

      <Panel
        title={t('remindersTitle')}
        description={t('remindersLead')}
        as="section"
        id="reminders"
      >
        <Reminders
          reminders={view.reminders}
          today={view.today.date}
          timeZone={viewer.profile.timezone}
        />
      </Panel>

      <Panel title={t('careTitle')} description={t('careLead')} as="section" id="care">
        <CareGuide care={view.care} />
      </Panel>
    </div>
  );
}
