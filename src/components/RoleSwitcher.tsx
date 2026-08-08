import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Pressable } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { Ionicons } from '@expo/vector-icons';

const ROLES: { label: string; value: UserRole; icon: keyof typeof Ionicons.glyphMap; desc: string }[] = [
  { label: 'Employee', value: 'employee', icon: 'person-outline', desc: 'Submit claims, track workflow, view history' },
  { label: 'Manager', value: 'manager', icon: 'people-outline', desc: 'Review, approve, reject or ask clarification' },
  { label: 'Finance Team', value: 'finance', icon: 'card-outline', desc: 'Validate claims, process & release payments' },
  { label: 'Top Level', value: 'B', icon: 'briefcase-outline', desc: 'Finance-style actions with bulk payment release' },
];

export const RoleSwitcher: React.FC = () => {
  const { activeRole, setActiveRole, currentUser, logout } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);

  const currentRoleObj = ROLES.find(r => r.value === activeRole);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        activeOpacity={0.8} 
        style={styles.headerBar} 
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.leftInfo}>
          <View style={styles.avatarContainer}>
            <Ionicons name={currentRoleObj?.icon || 'person'} size={20} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.title}>SAP Fiori | {currentUser?.employeeName || 'Guest'}</Text>
            <View style={styles.badgeContainer}>
              <Text style={styles.roleBadgeText}>Role: {currentRoleObj?.label || 'None'}</Text>
              <Ionicons name="chevron-down" size={14} color="#005A9E" style={styles.chevron} />
            </View>
          </View>
        </View>
        <View style={styles.rightAction}>
          <Text style={styles.switchPrompt}>SWITCH ROLE</Text>
        </View>
      </TouchableOpacity>

      {/* Role Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Demonstration Role</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#333333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Switching roles updates your Fiori Launchpad context to demonstrate the complete expense claim and approval lifecycle.
            </Text>

            <View style={styles.roleList}>
              {ROLES.map((role) => {
                const isSelected = role.value === activeRole;
                return (
                  <TouchableOpacity
                    key={role.value}
                    style={[styles.roleCard, isSelected && styles.roleCardSelected]}
                    onPress={() => {
                      setActiveRole(role.value);
                      setModalVisible(false);
                    }}
                  >
                    <View style={[styles.roleIconBg, isSelected && styles.roleIconBgSelected]}>
                      <Ionicons name={role.icon} size={24} color={isSelected ? '#005A9E' : '#555555'} />
                    </View>
                    <View style={styles.roleTextContainer}>
                      <Text style={[styles.roleLabel, isSelected && styles.roleLabelSelected]}>{role.label}</Text>
                      <Text style={styles.roleDesc}>{role.desc}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color="#005A9E" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity 
              style={{ marginTop: 20, padding: 15, backgroundColor: '#fee2e2', borderRadius: 8, alignItems: 'center' }}
              onPress={() => {
                setModalVisible(false);
                logout();
              }}
            >
              <Text style={{ color: '#b91c1c', fontWeight: 'bold', fontSize: 16 }}>Logout / Clear Session</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#002E5D', // SAP Fiori Horizon Navy Blue
    borderBottomWidth: 1,
    borderBottomColor: '#004A87',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#005A9E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    color: '#E0F2FE',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  roleBadgeText: {
    color: '#005A9E',
    fontSize: 12,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: 4,
  },
  rightAction: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  switchPrompt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C2D42',
  },
  closeBtn: {
    padding: 4,
  },
  modalSub: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 20,
    lineHeight: 18,
  },
  roleList: {
    gap: 12,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleCardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#005A9E',
  },
  roleIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roleIconBgSelected: {
    backgroundColor: '#DBEAFE',
  },
  roleTextContainer: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 2,
  },
  roleLabelSelected: {
    color: '#005A9E',
    fontWeight: '700',
  },
  roleDesc: {
    fontSize: 12,
    color: '#64748B',
  },
});
