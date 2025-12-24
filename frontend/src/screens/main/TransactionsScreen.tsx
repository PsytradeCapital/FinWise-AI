import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { theme } from '../../theme';

const TransactionsScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Transactions</Text>
      <Text variant="bodyLarge">Transaction list - to be implemented</Text>
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

export default TransactionsScreen;