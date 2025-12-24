import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../App';

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native/Libraries/Components/View/View');
  return {
    GestureHandlerRootView: View,
  };
});

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => {
  return {
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Mock navigation components
jest.mock('../navigation/AppNavigator', () => {
  const { View, Text } = require('react-native');
  return function MockAppNavigator() {
    return (
      <View testID="app-navigator">
        <Text>App Navigator</Text>
      </View>
    );
  };
});

describe('App', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('app-navigator')).toBeTruthy();
  });
});