import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test/test-utils';
import { PaymentForm } from '../payment-form';
import type { Debt } from '@/types/database';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const debt: Debt = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Chase Sapphire',
  type: 'credit_card',
  balance_cents: 50000, // $500
  apr_bps: 2499,
  min_payment_cents: 2500,
  due_day: 15,
  owner_type: 'session',
  owner_id: 'session-id',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('PaymentForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'payment-1' }),
    });
  });

  it('shows the remaining balance as context', () => {
    render(<PaymentForm debt={debt} />);

    expect(screen.getByText(/remaining balance: \$500\.00/i)).toBeInTheDocument();
  });

  it('rejects a payment of zero or less without calling the API', async () => {
    render(<PaymentForm debt={debt} />);

    await userEvent.type(screen.getByPlaceholderText('0.00'), '0');
    await userEvent.click(screen.getByRole('button', { name: /record payment/i }));

    expect(
      await screen.findByText(/payment must be greater than zero/i)
    ).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('requires a payment date', async () => {
    render(<PaymentForm debt={debt} />);

    await userEvent.type(screen.getByPlaceholderText('0.00'), '100');
    await userEvent.clear(screen.getByLabelText(/payment date/i));
    await userEvent.click(screen.getByRole('button', { name: /record payment/i }));

    expect(await screen.findByText(/payment date is required/i)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('submits a valid payment in cents with the note', async () => {
    const onSuccess = jest.fn();
    render(<PaymentForm debt={debt} onSuccess={onSuccess} />);

    await userEvent.type(screen.getByPlaceholderText('0.00'), '123.45');
    await userEvent.type(
      screen.getByPlaceholderText(/extra payment from bonus/i),
      'June payment'
    );
    await userEvent.click(screen.getByRole('button', { name: /record payment/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/payments');
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({
      debt_id: debt.id,
      amount_cents: 12345,
      note: 'June payment',
      allow_overpayment: false,
    });
    expect(body.paid_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('asks for confirmation when the server flags an overpayment, then resubmits with consent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Payment exceeds remaining balance',
        code: 'EXCEEDS_BALANCE',
        remaining_balance_cents: 50000,
      }),
    });

    const onSuccess = jest.fn();
    render(<PaymentForm debt={debt} onSuccess={onSuccess} />);

    await userEvent.type(screen.getByPlaceholderText('0.00'), '600');
    await userEvent.click(screen.getByRole('button', { name: /record payment/i }));

    // First attempt: warning shown, nothing saved yet
    expect(
      await screen.findByText(/payment exceeds remaining balance/i)
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();

    // Second attempt confirms
    await userEvent.click(screen.getByRole('button', { name: /confirm payment/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(secondBody.allow_overpayment).toBe(true);
  });

  it('clears the overpayment warning when the amount changes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Payment exceeds remaining balance',
        code: 'EXCEEDS_BALANCE',
        remaining_balance_cents: 50000,
      }),
    });

    render(<PaymentForm debt={debt} />);

    const amountInput = screen.getByPlaceholderText('0.00');
    await userEvent.type(amountInput, '600');
    await userEvent.click(screen.getByRole('button', { name: /record payment/i }));
    await screen.findByText(/payment exceeds remaining balance/i);

    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '100');

    expect(screen.queryByText(/payment exceeds remaining balance/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /record payment/i })).toBeInTheDocument();
  });

  it('pre-fills values when editing an existing payment', () => {
    render(
      <PaymentForm
        debt={debt}
        payment={{
          id: 'payment-1',
          owner_type: 'session',
          owner_id: 'session-id',
          debt_id: debt.id,
          amount_cents: 7550,
          balance_delta_cents: 7550,
          note: 'Original note',
          paid_at: '2026-06-15',
          created_at: new Date().toISOString(),
        }}
      />
    );

    expect(screen.getByPlaceholderText('0.00')).toHaveValue(75.5);
    expect(screen.getByLabelText(/payment date/i)).toHaveValue('2026-06-15');
    expect(screen.getByDisplayValue('Original note')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update payment/i })).toBeInTheDocument();
  });
});
