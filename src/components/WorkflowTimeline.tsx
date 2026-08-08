import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WorkflowEvent } from '../types';
import { Ionicons } from '@expo/vector-icons';

interface WorkflowTimelineProps {
  events: WorkflowEvent[];
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ events }) => {
  const getStepIcon = (outcome: string): keyof typeof Ionicons.glyphMap => {
    switch (outcome) {
      case 'Submitted':
      case 'Draft Updated':
        return 'document-text-outline';
      case 'Auto-Approved':
      case 'Approved':
        return 'checkmark-circle-outline';
      case 'Rejected':
        return 'close-circle-outline';
      case 'Validated':
        return 'shield-checkmark-outline';
      case 'Paid':
        return 'cash-outline';
      default:
        return 'time-outline';
    }
  };

  const getStepColor = (outcome: string) => {
    switch (outcome) {
      case 'Auto-Approved':
      case 'Approved':
      case 'Validated':
      case 'Paid':
        return '#10B981'; // Success green
      case 'Rejected':
        return '#EF4444'; // Error red
      case 'Submitted':
        return '#3B82F6'; // Info blue
      default:
        return '#6B7280'; // Neutral grey
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Workflow Audit Trail</Text>
      
      <View style={styles.timelineContainer}>
        {events.map((event, index) => {
          const isLast = index === events.length - 1;
          const iconName = getStepIcon(event.outcome);
          const color = getStepColor(event.outcome);

          return (
            <View key={index} style={styles.eventRow}>
              {/* Vertical line & Icon */}
              <View style={styles.iconColumn}>
                <View style={[styles.iconCircle, { borderColor: color }]}>
                  <Ionicons name={iconName} size={18} color={color} />
                </View>
                {!isLast && <View style={styles.verticalLine} />}
              </View>

              {/* Event Details */}
              <View style={styles.contentColumn}>
                <View style={styles.titleRow}>
                  <Text style={styles.stepName}>{event.step}</Text>
                  <Text style={[styles.outcomeBadge, { backgroundColor: `${color}1A`, color }]}>
                    {event.outcome}
                  </Text>
                </View>

                <Text style={styles.actorText}>Approver/Actor: {event.actor}</Text>
                <Text style={styles.timeText}>Timestamp: {event.timestamp}</Text>

                {event.remarks ? (
                  <View style={styles.remarksBox}>
                    <Text style={styles.remarksTitle}>Remarks / System Log:</Text>
                    <Text style={styles.remarksContent}>{event.remarks}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  eventRow: {
    flexDirection: 'row',
  },
  iconColumn: {
    alignItems: 'center',
    width: 30,
    marginRight: 12,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  contentColumn: {
    flex: 1,
    paddingBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stepName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  outcomeBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  actorText: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 2,
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
  },
  remarksBox: {
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3,
    borderLeftColor: '#005A9E',
    padding: 10,
    borderRadius: 6,
  },
  remarksTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  remarksContent: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
});
