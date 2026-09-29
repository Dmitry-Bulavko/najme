import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { FormField } from './form-field';
import { Input } from './input';

describe('FormField', () => {
  it('associates the label with the control', () => {
    render(
      <FormField label="Email">
        <Input />
      </FormField>,
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows a description, then swaps it for the error with aria wiring', () => {
    const { rerender } = render(
      <FormField label="Name" description="As on your ID">
        <Input />
      </FormField>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAccessibleDescription('As on your ID');
    expect(input).not.toHaveAttribute('aria-invalid');

    rerender(
      <FormField label="Name" description="As on your ID" error="Required">
        <Input />
      </FormField>,
    );
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Required');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('works with react-hook-form register and validation errors', async () => {
    const onValid = vi.fn();
    function Demo() {
      const {
        register,
        handleSubmit,
        formState: { errors },
      } = useForm<{ email: string }>();
      return (
        <form onSubmit={handleSubmit(onValid)}>
          <FormField label="Email" error={errors.email?.message}>
            <Input {...register('email', { required: 'Email is required' })} />
          </FormField>
          <button type="submit">Send</button>
        </form>
      );
    }
    render(<Demo />);

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email is required');
    expect(onValid).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onValid).toHaveBeenCalledOnce();
  });
});
