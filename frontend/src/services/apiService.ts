import { ApiResponse, Transaction, User, SavingsGoal, Category, Notification, MoneyStory, Advice } from '@finwise-ai/shared';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://fin-wise-ai-iota.vercel.app/api';

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Authentication
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData: {
    email: string;
    password: string;
    phoneNumber: string;
    country: string;
  }): Promise<ApiResponse<{ user: User; token: string }>> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(): Promise<ApiResponse<null>> {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  // Transactions
  async parseSMSTransaction(smsContent: string, userId: string, phoneNumber?: string): Promise<ApiResponse<Transaction>> {
    return this.request('/transactions/parse-sms', {
      method: 'POST',
      body: JSON.stringify({ smsContent, userId, phoneNumber }),
    });
  }

  async createManualTransaction(transactionData: {
    amount: number;
    description: string;
    category?: string;
    timestamp?: Date;
    merchant?: string;
    userId: string;
  }): Promise<ApiResponse<Transaction>> {
    return this.request('/transactions/manual', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }

  async getTransactions(userId: string): Promise<ApiResponse<Transaction[]>> {
    return this.request(`/transactions?userId=${userId}`);
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<ApiResponse<Transaction>> {
    return this.request(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTransaction(id: string): Promise<ApiResponse<null>> {
    return this.request(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  // Goals
  async getGoals(userId: string): Promise<ApiResponse<SavingsGoal[]>> {
    return this.request(`/goals?userId=${userId}`);
  }

  async createGoal(goalData: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<SavingsGoal>> {
    return this.request('/goals', {
      method: 'POST',
      body: JSON.stringify(goalData),
    });
  }

  async updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<ApiResponse<SavingsGoal>> {
    return this.request(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteGoal(id: string): Promise<ApiResponse<null>> {
    return this.request(`/goals/${id}`, {
      method: 'DELETE',
    });
  }

  // Categories
  async getCategories(userId?: string): Promise<ApiResponse<Category[]>> {
    const query = userId ? `?userId=${userId}` : '';
    return this.request(`/categories${query}`);
  }

  async createCategory(categoryData: Omit<Category, 'id'>): Promise<ApiResponse<Category>> {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  }

  // AI Advice
  async getAdvice(userId: string): Promise<ApiResponse<Advice[]>> {
    return this.request(`/advice?userId=${userId}`);
  }

  async getSpendingAnalysis(userId: string): Promise<ApiResponse<any>> {
    return this.request(`/advice/analysis?userId=${userId}`);
  }

  // Money Stories
  async getStories(userId: string): Promise<ApiResponse<MoneyStory[]>> {
    return this.request(`/stories?userId=${userId}`);
  }

  async generateStory(userId: string, period: 'weekly' | 'monthly'): Promise<ApiResponse<MoneyStory>> {
    return this.request('/stories/generate', {
      method: 'POST',
      body: JSON.stringify({ userId, period }),
    });
  }

  // Notifications
  async getNotifications(userId: string): Promise<ApiResponse<Notification[]>> {
    return this.request(`/notifications?userId=${userId}`);
  }

  async markNotificationRead(id: string): Promise<ApiResponse<null>> {
    return this.request(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  // Reports
  async generatePDFReport(userId: string, reportType: string, dateRange: { start: Date; end: Date }): Promise<ApiResponse<{ url: string }>> {
    return this.request('/reports/pdf', {
      method: 'POST',
      body: JSON.stringify({ userId, reportType, dateRange }),
    });
  }

  // External Services
  async connectMpesa(userId: string, phoneNumber: string): Promise<ApiResponse<any>> {
    return this.request('/mpesa/connect', {
      method: 'POST',
      body: JSON.stringify({ userId, phoneNumber }),
    });
  }

  async connectBank(userId: string, bankData: any): Promise<ApiResponse<any>> {
    return this.request('/banking/connect', {
      method: 'POST',
      body: JSON.stringify({ userId, ...bankData }),
    });
  }

  async connectNaboCapital(userId: string, credentials: any): Promise<ApiResponse<any>> {
    return this.request('/nabo-capital/connect', {
      method: 'POST',
      body: JSON.stringify({ userId, ...credentials }),
    });
  }

  // Sync
  async syncData(userId: string): Promise<ApiResponse<any>> {
    return this.request('/sync', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async getOfflineData(userId: string, lastSync?: Date): Promise<ApiResponse<any>> {
    const query = lastSync ? `?lastSync=${lastSync.toISOString()}` : '';
    return this.request(`/sync/offline/${userId}${query}`);
  }
}

export const apiService = new ApiService();
export default apiService;