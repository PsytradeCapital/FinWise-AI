import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert
} from 'react-native';

export interface ConflictData {
  id: string;
  collection: string;
  localData: any;
  remoteData: any;
  conflictedFields: string[];
}

interface ConflictResolutionModalProps {
  visible: boolean;
  conflicts: ConflictData[];
  onResolve: (resolutions: Record<string, 'local' | 'remote' | 'merge'>) => void;
  onCancel: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  visible,
  conflicts,
  onResolve,
  onCancel
}) => {
  const [resolutions, setResolutions] = useState<Record<string, 'local' | 'remote' | 'merge'>>({});

  const handleResolutionChange = (conflictId: string, resolution: 'local' | 'remote' | 'merge') => {
    setResolutions(prev => ({
      ...prev,
      [conflictId]: resolution
    }));
  };

  const handleResolveAll = () => {
    // Check if all conflicts have resolutions
    const unresolvedConflicts = conflicts.filter(conflict => !resolutions[conflict.id]);
    
    if (unresolvedConflicts.length > 0) {
      Alert.alert(
        'Incomplete Resolution',
        'Please resolve all conflicts before proceeding.',
        [{ text: 'OK' }]
      );
      return;
    }

    onResolve(resolutions);
    setResolutions({});
  };

  const handleCancel = () => {
    setResolutions({});
    onCancel();
  };

  const renderFieldComparison = (field: string, localValue: any, remoteValue: any) => {
    const formatValue = (value: any) => {
      if (value === null || value === undefined) return 'null';
      if (typeof value === 'object') return JSON.stringify(value, null, 2);
      return String(value);
    };

    return (
      <View key={field} style={styles.fieldComparison}>
        <Text style={styles.fieldName}>{field}</Text>
        
        <View style={styles.valueComparison}>
          <View style={styles.valueContainer}>
            <Text style={styles.valueLabel}>Local</Text>
            <Text style={styles.valueText}>{formatValue(localValue)}</Text>
          </View>
          
          <View style={styles.valueContainer}>
            <Text style={styles.valueLabel}>Remote</Text>
            <Text style={styles.valueText}>{formatValue(remoteValue)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderConflict = (conflict: ConflictData) => {
    const resolution = resolutions[conflict.id];

    return (
      <View key={conflict.id} style={styles.conflictContainer}>
        <Text style={styles.conflictTitle}>
          {conflict.collection} - {conflict.id}
        </Text>
        
        <Text style={styles.conflictDescription}>
          This item has been modified both locally and remotely. 
          Please choose how to resolve the conflict:
        </Text>

        {/* Show conflicted fields */}
        <View style={styles.fieldsContainer}>
          {conflict.conflictedFields.map(field => 
            renderFieldComparison(
              field, 
              conflict.localData[field], 
              conflict.remoteData[field]
            )
          )}
        </View>

        {/* Resolution options */}
        <View style={styles.resolutionOptions}>
          <TouchableOpacity
            style={[
              styles.resolutionButton,
              resolution === 'local' && styles.selectedResolution
            ]}
            onPress={() => handleResolutionChange(conflict.id, 'local')}
          >
            <Text style={[
              styles.resolutionButtonText,
              resolution === 'local' && styles.selectedResolutionText
            ]}>
              Keep Local Changes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.resolutionButton,
              resolution === 'remote' && styles.selectedResolution
            ]}
            onPress={() => handleResolutionChange(conflict.id, 'remote')}
          >
            <Text style={[
              styles.resolutionButtonText,
              resolution === 'remote' && styles.selectedResolutionText
            ]}>
              Use Remote Version
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.resolutionButton,
              resolution === 'merge' && styles.selectedResolution
            ]}
            onPress={() => handleResolutionChange(conflict.id, 'merge')}
          >
            <Text style={[
              styles.resolutionButtonText,
              resolution === 'merge' && styles.selectedResolutionText
            ]}>
              Merge Changes
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Resolve Sync Conflicts</Text>
          <Text style={styles.headerSubtitle}>
            {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} found
          </Text>
        </View>

        <ScrollView style={styles.scrollContainer}>
          {conflicts.map(renderConflict)}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resolveButton}
            onPress={handleResolveAll}
          >
            <Text style={styles.resolveButtonText}>Resolve All</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  conflictContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFD93D',
  },
  conflictTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  conflictDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    lineHeight: 20,
  },
  fieldsContainer: {
    marginBottom: 16,
  },
  fieldComparison: {
    marginBottom: 12,
  },
  fieldName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  valueComparison: {
    flexDirection: 'row',
    gap: 12,
  },
  valueContainer: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 4,
    padding: 8,
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  valueText: {
    fontSize: 12,
    color: '#333333',
    fontFamily: 'monospace',
  },
  resolutionOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  resolutionButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedResolution: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  resolutionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
  },
  selectedResolutionText: {
    color: '#2196F3',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  resolveButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  resolveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ConflictResolutionModal;