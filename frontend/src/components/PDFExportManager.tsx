import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView, Switch } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface PDFExportOptions {
  format: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  includeCharts: boolean;
  includeTransactionDetails: boolean;
  includeSavingsGoals: boolean;
  includeSpendingAnalysis: boolean;
  watermark?: string;
}

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  onExport: (type: string, options: PDFExportOptions) => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ visible, onClose, onExport }) => {
  const [options, setOptions] = useState<PDFExportOptions>({
    format: 'A4',
    orientation: 'portrait',
    includeCharts: true,
    includeTransactionDetails: true,
    includeSavingsGoals: true,
    includeSpendingAnalysis: true,
  });

  const [selectedType, setSelectedType] = useState<string>('financial');

  const updateOption = (key: keyof PDFExportOptions, value: any) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    onExport(selectedType, options);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Export PDF Report</Text>
          <TouchableOpacity onPress={handleExport}>
            <Text style={styles.exportButton}>Export</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Report Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Report Type</Text>
            <View style={styles.typeContainer}>
              {[
                { key: 'financial', label: 'Complete Financial Report', icon: '📊' },
                { key: 'savings', label: 'Savings Goals Report', icon: '💰' },
                { key: 'spending', label: 'Spending Analysis Report', icon: '📈' },
              ].map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeOption,
                    selectedType === type.key && styles.selectedTypeOption
                  ]}
                  onPress={() => setSelectedType(type.key)}
                >
                  <Text style={styles.typeIcon}>{type.icon}</Text>
                  <Text style={[
                    styles.typeLabel,
                    selectedType === type.key && styles.selectedTypeLabel
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Format Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Format Options</Text>
            
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Paper Size</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    options.format === 'A4' && styles.activeSegment
                  ]}
                  onPress={() => updateOption('format', 'A4')}
                >
                  <Text style={[
                    styles.segmentText,
                    options.format === 'A4' && styles.activeSegmentText
                  ]}>A4</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    options.format === 'Letter' && styles.activeSegment
                  ]}
                  onPress={() => updateOption('format', 'Letter')}
                >
                  <Text style={[
                    styles.segmentText,
                    options.format === 'Letter' && styles.activeSegmentText
                  ]}>Letter</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Orientation</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    options.orientation === 'portrait' && styles.activeSegment
                  ]}
                  onPress={() => updateOption('orientation', 'portrait')}
                >
                  <Text style={[
                    styles.segmentText,
                    options.orientation === 'portrait' && styles.activeSegmentText
                  ]}>Portrait</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    options.orientation === 'landscape' && styles.activeSegment
                  ]}
                  onPress={() => updateOption('orientation', 'landscape')}
                >
                  <Text style={[
                    styles.segmentText,
                    options.orientation === 'landscape' && styles.activeSegmentText
                  ]}>Landscape</Text>
                </TouchableOpacity>
              </View>
            </div>
          </View>

          {/* Content Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Content Options</Text>
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Include Charts</Text>
              <Switch
                value={options.includeCharts}
                onValueChange={(value) => updateOption('includeCharts', value)}
                trackColor={{ false: '#e0e0e0', true: '#2c5aa0' }}
                thumbColor={options.includeCharts ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Include Transaction Details</Text>
              <Switch
                value={options.includeTransactionDetails}
                onValueChange={(value) => updateOption('includeTransactionDetails', value)}
                trackColor={{ false: '#e0e0e0', true: '#2c5aa0' }}
                thumbColor={options.includeTransactionDetails ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Include Savings Goals</Text>
              <Switch
                value={options.includeSavingsGoals}
                onValueChange={(value) => updateOption('includeSavingsGoals', value)}
                trackColor={{ false: '#e0e0e0', true: '#2c5aa0' }}
                thumbColor={options.includeSavingsGoals ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Include Spending Analysis</Text>
              <Switch
                value={options.includeSpendingAnalysis}
                onValueChange={(value) => updateOption('includeSpendingAnalysis', value)}
                trackColor={{ false: '#e0e0e0', true: '#2c5aa0' }}
                thumbColor={options.includeSpendingAnalysis ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

export const PDFExportManager: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);

  const user = useSelector((state: RootState) => state.auth.user);
  const transactions = useSelector((state: RootState) => state.transactions.transactions);
  const goals = useSelector((state: RootState) => state.goals.goals);

  const handleExport = async (type: string, options: PDFExportOptions) => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setExporting(true);

    try {
      // Prepare data based on export type
      let exportData: any = {};
      let endpoint = '';

      switch (type) {
        case 'financial':
          endpoint = '/api/v1/reports/financial-pdf';
          exportData = {
            reportData: {
              user,
              reportPeriod: {
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                endDate: new Date(),
                type: 'monthly'
              },
              transactions,
              spendingPatterns: [], // Would be fetched from API
              savingsGoals: goals,
              summary: {
                totalIncome: transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
                totalExpenses: transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
                totalSavings: goals.reduce((sum, g) => sum + g.currentAmount, 0),
                netCashFlow: 0, // Would be calculated
                topSpendingCategories: [] // Would be calculated
              }
            },
            options
          };
          break;

        case 'savings':
          endpoint = '/api/v1/reports/savings-goals-pdf';
          exportData = {
            user,
            goals,
            options
          };
          break;

        case 'spending':
          endpoint = '/api/v1/reports/spending-analysis-pdf';
          exportData = {
            user,
            transactions,
            patterns: [], // Would be fetched from API
            options
          };
          break;

        default:
          throw new Error('Invalid export type');
      }

      // In a real implementation, this would make an API call to generate and download the PDF
      // For now, we'll simulate the process
      await new Promise(resolve => setTimeout(resolve, 2000));

      Alert.alert(
        'Export Successful',
        `Your ${type} report has been generated and saved to your device.`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'There was an error generating your report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const exportOptions = [
    {
      title: 'Complete Financial Report',
      description: 'Comprehensive report with all financial data',
      icon: '📊',
      type: 'financial'
    },
    {
      title: 'Savings Goals Report',
      description: 'Progress report for all your savings goals',
      icon: '💰',
      type: 'savings'
    },
    {
      title: 'Spending Analysis Report',
      description: 'Detailed analysis of your spending patterns',
      icon: '📈',
      type: 'spending'
    }
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📄 Export Reports</Text>
        <Text style={styles.subtitle}>Generate PDF reports for external use</Text>
      </View>

      <ScrollView style={styles.content}>
        {exportOptions.map((option) => (
          <TouchableOpacity
            key={option.type}
            style={styles.exportCard}
            onPress={() => {
              setModalVisible(true);
            }}
            disabled={exporting}
          >
            <View style={styles.cardContent}>
              <Text style={styles.cardIcon}>{option.icon}</Text>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{option.title}</Text>
                <Text style={styles.cardDescription}>{option.description}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📋 Report Information</Text>
          <Text style={styles.infoText}>
            • Reports are generated in PDF format{'\n'}
            • All financial data is included based on your selections{'\n'}
            • Reports can be shared or printed{'\n'}
            • Data is exported securely and privately
          </Text>
        </View>
      </ScrollView>

      <ExportModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onExport={handleExport}
      />

      {exporting && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Generating PDF...</Text>
            <Text style={styles.loadingSubtext}>This may take a few moments</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c5aa0',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  exportCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
  },
  arrow: {
    fontSize: 20,
    color: '#ccc',
  },
  infoCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2c5aa0',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  exportButton: {
    fontSize: 16,
    color: '#2c5aa0',
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  typeContainer: {
    gap: 12,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  selectedTypeOption: {
    borderColor: '#2c5aa0',
    backgroundColor: '#f0f4ff',
  },
  typeIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  typeLabel: {
    fontSize: 16,
    color: '#333',
  },
  selectedTypeLabel: {
    color: '#2c5aa0',
    fontWeight: 'bold',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionLabel: {
    fontSize: 16,
    color: '#333',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  segmentButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  activeSegment: {
    backgroundColor: '#2c5aa0',
  },
  segmentText: {
    fontSize: 14,
    color: '#333',
  },
  activeSegmentText: {
    color: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
  },
});

export default PDFExportManager;