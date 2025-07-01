// File: app/(tabs)/profile.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { auth, db } from '../../firebase/config';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
  addDoc,
} from 'firebase/firestore';
import { updateProfile, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';

export default function Profile() {
  const router = useRouter();
  const user = auth.currentUser!;
  const uid = user.uid;

  // Account info
  const [name, setName] = useState(user.displayName || '');
  const [email, setEmail] = useState(user.email || '');

  // Preferences
  const [theme, setTheme] = useState<'light'|'dark'|'system'>('system');
  const [currency, setCurrency] = useState<'USD'|'EUR'|'GBP'>('USD');
  const [chartDefault, setChartDefault] = useState<'candlestick'|'line'>('line');
  const [language, setLanguage] = useState<'en'|'es'|'fr'>('en');

  // Saved items
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [dashboards, setDashboards] = useState<any[]>([]);

  // Feedback
  const [feedback, setFeedback] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);

  // Load user preferences and saved items
  useEffect(() => {
    (async () => {
      // prefs stored in user doc
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.theme) setTheme(data.theme);
        if (data.currency) setCurrency(data.currency);
        if (data.chartDefault) setChartDefault(data.chartDefault);
        if (data.language) setLanguage(data.language);
      }
      // watchlist
      const wlSnap = await getDocs(collection(db, 'users', uid, 'watchlist'));
      setWatchlist(wlSnap.docs.map(d => d.data().symbol as string));
      // comparisons
      const compSnap = await getDocs(collection(db, 'users', uid, 'comparisons'));
      setComparisons(compSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      // dashboards
      const dbSnap = await getDocs(collection(db, 'users', uid, 'dashboards'));
      setDashboards(dbSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  // Update display name
  const saveName = async () => {
    try {
      await updateProfile(user, { displayName: name.trim() });
      await updateDoc(doc(db, 'users', uid), { name: name.trim() });
      Alert.alert('Success', 'Name updated');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // Change password flow
  const changePassword = async () => {
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        'Password Reset',
        'A reset link has been sent to your email.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // Save preferences
  const savePreferences = async () => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        theme, currency, chartDefault, language,
      });
      Alert.alert('Success', 'Preferences saved');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // Submit feedback
  const submitFeedback = async () => {
    if (!feedback.trim()) {
      Alert.alert('Please enter feedback');
      return;
    }
    setSavingFeedback(true);
    try {
      await addDoc(collection(db, 'users', uid, 'feedback'), {
        message: feedback.trim(),
        timestamp: new Date(),
      });
      setFeedback('');
      Alert.alert('Thank you!', 'Your feedback has been submitted.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingFeedback(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  // Admin check
  const isAdmin = user.email === 'admin@stockvista.com';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={{ uri: user.photoURL || 'https://via.placeholder.com/100' }}
          style={styles.avatar}
        />
        <Text style={styles.headerTitle}>Your Profile</Text>
        <Text style={styles.subtitle}>Manage your account settings</Text>
      </View>

      {/* 1. Account Info */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Display Name</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your Name"
            />
            <TouchableOpacity style={styles.iconButton} onPress={saveName}>
              <Ionicons name="checkmark-circle" size={24} color="#3498db" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{email}</Text>
          </View>
          <TouchableOpacity 
            style={styles.changeButton}
            onPress={() => router.push('/profile/change-email')}
          >
            <Text style={styles.changeButtonText}>Change</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={changePassword}
        >
          <Ionicons name="key" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Change Password</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Preferences */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        
        {[
          { label: 'Theme', value: theme, options: ['light','dark','system'], setter: setTheme },
          { label: 'Currency', value: currency, options: ['USD','EUR','GBP'], setter: setCurrency },
          { label: 'Chart Default', value: chartDefault, options: ['candlestick','line'], setter: setChartDefault },
          { label: 'Language', value: language, options: ['en','es','fr'], setter: setLanguage },
        ].map(pref => (
          <View key={pref.label} style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>{pref.label}</Text>
            <View style={styles.pickerContainer}>
              {pref.options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.pickerOption,
                    pref.value === opt && styles.pickerOptionActive,
                  ]}
                  onPress={() => pref.setter(opt as any)}
                >
                  <Text
                    style={[
                      styles.pickerText,
                      pref.value === opt && styles.pickerTextActive
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.saveButton]}
          onPress={savePreferences}
        >
          <Ionicons name="save" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Save Preferences</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Saved Items */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Saved Items</Text>
        
        <TouchableOpacity 
          style={styles.savedItem}
          onPress={() => router.push('/watchlist')}
        >
          <Ionicons name="star" size={24} color="#f39c12" />
          <View style={styles.savedItemContent}>
            <Text style={styles.savedItemTitle}>Watchlist</Text>
            <Text style={styles.savedItemSubtitle}>{watchlist.length} items saved</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#95a5a6" />
        </TouchableOpacity>
        
        <Text style={styles.subHeader}>Comparisons</Text>
        {comparisons.length > 0 ? (
          <FlatList
            data={comparisons}
            scrollEnabled={false}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.savedItem}>
                <Ionicons name="swap-horizontal" size={24} color="#3498db" />
                <View style={styles.savedItemContent}>
                  <Text style={styles.savedItemTitle}>{item.name || item.symbols.join(', ')}</Text>
                  <Text style={styles.savedItemSubtitle}>Created: {new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</Text>
                </View>
                <View style={styles.savedItemActions}>
                  <TouchableOpacity 
                    style={styles.savedItemButton}
                    onPress={() => router.push({ pathname: '/compare', params: { symbols: item.symbols.join(',') } })}
                  >
                    <Ionicons name="eye" size={20} color="#3498db" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.savedItemButton}
                    onPress={async () => {
                      await deleteDoc(doc(db, 'users', uid, 'comparisons', item.id));
                      setComparisons(cs => cs.filter(c => c.id !== item.id));
                    }}
                  >
                    <Ionicons name="trash" size={20} color="#e74c3c" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        ) : (
          <Text style={styles.emptyText}>No saved comparisons</Text>
        )}
        
        <Text style={styles.subHeader}>Dashboards</Text>
        {dashboards.length > 0 ? (
          <FlatList
            data={dashboards}
            scrollEnabled={false}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.savedItem}
                onPress={() => router.push(item.route)}
              >
                <Ionicons name="grid" size={24} color="#9b59b6" />
                <View style={styles.savedItemContent}>
                  <Text style={styles.savedItemTitle}>{item.name}</Text>
                  <Text style={styles.savedItemSubtitle}>{item.widgets?.length || 0} widgets</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#95a5a6" />
              </TouchableOpacity>
            )}
          />
        ) : (
          <Text style={styles.emptyText}>No saved dashboards</Text>
        )}
      </View>

      {/* 4. Integrations & API */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Integrations</Text>
        
        <TouchableOpacity style={styles.integrationItem}>
          <Ionicons name="key" size={24} color="#2c3e50" />
          <Text style={styles.integrationText}>Manage API Key</Text>
          <Ionicons name="chevron-forward" size={24} color="#95a5a6" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.integrationItem}>
          <Ionicons name="notifications" size={24} color="#2c3e50" />
          <Text style={styles.integrationText}>Notification Channels</Text>
          <Ionicons name="chevron-forward" size={24} color="#95a5a6" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.integrationItem}>
          <Ionicons name="link" size={24} color="#2c3e50" />
          <Text style={styles.integrationText}>Connected Accounts</Text>
          <Ionicons name="chevron-forward" size={24} color="#95a5a6" />
        </TouchableOpacity>
      </View>

      {/* 5. Subscription & Billing */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        
        <TouchableOpacity style={styles.integrationItem}>
          <Ionicons name="card" size={24} color="#27ae60" />
          <View>
            <Text style={styles.integrationText}>Premium Plan</Text>
            <Text style={styles.subscriptionStatus}>Active until Dec 31, 2024</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#95a5a6" />
        </TouchableOpacity>
      </View>

      {/* 6. Admin Access */}
      {isAdmin && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Admin Tools</Text>
          
          <TouchableOpacity style={styles.integrationItem} onPress={() => router.push('/admin')}>
            <Ionicons name="construct" size={24} color="#e67e22" />
            <Text style={styles.integrationText}>Admin Panel</Text>
            <Ionicons name="chevron-forward" size={24} color="#95a5a6" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.integrationItem}>
            <Ionicons name="document-text" size={24} color="#e67e22" />
            <Text style={styles.integrationText}>Activity Log</Text>
            <Ionicons name="chevron-forward" size={24} color="#95a5a6" />
          </TouchableOpacity>
        </View>
      )}

      {/* 7. Feedback & Support */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Support & Feedback</Text>
        
        <TextInput
          style={styles.feedbackInput}
          placeholder="Share your feedback or report an issue..."
          placeholderTextColor="#95a5a6"
          multiline
          value={feedback}
          onChangeText={setFeedback}
        />
        
        <TouchableOpacity
          style={[styles.actionButton, styles.feedbackButton]}
          onPress={submitFeedback}
          disabled={savingFeedback}
        >
          <Ionicons name="send" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>
            {savingFeedback ? 'Sending...' : 'Submit Feedback'}
          </Text>
        </TouchableOpacity>
        
        <View style={styles.supportLinks}>
          <TouchableOpacity 
            style={styles.supportLink}
            onPress={() => Linking.openURL('https://yourapp.helpcenter.com')}
          >
            <Ionicons name="help-circle" size={24} color="#3498db" />
            <Text style={styles.supportLinkText}>Help Center</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.supportLink}
            onPress={() => Linking.openURL('mailto:support@stockvista.com')}
          >
            <Ionicons name="mail" size={24} color="#3498db" />
            <Text style={styles.supportLinkText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 8. About & Version */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>About</Text>
        
        <Text style={styles.versionText}>
          Version {Constants.manifest?.version || Constants.expoConfig?.version}
        </Text>
        
        <View style={styles.legalLinks}>
          <TouchableOpacity 
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://yourapp.com/terms')}
          >
            <Text style={styles.legalLinkText}>Terms of Service</Text>
          </TouchableOpacity>
          
          <View style={styles.divider} />
          
          <TouchableOpacity 
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://yourapp.com/privacy')}
          >
            <Text style={styles.legalLinkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity 
        style={[styles.actionButton, styles.signOutButton]}
        onPress={handleSignOut}
      >
        <Ionicons name="log-out" size={24} color="#fff" />
        <Text style={styles.actionButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#ecf0f1',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e6ed',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  iconButton: {
    padding: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#2c3e50',
  },
  changeButton: {
    backgroundColor: '#ecf0f1',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  changeButtonText: {
    color: '#3498db',
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#2ecc71',
    marginTop: 16,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  preferenceLabel: {
    width: 120,
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  pickerContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pickerOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e6ed',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  pickerOptionActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  pickerText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  pickerTextActive: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  subHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 12,
  },
  savedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  savedItemContent: {
    flex: 1,
    marginLeft: 16,
  },
  savedItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  savedItemSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  savedItemActions: {
    flexDirection: 'row',
  },
  savedItemButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyText: {
    color: '#95a5a6',
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  integrationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  integrationText: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    marginLeft: 16,
  },
  subscriptionStatus: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  feedbackInput: {
    height: 120,
    borderWidth: 1,
    borderColor: '#e0e6ed',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  feedbackButton: {
    backgroundColor: '#9b59b6',
  },
  supportLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  supportLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#ecf0f1',
    borderRadius: 12,
    marginHorizontal: 8,
  },
  supportLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3498db',
    marginLeft: 8,
  },
  versionText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: 14,
    marginBottom: 16,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  legalLink: {
    paddingHorizontal: 16,
  },
  legalLinkText: {
    color: '#3498db',
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: '#bdc3c7',
    marginVertical: 4,
  },
  signOutButton: {
    backgroundColor: '#e74c3c',
    marginTop: 20,
  },
});