import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiService } from '../../services/apiService';
import { User } from '@finwise-ai/shared';

export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await apiService.login(credentials.email, credentials.password);
      
      if (response.success && response.data) {
        apiService.setToken(response.data.token);
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Login failed');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Login failed');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (userData: {
    email: string;
    password: string;
    phoneNumber: string;
    country: string;
  }, { rejectWithValue }) => {
    try {
      const response = await apiService.register(userData);
      
      if (response.success && response.data) {
        apiService.setToken(response.data.token);
        return response.data;
      } else {
        return rejectWithValue(response.error || 'Registration failed');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Registration failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await apiService.logout();
      apiService.setToken(null);
      return null;
    } catch (error) {
      // Even if logout fails on server, clear local state
      apiService.setToken(null);
      return null;
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateProfile',
  async (updates: Partial<User>, { rejectWithValue }) => {
    try {
      // This would need a corresponding API endpoint
      // For now, just return the updates
      return updates;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Update failed');
    }
  }
);