import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { powersync } from '@/powersync/system';
import { SystemLogRecord } from '@/powersync/Schema';
import { RefreshCcw, Trash2, Eye, X } from 'lucide-react-native';

const SyncLogs = () => {
  const [logs, setLogs] = useState<SystemLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recordDetails, setRecordDetails] = useState<any | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const result = await powersync.getAll<SystemLogRecord>('SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100');
      setLogs(result || []);
    } catch (error) {
      console.error('Failed to fetch sync logs:', error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchLogs();
    }, [])
  );

  const handleViewData = async (log: SystemLogRecord) => {
    if (!log.table_name || !log.record_id || log.table_name === 'N/A' || log.record_id === 'N/A') {
      Alert.alert('Cannot View Data', 'Log entry does not have enough information to find the record.');
      return;
    }
    try {
      const record = await powersync.get(`SELECT * FROM ${log.table_name} WHERE id = ?`, [log.record_id]);
      if (record) {
        setRecordDetails(record);
      } else {
        Alert.alert('Record Not Found', 'The local record that caused this error could not be found. It may have been deleted already.');
      }
    } catch (error) {
      console.error('Failed to fetch record data:', error);
      Alert.alert('Error', `Failed to fetch record data: ${error}`);
    }
  };

  const handleDelete = async (log: SystemLogRecord) => {
    if (!log.table_name || !log.record_id || log.table_name === 'N/A' || log.record_id === 'N/A') {
      Alert.alert('Cannot Delete', 'Log entry does not have enough information to delete the record.');
      return;
    }

    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete the local record from "${log.table_name}" with ID "${log.record_id}"? This can resolve sync errors for this record, but the local data will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await powersync.writeTransaction(async (tx) => {
                try {
                // 1. Delete the record that caused the error
                console.log(`Attempting to delete from ${log.table_name} where id = ${log.record_id}`);
                await tx.execute(`DELETE FROM ${log.table_name} WHERE id = ?`, [String(log.record_id)]);
                
                // 2. Delete the log entry itself
                await tx.execute('DELETE FROM system_logs WHERE id = ?', [log.id]);
                } catch (e) {
                  // Explicit rollback to ensure nothing is committed on error
                  await tx.rollback();
                  throw e;
              }
              });

              Alert.alert('Success', 'Local record and log entry deleted. The pending transaction will be cleared on next sync.');
              await fetchLogs(); // Refresh the list
            } catch (error) {
              console.error('Failed to delete record:', error);
              Alert.alert('Error', `Failed to delete local record: ${error}`);
            }
          },
        },
      ]
    );
  };

  const handleClearAllErrors = async () => {
    Alert.alert(
      'Confirm Clear All Errors',
      `This will delete ALL local records that are currently causing sync errors and clear the error logs. This action cannot be undone. Are you sure you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const errorLogs = await powersync.getAll<SystemLogRecord>('SELECT id, table_name, record_id FROM system_logs WHERE type = ?', ['error']);

              if (errorLogs.length === 0) {
                Alert.alert('No Errors', 'There are no error logs to clear.');
                setIsLoading(false);
                return;
              }

              await powersync.writeTransaction(async (tx) => {
                try {
                for (const log of errorLogs) {
                  if (log.table_name && log.record_id && log.table_name !== 'N/A' && log.record_id !== 'N/A') {
                    console.log(`Queueing deletion for ${log.table_name} ID: ${log.record_id}`);
                    await tx.execute(`DELETE FROM ${log.table_name} WHERE id = ?`, [log.record_id]);
                  }
                }
                // After deleting records, clear all error logs
                await tx.execute(`DELETE FROM system_logs WHERE type = ?`, ['error']);
                } catch (e) {
                  // Explicit rollback if anything fails
                  await tx.rollback();
                  throw e;
              }
              });

              Alert.alert('Success', `${errorLogs.length} error(s) and associated records have been cleared.`);
              await fetchLogs(); // Refresh the list
            } catch (error) {
              console.error('Failed to clear all errors:', error);
              Alert.alert('Error', `Failed to clear errors: ${error}`);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderLogItem = ({ item }: { item: SystemLogRecord }) => (
    <View className={`p-3 mb-2 rounded-lg border ${item.type === 'error' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
        <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-2">
                <Text className="text-xs text-gray-500">{item.created_at ? new Date(item.created_at).toLocaleString() : 'No date'}</Text>
                <Text className={`font-semibold ${item.type === 'error' ? 'text-red-800' : 'text-green-800'}`}>{item.message}</Text>
                <Text className="text-xs text-gray-600 mt-1">Table: {item.table_name} | ID: {item.record_id}</Text>
                {item.retry_count && item.retry_count > 1 && (
                  <Text className="text-xs text-yellow-600 mt-1">Retried: {item.retry_count} times (Last: {item.last_seen_at ? new Date(item.last_seen_at).toLocaleTimeString() : 'N/A'})</Text>
                )}
                {item.details && item.details !== 'null' && (
                    <Text className="text-xs text-gray-500 mt-1" selectable>{`Details: ${item.details}`}</Text>
                )}
            </View>
            {item.type === 'error' && (
                <View className="flex-row">
                    <TouchableOpacity onPress={() => handleViewData(item)} className="p-2">
                        <Eye size={20} color="#4b5563" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} className="p-2">
                        <Trash2 size={20} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    </View>
  );

  return (
    <View className="mt-4 p-4 bg-white rounded-xl">
       <Modal
        animationType="slide"
        transparent={true}
        visible={recordDetails !== null}
        onRequestClose={() => setRecordDetails(null)}
      >
        <View className="flex-1 justify-center items-center bg-black/50 p-4">
          <View className="bg-white rounded-lg w-full max-w-lg max-h-[80%]">
            <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
              <Text className="text-lg font-bold text-[#65435C]">Record Data</Text>
              <TouchableOpacity onPress={() => setRecordDetails(null)} className="p-2">
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4">
              <Text selectable>{JSON.stringify(recordDetails, null, 2)}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-lg font-bold text-[#65435C]">Sync Logs</Text>
        <View className="flex-row items-center">
          <TouchableOpacity onPress={handleClearAllErrors} className="p-2 mr-2 bg-red-100 rounded-full">
            <Trash2 size={18} color="#dc2626" />
          </TouchableOpacity>
          <TouchableOpacity onPress={fetchLogs} className="p-2">
            <RefreshCcw size={18} color="#65435C" />
          </TouchableOpacity>
        </View>
      </View>
      {isLoading ? (
        <ActivityIndicator color="#65435C" />
      ) : (
        <FlatList
          data={logs}
          renderItem={renderLogItem}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: 300 }}
          ListEmptyComponent={<Text className="text-gray-500 text-center">No logs found.</Text>}
        />
      )}
    </View>
  );
};

export default SyncLogs;
