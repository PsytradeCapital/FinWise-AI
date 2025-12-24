import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { theme } from '../../theme';

const LoginScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        FinWise AI
      </Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        AI-powered financial management
      </Text>
      <Button
        mode="contained"
        style={styles.button}
        onPress={() => {
          // TODO: Implement login functionality
          console.log('Login pressed');
        }}
      >
        Login
      </Button>
      <Button
        mode="outlined"
        style={styles.button}
        onPress={() => {
          // TODO: Navigate to register screen
          console.log('Register pressed');
        }}
      >
        Register
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.background,
  },
  title: {
    marginBottom: 8,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  subtitle: {
    marginBottom: 40,
    color: theme.colors.onSurface,
    textAlign: 'center',
  },
  button: {
    marginVertical: 8,
    width: '100%',
  },
});

export default LoginScreen;