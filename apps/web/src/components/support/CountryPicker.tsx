'use client';

import { SelectField } from '@waypoint/ui';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';

/** Switches the country shown on a public page via the `?country=` query parameter. */
export function CountryPicker({
  label,
  countries,
  value,
}: {
  label: string;
  countries: Array<{ code: string; name: string }>;
  value: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <SelectField
      label={label}
      options={countries.map((c) => ({ id: c.code, label: c.name, textValue: c.name }))}
      selectedKey={value}
      isDisabled={pending}
      onSelectionChange={(k) => {
        if (!k) return;
        startTransition(() =>
          router.replace(`${pathname}?country=${String(k)}` as Route, { scroll: false }),
        );
      }}
    />
  );
}
