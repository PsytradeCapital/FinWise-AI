import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiService } from '../../services/apiService';
import { SavingsGoal } from '@finwise-ai/shared';

export const fetchGoals = createAsyncThunk(
  'goals/fetchGoals',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.getGoals(userId);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to fetch goals');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch goals');
    }
  }
);

export const createGoalThunk = createAsyncThunk(
  'goals/create',
  async (goalData: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>, { rejectWithValue }) => {
    try {
      const response = await apiService.createGoal(goalData);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Failed to create goal');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to create goal');
    }
  }
);

export const updateGoalThunk = createAsyncThunk(
  'goals/update',
  async (data: { id: string; updates: Partial<SavingsGoal> }, { rejectWithValue }) => {
    try {
      const response = await apiService.updateGoal(data.id, data.updates);
      
      if (response.success && response.data) {
        return { id: data.id, goal: response.data };
      } else {
        return rejectWithValue(response.error || 'Failed to update goal');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to update goal');
    }
  }
);

export const deleteGoalThunk = createAsyncThunk(
  'goals/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await apiService.deleteGoal(id);
      
      if (response.success) {
        return id;
      } else {
        return rejectWithValue(response.error || 'Failed to delete goal');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to delete goal');
    }
  }
);