import { Car, Dumbbell, Flower2, Scissors, Sparkles, Stethoscope } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

const CATEGORIES = [
  { key: 'salons', icon: Sparkles },
  { key: 'barbers', icon: Scissors },
  { key: 'wellness', icon: Flower2 },
  { key: 'clinics', icon: Stethoscope },
  { key: 'transfers', icon: Car },
  { key: 'fitness', icon: Dumbbell },
] as const;

/** Category chips placeholder showing the product direction; not wired to data yet. */
export async function CategoryChips(): Promise<ReactElement> {
  const t = await getTranslations('home.categories');

  return (
    <section aria-labelledby="home-categories" className="grid gap-4">
      <h2 id="home-categories" className="text-title">
        {t('title')}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {CATEGORIES.map(({ key, icon: Icon }) => (
          <li key={key}>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-bold text-foreground shadow-xs transition-colors outline-none hover:border-primary/40 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            >
              <Icon className="size-4 text-primary" aria-hidden="true" />
              {t(key)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
