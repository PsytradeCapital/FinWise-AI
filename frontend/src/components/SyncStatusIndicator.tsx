import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SyncStatus } from '../services/syncService';

interface SyncStatusIndicatorProps {
  syncStatus: SyncStatus;
  onSyncPress?: () => void;
  showDetails?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  syncStatus,
  onSyncPress,
  showDetails = false
}) => {
  const getStatusColor = () => {
    if (syncStatus.syncInProgress) return '#FFA500'; // Orange
    if (!syncStatus.isOnline) return '#FF6B6B'; // Red
    if (syncStatus.pendingOperations > 0) return '#FFD93D'; // Yellow
    return '#6BCF7F'; // Green
  };

  const getStatusText = () => {
    if (syncStatus.syncInProgress) return 'Syncing...';
    if (!syncStatus.isOnline) return 'Offline';
    if (syncStatus.pendingOperations > 0) return `${syncStatus.pendingOperations} pending`;
    return 'Synced';
  };

  const formatLastSyncTime = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <TouchableOpacity
      style={[styles.container, { borderColor: getStatusColor() }]}
      onPress={onSyncPress}
      disabled={syncStatus.syncInProgress}
    >
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        
        {syncStatus.syncInProgress ? (
          <ActivityIndicator size="small" color={getStatusColor()} style={styles.spinner} />
        ) : null}
        
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>

      {showDetails && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailText}>
            Last sync: {formatLastSyncTime(syncStatus.lastSyncTime)}
          </Text>
          
          {syncStatus.pendingOperations > 0 && (
            <Text style={styles.detailText}>
              {syncStatus.pendingOperations} operations waiting to sync
            </Text>
          )}
          
          {!syncStatus.isOnline && (
            <Text style={styles.warningText}>
              Changes will sync when connection is restored
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginVertical: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  spinner: {
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  detailsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  detailText: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  warningText: {
    fontSize: 12,
    color: '#FF6B6B',
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default SyncStatusIndicator;