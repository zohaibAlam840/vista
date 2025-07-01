// import React, { useState, useEffect, useCallback, useRef } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   ScrollView,
//   FlatList,
//   Switch,
//   ActivityIndicator,
//   RefreshControl,
//   StyleSheet,
//   Alert,
// } from 'react-native';
// import { useRouter } from 'expo-router';
// import { LineChart } from 'react-native-chart-kit';
// import { Dimensions } from 'react-native';
// import Ionicons from '@expo/vector-icons/Ionicons';

// const ALPHA_VANTAGE_API_KEY = 'FXETMFVVBZSV40QN';
// const screenWidth = Dimensions.get('window').width;

// type Quote = {
//   price: number;
//   change: number;
//   changePercent: string;
// };

// type OHLCV = {
//   date: string;
//   open: number;
//   high: number;
//   low: number;
//   close: number;
//   volume: number;
// };

// const DATE_RANGES = ['1D', '1W', '1M', '6M', 'YTD', 'MAX'] as const;
// type DateRange = typeof DATE_RANGES[number];

// export default function DataScreen() {
//   const router = useRouter();
//   const [symbol, setSymbol] = useState('AAPL');
//   const [searchInput, setSearchInput] = useState('AAPL');
//   const [quote, setQuote] = useState<Quote | null>(null);
//   const [ohlcv, setOhlcv] = useState<OHLCV[]>([]);
//   const [dateRange, setDateRange] = useState<DateRange>('1M');
//   const [loading, setLoading] = useState(false);
//   const [refreshing, setRefreshing] = useState(false);
//   const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

//   // Technical indicator toggles
//   const [showSMA, setShowSMA] = useState(false);
//   const [showEMA, setShowEMA] = useState(false);
//   const [showBollinger, setShowBollinger] = useState(false);
//   const [showRSI, setShowRSI] = useState(false);
//   const [showMACD, setShowMACD] = useState(false);
//   const [showVWAP, setShowVWAP] = useState(false);

//   // Key metrics
//   const [metrics, setMetrics] = useState<{
//     open: number;
//     high: number;
//     low: number;
//     close: number;
//     volume: number;
//     week52High: number;
//     week52Low: number;
//     avgVolume: number;
//     marketCap: number | null;
//     pe: number | null;
//     pb: number | null;
//     dividendYield: number | null;
//   } | null>(null);

//   const fetchQuote = async (sym: string) => {
//     const res = await fetch(
//       `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${ALPHA_VANTAGE_API_KEY}`
//     );
//     const json = await res.json();
//     const g = json['Global Quote'] || {};
//     return {
//       price: parseFloat(g['05. price'] || '0'),
//       change: parseFloat(g['09. change'] || '0'),
//       changePercent: g['10. change percent'] || '0%',
//     };
//   };

//   const fetchDailySeries = async (sym: string) => {
//     const res = await fetch(
//       `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${sym}&apikey=${ALPHA_VANTAGE_API_KEY}&outputsize=full`
//     );
//     const json = await res.json();
//     const ts = json['Time Series (Daily)'] || {};
//     const data: OHLCV[] = Object.entries(ts).map(([date, vals]: any) => ({
//       date,
//       open: parseFloat(vals['1. open']),
//       high: parseFloat(vals['2. high']),
//       low: parseFloat(vals['3. low']),
//       close: parseFloat(vals['4. close']),
//       volume: parseInt(vals['5. volume'], 10),
//     }));
//     return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
//   };

//   const fetchOverview = async (sym: string) => {
//     const res = await fetch(
//       `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${sym}&apikey=${ALPHA_VANTAGE_API_KEY}`
//     );
//     const json = await res.json();
//     return {
//       marketCap: json.MarketCapitalization ? parseInt(json.MarketCapitalization, 10) : null,
//       pe: json.PERatio ? parseFloat(json.PERatio) : null,
//       pb: json.PriceToBookRatio ? parseFloat(json.PriceToBookRatio) : null,
//       dividendYield: json.DividendYield ? parseFloat(json.DividendYield) : null,
//     };
//   };

//   const filterByDateRange = (data: OHLCV[], range: DateRange) => {
//     const now = new Date();
//     return data.filter(item => {
//       const d = new Date(item.date);
//       const timeDiff = now.getTime() - d.getTime();
      
//       switch (range) {
//         case '1D': 
//           return timeDiff <= 24 * 60 * 60 * 1000;
//         case '1W':
//           return timeDiff <= 7 * 24 * 60 * 60 * 1000;
//         case '1M':
//           return now.getMonth() === d.getMonth() && now.getFullYear() === d.getFullYear();
//         case '6M':
//           const sixMonthsAgo = new Date();
//           sixMonthsAgo.setMonth(now.getMonth() - 6);
//           return d >= sixMonthsAgo;
//         case 'YTD':
//           return d.getFullYear() === now.getFullYear();
//         case 'MAX':
//           return true;
//       }
//     });
//   };

//   const loadData = useCallback(async () => {
//     if (!symbol.trim()) {
//       Alert.alert('Error', 'Please enter a ticker symbol');
//       return;
//     }
//     setLoading(true);
//     try {
//       const [q, series, ov] = await Promise.all([
//         fetchQuote(symbol),
//         fetchDailySeries(symbol),
//         fetchOverview(symbol),
//       ]);
//       setQuote(q);
      
//       // Calculate 52-week high/low from the last year of data
//       const oneYearAgo = new Date();
//       oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
//       const lastYearData = series.filter(item => 
//         new Date(item.date) >= oneYearAgo
//       );
      
//       setMetrics({
//         open: series[series.length - 1]?.open || 0,
//         high: series[series.length - 1]?.high || 0,
//         low: series[series.length - 1]?.low || 0,
//         close: series[series.length - 1]?.close || 0,
//         volume: series[series.length - 1]?.volume || 0,
//         week52High: Math.max(...lastYearData.map(d => d.high)),
//         week52Low: Math.min(...lastYearData.map(d => d.low)),
//         avgVolume: Math.round(
//           lastYearData.reduce((sum, d) => sum + d.volume, 0) / lastYearData.length
//         ),
//         ...ov,
//       });
//       setOhlcv(filterByDateRange(series, dateRange));
//     } catch (err) {
//       console.error(err);
//       Alert.alert('Error', 'Failed to load data. Please check your API key or try another symbol');
//     } finally {
//       setLoading(false);
//       setRefreshing(false);
//     }
//   }, [symbol, dateRange]);

//   useEffect(() => {
//     loadData();
//   }, [dateRange]);

//   const onRefresh = () => {
//     setRefreshing(true);
//     loadData();
//   };

//   // Debounced search handling
//   const handleSearchInput = (text: string) => {
//     setSearchInput(text);
    
//     if (debounceTimeout.current) {
//       clearTimeout(debounceTimeout.current);
//     }
    
//     debounceTimeout.current = setTimeout(() => {
//       if (text.trim()) {
//         setSymbol(text.trim().toUpperCase());
//       }
//     }, 500);
//   };

//   const handleSearchPress = () => {
//     if (searchInput.trim()) {
//       setSymbol(searchInput.trim().toUpperCase());
//     }
//   };

//   const handleSubmit = () => {
//     if (searchInput.trim()) {
//       setSymbol(searchInput.trim().toUpperCase());
//     }
//   };

//   // Prepare chart data
//   const chartData = {
//     labels: ohlcv.slice(-10).map(item => {
//       const date = new Date(item.date);
//       return dateRange === '1D' 
//         ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
//         : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
//     }),
//     datasets: [
//       {
//         data: ohlcv.slice(-10).map(item => item.close),
//         color: (opacity = 1) => quote?.change >= 0 
//           ? `rgba(40, 167, 69, ${opacity})` 
//           : `rgba(220, 53, 69, ${opacity})`,
//         strokeWidth: 2,
//       },
//     ],
//   };

//   if (loading && !refreshing && !ohlcv.length) {
//     return (
//       <View style={styles.center}>
//         <ActivityIndicator size="large" color="#007bff" />
//         <Text style={styles.loadingText}>Loading {symbol} data...</Text>
//       </View>
//     );
//   }

//   return (
//     <ScrollView
//       style={styles.container}
//       refreshControl={
//         <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
//       }
//     >
//       {/* Header with Search */}
//       <View style={styles.header}>
//         <Text style={styles.headerTitle}>Stock Tracker</Text>
//         <View style={styles.searchContainer}>
//           <TextInput
//             style={styles.input}
//             placeholder="Search ticker (e.g., AAPL)"
//             placeholderTextColor="#999"
//             autoCapitalize="characters"
//             value={searchInput}
//             onChangeText={handleSearchInput}
//             onSubmitEditing={handleSubmit}
//             returnKeyType="search"
//           />
//           <TouchableOpacity style={styles.searchButton} onPress={handleSearchPress}>
//             <Ionicons name="search" size={20} color="#fff" />
//           </TouchableOpacity>
//         </View>
//       </View>

//       {/* Quote Info */}
//       {quote && (
//         <View style={styles.quoteContainer}>
//           <View>
//             <Text style={styles.symbol}>{symbol}</Text>
//             <Text style={styles.price}>${quote.price.toFixed(2)}</Text>
//             <Text style={[styles.change, quote.change >= 0 ? styles.up : styles.down]}>
//               {quote.change >= 0 ? '▲' : '▼'} {quote.change.toFixed(2)} ({quote.changePercent})
//             </Text>
//           </View>
//           <TouchableOpacity
//             style={styles.watchButton}
//             onPress={() => router.push('/watchlist')}
//           >
//             <Ionicons name="star" size={24} color="#ffd700" />
//           </TouchableOpacity>
//         </View>
//       )}

//       {/* Date-Range Selector */}
//       <ScrollView 
//         horizontal 
//         showsHorizontalScrollIndicator={false}
//         style={styles.rangeSelector}
//       >
//         {DATE_RANGES.map(r => (
//           <TouchableOpacity
//             key={r}
//             style={[
//               styles.rangeButton,
//               dateRange === r && styles.rangeButtonActive,
//             ]}
//             onPress={() => setDateRange(r)}
//           >
//             <Text style={[styles.rangeText, dateRange === r && styles.rangeTextActive]}>
//               {r}
//             </Text>
//           </TouchableOpacity>
//         ))}
//       </ScrollView>

//       {/* Price Chart */}
//       {ohlcv.length > 0 && (
//         <View style={styles.chartContainer}>
//           <LineChart
//             data={chartData}
//             width={screenWidth - 32}
//             height={220}
//             yAxisLabel="$"
//             yAxisInterval={1}
//             chartConfig={{
//               backgroundColor: '#ffffff',
//               backgroundGradientFrom: '#f8f9fa',
//               backgroundGradientTo: '#e9ecef',
//               decimalPlaces: 2,
//               color: (opacity = 1) => `rgba(108, 117, 125, ${opacity})`,
//               labelColor: (opacity = 1) => `rgba(108, 117, 125, ${opacity})`,
//               style: { borderRadius: 16 },
//               propsForDots: { r: '3', strokeWidth: '2', stroke: quote?.change >= 0 ? '#28a745' : '#dc3545' },
//               propsForBackgroundLines: { strokeDasharray: "" },
//               propsForLabels: { fontSize: 10 },
//             }}
//             bezier
//             withVerticalLines={false}
//             withHorizontalLines={true}
//             withDots={true}
//             style={styles.chart}
//           />
//         </View>
//       )}

//       {/* Technical Indicators */}
//       <View style={styles.section}>
//         <Text style={styles.sectionTitle}>Technical Indicators</Text>
//         <View style={styles.indicatorsGrid}>
//           {[
//             { label: 'SMA', value: showSMA, setter: setShowSMA, icon: 'analytics' },
//             { label: 'EMA', value: showEMA, setter: setShowEMA, icon: 'pulse' },
//             { label: 'Bollinger', value: showBollinger, setter: setShowBollinger, icon: 'resize' },
//             { label: 'RSI', value: showRSI, setter: setShowRSI, icon: 'speedometer' },
//             { label: 'MACD', value: showMACD, setter: setShowMACD, icon: 'bar-chart' },
//             { label: 'VWAP', value: showVWAP, setter: setShowVWAP, icon: 'calculator' },
//           ].map(ind => (
//             <TouchableOpacity
//               key={ind.label}
//               style={[
//                 styles.indicatorCard,
//                 ind.value && styles.indicatorCardActive
//               ]}
//               onPress={() => ind.setter(!ind.value)}
//             >
//               <Ionicons 
//                 name={ind.icon} 
//                 size={24} 
//                 color={ind.value ? '#007bff' : '#6c757d'} 
//               />
//               <Text style={[styles.indicatorLabel, ind.value && styles.indicatorLabelActive]}>
//                 {ind.label}
//               </Text>
//             </TouchableOpacity>
//           ))}
//         </View>
//       </View>

//       {/* Key Metrics */}
//       {metrics && (
//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>Key Metrics</Text>
//           <View style={styles.metricsGrid}>
//             {[
//               { label: 'Open', value: `$${metrics.open.toFixed(2)}`, icon: 'arrow-up' },
//               { label: 'High', value: `$${metrics.high.toFixed(2)}`, icon: 'trending-up' },
//               { label: 'Low', value: `$${metrics.low.toFixed(2)}`, icon: 'trending-down' },
//               { label: 'Prev Close', value: `$${metrics.close.toFixed(2)}`, icon: 'close' },
//               { label: 'Volume', value: metrics.volume.toLocaleString(), icon: 'volume-high' },
//               { label: '52W High', value: `$${metrics.week52High.toFixed(2)}`, icon: 'rocket' },
//               { label: '52W Low', value: `$${metrics.week52Low.toFixed(2)}`, icon: 'thermometer' },
//               { label: 'Avg Vol', value: metrics.avgVolume.toLocaleString(), icon: 'stats-chart' },
//               { label: 'Mkt Cap', value: metrics.marketCap ? `$${(metrics.marketCap / 1000000).toFixed(2)}M` : 'N/A', icon: 'business' },
//               { label: 'P/E', value: metrics.pe ? metrics.pe.toFixed(2) : 'N/A', icon: 'cash' },
//               { label: 'P/B', value: metrics.pb ? metrics.pb.toFixed(2) : 'N/A', icon: 'book' },
//               { label: 'Div Yield', value: metrics.dividendYield ? `${metrics.dividendYield.toFixed(2)}%` : 'N/A', icon: 'gift' },
//             ].map((item) => (
//               <View key={item.label} style={styles.metricCard}>
//                 <View style={styles.metricHeader}>
//                   <Ionicons name={item.icon} size={16} color="#6c757d" />
//                   <Text style={styles.metricLabel}>{item.label}</Text>
//                 </View>
//                 <Text style={styles.metricValue}>{item.value}</Text>
//               </View>
//             ))}
//           </View>
//         </View>
//       )}

//       {/* Historical Data */}
//       <View style={styles.section}>
//         <View style={styles.sectionHeader}>
//           <Text style={styles.sectionTitle}>Historical Data</Text>
//           <TouchableOpacity
//             style={styles.exportButton}
//             onPress={() => router.push('/export')}
//           >
//             <Text style={styles.exportText}>Export CSV</Text>
//           </TouchableOpacity>
//         </View>
        
//         <View style={styles.tableContainer}>
//           <View style={styles.headerRow}>
//             {['Date', 'Open', 'Close', 'Vol'].map(h => (
//               <Text key={h} style={[styles.dataCell, styles.headerCell]}>
//                 {h}
//               </Text>
//             ))}
//           </View>
          
//           {ohlcv.slice(-5).map((item, index) => (
//             <View 
//               key={item.date} 
//               style={[
//                 styles.dataRow,
//                 index % 2 === 0 && styles.dataRowEven
//               ]}
//             >
//               <Text style={styles.dataCell}>{new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
//               <Text style={styles.dataCell}>${item.open.toFixed(2)}</Text>
//               <Text style={styles.dataCell}>${item.close.toFixed(2)}</Text>
//               <Text style={styles.dataCell}>{(item.volume / 1000000).toFixed(1)}M</Text>
//             </View>
//           ))}
//         </View>
//       </View>

//       {/* Action Buttons */}
//       <View style={styles.actionRow}>
//         <TouchableOpacity
//           style={[styles.actionButton, styles.compareButton]}
//           onPress={() => router.push({ pathname: '/compare', params: { symbols: symbol } })}
//         >
//           <Ionicons name="git-compare" size={20} color="#fff" />
//           <Text style={styles.actionButtonText}>Compare</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={[styles.actionButton, styles.alertButton]}
//           onPress={() => router.push({ pathname: '/alerts', params: { symbol } })}
//         >
//           <Ionicons name="notifications" size={20} color="#fff" />
//           <Text style={styles.actionButtonText}>Set Alert</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={[styles.actionButton, styles.detailButton]}
//           onPress={() => router.push({ pathname: '/detail', params: { symbol } })}
//         >
//           <Ionicons name="information-circle" size={20} color="#fff" />
//           <Text style={styles.actionButtonText}>Details</Text>
//         </TouchableOpacity>
//       </View>

//       {/* Footer */}
//       <View style={styles.footer}>
//         <Text style={styles.footerText}>Data provided by Alpha Vantage</Text>
//         <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
//           <Ionicons name="refresh" size={16} color="#007bff" />
//           <Text style={styles.footerLink}> Refresh</Text>
//         </TouchableOpacity>
//       </View>
//     </ScrollView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { 
//     flex: 1, 
//     backgroundColor: '#f8f9fa', 
//     padding: 16 
//   },
//   center: { 
//     flex: 1, 
//     justifyContent: 'center', 
//     alignItems: 'center' 
//   },
//   loadingText: {
//     marginTop: 16,
//     color: '#6c757d',
//   },
//   header: {
//     marginBottom: 20,
//   },
//   headerTitle: {
//     fontSize: 28,
//     fontWeight: '800',
//     color: '#2c3e50',
//     marginBottom: 16,
//     textAlign: 'center',
//   },
//   searchContainer: {
//     flexDirection: 'row',
//     marginBottom: 16,
//   },
//   input: {
//     flex: 1,
//     borderWidth: 1,
//     borderColor: '#dee2e6',
//     borderRadius: 8,
//     padding: 14,
//     fontSize: 16,
//     backgroundColor: '#fff',
//     color: '#333',
//   },
//   searchButton: {
//     marginLeft: 8,
//     backgroundColor: '#007bff',
//     borderRadius: 8,
//     padding: 14,
//     justifyContent: 'center',
//     width: 50,
//     alignItems: 'center',
//   },
//   quoteContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 20,
//     padding: 16,
//     backgroundColor: '#fff',
//     borderRadius: 12,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.05,
//     shadowRadius: 6,
//     elevation: 2,
//   },
//   symbol: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: '#6c757d',
//   },
//   price: { 
//     fontSize: 32, 
//     fontWeight: '700',
//     color: '#212529',
//     marginVertical: 4,
//   },
//   change: { 
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   up: { color: '#28a745' },
//   down: { color: '#dc3545' },
//   watchButton: {
//     padding: 10,
//     backgroundColor: '#f8f9fa',
//     borderRadius: 50,
//   },
//   rangeSelector: {
//     marginBottom: 20,
//   },
//   rangeButton: {
//     paddingVertical: 8,
//     paddingHorizontal: 16,
//     borderRadius: 20,
//     backgroundColor: '#e9ecef',
//     marginRight: 8,
//   },
//   rangeButtonActive: { 
//     backgroundColor: '#007bff',
//   },
//   rangeText: { 
//     fontSize: 14, 
//     fontWeight: '600',
//     color: '#6c757d',
//   },
//   rangeTextActive: { 
//     color: '#fff',
//   },
//   chartContainer: {
//     height: 240,
//     borderRadius: 12,
//     backgroundColor: '#fff',
//     marginBottom: 20,
//     padding: 8,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.05,
//     shadowRadius: 6,
//     elevation: 3,
//   },
//   chart: {
//     borderRadius: 8,
//   },
//   section: {
//     backgroundColor: '#fff',
//     borderRadius: 12,
//     padding: 16,
//     marginBottom: 16,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 1 },
//     shadowOpacity: 0.05,
//     shadowRadius: 3,
//     elevation: 2,
//   },
//   sectionHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 16,
//   },
//   sectionTitle: {
//     fontSize: 18,
//     fontWeight: '700',
//     color: '#2c3e50',
//   },
//   indicatorsGrid: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     justifyContent: 'space-between',
//   },
//   indicatorCard: {
//     width: '30%',
//     alignItems: 'center',
//     padding: 12,
//     marginBottom: 12,
//     borderWidth: 1,
//     borderColor: '#e9ecef',
//     borderRadius: 8,
//   },
//   indicatorCardActive: {
//     borderColor: '#007bff',
//     backgroundColor: '#e6f7ff',
//   },
//   indicatorLabel: {
//     fontSize: 14,
//     fontWeight: '600',
//     color: '#6c757d',
//     marginTop: 8,
//   },
//   indicatorLabelActive: {
//     color: '#007bff',
//   },
//   metricsGrid: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     justifyContent: 'space-between',
//   },
//   metricCard: {
//     width: '48%',
//     padding: 12,
//     marginBottom: 12,
//     backgroundColor: '#f8f9fa',
//     borderRadius: 8,
//   },
//   metricHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 4,
//   },
//   metricLabel: {
//     fontSize: 13,
//     color: '#6c757d',
//     marginLeft: 6,
//   },
//   metricValue: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#212529',
//   },
//   tableContainer: {
//     borderRadius: 8,
//     overflow: 'hidden',
//   },
//   headerRow: {
//     flexDirection: 'row',
//     backgroundColor: '#007bff',
//     paddingVertical: 12,
//   },
//   headerCell: {
//     flex: 1,
//     textAlign: 'center',
//     color: '#fff',
//     fontWeight: '700',
//   },
//   dataRow: {
//     flexDirection: 'row',
//     paddingVertical: 12,
//     backgroundColor: '#fff',
//   },
//   dataRowEven: {
//     backgroundColor: '#f8f9fa',
//   },
//   dataCell: {
//     flex: 1,
//     textAlign: 'center',
//     fontSize: 14,
//     color: '#495057',
//   },
//   exportButton: {
//     backgroundColor: '#28a745',
//     borderRadius: 20,
//     paddingVertical: 6,
//     paddingHorizontal: 12,
//   },
//   exportText: {
//     color: '#fff',
//     fontWeight: '600',
//     fontSize: 14,
//   },
//   actionRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginBottom: 20,
//   },
//   actionButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderRadius: 8,
//     paddingVertical: 12,
//     paddingHorizontal: 16,
//     flex: 1,
//     marginHorizontal: 4,
//     justifyContent: 'center',
//   },
//   compareButton: { 
//     backgroundColor: '#17a2b8' 
//   },
//   alertButton: { 
//     backgroundColor: '#ffc107' 
//   },
//   detailButton: { 
//     backgroundColor: '#6c757d' 
//   },
//   actionButtonText: {
//     color: '#fff',
//     fontWeight: '600',
//     marginLeft: 6,
//   },
//   footer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingVertical: 16,
//     borderTopWidth: 1,
//     borderTopColor: '#e9ecef',
//   },
//   footerText: {
//     fontSize: 12,
//     color: '#6c757d',
//   },
//   refreshButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   footerLink: {
//     fontSize: 12,
//     color: '#007bff',
//     fontWeight: '600',
//   },
// });

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const FAST_API_BASE = "http://192.168.100.11:8000";
const screenWidth = Dimensions.get('window').width;

type Quote = {
  price: number;
  change: number;
  changePercent: string;
};

type OHLCV = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const DATE_RANGES = ['1D', '1W', '1M', '6M', 'YTD', 'MAX'] as const;
type DateRange = typeof DATE_RANGES[number];

// Helper function to format date as YYYY-MM-DD
const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0];
};

// Function to calculate date range based on selected period
const getDateRange = (range: DateRange) => {
  const end = new Date();
  const start = new Date();
  
  switch (range) {
    case '1D': 
      start.setDate(end.getDate() - 1);
      break;
    case '1W':
      start.setDate(end.getDate() - 7);
      break;
    case '1M':
      start.setMonth(end.getMonth() - 1);
      break;
    case '6M':
      start.setMonth(end.getMonth() - 6);
      break;
    case 'YTD':
      start.setMonth(0);
      start.setDate(1);
      break;
    case 'MAX':
      start.setFullYear(2000, 0, 1); // Set to year 2000
      break;
  }
  
  return { start, end };
};

export default function DataScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [symbol, setSymbol] = useState(params.symbol?.toString() || 'OGDC');
  const [searchInput, setSearchInput] = useState(params.symbol?.toString() || 'OGDC');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [ohlcv, setOhlcv] = useState<OHLCV[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('1M');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Technical indicator toggles
  const [showSMA, setShowSMA] = useState(false);
  const [showEMA, setShowEMA] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [showVWAP, setShowVWAP] = useState(false);

  // Fetch historical data from your FastAPI
  const fetchHistoricalData = async (symbol: string, range: DateRange) => {
    try {
      const { start, end } = getDateRange(range);
      
      const response = await fetch(
        `${FAST_API_BASE}/historical?symbols=${symbol}&start=${formatDate(start)}&end=${formatDate(end)}`
      );
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error(`Invalid response for ${symbol}`);
        return null;
      }
      
      // Transform data to OHLCV format
      return data.map((item: any) => ({
        date: item.Date,
        open: item.Open,
        high: item.High,
        low: item.Low,
        close: item.Close,
        volume: item.Volume
      })).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    } catch (error) {
      console.error(`Error fetching data for ${symbol}:`, error);
      return null;
    }
  };

  // Get latest price from historical data
  const getLatestPrice = (historicalData: OHLCV[]) => {
    if (!historicalData || historicalData.length === 0) return null;
    return historicalData[historicalData.length - 1].close;
  };

  // Calculate price change from historical data
  const calculatePriceChange = (historicalData: OHLCV[]) => {
    if (!historicalData || historicalData.length < 2) return { change: 0, percent: '0%' };
    
    const last = historicalData[historicalData.length - 1].close;
    const prev = historicalData[historicalData.length - 2].close;
    
    const change = last - prev;
    const percentChange = (change / prev) * 100;
    
    return {
      change: change,
      percent: `${percentChange.toFixed(2)}%`
    };
  };

  // Calculate 52-week high/low
  const calculate52WeekHighLow = (data: OHLCV[]) => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const lastYearData = data.filter(item => 
      new Date(item.date) >= oneYearAgo
    );
    
    return {
      week52High: Math.max(...lastYearData.map(d => d.high)),
      week52Low: Math.min(...lastYearData.map(d => d.low)),
      avgVolume: Math.round(
        lastYearData.reduce((sum, d) => sum + d.volume, 0) / lastYearData.length
      )
    };
  };

  const loadData = useCallback(async () => {
    if (!symbol.trim()) {
      Alert.alert('Error', 'Please enter a ticker symbol');
      return;
    }
    
    setError(null);
    setLoading(true);
    
    try {
      const historicalData = await fetchHistoricalData(symbol, dateRange);
      
      if (!historicalData || historicalData.length === 0) {
        throw new Error('No data available for this symbol');
      }
      
      const latestPrice = getLatestPrice(historicalData);
      const { change, percent } = calculatePriceChange(historicalData);
      
      setQuote({
        price: latestPrice || 0,
        change: change,
        changePercent: percent
      });
      
      setOhlcv(historicalData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [symbol, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Search for symbols using your FastAPI
  const searchSymbols = async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    try {
      const response = await fetch(`${FAST_API_BASE}/search?q=${query}`);
      const symbols = await response.json();
      
      if (!Array.isArray(symbols)) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      
      setSuggestions(symbols.slice(0, 5));
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error searching symbols:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Debounced search handling
  const handleSearchInput = (text: string) => {
    setSearchInput(text);
    
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    debounceTimeout.current = setTimeout(() => {
      if (text.trim()) {
        searchSymbols(text.trim().toUpperCase());
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  };

  const handleSuggestionPress = (suggestion: string) => {
    setSymbol(suggestion);
    setSearchInput(suggestion);
    setShowSuggestions(false);
  };

  const handleSearchPress = () => {
    if (searchInput.trim()) {
      setSymbol(searchInput.trim().toUpperCase());
      setShowSuggestions(false);
    }
  };

  const handleSubmit = () => {
    if (searchInput.trim()) {
      setSymbol(searchInput.trim().toUpperCase());
      setShowSuggestions(false);
    }
  };

  // Handle CSV export
  const handleExport = async () => {
    try {
      const { start, end } = getDateRange(dateRange);
      const startStr = formatDate(start);
      const endStr = formatDate(end);
      
      const exportUrl = `${FAST_API_BASE}/export/historical/csv?symbol=${symbol}&start=${startStr}&end=${endStr}`;
      
      // Open the URL in browser for download
      await Linking.openURL(exportUrl);
      
      Alert.alert('Export Started', 'Your CSV download should start shortly');
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert('Export Error', 'Failed to start download. Please try again.');
    }
  };

  // Prepare chart data
  const chartData = ohlcv.length > 0 ? {
    labels: ohlcv.slice(-10).map(item => {
      const date = new Date(item.date);
      return dateRange === '1D' 
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        data: ohlcv.slice(-10).map(item => item.close),
        color: (opacity = 1) => quote?.change >= 0 
          ? `rgba(40, 167, 69, ${opacity})` 
          : `rgba(220, 53, 69, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  } : null;

  if (loading && !refreshing && !ohlcv.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading {symbol} data...</Text>
      </View>
    );
  }

  // Historical data table rows
  const tableData = ohlcv.slice(-5).map((item, index) => ({
    id: index.toString(),
    date: new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    open: item.open.toFixed(2),
    close: item.close.toFixed(2),
    volume: (item.volume / 1000000).toFixed(1) + 'M'
  }));

  // Key metrics data
  const metricsData = ohlcv.length > 0 ? [
    { id: '1', label: 'Open', value: `Rs ${ohlcv[ohlcv.length - 1]?.open.toFixed(2) || '0.00'}`, icon: 'arrow-up' },
    { id: '2', label: 'High', value: `Rs ${ohlcv[ohlcv.length - 1]?.high.toFixed(2) || '0.00'}`, icon: 'trending-up' },
    { id: '3', label: 'Low', value: `Rs ${ohlcv[ohlcv.length - 1]?.low.toFixed(2) || '0.00'}`, icon: 'trending-down' },
    { id: '4', label: 'Close', value: `Rs ${ohlcv[ohlcv.length - 1]?.close.toFixed(2) || '0.00'}`, icon: 'close' },
    { id: '5', label: 'Volume', value: ohlcv[ohlcv.length - 1]?.volume.toLocaleString() || '0', icon: 'volume-high' },
    { id: '6', label: '52W High', value: `Rs ${Math.max(...ohlcv.map(d => d.high)).toFixed(2)}`, icon: 'rocket' },
    { id: '7', label: '52W Low', value: `Rs ${Math.min(...ohlcv.map(d => d.low)).toFixed(2)}`, icon: 'thermometer' },
    { id: '8', label: 'Avg Vol', value: Math.round(ohlcv.reduce((sum, d) => sum + d.volume, 0) / ohlcv.length).toLocaleString(), icon: 'stats-chart' },
  ] : [];

  return (
    <FlatList
      data={[]}
      renderItem={null}
      ListHeaderComponent={
        <>
          {/* Header with Search */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>PSX Stock Details</Text>
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Search PSX ticker (e.g., OGDC)"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                  value={searchInput}
                  onChangeText={handleSearchInput}
                  onSubmitEditing={handleSubmit}
                  returnKeyType="search"
                />
              </View>
              <TouchableOpacity style={styles.searchButton} onPress={handleSearchPress}>
                <Ionicons name="search" size={20} color="#fff" />
              </TouchableOpacity>
              
              {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionItem}
                      onPress={() => handleSuggestionPress(suggestion)}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={24} color="#dc3545" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadData}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Quote Info */}
              {quote && (
                <View style={styles.quoteContainer}>
                  <View>
                    <Text style={styles.symbol}>{symbol}</Text>
                    <Text style={styles.price}>Rs {quote.price.toFixed(2)}</Text>
                    <Text style={[styles.change, quote.change >= 0 ? styles.up : styles.down]}>
                      {quote.change >= 0 ? '▲' : '▼'} {quote.change.toFixed(2)} ({quote.changePercent})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.watchButton}
                    onPress={() => router.push('/watchlist')}
                  >
                    <Ionicons name="star" size={24} color="#ffd700" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Date-Range Selector */}
              <FlatList
                horizontal
                data={DATE_RANGES}
                keyExtractor={item => item}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rangeSelector}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.rangeButton,
                      dateRange === item && styles.rangeButtonActive,
                    ]}
                    onPress={() => setDateRange(item)}
                  >
                    <Text style={[styles.rangeText, dateRange === item && styles.rangeTextActive]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />

              {/* Price Chart */}
              {ohlcv.length > 0 && chartData && (
                <View style={styles.chartContainer}>
                  <LineChart
                    data={chartData}
                    width={screenWidth - 32}
                    height={220}
                    yAxisLabel="Rs "
                    yAxisInterval={1}
                    chartConfig={{
                      backgroundColor: '#ffffff',
                      backgroundGradientFrom: '#f8f9fa',
                      backgroundGradientTo: '#e9ecef',
                      decimalPlaces: 2,
                      color: (opacity = 1) => `rgba(108, 117, 125, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(108, 117, 125, ${opacity})`,
                      style: { borderRadius: 16 },
                      propsForDots: { r: '3', strokeWidth: '2', stroke: quote?.change >= 0 ? '#28a745' : '#dc3545' },
                      propsForBackgroundLines: { strokeDasharray: "" },
                      propsForLabels: { fontSize: 10 },
                    }}
                    bezier
                    withVerticalLines={false}
                    withHorizontalLines={true}
                    withDots={true}
                    style={styles.chart}
                  />
                </View>
              )}

              {/* Technical Indicators */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Technical Indicators</Text>
                <FlatList
                  data={[
                    { id: '1', label: 'SMA', value: showSMA, setter: setShowSMA, icon: 'analytics' },
                    { id: '2', label: 'EMA', value: showEMA, setter: setShowEMA, icon: 'pulse' },
                    { id: '3', label: 'Bollinger', value: showBollinger, setter: setShowBollinger, icon: 'resize' },
                    { id: '4', label: 'RSI', value: showRSI, setter: setShowRSI, icon: 'speedometer' },
                    { id: '5', label: 'MACD', value: showMACD, setter: setShowMACD, icon: 'bar-chart' },
                    { id: '6', label: 'VWAP', value: showVWAP, setter: setShowVWAP, icon: 'calculator' },
                  ]}
                  numColumns={3}
                  scrollEnabled={false}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.indicatorCard,
                        item.value && styles.indicatorCardActive
                      ]}
                      onPress={() => item.setter(!item.value)}
                    >
                      <Ionicons 
                        name={item.icon} 
                        size={24} 
                        color={item.value ? '#007bff' : '#6c757d'} 
                      />
                      <Text style={[styles.indicatorLabel, item.value && styles.indicatorLabelActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.indicatorsGrid}
                />
              </View>

              {/* Key Metrics */}
              {metricsData.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Key Metrics</Text>
                  <FlatList
                    data={metricsData}
                    numColumns={2}
                    scrollEnabled={false}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <View style={styles.metricCard}>
                        <View style={styles.metricHeader}>
                          <Ionicons name={item.icon} size={16} color="#6c757d" />
                          <Text style={styles.metricLabel}>{item.label}</Text>
                        </View>
                        <Text style={styles.metricValue}>{item.value}</Text>
                      </View>
                    )}
                    contentContainerStyle={styles.metricsGrid}
                  />
                </View>
              )}

              {/* Historical Data */}
              {tableData.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Historical Data</Text>
                    <TouchableOpacity
                      style={styles.exportButton}
                      onPress={handleExport}
                    >
                      <Text style={styles.exportText}>Export CSV</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.tableContainer}>
                    <View style={styles.headerRow}>
                      {['Date', 'Open', 'Close', 'Vol'].map(h => (
                        <Text key={h} style={[styles.dataCell, styles.headerCell]}>
                          {h}
                        </Text>
                      ))}
                    </View>
                    
                    {tableData.map((item, index) => (
                      <View 
                        key={item.id} 
                        style={[
                          styles.dataRow,
                          index % 2 === 0 && styles.dataRowEven
                        ]}
                      >
                        <Text style={styles.dataCell}>{item.date}</Text>
                        <Text style={styles.dataCell}>Rs {item.open}</Text>
                        <Text style={styles.dataCell}>Rs {item.close}</Text>
                        <Text style={styles.dataCell}>{item.volume}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </>
      }
      ListFooterComponent={
        <>
          {!error && (
            <>
              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.compareButton]}
                  onPress={() => router.push({ pathname: '/compare', params: { symbols: symbol } })}
                >
                  <Ionicons name="git-compare" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Compare</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.alertButton]}
                  onPress={() => router.push({ pathname: '/alerts', params: { symbol } })}
                >
                  <Ionicons name="notifications" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Set Alert</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.detailButton]}
                  onPress={() => router.push({ pathname: '/detail', params: { symbol } })}
                >
                  <Ionicons name="information-circle" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Details</Text>
                </TouchableOpacity>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Data provided by PSX API</Text>
                <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
                  <Ionicons name="refresh" size={16} color="#007bff" />
                  <Text style={styles.footerLink}> Refresh</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa', 
    padding: 16 
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: {
    marginTop: 16,
    color: '#6c757d',
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchContainer: {
    position: 'relative',
    flexDirection: 'row',
    marginBottom: 16,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  searchButton: {
    marginLeft: 8,
    backgroundColor: '#007bff',
    borderRadius: 8,
    padding: 14,
    justifyContent: 'center',
    width: 50,
    alignItems: 'center',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    zIndex: 10,
    elevation: 5,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
  },
  quoteContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  symbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6c757d',
  },
  price: { 
    fontSize: 32, 
    fontWeight: '700',
    color: '#212529',
    marginVertical: 4,
  },
  change: { 
    fontSize: 16,
    fontWeight: '600',
  },
  up: { color: '#28a745' },
  down: { color: '#dc3545' },
  watchButton: {
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 50,
  },
  rangeSelector: {
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  rangeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    marginRight: 8,
  },
  rangeButtonActive: { 
    backgroundColor: '#007bff',
  },
  rangeText: { 
    fontSize: 14, 
    fontWeight: '600',
    color: '#6c757d',
  },
  rangeTextActive: { 
    color: '#fff',
  },
  chartContainer: {
    height: 240,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  chart: {
    borderRadius: 8,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
  },
  indicatorsGrid: {
    paddingBottom: 8,
  },
  indicatorCard: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    marginHorizontal: '1.5%',
  },
  indicatorCardActive: {
    borderColor: '#007bff',
    backgroundColor: '#e6f7ff',
  },
  indicatorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    marginTop: 8,
  },
  indicatorLabelActive: {
    color: '#007bff',
  },
  metricsGrid: {
    paddingBottom: 8,
  },
  metricCard: {
    width: '48%',
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginHorizontal: '1%',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: '#6c757d',
    marginLeft: 6,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  tableContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    paddingVertical: 12,
  },
  headerCell: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontWeight: '700',
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dataRowEven: {
    backgroundColor: '#f8f9fa',
  },
  dataCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: '#495057',
  },
  exportButton: {
    backgroundColor: '#28a745',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  exportText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  compareButton: { 
    backgroundColor: '#17a2b8' 
  },
  alertButton: { 
    backgroundColor: '#ffc107' 
  },
  detailButton: { 
    backgroundColor: '#6c757d' 
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  footerText: {
    fontSize: 12,
    color: '#6c757d',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLink: {
    fontSize: 12,
    color: '#007bff',
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    marginVertical: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007bff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
});