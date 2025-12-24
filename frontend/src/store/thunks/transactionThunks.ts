import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiService } from '../../services/apiService';
import { Transaction } from '@finwise-ai/shared';

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchTransactions',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.getTransactions(userId);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch transactions');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch transactions');
    }
  }
);

export const parseSMSTransaction = createAsyncThunk(
  'transactions/parseSMS',
  async (data: { smsContent: string; userId: string; phoneNumber?: string }, { rejectWithValue }) => {
    try {
      const response = await apiService.parseSMSTransaction(data.smsContent, data.userId, data.phoneNumber);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to parse SMS transaction');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to parse SMS transaction');
    }
  }
);

export const createManualTransaction = createAsyncThunk(
  'transactions/createManual',
  async (transactionData: {
    amount: number;
    description: string;
    category?: string;
    timestamp?: Date;
    merchant?: string;
    userId: string;
  }, { rejectWithValue }) => {
    try {
      const response = await apiService.createManualTransaction(transactionData);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to create transaction');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to create transaction');
    }
  }
);

export const updateTransactionThunk = createAsyncThunk(
  'transactions/update',
  async (data: { id: string; updates: Partial<Transaction> }, { rejectWithValue }) => {
    try {
      const response = await apiService.updateTransaction(data.id, data.updates);
      
      if (response.success && response.data) {
        return { id: data.id, transaction: response.data };
      } else {
        return rejectWithValue(response.error || 'Failed to update transaction');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to update transaction');
    }
  }
);

export const deleteTransactionThunk = createAsyncThunk(
  'transactions/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await apiService.deleteTransaction(id);
      
      if (response.success) {
        return id;
      } else {
        return rejectWithValue(response.error || 'Failed to delete transaction');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to delete transaction');
    }
  }
);