'use client';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { ReactElement, ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

const VARIANTS = ['primary', 'secondary', 'outline', 'ghost', 'destructive'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="grid gap-4">
      <h2 className="text-title">{title}</h2>
      {children}
    </section>
  );
}

interface DemoForm {
  name: string;
  email: string;
}

/** Renders every kit component and variant. Mounted only by the dev-only `/dev/ui` route. */
export function UiShowcase(): ReactElement {
  const t = useTranslations('devUi');
  const tCommon = useTranslations('actions');
  const tShell = useTranslations('shell');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DemoForm>({ defaultValues: { name: '', email: 'not-an-email' } });

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-12 px-4 py-12 sm:px-6">
      <header className="grid gap-2">
        <h1 className="text-heading">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </header>

      <Section title="Button">
        <div className="grid gap-3">
          {SIZES.map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-3">
              {VARIANTS.map((variant) => (
                <Button key={variant} variant={variant} size={size}>
                  {variant}
                </Button>
              ))}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button loading>{t('loading')}</Button>
            <Button variant="outline" loading>
              {t('loading')}
            </Button>
            <Button disabled>{tCommon('save')}</Button>
          </div>
        </div>
      </Section>

      <Section title="Input / FormField">
        <form
          onSubmit={handleSubmit(() => toast.success(t('toastMessage')))}
          className="grid max-w-md gap-4"
          noValidate
        >
          <FormField label={t('nameLabel')} description={t('nameHint')}>
            <Input {...register('name')} />
          </FormField>
          <FormField label={t('emailLabel')} error={errors.email?.message ?? t('emailError')}>
            <Input type="email" {...register('email')} />
          </FormField>
          <Input disabled placeholder={t('nameLabel')} />
          <div>
            <Button type="submit">{tCommon('save')}</Button>
          </div>
        </form>
      </Section>

      <Section title="Card">
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>{t('cardTitle')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent>{t('cardBody')}</CardContent>
          <CardFooter>
            <Button size="sm">{tCommon('continue')}</Button>
            <Button size="sm" variant="ghost">
              {tCommon('cancel')}
            </Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Alert">
        <div className="grid gap-3">
          <Alert variant="info">
            <AlertTitle>{t('alertTitle')}</AlertTitle>
            <AlertDescription>{t('alertBody')}</AlertDescription>
          </Alert>
          <Alert variant="success">
            <AlertTitle>{t('toastMessage')}</AlertTitle>
          </Alert>
          <Alert variant="warning">
            <AlertTitle>{t('alertTitle')}</AlertTitle>
            <AlertDescription>{t('alertBody')}</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>{t('alertErrorTitle')}</AlertTitle>
            <AlertDescription>{t('alertErrorBody')}</AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section title="Toast">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => toast(t('toastMessage'))}>
            {t('showToast')}
          </Button>
          <Button variant="outline" onClick={() => toast.error(t('alertErrorTitle'))}>
            {t('showToast')} (error)
          </Button>
        </div>
      </Section>

      <Section title="Avatar">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src="/nonexistent.png" alt="" />
            <AvatarFallback>NJ</AvatarFallback>
          </Avatar>
          <Avatar className="size-14">
            <AvatarFallback>AB</AvatarFallback>
          </Avatar>
        </div>
      </Section>

      <Section title="DropdownMenu / Sheet">
        <div className="flex flex-wrap gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">{t('openDropdown')}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>{t('cardTitle')}</DropdownMenuLabel>
              <DropdownMenuItem>{t('itemOne')}</DropdownMenuItem>
              <DropdownMenuItem>{t('itemTwo')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>{tShell('signIn')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">{t('openSheet')}</Button>
            </SheetTrigger>
            <SheetContent side="right" closeLabel={tShell('close')}>
              <SheetHeader>
                <SheetTitle>{t('cardTitle')}</SheetTitle>
                <SheetDescription>{t('cardBody')}</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </div>
      </Section>

      <Section title="Separator / Skeleton">
        <div className="grid max-w-sm gap-4">
          <Separator />
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
