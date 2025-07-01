import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { auth, db } from '../../../firebase/config';
import {
  collection,
  getDocs,
  query,
  orderBy,
  setDoc,
  doc
} from 'firebase/firestore';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// API endpoints - Updated to use your FastAPI
const FAST_API_BASE =  "http://192.168.100.11:8000"; // REPLACE WITH YOUR ACTUAL SERVER ADDRESS
const FINNHUB_API_KEY = 'd1dbfhpr01qn1ojmijcgd1dbfhpr01qn1ojmijd0';

const TOP_PAKISTANI_STOCKS = ['OGDC', 'PPL', 'PSO', 'HBL', 'UBL', 'LUCK'];
const CHART_WIDTH = Dimensions.get('window').width - 32;

interface AdminData {
  id: string;
  title: string;
  description: string;
  type: string;
  timestamp: any;
  logoUrl?: string;
}

interface StockQuote {
  symbol: string;
  price: string;
  change: string;
  percent: string;
}

interface NewsItem {
  id: number;
  headline: string;
  summary: string;
  url: string;
  image: string;
  source: string;
}

// Helper function to format date as YYYY-MM-DD
const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0];
};

// Safe JSON parsing with error handling
const safeJsonParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('JSON parse error:', error);
    return null;
  }
};

export default function Home() {
  const router = useRouter();
  const uid = auth.currentUser?.uid;
  const searchInputRef = useRef<TextInput>(null);

  // State declarations
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(TOP_PAKISTANI_STOCKS);
  const [searchQuery, setSearchQuery] = useState('');
  const [spotlight, setSpotlight] = useState<AdminData[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [watchlistData, setWatchlistData] = useState<StockQuote[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [featuredSymbol, setFeaturedSymbol] = useState<string>('OGDC');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartData, setChartData] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedWatchlistItem, setSelectedWatchlistItem] = useState<string | null>(null);

  // Helper function to determine change color
  const getChangeColor = (valueStr: string) => {
    if (!valueStr) return '#666';
    const num = parseFloat(valueStr.replace('%', '').replace('N/A', '0'));
    if (isNaN(num)) return '#666';
    return num > 0 ? '#4CAF50' : num < 0 ? '#F44336' : '#666';
  };

  // Fetch admin-driven content
  const fetchAdminData = async () => {
    try {
      const q = query(collection(db, 'adminData'), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      const docs = snap.docs.map(docSnap => {
        const data = docSnap.data() as Omit<AdminData, 'id'>;
        return { id: docSnap.id, ...data };
      });
      setSpotlight(docs);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };

  // Fetch market news from Finnhub
  const fetchMarketNews = async () => {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_API_KEY}`
      );
      
      // Check for HTML responses
      const text = await res.text();
      if (text.startsWith('<!DOCTYPE html>') || text.startsWith('<html')) {
        console.error('Finnhub API returned HTML error page');
        return;
      }
      
      const json = safeJsonParse(text);
      if (!json || !Array.isArray(json)) return;
      
      const news = json.slice(0, 5).map((item: any, index: number) => ({
        id: index,
        headline: item.headline,
        summary: item.summary,
        url: item.url,
        image: item.image,
        source: item.source
      }));
      setNewsItems(news);
    } catch (error) {
      console.error('Error fetching news:', error);
    }
  };

  // Refresh news only
  const refreshNews = async () => {
    try {
      setRefreshing(true);
      await fetchMarketNews();
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch historical data from your FastAPI
  const fetchHistoricalData = async (symbol: string, days: number = 30) => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);
      
      const response = await fetch(
        `${FAST_API_BASE}/graph?symbol=${symbol}&start=${formatDate(startDate)}&end=${formatDate(endDate)}`
      );
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error(`Invalid response for ${symbol}`);
        return null;
      }
      
      // Sort data by date ascending
      return data.sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    } catch (error) {
      console.error(`Error fetching data for ${symbol}:`, error);
      return null;
    }
  };

  // Get latest price from historical data
  const getLatestPrice = (historicalData: any[]) => {
    if (!historicalData || historicalData.length === 0) return null;
    return historicalData[historicalData.length - 1].close;
  };

  // Calculate price change from historical data
  const calculatePriceChange = (historicalData: any[]) => {
    if (!historicalData || historicalData.length < 2) return { change: 'N/A', percent: 'N/A' };
    
    const last = historicalData[historicalData.length - 1].close;
    const prev = historicalData[historicalData.length - 2].close;
    
    if (last === null || prev === null) {
      return { change: 'N/A', percent: 'N/A' };
    }
    
    const change = last - prev;
    const percentChange = (change / prev) * 100;
    
    return {
      change: change.toFixed(2),
      percent: `${percentChange.toFixed(2)}%`
    };
  };

  // Quotes for watchlist using your FastAPI
  const fetchWatchlistData = async () => {
    if (watchlistSymbols.length === 0) return;
    
    try {
      const results = [];
      
      for (const symbol of watchlistSymbols) {
        const historicalData = await fetchHistoricalData(symbol, 10); // Get 10 days data
        if (!historicalData || historicalData.length === 0) continue;
        
        const latestPrice = getLatestPrice(historicalData);
        if (latestPrice === null) continue;
        
        const { change, percent } = calculatePriceChange(historicalData);
        
        results.push({
          symbol,
          price: latestPrice.toFixed(2),
          change,
          percent
        });
      }
      
      setWatchlistData(results);
    } catch (error) {
      console.error('Error fetching watchlist data:', error);
      // Fallback to static data
      setWatchlistData(
        TOP_PAKISTANI_STOCKS.map(symbol => ({
          symbol,
          price: 'N/A',
          change: 'N/A',
          percent: 'N/A'
        }))
      );
    }
  };

  // User alerts
  const fetchAlerts = async () => {
    if (!uid) return;
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'alerts'));
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  // Fetch chart data using your FastAPI
  const fetchFeaturedData = async () => {
    if (!featuredSymbol) return;

    try {
      const historicalData = await fetchHistoricalData(featuredSymbol);
      if (!historicalData || historicalData.length === 0) {
        setChartData(null);
        return;
      }

      // Format data for chart
      const labels = historicalData.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      });

      const closePrices = historicalData.map(item => item.close);

      setChartData({
        labels,
        datasets: [{ data: closePrices }]
      });
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setChartData(null);
    }
  };

  // Search for symbols using your FastAPI
  const searchSymbols = async (query: string) => {
    if (query.length < 2) {
      setShowSearchResults(false);
      return;
    }
    
    try {
      const response = await fetch(`${FAST_API_BASE}/search?q=${query}`);
      const symbols = await response.json();
      
      if (!Array.isArray(symbols)) {
        setShowSearchResults(false);
        return;
      }
      
      const filtered = symbols.slice(0, 5).map(symbol => ({ symbol, name: symbol }));
      
      setSearchResults(filtered);
      setShowSearchResults(filtered.length > 0);
    } catch (error) {
      console.error('Error searching symbols:', error);
      setShowSearchResults(false);
    }
  };

  // Add ticker to watchlist
  const addToWatchlist = async (symbol: string) => {
    if (!uid) {
      Alert.alert('Please sign in to add to watchlist');
      return;
    }
    try {
      await setDoc(doc(db, 'users', uid, 'watchlist', symbol), {
        symbol,
        addedAt: new Date()
      });
      setWatchlistSymbols(prev => [...prev, symbol]);
      setShowSearchResults(false);
      setSearchQuery('');
      Alert.alert('Added to watchlist', `${symbol} added to your watchlist`);
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      Alert.alert('Error', 'Failed to add to watchlist');
    }
  };

  // Pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchAdminData(),
      fetchMarketNews(),
      fetchWatchlistData(),
      fetchAlerts(),
      fetchFeaturedData()
    ]);
    setRefreshing(false);
  };

  // Handle watchlist item press
  const handleWatchlistPress = (symbol: string) => {
    setFeaturedSymbol(symbol);
    setSelectedWatchlistItem(symbol);
  };

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([
        fetchAdminData(),
        fetchMarketNews(),
        fetchWatchlistData(),
        fetchAlerts(),
        fetchFeaturedData()
      ]);
      setLoading(false);
    })();
  }, []);

  // Re-fetch dependent data
  useEffect(() => {
    if (watchlistSymbols.length > 0) {
      fetchWatchlistData();
    }
  }, [watchlistSymbols]);

  useEffect(() => {
    if (featuredSymbol) {
      fetchFeaturedData();
    }
  }, [featuredSymbol, selectedWatchlistItem]);

  // Handle search input changes
  useEffect(() => {
    if (searchQuery) {
      const timer = setTimeout(() => {
        searchSymbols(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4361ee" />
        <Text style={styles.loadingText}>Loading market data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          tintColor="#4361ee"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Assalam-o-Alaikum</Text>
          <Text style={styles.username}>{auth.currentUser?.displayName || 'User'}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <Image
            source={{ uri: auth.currentUser?.photoURL || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          ref={searchInputRef}
          style={styles.search}
          placeholder="Search Pakistan stocks"
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={text => setSearchQuery(text)}
          onSubmitEditing={() => {
            const sym = searchQuery.trim().toUpperCase();
            if (sym) router.push({ pathname: '/data', params: { symbol: sym } });
          }}
        />
        {showSearchResults && (
          <View style={styles.searchResultsContainer}>
            {searchResults.map(result => (
              <TouchableOpacity
                key={result.symbol}
                style={styles.searchResultItem}
                onPress={() => {
                  setFeaturedSymbol(result.symbol);
                  setShowSearchResults(false);
                  setSearchQuery('');
                }}
              >
                <Text style={styles.searchSymbol}>{result.symbol}</Text>
                <Text style={styles.searchName} numberOfLines={1}>{result.name}</Text>
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={() => addToWatchlist(result.symbol)}
                >
                  <Ionicons name="add" size={16} color="#4361ee" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Watchlist */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top Pakistan Stocks</Text>
      </View>
      {watchlistData.length > 0 ? (
        <FlatList
          data={watchlistData}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.symbol}
          contentContainerStyle={styles.watchlistContainer}
          renderItem={({ item }) => {
            const changeColor = getChangeColor(item.percent);
            return (
              <TouchableOpacity
                style={styles.watchCard}
                onPress={() => handleWatchlistPress(item.symbol)}
              >
                <Text style={styles.watchSymbol}>{item.symbol}</Text>
                <Text style={styles.watchPrice}>Rs {item.price}</Text>
                <Text style={[styles.watchChange, { color: changeColor }]}>{item.percent}</Text>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <TouchableOpacity 
          style={styles.emptyWatchlist} 
          onPress={() => searchInputRef.current?.focus()}
        >
          <MaterialIcons name="add" size={28} color="#4361ee" />
          <Text style={styles.emptyWatchlistText}>Add Pakistani stocks to watchlist</Text>
        </TouchableOpacity>
      )}

      {/* Featured Chart */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{selectedWatchlistItem || featuredSymbol || '—'} Chart</Text>
      </View>
      <View style={styles.chartContainer}>
        {chartData ? (
          <LineChart
            data={chartData}
            width={CHART_WIDTH}
            height={220}
            yAxisLabel="Rs "
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 2,
              color: (opacity = 1) => `rgba(67, 97, 238, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: { r: '0' }
            }}
            bezier
            style={styles.chart}
          />
        ) : (
          <View style={styles.chartPlaceholder}>
            <Ionicons name="trending-up" size={32} color="#94a3b8" />
            <Text style={styles.chartPlaceholderText}>
              Chart data not available
            </Text>
          </View>
        )}
        
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#4361ee' }]} />
            <Text style={styles.legendText}>{featuredSymbol} Price</Text>
          </View>
        </View>
      </View>

      {/* Market Spotlight */}
      <Text style={styles.sectionTitle}>Market Spotlight</Text>
      <FlatList
        data={spotlight.slice(0, 3)}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.spotlightContainer}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.spotlightCard}
            onPress={() => router.push(`/${item.id}`)}
          >
            {item.logoUrl && (
              <Image source={{ uri: item.logoUrl }} style={styles.spotlightImage} />
            )}
            <Text style={styles.spotlightTitle}>{item.title}</Text>
            <Text numberOfLines={2} style={styles.spotlightTagline}>{item.description}</Text>
          </TouchableOpacity>
        )}
      />

      {/* News & Insights */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Market News</Text>
        <TouchableOpacity onPress={refreshNews}>
          <Ionicons name="refresh" size={20} color="#4361ee" />
        </TouchableOpacity>
      </View>
      <View style={styles.newsContainer}>
        {newsItems.map(item => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.newsCard}
            onPress={() => router.push(item.url)}
          >
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.newsImage} />
            ) : (
              <View style={styles.newsImagePlaceholder}>
                <Ionicons name="newspaper" size={24} color="#888" />
              </View>
            )}
            <View style={styles.newsContent}>
              <Text style={styles.newsTitle}>{item.headline}</Text>
              <Text numberOfLines={2} style={styles.newsDesc}>{item.summary}</Text>
              <Text style={styles.newsSource}>{item.source}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Alerts Overview */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Alerts</Text>
        <TouchableOpacity onPress={() => router.push('/alerts')}>
          <Text style={styles.manageLink}>Manage</Text>
        </TouchableOpacity>
      </View>
      {alerts.length > 0 ? (
        alerts.slice(0, 2).map(a => (
          <View key={a.id} style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Text style={styles.alertSymbol}>{a.symbol}</Text>
              <Text style={[
                styles.alertDirection, 
                a.direction === 'above' ? styles.alertAbove : styles.alertBelow
              ]}>
                {a.direction === 'above' ? '▲ Above' : '▼ Below'} Rs {a.targetPrice}
              </Text>
            </View>
            <Text style={styles.alertStatus}>Active • Price: Rs {(a.currentPrice || 0).toFixed(2)}</Text>
          </View>
        ))
      ) : (
        <View style={styles.noAlerts}>
          <Ionicons name="notifications-outline" size={24} color="#888" />
          <Text style={styles.noAlertsText}>No active alerts</Text>
        </View>
      )}

      {/* Footer Quick Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerCard} onPress={() => router.push('/compare')}>
          <Ionicons name="stats-chart" size={24} color="#4361ee" />
          <Text style={styles.footerAction}>Compare</Text>
        </TouchableOpacity>
        {auth.currentUser?.email === 'admin@stockvista.com' && (
          <TouchableOpacity style={styles.footerCard} onPress={() => router.push('/admin')}>
            <Ionicons name="create-outline" size={24} color="#4361ee" />
            <Text style={styles.footerAction}>Upload</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.footerCard} onPress={() => router.push('/profile')}>
          <Ionicons name="settings-outline" size={24} color="#4361ee" />
          <Text style={styles.footerAction}>Settings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Styles remain the same as before
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafd', padding: 16 },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#f8fafd'
  },
  loadingText: {
    marginTop: 16,
    color: '#4361ee',
    fontSize: 16
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 24 
  },
  greeting: {
    fontSize: 16,
    color: '#666'
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333'
  },
  avatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#e0e7ff'
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 24,
    zIndex: 10
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 14,
    zIndex: 2
  },
  search: { 
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    paddingLeft: 48,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchResultsContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  searchSymbol: {
    fontWeight: '700',
    color: '#1e293b',
    fontSize: 16,
    width: 60
  },
  searchName: {
    flex: 1,
    color: '#64748b',
    marginHorizontal: 12,
    fontSize: 14
  },
  addButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#eef2ff'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1e293b',
    marginBottom: 16
  },
  marketContainer: {
    paddingBottom: 16,
    marginBottom: 24
  },
  indexCard: {
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  indexSymbol: { 
    fontWeight: '700', 
    color: '#334155', 
    fontSize: 16,
    marginBottom: 4
  },
  indexPrice: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#1e293b',
    marginBottom: 4
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  indexChange: { 
    fontSize: 14, 
    fontWeight: '600'
  },
  watchlistContainer: {
    paddingBottom: 8
  },
  watchCard: {
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  watchSymbol: { 
    fontWeight: '700', 
    color: '#334155', 
    fontSize: 16,
    marginBottom: 8
  },
  watchPrice: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#1e293b',
    marginBottom: 4
  },
  watchChange: { 
    fontSize: 14, 
    fontWeight: '600'
  },
  emptyWatchlist: {
    height: 100,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    marginBottom: 24
  },
  emptyWatchlistText: {
    color: '#4361ee',
    fontWeight: '600',
    marginTop: 8
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  chartPlaceholder: {
    height: 220,
    backgroundColor: '#fff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24
  },
  chartPlaceholderText: {
    color: '#64748b',
    marginTop: 12
  },
  chartControls: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 4,
    marginBottom: 12
  },
  rangeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  rangeButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  rangeText: { 
    fontSize: 14, 
    color: '#64748b',
    fontWeight: '600'
  },
  rangeTextActive: { 
    color: '#4361ee'
  },
  chart: {
    borderRadius: 12,
    marginBottom: 16
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8
  },
  legendText: {
    fontSize: 14,
    color: '#64748b'
  },
  spotlightContainer: {
    paddingBottom: 16
  },
  spotlightCard: {
    width: 260,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  spotlightImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#e2e8f0'
  },
  spotlightTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#1e293b',
    padding: 16,
    paddingBottom: 8
  },
  spotlightTagline: {
    fontSize: 14,
    color: '#64748b',
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  newsContainer: {
    marginBottom: 24
  },
  newsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  newsImage: {
    width: 100,
    height: 100,
    backgroundColor: '#e2e8f0'
  },
  newsImagePlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  newsContent: {
    flex: 1,
    padding: 12
  },
  newsTitle: {
    fontWeight: '600',
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 6
  },
  newsDesc: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 6
  },
  newsSource: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic'
  },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  alertSymbol: {
    fontWeight: '700',
    fontSize: 16,
    color: '#1e293b'
  },
  alertDirection: {
    fontWeight: '600',
    fontSize: 14,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  alertAbove: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    color: '#4CAF50'
  },
  alertBelow: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    color: '#F44336'
  },
  alertStatus: {
    fontSize: 14,
    color: '#64748b'
  },
  noAlerts: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24
  },
  noAlertsText: {
    marginLeft: 12,
    color: '#64748b'
  },
  manageLink: {
    color: '#4361ee',
    fontWeight: '600'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 24
  },
  footerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '31%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  footerAction: {
    color: '#4361ee',
    fontWeight: '600',
    marginTop: 8
  }
});