'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { FormEvent, ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Search box of the home hero. Placeholder for now: real search arrives with the discovery tasks. */
export function HeroSearch(): ReactElement {
  const t = useTranslations('home.search');

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-xl flex-col gap-2 rounded-lg border bg-card p-2 shadow-lg sm:flex-row"
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          name="q"
          aria-label={t('label')}
          placeholder={t('placeholder')}
          className="h-12 border-transparent bg-transparent pl-10 shadow-none hover:border-transparent"
        />
      </div>
      <Button type="submit" size="lg">
        {t('submit')}
      </Button>
    </form>
  );
}
