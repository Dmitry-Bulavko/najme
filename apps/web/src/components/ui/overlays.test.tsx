import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Alert, AlertDescription, AlertTitle } from './alert';
import { Avatar, AvatarFallback } from './avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from './sheet';

describe('Sheet', () => {
  it('opens from the trigger, exposes a dialog and closes via the labelled close button', async () => {
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent closeLabel="Close">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Body</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent closeLabel="Close">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Body</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('DropdownMenu', () => {
  it('opens with the keyboard and lists items', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Profile</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    screen.getByRole('button', { name: 'Menu' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeInTheDocument();
  });
});

describe('Alert', () => {
  it('uses role=alert for destructive and role=status otherwise', () => {
    render(
      <>
        <Alert variant="destructive">
          <AlertTitle>Failed</AlertTitle>
          <AlertDescription>Try again</AlertDescription>
        </Alert>
        <Alert>
          <AlertTitle>FYI</AlertTitle>
        </Alert>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    expect(screen.getByRole('status')).toHaveTextContent('FYI');
  });
});

describe('Avatar', () => {
  it('shows the fallback when there is no image', () => {
    render(
      <Avatar>
        <AvatarFallback>NJ</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('NJ')).toBeInTheDocument();
  });
});
