import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('renders a type=button by default and fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each(['primary', 'secondary', 'outline', 'ghost', 'destructive'] as const)(
    'supports the %s variant',
    (variant) => {
      render(<Button variant={variant}>Go</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    },
  );

  it('in the loading state is disabled, busy and does not fire onClick', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders the child element with asChild', () => {
    render(
      <Button asChild>
        <a href="https://example.com/x">Link</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute(
      'href',
      'https://example.com/x',
    );
  });
});
