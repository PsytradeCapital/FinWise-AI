import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Transaction } from '@finwise-ai/shared';
import { 
  fetchTransactions, 
  parseSMSTransaction, 
  createManualTransaction, 
  updateTransactionThunk, 
  deleteTransactionThunk 
} from '../thunks/transactionThunks';

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  lastSync: Date | null;
}

const initialState: TransactionState = {
  transactions: [],
  isLoading: false,
  error: null,
  lastSync: null,
};

const transactionSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    fetchTransactionsStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchTransactionsSuccess: (state, action: PayloadAction<Transaction[]>) => {
      state.isLoading = false;
      state.transactions = action.payload;
      state.lastSync = new Date();
      state.error = null;
    },
    fetchTransactionsFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    addTransaction: (state, action: PayloadAction<Transaction>) => {
      state.transactions.unshift(action.payload);
    },
    updateTransaction: (state, action: PayloadAction<{ id: string; updates: Partial<Transaction> }>) => {
      const index = state.transactions.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        state.transactions[index] = { ...state.transactions[index], ...action.payload.updates };
      }
    },
    deleteTransaction: (state, action: PayloadAction<string>) => {
      state.transactions = state.transactions.filter(t => t.id !== action.payload);
    },
    clearTransactions: (state) => {
      state.transactions = [];
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Transactions
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.transactions = action.payload;
        state.lastSync = new Date();
        state.error = null;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Parse SMS Transaction
    builder
      .addCase(parseSMSTransaction.fulfilled, (state, action) => {
        state.transactions.unshift(action.payload);
      })
      .addCase(parseSMSTransaction.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Create Manual Transaction
    builder
      .addCase(createManualTransaction.fulfilled, (state, action) => {
        state.transactions.unshift(action.payload);
      })
      .addCase(createManualTransaction.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Update Transaction
    builder
      .addCase(updateTransactionThunk.fulfilled, (state, action) => {
        const index = state.transactions.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.transactions[index] = action.payload.transaction;
        }
      })
      .addCase(updateTransactionThunk.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Delete Transaction
    builder
      .addCase(deleteTransactionThunk.fulfilled, (state, action) => {
        state.transactions = state.transactions.filter(t => t.id !== action.payload);
      })
      .addCase(deleteTransactionThunk.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  fetchTransactionsStart,
  fetchTransactionsSuccess,
  fetchTransactionsFailure,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  clearTransactions,
  clearError,
} = transactionSlice.actions;

export default transactionSlice.reducer;