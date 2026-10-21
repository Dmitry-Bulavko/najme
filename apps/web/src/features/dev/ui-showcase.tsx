'use client';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useState, type ReactElement, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { TimeInput } from '@/components/ui/time-input';

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

  const [amount, setAmount] = useState<number | null>(2500);
  const [time, setTime] = useState('09:00');
  const [category, setCategory] = useState<string | undefined>();
  const [online, setOnline] = useState(true);
  const [visible, setVisible] = useState(false);
  const [pricing, setPricing] = useState('fixed');

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

      <Section title="Input / FormField / Textarea">
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
          <FormField label={t('notesLabel')}>
            <Textarea placeholder={t('notesPlaceholder')} />
          </FormField>
          <Input disabled placeholder={t('nameLabel')} />
          <div>
            <Button type="submit">{tCommon('save')}</Button>
          </div>
        </form>
      </Section>

      <Section title="MoneyInput / TimeInput">
        <div className="grid max-w-md gap-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">{t('amountLabel')}</Label>
            <MoneyInput
              id="amount"
              value={amount}
              onChange={setAmount}
              aria-label={t('amountLabel')}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="start-time">{t('timeLabel')}</Label>
            <TimeInput
              id="start-time"
              value={time}
              onChange={setTime}
              aria-label={t('timeLabel')}
            />
          </div>
        </div>
      </Section>

      <Section title="Select / Switch / Checkbox / RadioGroup">
        <div className="grid max-w-md gap-6">
          <div className="grid gap-2">
            <Label htmlFor="category">{t('selectLabel')}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" aria-label={t('selectLabel')}>
                <SelectValue placeholder={t('selectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="haircut">{t('selectOptionOne')}</SelectItem>
                <SelectItem value="colour">{t('selectOptionTwo')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="online"
              checked={online}
              onCheckedChange={setOnline}
              aria-label={t('switchLabel')}
            />
            <Label htmlFor="online">{t('switchLabel')}</Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="visible"
              checked={visible}
              onCheckedChange={(checked) => setVisible(checked === true)}
              aria-label={t('checkboxLabel')}
            />
            <Label htmlFor="visible">{t('checkboxLabel')}</Label>
          </div>
          <div className="grid gap-3">
            <Label id="pricing-label">{t('radioLabel')}</Label>
            <RadioGroup value={pricing} onValueChange={setPricing} aria-labelledby="pricing-label">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fixed" id="pricing-fixed" />
                <Label htmlFor="pricing-fixed">{t('radioFixed')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="from" id="pricing-from" />
                <Label htmlFor="pricing-from">{t('radioFrom')}</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </Section>

      <Section title="Tabs / Badge / Table">
        <Tabs defaultValue="services">
          <TabsList aria-label={t('tabsServices')}>
            <TabsTrigger value="services">{t('tabsServices')}</TabsTrigger>
            <TabsTrigger value="staff">{t('tabsStaff')}</TabsTrigger>
            <TabsTrigger value="hours">{t('tabsHours')}</TabsTrigger>
          </TabsList>
          <TabsContent value="services">
            <div className="flex flex-wrap gap-2">
              <Badge>{t('badgeDefault')}</Badge>
              <Badge variant="secondary">{t('badgeSecondary')}</Badge>
              <Badge variant="success">{t('badgeSuccess')}</Badge>
              <Badge variant="warning">{t('badgeWarning')}</Badge>
              <Badge variant="destructive">{t('badgeDestructive')}</Badge>
              <Badge variant="outline">{t('badgeSecondary')}</Badge>
            </div>
          </TabsContent>
          <TabsContent value="staff">{t('tabsStaff')}</TabsContent>
          <TabsContent value="hours">{t('tabsHours')}</TabsContent>
        </Tabs>
        <Table>
          <TableCaption>{t('tableCaption')}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tableService')}</TableHead>
              <TableHead>{t('tableTime')}</TableHead>
              <TableHead>{t('tableStatus')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>{t('selectOptionOne')}</TableCell>
              <TableCell>09:00</TableCell>
              <TableCell>
                <Badge variant="success">{t('badgeSuccess')}</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>{t('selectOptionTwo')}</TableCell>
              <TableCell>10:30</TableCell>
              <TableCell>
                <Badge variant="warning">{t('badgeWarning')}</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      <Section title="Dialog / AlertDialog / Popover">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">{t('openDialog')}</Button>
            </DialogTrigger>
            <DialogContent closeLabel={t('close')}>
              <DialogHeader>
                <DialogTitle>{t('dialogTitle')}</DialogTitle>
                <DialogDescription>{t('dialogBody')}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button>{t('save')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">{t('openAlertDialog')}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('alertDialogTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('alertDialogBody')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction>{t('delete')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">{t('openPopover')}</Button>
            </PopoverTrigger>
            <PopoverContent>{t('popoverBody')}</PopoverContent>
          </Popover>
        </div>
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
