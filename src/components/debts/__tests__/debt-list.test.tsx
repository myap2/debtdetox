import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { render } from '@/test/test-utils';
import { DebtList } from '../debt-list';
import type { Debt } from '@/types/database';

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock DebtDialog to simplify testing
jest.mock('../debt-dialog', () => ({
  DebtDialog: ({ open, debt }: { open: boolean; debt: Debt | null }) =>
    open ? <div data-testid="debt-dialog">Editing: {debt?.name}</div> : null,
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock window.confirm
const mockConfirm = jest.fn();
global.confirm = mockConfirm;

const mockDebts: Debt[] = [
  {
    id: 'debt-1',
    name: 'Chase Sapphire',
    type: 'credit_card',
    balance_cents: 500000,
    apr_bps: 2499,
    min_payment_cents: 15000,
    due_day: 15,
    owner_type: 'session',
    owner_id: 'session-id',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'debt-2',
    name: 'Student Loan',
    type: 'student_loan',
    balance_cents: 2500000,
    apr_bps: 650,
    min_payment_cents: 35000,
    due_day: null,
    owner_type: 'session',
    owner_id: 'session-id',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe('DebtList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockDebts,
    });
  });

  describe('loading state', () => {
    it('should show loading state initially', () => {
      // Don't resolve fetch immediately
      mockFetch.mockImplementation(() => new Promise(() => {}));

      render(<DebtList />);
      expect(screen.getByText(/loading debts/i)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no debts exist', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      render(<DebtList />);

      await waitFor(() => {
        expect(screen.getByText(/no debts added yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('displaying debts', () => {
    it('should display debts in a table', async () => {
      render(<DebtList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
        // Student Loan appears twice - as name and as type badge
        expect(screen.getAllByText('Student Loan').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should show debt type badges', async () => {
      render(<DebtList />);

      await waitFor(() => {
        // Find badges by their role and text
        const badges = screen.getAllByText(/Credit Card|Student Loan/);
        expect(badges.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should format currency correctly', async () => {
      render(<DebtList />);

      await waitFor(() => {
        // $5,000.00 balance for Chase Sapphire
        expect(screen.getByText('$5,000.00')).toBeInTheDocument();
        // $25,000.00 balance for Student Loan
        expect(screen.getByText('$25,000.00')).toBeInTheDocument();
      });
    });

    it('should format APR correctly', async () => {
      render(<DebtList />);

      await waitFor(() => {
        expect(screen.getByText('24.99%')).toBeInTheDocument();
        expect(screen.getByText('6.50%')).toBeInTheDocument();
      });
    });

    it('should show due day or dash', async () => {
      render(<DebtList />);

      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument();
        expect(screen.getByText('-')).toBeInTheDocument();
      });
    });

    it('should show total row', async () => {
      render(<DebtList />);

      await waitFor(() => {
        expect(screen.getByText('Total')).toBeInTheDocument();
        // Total balance: $5,000 + $25,000 = $30,000
        expect(screen.getByText('$30,000.00')).toBeInTheDocument();
        // Total min payment: $150 + $350 = $500
        expect(screen.getByText('$500.00')).toBeInTheDocument();
      });
    });
  });

  describe('table headers', () => {
    it('should show all table headers', async () => {
      render(<DebtList />);

      await waitFor(() => {
        expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /type/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /balance/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /apr/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /min payment/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /due day/i })).toBeInTheDocument();
      });
    });
  });

  describe('action buttons', () => {
    it('should render action dropdown buttons for each debt', async () => {
      render(<DebtList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      // Each debt row should have an action button
      const rows = screen.getAllByRole('row');
      // Filter for data rows (not header or total)
      const dataRows = rows.filter(row =>
        row.textContent?.includes('Chase Sapphire') ||
        row.textContent?.includes('Student Loan')
      );

      expect(dataRows).toHaveLength(2);

      // Each data row should have a button for actions
      dataRows.forEach(row => {
        expect(within(row).getByRole('button')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should show error toast when fetch fails', async () => {
      const { toast } = require('sonner');
      mockFetch.mockResolvedValue({
        ok: false,
      });

      render(<DebtList />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to load debts');
      });
    });
  });
});
