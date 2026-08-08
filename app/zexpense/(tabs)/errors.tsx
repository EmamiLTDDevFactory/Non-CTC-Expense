import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useClaim } from '../../../src/context/ClaimContext';
import { Ionicons } from '@expo/vector-icons';

export default function ErrorsScreen() {
  const { errors, retrySAPPosting } = useClaim();

  const handleRetry = (errorId: string, claimId: string) => {
    Alert.alert(
      'Retry SAP Posting',
      `Re-trigger the background RFC queue to post accounting document for claim ${claimId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retry Posting',
          onPress: () => {
            retrySAPPosting(errorId);
            Alert.alert('Success', `Posting re-triggered successfully. Error ${errorId} marked as Resolved.`);
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.pageTitle}>SAP Error Management</Text>
        <Text style={styles.pageSubtitle}>Monitor backend integration failures and re-trigger posting queues</Text>
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {errors.map(err => {
          const isResolved = err.status === 'Resolved';
          return (
            <View key={err.id} style={styles.errorCard}>
              <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                  <Ionicons 
                    name={isResolved ? 'checkmark-circle' : 'alert-circle'} 
                    size={22} 
                    color={isResolved ? '#10B981' : '#DC2626'} 
                  />
                  <Text style={styles.errorId}>{err.id} • Claim: {err.claimId}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isResolved ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Text style={[styles.statusText, { color: isResolved ? '#065F46' : '#991B1B' }]}>{err.status}</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.label}>ERROR TYPE</Text>
                <Text style={styles.errorType}>{err.errorType}</Text>

                <Text style={styles.label}>SYSTEM MESSAGE</Text>
                <Text style={styles.errorMessage}>{err.errorMessage}</Text>

                <Text style={styles.label}>ROOT CAUSE ANALYSIS</Text>
                <Text style={styles.rootCause}>{err.rootCause}</Text>

                <View style={styles.historySection}>
                  <Text style={styles.historySectionTitle}>Resolution & Diagnostic History</Text>
                  {err.resolutionHistory.map((hist, index) => (
                    <View key={index} style={styles.historyRow}>
                      <View style={styles.historyDot} />
                      <View style={styles.historyTextCol}>
                        <View style={styles.historyHeader}>
                          <Text style={styles.historyBy}>{hist.resolvedBy}</Text>
                          <Text style={styles.historyTime}>{hist.timestamp}</Text>
                        </View>
                        <Text style={styles.historyNotes}>{hist.notes}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Action Footer (BR-018) */}
              {!isResolved && (
                <View style={styles.actionFooter}>
                  <TouchableOpacity style={styles.retryBtn} onPress={() => handleRetry(err.id, err.claimId)}>
                    <Ionicons name="sync" size={18} color="#FFFFFF" />
                    <Text style={styles.retryBtnText}>Retry Processing (Re-trigger Posting)</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topSection: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorId: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardBody: {
    padding: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  errorType: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 14,
  },
  errorMessage: {
    fontSize: 14,
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  rootCause: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 20,
  },
  historySection: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  historySectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#005A9E',
    marginTop: 6,
    marginRight: 10,
  },
  historyTextCol: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  historyBy: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  historyTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  historyNotes: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  actionFooter: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#005A9E',
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
  },
});
