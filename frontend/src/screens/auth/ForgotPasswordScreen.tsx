import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { theme } from '../../theme';

const ForgotPasswordScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Forgot Password</Text>
      <Text variant="bodyLarge">Password recovery screen - to be implemented</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});

export default ForgotPasswordScreen;