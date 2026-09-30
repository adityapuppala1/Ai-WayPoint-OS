'use client';

/** Last-resort error page (the root layout itself failed), so no translations or styles. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', lineHeight: 1.5 }}>
        <h1>Something went wrong on our side.</h1>
        <p>Your work is safe. Please try again in a moment.</p>
        <p>
          If you need help right now, call your local emergency number or visit{' '}
          <a href="https://findahelpline.com">findahelpline.com</a>.
        </p>
        <button type="button" onClick={reset} style={{ padding: '0.75rem 1rem', fontSize: '1rem' }}>
          Try again
        </button>
      </body>
    </html>
  );
}
