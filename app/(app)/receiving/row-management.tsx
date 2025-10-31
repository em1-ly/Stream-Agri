import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { powersync } from '@/powersync/system';
import { RowManagementRecord } from '@/powersync/Schema';

interface RowData {
  id: number;
  row_number: number;
  current_count: number;
  max_count: number;
  lay_number: number;
  date: string;
  is_active_lay: boolean;
  last_updated: string;
  bale_count?: number;
}

export default function RowManagementScreen() {
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRows = async () => {
    try {
      setLoading(true);

      // Fetch ALL rows from PowerSync
      const rowsData = await powersync.getAll(`
        SELECT 
          id,
          row_number,
          current_count,
          max_count,
          lay_number,
          date,
          is_active_lay,
          last_updated
        FROM receiving_curverid_row_management 
        ORDER BY date DESC, is_active_lay DESC, row_number ASC
      `) as RowManagementRecord[];

      // Transform the data to match our interface
      const transformedRows: RowData[] = rowsData.map((row) => ({
        id: row.id,
        row_number: row.row_number,
        current_count: row.current_count || 0,
        max_count: row.max_count || 50,
        lay_number: row.lay_number || 1,
        date: row.date,
        is_active_lay: Boolean(row.is_active_lay),
        last_updated: row.last_updated,
      }));

      setRows(transformedRows);
    } catch (error) {
      console.error('Error fetching rows from PowerSync:', error);
    } finally {
      setLoading(false);
    }
  };


  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRows();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const getRowStatusColor = (row: RowData) => {
    if (!row.is_active_lay) return 'bg-gray-200';
    const percentage = (row.current_count / row.max_count) * 100;
    if (percentage >= 90) return 'bg-red-200';
    if (percentage >= 70) return 'bg-yellow-200';
    return 'bg-green-200';
  };

  const getRowStatusText = (row: RowData) => {
    if (!row.is_active_lay) return 'Inactive';
    const percentage = (row.current_count / row.max_count) * 100;
    if (percentage >= 90) return 'Full';
    if (percentage >= 70) return 'Nearly Full';
    return 'Available';
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Stack.Screen options={{ title: 'Row Management' }} />
        <ActivityIndicator size="large" color="#65435C" />
        <Text className="text-gray-600 mt-4">Loading rows...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: 'Row Management' }} />
      
      <ScrollView 
        className="flex-1 p-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        {/* Summary Stats */}
        <View className="bg-gray-50 rounded-lg p-4 mb-6">
          <Text className="text-lg font-bold text-gray-800 mb-2">Summary</Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-2xl font-bold text-[#65435C]">
                {rows.filter(r => r.is_active_lay).length}
              </Text>
              <Text className="text-gray-600 text-sm">Active Rows</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-blue-600">
                {rows.filter(r => r.is_active_lay).reduce((sum, r) => sum + r.current_count, 0)}
              </Text>
              <Text className="text-gray-600 text-sm">Total Bales (Active)</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">
                {rows.filter(r => r.is_active_lay && r.current_count < r.max_count).length}
              </Text>
              <Text className="text-gray-600 text-sm">Available</Text>
            </View>
          </View>
        </View>

        {/* Rows List */}
        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-800 mb-3">Row Status</Text>
          {rows.length === 0 ? (
            <View className="bg-gray-100 rounded-lg p-6 items-center">
              <Text className="text-gray-600 text-center">No rows found.</Text>
            </View>
          ) : (
            <View className="space-y-3">
              {rows
                .sort((a, b) => (
                  a.date === b.date
                    ? a.row_number - b.row_number
                    : (a.date < b.date ? 1 : -1)
                ))
                .map((row) => (
                  <View key={row.id} className={`rounded-lg p-4 ${getRowStatusColor(row)}`}>
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-lg font-bold text-gray-800">
                        {row.date} • Row {row.row_number}
                      </Text>
                      <View className="flex-row items-center">
                        <Text className="text-sm text-gray-600 mr-2">
                          Lay {row.lay_number}
                        </Text>
                        <View className={`px-2 py-1 rounded-full ${
                          getRowStatusText(row) === 'Available' ? 'bg-green-100' :
                          getRowStatusText(row) === 'Nearly Full' ? 'bg-yellow-100' :
                          getRowStatusText(row) === 'Full' ? 'bg-red-100' : 'bg-gray-100'
                        }`}>
                          <Text className={`text-xs font-semibold ${
                            getRowStatusText(row) === 'Available' ? 'text-green-800' :
                            getRowStatusText(row) === 'Nearly Full' ? 'text-yellow-800' :
                            getRowStatusText(row) === 'Full' ? 'text-red-800' : 'text-gray-800'
                          }`}>
                            {getRowStatusText(row)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <View className="flex-row justify-between items-center">
                      <Text className="text-gray-600">
                        {row.current_count} / {row.max_count} bales
                      </Text>
                      <View className="flex-1 mx-3">
                        <View className="bg-gray-300 rounded-full h-2">
                          <View 
                            className="bg-[#65435C] rounded-full h-2"
                            style={{ 
                              width: `${Math.min((row.current_count / row.max_count) * 100, 100)}%` 
                            }}
                          />
                        </View>
                      </View>
                      <Text className="text-sm text-gray-500">
                        {Math.round((row.current_count / row.max_count) * 100)}%
                      </Text>
                    </View>
                    
                    <Text className="text-xs text-gray-500 mt-1">
                      Last updated: {row.last_updated ? new Date(row.last_updated).toLocaleString() : '—'}
                    </Text>
                  </View>
                ))}
            </View>
          )}
        </View>

        {/* Inactive Rows */}
        {rows.filter(row => !row.is_active_lay).length > 0 && (
          <View className="mb-4">
            <Text className="text-lg font-bold text-gray-800 mb-3">Inactive Rows</Text>
            <View className="space-y-2">
              {rows
                .filter(row => !row.is_active_lay)
                .sort((a, b) => (
                  a.date === b.date
                    ? a.row_number - b.row_number
                    : (a.date < b.date ? 1 : -1)
                ))
                .map((row) => (
                  <View key={row.id} className="bg-gray-200 rounded-lg p-3">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-gray-700">
                        {row.date} • Row {row.row_number} - Lay {row.lay_number}
                      </Text>
                      <Text className="text-gray-500 text-sm">
                        {row.current_count} bales
                      </Text>
                    </View>
                  </View>
                ))}
            </View>
          </View>
        )}
      </ScrollView>

    </View>
  );
}
