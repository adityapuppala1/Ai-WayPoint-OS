'use client';

import { Notice } from '@waypoint/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import styles from './shell.module.css';

/**
 * Says so when the device has no connection, and stops saying so when it is back. Without it,
 * a press that cannot reach the server looks like an app that has stopped listening.
 */
export function OfflineNotice() {
  const t = useTranslations('shell');
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  // The region is always on the page, so a screen reader announces the notice when it appears.
  return (
    <div className={styles.offline} role="status">
      {offline ? <Notice tone="info" title={t('offline')} /> : null}
    </div>
  );
}
