import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  ScrollView
} from 'react-native';
import { SyncStatus } from '../services/syncService';
import SyncStatusIndicator from './SyncStatusIndicator';

interface OfflineIndicatorProps {
  syncStatus: SyncStatus;
  onSyncPress?: () => void;
  storageStats?: {
    totalItems: number;
    collections: Record<string, number>;
    cacheSize: number;
  };
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  syncStatus,
  onSyncPress,
  storageStats
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));

  const toggleDetails = () => {
    const toValue = showDetails ? 0 : 1;
    
    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    setShowDetails(!showDetails);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getOfflineCapabilities = () => {
    return [
      'View cached transactions and goals',
      'Create new transactions offline',
      'Edit existing data',
      'Search through cached data',
      'View spending summaries',
      'Access saved categories'
    ];
  };

  const renderOfflineCapabilities = () => (
    <View style={styles.capabilitiesContainer}>
      <Text style={styles.capabilitiesTitle}>Available Offline:</Text>
      {getOfflineCapabilities().map((capability, index) => (
        <View key={index} style={styles.capabilityItem}>
          <Text style={styles.capabilityBullet}>•</Text>
          <Text style={styles.capabilityText}>{capability}</Text>
        </View>
      ))}
    </View>
  );

  const renderStorageStats = () => {
    if (!storageStats) return null;

    return (
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Storage Information:</Text>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Items:</Text>
          <Text style={styles.statValue}>{storageStats.totalItems}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Cache Size:</Text>
          <Text style={styles.statValue}>{formatBytes(storageStats.cacheSize)}</Text>
        </View>

        {Object.entries(storageStats.collections).map(([collection, count]) => (
          <View key={collection} style={styles.statItem}>
            <Text style={styles.statLabel}>{collection}:</Text>
            <Text style={styles.statValue}>{count} items</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderDetailsModal = () => (
    <Modal
      visible={showDetails}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowDetails(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Offline Status</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowDetails(false)}
          >
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <SyncStatusIndicator
            syncStatus={syncStatus}
            onSyncPress={onSyncPress}
            showDetails={true}
          />

          {!syncStatus.isOnline && (
            <View style={styles.offlineNotice}>
              <Text style={styles.offlineNoticeTitle}>You're Offline</Text>
              <Text style={styles.offlineNoticeText}>
                Don't worry! You can still use most features of FinWise AI. 
                Your changes will be saved locally and synced when you're back online.
              </Text>
            </View>
          )}

          {renderOfflineCapabilities()}
          {renderStorageStats()}

          {syncStatus.pendingOperations > 0 && (
            <View style={styles.pendingContainer}>
              <Text style={styles.pendingTitle}>Pending Changes:</Text>
              <Text style={styles.pendingText}>
                You have {syncStatus.pendingOperations} changes waiting to sync. 
                These will be automatically synced when you're back online.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );

  if (syncStatus.isOnline && syncStatus.pendingOperations === 0) {
    return null; // Don't show indicator when fully synced and online
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.indicator,
          !syncStatus.isOnline && styles.offlineIndicator
        ]}
        onPress={toggleDetails}
      >
        <View style={styles.indicatorContent}>
          <View style={[
            styles.statusDot,
            { backgroundColor: syncStatus.isOnline ? '#FFD93D' : '#FF6B6B' }
          ]} />
          
          <Text style={styles.indicatorText}>
            {!syncStatus.isOnline ? 'Offline' : `${syncStatus.pendingOperations} pending`}
          </Text>
          
          <Text style={styles.tapHint}>Tap for details</Text>
        </View>
      </TouchableOpacity>

      {renderDetailsModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  indicator: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD93D',
  },
  offlineIndicator: {
    borderLeftColor: '#FF6B6B',
  },
  indicatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  indicatorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  tapHint: {
    fontSize: 12,
    color: '#666666',
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  modalHeader: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  offlineNotice: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 16,
    marginVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  offlineNoticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  offlineNoticeText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  capabilitiesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
  },
  capabilitiesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  capabilityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  capabilityBullet: {
    fontSize: 16,
    color: '#2196F3',
    marginRight: 8,
    marginTop: 2,
  },
  capabilityText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  statsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666666',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  pendingContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  pendingText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
});

export default OfflineIndicator;