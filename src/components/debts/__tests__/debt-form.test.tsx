import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { DebtForm } from '../debt-form';

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('DebtForm', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-debt-id' }),
    });
  });

  describe('rendering', () => {
    it('should render all form fields', () => {
      render(<DebtForm />);

      // Check for labels by text content
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Current Balance')).toBeInTheDocument();
      expect(screen.getByText(/apr/i)).toBeInTheDocument();
      expect(screen.getByText('Minimum Payment')).toBeInTheDocument();
      expect(screen.getByText(/due day/i)).toBeInTheDocument();

      // Check for inputs
      expect(screen.getByPlaceholderText('e.g., Chase Sapphire')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('1-31')).toBeInTheDocument();
    });

    it('should show "Add Debt" button for new debt', () => {
      render(<DebtForm />);
      expect(screen.getByRole('button', { name: /add debt/i })).toBeInTheDocument();
    });

    it('should show "Update Debt" button when editing', () => {
      const existingDebt = {
        id: 'debt-1',
        name: 'Test Card',
        type: 'credit_card' as const,
        balance_cents: 100000,
        apr_bps: 2000,
        min_payment_cents: 5000,
        due_day: 15,
        owner_type: 'session' as const,
        owner_id: 'session-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(<DebtForm debt={existingDebt} />);
      expect(screen.getByRole('button', { name: /update debt/i })).toBeInTheDocument();
    });

    it('should show Cancel button when onCancel is provided', () => {
      render(<DebtForm onCancel={mockOnCancel} />);
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should not show Cancel button when onCancel is not provided', () => {
      render(<DebtForm />);
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  describe('pre-filled values for editing', () => {
    it('should pre-fill form with existing debt data', () => {
      const existingDebt = {
        id: 'debt-1',
        name: 'My Credit Card',
        type: 'credit_card' as const,
        balance_cents: 250000, // $2,500
        apr_bps: 1850, // 18.5%
        min_payment_cents: 7500, // $75
        due_day: 20,
        owner_type: 'session' as const,
        owner_id: 'session-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(<DebtForm debt={existingDebt} />);

      expect(screen.getByDisplayValue('My Credit Card')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2500')).toBeInTheDocument();
      expect(screen.getByDisplayValue('18.5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('75')).toBeInTheDocument();
      expect(screen.getByDisplayValue('20')).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('should show error for empty name', async () => {
      render(<DebtForm />);

      const submitButton = screen.getByRole('button', { name: /add debt/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      });
    });

    it('should show error for missing balance', async () => {
      render(<DebtForm />);

      const nameInput = screen.getByPlaceholderText('e.g., Chase Sapphire');
      await userEvent.type(nameInput, 'Test Card');

      // Leave balance empty (don't fill it in)
      const submitButton = screen.getByRole('button', { name: /add debt/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/valid balance is required/i)).toBeInTheDocument();
      });
    });

    it('should validate due day bounds', () => {
      render(<DebtForm />);

      // Check that the due day input has proper min/max attributes
      const dueDayInput = screen.getByPlaceholderText('1-31');
      expect(dueDayInput).toHaveAttribute('min', '1');
      expect(dueDayInput).toHaveAttribute('max', '31');
      expect(dueDayInput).toHaveAttribute('type', 'number');
    });
  });

  describe('form submission', () => {
    it('should submit form with correct data for new debt', async () => {
      render(<DebtForm onSuccess={mockOnSuccess} />);

      const nameInput = screen.getByPlaceholderText('e.g., Chase Sapphire');
      await userEvent.type(nameInput, 'Chase Sapphire');

      const balanceInputs = screen.getAllByPlaceholderText('0.00');
      await userEvent.type(balanceInputs[0], '5000');
      await userEvent.type(balanceInputs[1], '24.99');
      await userEvent.type(balanceInputs[2], '150');

      const submitButton = screen.getByRole('button', { name: /add debt/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/debts',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      // Verify the payload
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.name).toBe('Chase Sapphire');
      expect(callBody.balance_cents).toBe(500000);
      expect(callBody.apr_bps).toBe(2499);
      expect(callBody.min_payment_cents).toBe(15000);
    });

    it('should call PATCH for existing debt', async () => {
      const existingDebt = {
        id: 'debt-123',
        name: 'Old Card',
        type: 'credit_card' as const,
        balance_cents: 100000,
        apr_bps: 2000,
        min_payment_cents: 5000,
        due_day: null,
        owner_type: 'session' as const,
        owner_id: 'session-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(<DebtForm debt={existingDebt} onSuccess={mockOnSuccess} />);

      const submitButton = screen.getByRole('button', { name: /update debt/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/debts/debt-123',
          expect.objectContaining({
            method: 'PATCH',
          })
        );
      });
    });

    it('should call onSuccess after successful submission', async () => {
      render(<DebtForm onSuccess={mockOnSuccess} />);

      const nameInput = screen.getByPlaceholderText('e.g., Chase Sapphire');
      await userEvent.type(nameInput, 'Test Card');

      const balanceInputs = screen.getAllByPlaceholderText('0.00');
      await userEvent.type(balanceInputs[0], '1000');
      await userEvent.type(balanceInputs[1], '20');
      await userEvent.type(balanceInputs[2], '25');

      const submitButton = screen.getByRole('button', { name: /add debt/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should show error toast on API failure', async () => {
      const { toast } = require('sonner');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });

      render(<DebtForm />);

      const nameInput = screen.getByPlaceholderText('e.g., Chase Sapphire');
      await userEvent.type(nameInput, 'Test Card');

      const balanceInputs = screen.getAllByPlaceholderText('0.00');
      await userEvent.type(balanceInputs[0], '1000');
      await userEvent.type(balanceInputs[1], '20');
      await userEvent.type(balanceInputs[2], '25');

      const submitButton = screen.getByRole('button', { name: /add debt/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create debt');
      });
    });
  });

  describe('cancel behavior', () => {
    it('should call onCancel when Cancel button is clicked', async () => {
      render(<DebtForm onCancel={mockOnCancel} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});
