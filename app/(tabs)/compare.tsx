// File: app/(tabs)/compare.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  Linking,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';

// Replace with your actual API URL
const API_BASE_URL = "http://192.168.100.11:8000"; 



// Date ranges
const DATE_RANGES = ['1M', '3M', '6M', '1Y', 'MAX'] as const;
type DateRange = typeof DATE_RANGES[number];

// Time-series point
type TimeSeriesPoint = { date: string; close: number };

// Company data
type CompanyData = {
  symbol: string;
  latestClose: number;
  performance: number; // Percentage change
};

export default function CompareScreen() {
  const router = useRouter();
  const screenWidth = Dimensions.get('window').width;

  // Input & parsed symbols
  const [input, setInput] = useState('OGDC,PSO');
  const [symbols, setSymbols] = useState<string[]>(['OGDC', 'PSO']);

  // Date range
  const [dateRange, setDateRange] = useState<DateRange>('6M');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  // Data states
  const [companyData, setCompanyData] = useState<CompanyData[]>([]);
  const [seriesData, setSeriesData] = useState<Record<string, TimeSeriesPoint[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate date range
  const calculateDateRange = useCallback(() => {
    const end = new Date();
    const start = new Date();
    
    switch (dateRange) {
      case '1M':
        start.setMonth(start.getMonth() - 1);
        break;
      case '3M':
        start.setMonth(start.getMonth() - 3);
        break;
      case '6M':
        start.setMonth(start.getMonth() - 6);
        break;
      case '1Y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'MAX':
        start.setFullYear(2010);
        break;
    }
    
    setStartDate(start);
    setEndDate(end);
  }, [dateRange]);

  // Parse input into exactly 2 tickers
  const parseSymbols = useCallback(() => {
    const list = Array.from(
      new Set(
        input
          .split(',')
          .map(s => s.trim().toUpperCase())
          .filter(s => s)
      )
    ).slice(0, 2);
    
    if (list.length === 2) {
      setSymbols(list);
      setError(null);
    } else {
      Alert.alert('Error', 'Please enter exactly 2 symbols');
      setError('Please enter exactly 2 symbols');
    }
  }, [input]);

  // Load comparison data using your API
  const loadComparison = useCallback(async () => {
    if (symbols.length !== 2) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Format dates for API
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      
      // Fetch data for both symbols in parallel
      const responses = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const response = await fetch(
              `${API_BASE_URL}/graph?symbol=${symbol}&start=${startStr}&end=${endStr}`
            );
            
            // Check for HTML responses
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
              const html = await response.text();
              throw new Error(`Server returned HTML: ${html.substring(0, 100)}...`);
            }
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
          } catch (error: any) {
            console.error(`Error fetching data for ${symbol}:`, error);
            throw new Error(`Failed to load ${symbol}: ${error.message}`);
          }
        })
      );

      // Validate and process API responses
      const processedData = await Promise.all(
        responses.map(async (response, index) => {
          const symbol = symbols[index];
          
          // Validate response structure
          if (!Array.isArray(response)) {
            throw new Error(`Invalid data format for ${symbol}. Expected array.`);
          }
          
          // Process each data point
          const processedPoints = response.map((point: any) => {
            if (!point.date || typeof point.close === 'undefined') {
              throw new Error(`Invalid data point for ${symbol}: Missing date or close`);
            }
            
            const close = parseFloat(point.close);
            if (isNaN(close)) {
              throw new Error(`Invalid close value for ${symbol} on ${point.date}: ${point.close}`);
            }
            
            return {
              date: point.date,
              close
            };
          });
          
          // Sort by date (oldest first)
          processedPoints.sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          
          // Calculate performance metrics
          if (processedPoints.length === 0) {
            throw new Error(`No data available for ${symbol}`);
          }
          
          const firstClose = processedPoints[0].close;
          const lastClose = processedPoints[processedPoints.length - 1].close;
          const performance = firstClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;
          
          return {
            symbol,
            series: processedPoints,
            companyData: {
              symbol,
              latestClose: lastClose,
              performance
            }
          };
        })
      );
      
      // Update state with processed data
      const newSeriesData: Record<string, TimeSeriesPoint[]> = {};
      const newCompanyData: CompanyData[] = [];
      
      processedData.forEach(data => {
        newSeriesData[data.symbol] = data.series;
        newCompanyData.push(data.companyData);
      });
      
      setSeriesData(newSeriesData);
      setCompanyData(newCompanyData);
    } catch (error: any) {
      setError(error.message || 'Failed to load comparison data');
      console.error('Comparison error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [symbols, startDate, endDate]);

  // Initialize and reload when dependencies change
  useEffect(() => {
    calculateDateRange();
  }, [dateRange]);

  useEffect(() => {
    if (symbols.length === 2) {
      loadComparison();
    }
  }, [symbols, startDate, endDate]);

  // Handle CSV export
  const handleExport = async (symbol: string) => {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    const url = `${API_BASE_URL}/export/historical/csv?symbol=${symbol}&start=${startStr}&end=${endStr}`;
    
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      try {
        await Linking.openURL(url);
      } catch (error) {
        Alert.alert('Error', 'Could not open the download link');
      }
    }
  };

  // Render chart with synchronized date ranges
  const renderChart = () => {
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHelp}>
            Check API connection: {API_BASE_URL}
          </Text>
          <Text style={styles.errorHelp}>
            Try symbols: OGDC, PSO, HBL, UBL, LUCK
          </Text>
        </View>
      );
    }
    
    if (!symbols[0] || !symbols[1] || 
        !seriesData[symbols[0]] || 
        !seriesData[symbols[1]] || 
        seriesData[symbols[0]].length === 0 || 
        seriesData[symbols[1]].length === 0) {
      return (
        <View style={styles.chartPlaceholder}>
          <Text style={styles.placeholderText}>Loading chart data...</Text>
        </View>
      );
    }
    
    const series1 = seriesData[symbols[0]];
    const series2 = seriesData[symbols[1]];
    
    // Find common date range
    const minDate = new Date(Math.max(
      new Date(series1[0].date).getTime(), 
      new Date(series2[0].date).getTime()
    ));
    
    const maxDate = new Date(Math.min(
      new Date(series1[series1.length - 1].date).getTime(), 
      new Date(series2[series2.length - 1].date).getTime()
    ));
    
    // Filter data to common range
    const filteredData1 = series1.filter(point => {
      const pointDate = new Date(point.date);
      return pointDate >= minDate && pointDate <= maxDate;
    });
    
    const filteredData2 = series2.filter(point => {
      const pointDate = new Date(point.date);
      return pointDate >= minDate && pointDate <= maxDate;
    });
    
    // Prepare labels (every 5th point to avoid overcrowding)
    const labelInterval = Math.max(1, Math.floor(filteredData1.length / 5));
    const labels = filteredData1
      .filter((_, index) => index % labelInterval === 0)
      .map(point => 
        new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      );
    
    const chartData = {
      labels,
      datasets: [
        {
          data: filteredData1.map(point => point.close),
          color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
          strokeWidth: 2
        },
        {
          data: filteredData2.map(point => point.close),
          color: (opacity = 1) => `rgba(231, 76, 60, ${opacity})`,
          strokeWidth: 2
        }
      ]
    };
    
    // Calculate min/max values for better Y-axis scaling
    const allValues = [
      ...filteredData1.map(p => p.close),
      ...filteredData2.map(p => p.close)
    ];
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const padding = (maxValue - minValue) * 0.1;
    
    return (
      <View style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={screenWidth - 40}
          height={220}
          yAxisLabel="Rs. "
          yAxisSuffix=""
          fromZero={false}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 2,
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: '3',
              strokeWidth: '2',
              stroke: '#ffffff'
            }
          }}
          bezier
          style={styles.chart}
          getDotColor={(dataPoint, index) => index % 7 === 0 ? 'transparent' : 'rgba(52, 152, 219, 1)'}
          withVerticalLines={false}
          withHorizontalLines={true}
          withInnerLines={true}
          segments={5}
          yAxisInterval={1}
          xLabelsOffset={-10}
          yLabelsOffset={5}
          verticalLabelRotation={0}
          formatYLabel={(value) => `Rs. ${parseFloat(value).toFixed(0)}`}
        />
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: 'rgba(52, 152, 219, 1)' }]} />
            <Text style={styles.legendText}>{symbols[0]}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: 'rgba(231, 76, 60, 1)' }]} />
            <Text style={styles.legendText}>{symbols[1]}</Text>
          </View>
        </View>
      </View>
    );
  };

  // Render performance cards
  const renderPerformanceCards = () => {
    if (!companyData || companyData.length === 0) return null;
    
    return companyData.map(company => {
      // Calculate additional metrics
      const series = seriesData[company.symbol] || [];
      const high = series.length ? Math.max(...series.map(p => p.close)) : 0;
      const low = series.length ? Math.min(...series.map(p => p.close)) : 0;
      const volume = series.length ? series.reduce((sum, point) => sum + (point as any).volume, 0) : 0;
      
      return (
        <View key={company.symbol} style={styles.companyCard}>
          <View style={styles.symbolHeader}>
            <Text style={styles.symbolText}>{company.symbol}</Text>
            <Text style={styles.sectorText}>PSX: {company.symbol}</Text>
          </View>
          
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>
              Rs. {company.latestClose.toFixed(2)}
            </Text>
            <Text style={[
              styles.performanceText,
              company.performance >= 0 
                ? styles.positivePerformance 
                : styles.negativePerformance
            ]}>
              {company.performance >= 0 ? '▲' : '▼'} 
              {Math.abs(company.performance).toFixed(2)}%
            </Text>
          </View>
          
          <View style={styles.metricsContainer}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>High:</Text>
              <Text style={styles.metricValue}>Rs. {high.toFixed(2)}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Low:</Text>
              <Text style={styles.metricValue}>Rs. {low.toFixed(2)}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Volume:</Text>
              <Text style={styles.metricValue}>
                {(volume / 1000000).toFixed(2)}M
              </Text>
            </View>
          </View>
        </View>
      );
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>PSX Stock Comparison</Text>
        <Text style={styles.subtitle}>Pakistan Stock Exchange Analysis</Text>
      </View>

      {/* Symbol Input */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Compare Two Stocks</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., OGDC, PSO, HBL, LUCK"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={parseSymbols}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={parseSymbols}>
          <Text style={styles.buttonText}>Compare</Text>
        </TouchableOpacity>
      </View>

      {/* Date Range Selector */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Select Date Range</Text>
        <View style={styles.rangeContainer}>
          {DATE_RANGES.map(range => (
            <TouchableOpacity
              key={range}
              style={[
                styles.rangeButton,
                dateRange === range && styles.rangeButtonActive
              ]}
              onPress={() => setDateRange(range)}
            >
              <Text style={[
                styles.rangeText,
                dateRange === range && styles.rangeTextActive
              ]}>
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Fetching market data...</Text>
        </View>
      )}

      {/* Performance Chart */}
      {renderChart()}

      {/* Company Performance Summary */}
      {!isLoading && companyData.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Performance Summary</Text>
          <View style={styles.performanceContainer}>
            {renderPerformanceCards()}
          </View>
        </View>
      )}

      {/* Export Options */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Export Data</Text>
        <View style={styles.exportContainer}>
          {symbols.map(symbol => (
            <TouchableOpacity 
              key={symbol} 
              style={styles.exportButton}
              onPress={() => handleExport(symbol)}
            >
              <Text style={styles.exportText}>Export {symbol} CSV</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimerContainer}>
        <Text style={styles.disclaimerText}>
          Data provided by PSX API. For informational purposes only. 
          Past performance is not indicative of future results.
        </Text>
        <Text style={styles.disclaimerText}>
          As of: {new Date().toLocaleDateString()}
        </Text>
      </View>
    </ScrollView>
  );
}

// Professional styling
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  header: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e6ed',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  primaryButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#2980b9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rangeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  rangeButton: {
    backgroundColor: '#ecf0f1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  rangeButtonActive: {
    backgroundColor: '#3498db',
  },
  rangeText: {
    color: '#7f8c8d',
    fontWeight: '500',
  },
  rangeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 16,
    color: '#7f8c8d',
    fontSize: 14,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  chart: {
    borderRadius: 12,
  },
  chartPlaceholder: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  placeholderText: {
    color: '#bdc3c7',
    fontSize: 16,
  },
  performanceContainer: {
    gap: 16,
  },
  companyCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  symbolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  symbolText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
  },
  sectorText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  priceText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  performanceText: {
    fontSize: 16,
    fontWeight: '600',
  },
  positivePerformance: {
    color: '#27ae60',
  },
  negativePerformance: {
    color: '#e74c3c',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
  },
  exportContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  exportButton: {
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 150,
    alignItems: 'center',
  },
  exportText: {
    color: '#fff',
    fontWeight: '500',
  },
  disclaimerContainer: {
    padding: 16,
    backgroundColor: '#ecf0f1',
    borderRadius: 12,
    marginTop: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 4,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
  },
  errorContainer: {
    backgroundColor: '#fdecea',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorHelp: {
    color: '#7f8c8d',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
});