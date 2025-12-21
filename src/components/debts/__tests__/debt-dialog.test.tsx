import { render, screen, fireEvent } from '@testing-library/react';
import { DebtDialog } from '../debt-dialog';
import type { Debt } from '@/types/database';

// Mock DebtForm to simplify testing
jest.mock('../debt-form', () => ({
  DebtForm: ({ debt, onSuccess, onCancel }: { debt?: Debt | null; onSuccess?: () => void; onCancel?: () => void }) => (
    <div data-testid="debt-form">
      <span data-testid="form-mode">{debt ? 'edit' : 'create'}</span>
      <button onClick={onSuccess} data-testid="mock-submit">Submit</button>
      <button onClick={onCancel} data-testid="mock-cancel">Cancel</button>
    </div>
  ),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockDebt: Debt = {
  id: 'debt-1',
  name: 'Test Card',
  type: 'credit_card',
  balance_cents: 100000,
  apr_bps: 2000,
  min_payment_cents: 5000,
  due_day: 15,
  owner_type: 'session',
  owner_id: 'session-id',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('DebtDialog', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('dialog visibility', () => {
    it('should not render dialog content when closed', () => {
      render(
        <DebtDialog
          open={false}
          onOpenChange={mockOnOpenChange}
        />
      );

      expect(screen.queryByTestId('debt-form')).not.toBeInTheDocument();
    });

    it('should render dialog content when open', () => {
      render(
        <DebtDialog
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      expect(screen.getByTestId('debt-form')).toBeInTheDocument();
    });
  });

  describe('dialog title and description', () => {
    it('should show "Add New Debt" title for new debt', () => {
      render(
        <DebtDialog
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      expect(screen.getByText('Add New Debt')).toBeInTheDocument();
      expect(screen.getByText(/enter the details of your debt/i)).toBeInTheDocument();
    });

    it('should show "Edit Debt" title when editing', () => {
      render(
        <DebtDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          debt={mockDebt}
        />
      );

      expect(screen.getByText('Edit Debt')).toBeInTheDocument();
      expect(screen.getByText(/update the details of your debt/i)).toBeInTheDocument();
    });
  });

  describe('form mode', () => {
    it('should pass null debt to form for new debt', () => {
      render(
        <DebtDialog
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      expect(screen.getByTestId('form-mode')).toHaveTextContent('create');
    });

    it('should pass debt to form when editing', () => {
      render(
        <DebtDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          debt={mockDebt}
        />
      );

      expect(screen.getByTestId('form-mode')).toHaveTextContent('edit');
    });
  });

  describe('success handling', () => {
    it('should close dialog and call onSuccess when form succeeds', () => {
      render(
        <DebtDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      const submitButton = screen.getByTestId('mock-submit');
      fireEvent.click(submitButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should close dialog on success even without onSuccess callback', () => {
      render(
        <DebtDialog
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      const submitButton = screen.getByTestId('mock-submit');
      fireEvent.click(submitButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('cancel handling', () => {
    it('should close dialog when cancel is clicked', () => {
      render(
        <DebtDialog
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      );

      const cancelButton = screen.getByTestId('mock-cancel');
      fireEvent.click(cancelButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
