import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { EmployeeProfile, UserRole } from '../types';

interface AuthContextType {
  activeRole: UserRole | null;
  currentUser: EmployeeProfile | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (employeeId: string, role: UserRole, name?: string, info?: any) => boolean;
  logout: () => void;
  setActiveRole: (role: UserRole | null) => void;
  validEmployeeIds: string[];
}

const PROFILES: Record<UserRole, EmployeeProfile> = {
  employee: {
    employeeId: 'EMP-9021',
    employeeName: 'John Doe',
    department: 'Sales & Marketing',
    designation: 'Senior Sales Representative',
    role: 'employee',
  },
  manager: {
    employeeId: 'MGR-4052',
    employeeName: 'Sarah Connor',
    department: 'Sales & Marketing',
    designation: 'Regional Sales Manager',
    role: 'manager',
  },
  finance: {
    employeeId: 'FIN-1092',
    employeeName: 'Robert Miller',
    department: 'Finance & Accounts',
    designation: 'Financial Claims Analyst',
    role: 'finance',
  },
  B: {
    employeeId: 'TOP-0001',
    employeeName: 'Priya Sharma',
    department: 'Finance & Accounts',
    designation: 'Top Level Approver',
    role: 'B',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeRole = (role: unknown): UserRole | null => {
  if (typeof role !== 'string') return null;
  const trimmed = role.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'employee' || lower === 'manager' || lower === 'finance') {
    return lower as UserRole;
  }
  if (trimmed.toUpperCase() === 'B') {
    return 'B';
  }
  return null;
};

const isUserRole = (role: unknown): role is UserRole => {
  return normalizeRole(role) !== null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const currentUser = activeRole ? PROFILES[activeRole] : null;
  const isAuthenticated = !!activeRole;

  const validEmployeeIds = Object.values(PROFILES).map(p => p.employeeId);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        let savedSession: string | null = null;
        if (typeof window !== 'undefined' && window.sessionStorage) {
          await AsyncStorage.removeItem('user_session').catch(() => {});
          savedSession = window.sessionStorage.getItem('user_session');
        } else {
          savedSession = await AsyncStorage.getItem('user_session');
        }

        if (!savedSession) return;

        const parsedSession = JSON.parse(savedSession);
        const role = normalizeRole(parsedSession?.role);
        const employeeId = parsedSession?.employeeId;
        const name = parsedSession?.name;

        if (!role || !employeeId || !PROFILES[role]) {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.removeItem('user_session');
          }
          await AsyncStorage.removeItem('user_session');
          return;
        }

        PROFILES[role].employeeId = employeeId;
        if (name) {
          PROFILES[role].name = name;
          PROFILES[role].employeeName = name;
        }
        // restore any extra info saved during login
        const info = parsedSession?.info;
        if (info) {
          if (info.Department) PROFILES[role].department = info.Department;
          if (info.Designation) PROFILES[role].designation = info.Designation;
          const rawCc = info.CostCenter || info.costCenter || info.Costcenter || (PROFILES[role] as any).costCenter || '';
          const ltext = info.Ltext || info.ltext || info.LTEXT || info.LText || '';
          const formattedCc = (rawCc && ltext && !String(rawCc).includes('(')) ? `${rawCc} (${ltext})` : rawCc;
          (PROFILES[role] as any).costCenter = formattedCc;
          (PROFILES[role] as any).CostCenter = formattedCc;
          (PROFILES[role] as any).gst = info.GstSet || info.Gst || info.gst || (PROFILES[role] as any).gst;
        }
        setActiveRole(role);
      } catch (error) {
        console.error('Failed to restore user session:', error);
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.removeItem('user_session');
        }
        await AsyncStorage.removeItem('user_session').catch(console.error);
      } finally {
        setIsInitializing(false);
      }
    };

    restoreSession();
  }, []);

  const login = (employeeId: string, role: UserRole, name?: string, info?: any): boolean => {
    setActiveRole(role);
    if (PROFILES[role]) {
      PROFILES[role].employeeId = employeeId;
      if (name) {
        PROFILES[role].name = name;
        // also populate employeeName for compatibility
        PROFILES[role].employeeName = name;
      }

      // If the OTP/verify response included additional fields, map them into the profile
      try {
        if (info) {
          if (info.Department) PROFILES[role].department = info.Department;
          if (info.designation) PROFILES[role].designation = info.designation;
          if (info.Designation) PROFILES[role].designation = info.Designation;
          if (info.employeeName) PROFILES[role].employeeName = info.employeeName;
          if (info.Name) PROFILES[role].employeeName = info.Name;
          // store cost center formatted with Ltext in brackets if available
          const rawCc = info.CostCenter || info.costCenter || info.Costcenter || (PROFILES[role] as any).costCenter || '';
          const ltext = info.Ltext || info.ltext || info.LTEXT || info.LText || '';
          const formattedCc = (rawCc && ltext && !String(rawCc).includes('(')) ? `${rawCc} (${ltext})` : rawCc;
          (PROFILES[role] as any).costCenter = formattedCc;
          (PROFILES[role] as any).CostCenter = formattedCc;
          (PROFILES[role] as any).gst = info.GstSet || info.Gst || info.gst || (PROFILES[role] as any).gst;
        }
      } catch (e) {
        console.warn('Failed to map extra profile fields', e);
      }

      // Save session securely to sessionStorage on web (and AsyncStorage as fallback)
      const sessionData = JSON.stringify({ role, employeeId, name, info });
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('user_session', sessionData);
      } else {
        AsyncStorage.setItem('user_session', sessionData).catch(console.error);
      }
    }
    return true;
  };

  const logout = () => {
    setActiveRole(null);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem('user_session');
    }
    AsyncStorage.removeItem('user_session').catch(console.error);
  };

  return (
    <AuthContext.Provider value={{ activeRole, currentUser, isAuthenticated, isInitializing, login, logout, setActiveRole, validEmployeeIds }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
