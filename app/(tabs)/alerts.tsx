// File: app/(tabs)/alerts.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Notifications from 'expo-notifications';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';

const ALPHA_VANTAGE_API_KEY = 'YOUR_API_KEY'; // replace with your key

export default function Alerts() {
  const uid = auth.currentUser?.uid!;
  const [symbol, setSymbol] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Request push notification permissions
  useEffect(() => {
    Notifications.requestPermissionsAsync();
    fetchAlerts();
  }, []);

  // Fetch user's alerts from Firestore
  const fetchAlerts = async () => {
    try {
      const q = query(
        collection(db, 'users', uid, 'alerts'),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    }
  };

  // Add a new alert
  const addAlert = async () => {
    if (!symbol.trim() || !targetPrice.trim()) {
      Alert.alert('Error', 'Please enter symbol and target price.');
      return;
    }
    const price = parseFloat(targetPrice);
    if (isNaN(price)) {
      Alert.alert('Error', 'Target price must be a number.');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'users', uid, 'alerts'), {
        symbol: symbol.toUpperCase(),
        targetPrice: price,
        direction,
        timestamp: new Date(),
      });
      setSymbol('');
      setTargetPrice('');
      fetchAlerts();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Remove an alert
  const removeAlert = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid, 'alerts', id));
      fetchAlerts();
    } catch (err) {
      Alert.alert('Error', 'Could not remove alert.');
    }
  };

  // Check all alerts manually
  const checkAlerts = async () => {
    if (alerts.length === 0) {
      Alert.alert('No alerts', 'You have no alerts to check.');
      return;
    }
    setChecking(true);
    let triggered = 0;
    try {
      for (const a of alerts) {
        const res = await fetch(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${a.symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
        );
        const json = await res.json();
        const price = parseFloat(json['Global Quote']?.['05. price'] ?? '0');
        const met =
          (a.direction === 'above' && price >= a.targetPrice) ||
          (a.direction === 'below' && price <= a.targetPrice);
        if (met) {
          triggered++;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Price Alert',
              body: `${a.symbol} is now $${price.toFixed(2)} (${a.direction} $${a.targetPrice})`,
            },
            trigger: null,
          });
        }
      }
      Alert.alert('Alerts Checked', `${triggered} of ${alerts.length} triggered.`);
    } catch (err) {
      Alert.alert('Error', 'Could not check alerts.');
    } finally {
      setChecking(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.alertItem}>
      <View style={styles.alertInfo}>
        <Text style={styles.symbol}>{item.symbol}</Text>
        <Text>
          {item.direction === 'above' ? 'Above' : 'Below'} ${item.targetPrice}
        </Text>
      </View>
      <TouchableOpacity onPress={() => removeAlert(item.id)}>
        <Text style={styles.remove}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Price Alerts</Text>

      {/* Form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Ticker (e.g., AAPL)"
          value={symbol}
          onChangeText={setSymbol}
          autoCapitalize="characters"
        />
        <TextInput
          style={styles.input}
          placeholder="Target Price"
          value={targetPrice}
          onChangeText={setTargetPrice}
          keyboardType="numeric"
        />
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={direction}
            onValueChange={(v:any) => setDirection(v)}
            style={styles.picker}
          >
            <Picker.Item label="Above" value="above" />
            <Picker.Item label="Below" value="below" />
          </Picker>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={addAlert}
          disabled={loading}
        >
          <Text style={styles.addButtonText}>
            {loading ? 'Adding...' : 'Add Alert'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Check Alerts */}
      <TouchableOpacity
        style={styles.checkButton}
        onPress={checkAlerts}
        disabled={checking}
      >
        <Text style={styles.checkButtonText}>
          {checking ? 'Checking...' : 'Check All Alerts'}
        </Text>
      </TouchableOpacity>
      {checking && <ActivityIndicator color="#007bff" style={{ marginTop: 8 }} />}

      {/* List of Alerts */}
      <FlatList
        style={styles.list}
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No alerts set yet.</Text>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  form: { marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginBottom: 12,
  },
  picker: { height: 50, width: '100%' },
  addButton: {
    backgroundColor: '#007bff',
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
  checkButton: {
    backgroundColor: '#28a745',
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 16,
  },
  checkButtonText: { color: '#fff', fontWeight: 'bold' },
  list: { flex: 1 },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  alertInfo: {},
  symbol: { fontSize: 16, fontWeight: 'bold' },
  remove: { color: '#dc3545', fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#666', marginTop: 40, fontSize: 16 },
});
