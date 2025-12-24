import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SavingsGoal } from '@shared/types';

interface GoalState {
  goals: SavingsGoal[];
  isLoading: boolean;
  error: string | null;
}

const initialState: GoalState = {
  goals: [],
  isLoading: false,
  error: null,
};

const goalSlice = createSlice({
  name: 'goals',
  initialState,
  reducers: {
    fetchGoalsStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchGoalsSuccess: (state, action: PayloadAction<SavingsGoal[]>) => {
      state.isLoading = false;
      state.goals = action.payload;
      state.error = null;
    },
    fetchGoalsFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    addGoal: (state, action: PayloadAction<SavingsGoal>) => {
      state.goals.push(action.payload);
    },
    updateGoal: (state, action: PayloadAction<{ id: string; updates: Partial<SavingsGoal> }>) => {
      const index = state.goals.findIndex(g => g.id === action.payload.id);
      if (index !== -1) {
        state.goals[index] = { ...state.goals[index], ...action.payload.updates };
      }
    },
    deleteGoal: (state, action: PayloadAction<string>) => {
      state.goals = state.goals.filter(g => g.id !== action.payload);
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  fetchGoalsStart,
  fetchGoalsSuccess,
  fetchGoalsFailure,
  addGoal,
  updateGoal,
  deleteGoal,
  clearError,
} = goalSlice.actions;

export default goalSlice.reducer;