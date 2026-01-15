import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { powersync } from '@/powersync/system';
import { printGrowerDeliveryNoteLocally } from '@/utils/growerDeliveryNotePrint';
import { Printer, ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TDNote = {
  id: string;
  document_number?: string;
  physical_dnote_number?: string;
  name?: string; // Driver Name
  id_number?: string;
  cellphone?: string;
  vehicle_registration?: string;
  transporter_name?: string;
  transporter_cellphone?: string;
  creditor_number?: string;
  bank?: string;
  branch?: string;
  account_number?: string;
  number_of_growers?: number;
  number_of_bales?: number;
  validated_bales?: number;
  pending_validation_count?: number;
  state?: string;
  create_date?: string;
};

type TDLine = {
  id: string;
  transporter_delivery_note_id?: number;
  grower_number?: string;
  grower_name?: string;
  location_id?: number;
  number_of_bales?: number;
  preferred_sale_date?: string;
  state?: string;
  actual_bales_found?: number;
  physical_validation_status?: string;
  has_been_printed?: number; // Boolean (0 or 1)
  grower_delivery_note_id?: number;
};

export default function TransporterDetailsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const recordId = String(params.id || '');

  const [note, setNote] = useState<TDNote | null>(null);
  const [lines, setLines] = useState<TDLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [printingIds, setPrintingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        if (!recordId) {
          setLoading(false);
          return;
        }
        const header = await powersync.get<TDNote>(
          'SELECT * FROM receiving_transporter_delivery_note WHERE id = ? LIMIT 1',
          [recordId]
        );
        setNote(header || null);

        // Live watch lines for this delivery note using PowerSync (including grower_delivery_note_id and has_been_printed)
        const controller = new AbortController();
        powersync.watch(
          'SELECT id, transporter_delivery_note_id, grower_number, grower_name, location_id, number_of_bales, preferred_sale_date, state, actual_bales_found, physical_validation_status, has_been_printed, grower_delivery_note_id FROM receiving_boka_transporter_delivery_note_line WHERE transporter_delivery_note_id = ? ORDER BY id DESC',
          [Number(recordId)],
          {
            onResult: (result) => {
              const rows = result?.rows?._array as TDLine[] | undefined;
              if (rows) setLines(rows);
            },
            onError: (err) => console.error('Lines watch error:', err)
          },
          { signal: controller.signal }
        );

        // One-shot initial load (in case watch has initial latency)
        const initial = await powersync.getAll<TDLine>(
          'SELECT id, transporter_delivery_note_id, grower_number, grower_name, location_id, number_of_bales, preferred_sale_date, state, actual_bales_found, physical_validation_status, has_been_printed, grower_delivery_note_id FROM receiving_boka_transporter_delivery_note_line WHERE transporter_delivery_note_id = ?',
          [Number(recordId)]
        );
        if (initial) setLines(initial);

        return () => controller.abort();
      } catch (e) {
        console.error('Failed to load TD note details:', e);
        Alert.alert('Error', 'Failed to load transporter delivery note');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [recordId]);

  const HeaderRow = ({ label, value }: { label: string; value?: string | number }) => (
    <View className="flex-row justify-between mb-2">
      <Text className="text-gray-600 font-medium">{label}</Text>
      <Text className="text-gray-800">{value ?? ''}</Text>
    </View>
  );

  const handlePrint = async (line: TDLine) => {
    if (!line.grower_delivery_note_id) {
      Alert.alert('Error', 'Cannot print: Grower Delivery Note ID not found for this line.');
      return;
    }

    setPrintingIds(prev => new Set(prev).add(line.id));

    try {
      // Print locally (works offline - no network required)
      await printGrowerDeliveryNoteLocally(line.grower_delivery_note_id);
      
      // Update has_been_printed and state to 'printed' in local database (works offline)
      // PowerSync connector will automatically sync this to Odoo via PATCH when online
      await powersync.execute(
        `UPDATE receiving_boka_transporter_delivery_note_line 
         SET has_been_printed = 1, state = 'printed', write_date = ? 
         WHERE id = ?`,
        [new Date().toISOString(), line.id]
      );
      
      Alert.alert('Success', 'Grower Delivery Note printed successfully.');
    } catch (error: any) {
      Alert.alert('Print Error', `Failed to print: ${error.message}`);
    } finally {
      setPrintingIds(prev => {
        const next = new Set(prev);
        next.delete(line.id);
        return next;
      });
    }
  };

  return (
    <View className="flex-1 bg-[#65435C]">
      <Stack.Screen options={{ title: 'Transporter Details', headerShown: false }} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : !note ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-gray-700">Record not found.</Text>
        </View>
      ) : (
        <View className="flex-1">
          {/* Custom header with back, on purple background but white card */}
          <View style={{ backgroundColor: '#65435C', paddingTop: insets.top }}>
            <View className="flex-row items-center justify-between bg-white py-5 px-4">
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() => router.back()}
            >
              <ChevronLeft size={24} color="#65435C" />
              <Text className="text-[#65435C] font-bold text-lg ml-2">
                Transporter Details
              </Text>
            </TouchableOpacity>
            </View>
          </View>

          {/* Main content card */}
          <View className="flex-1 bg-white rounded-2xl p-4">
            <ScrollView className="flex-1">
              {/* Top banner with document and state */}
              <View className="bg-[#65435C] rounded-xl p-4 mb-4">
                <Text className="text-white text-2xl font-extrabold">
                  {note.physical_dnote_number || 'Transporter D/Note'}
                </Text>
                <View className="mt-8">
                  <Text className="text-white/90 bg-white/20 self-start px-3 py-1 rounded-full text-xs font-semibold uppercase">
                    {note.state || 'open'}
                  </Text>
                </View>
              </View>

              {/* Driver Information */}
              <View className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
                <Text className="text-lg font-semibold text-[#65435C] mb-3">Driver Information</Text>
                <HeaderRow label="Driver Name" value={note.name} />
                <HeaderRow label="Driver ID" value={note.id_number} />
                <HeaderRow label="Driver Phone" value={note.cellphone} />
                <HeaderRow label="Truck Reg" value={note.vehicle_registration} />
              </View>

              {/* Transporter Information */}
              <View className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
                <Text className="text-lg font-semibold text-[#65435C] mb-3">Transporter Information</Text>
                <HeaderRow label="Transporter" value={note.transporter_name} />
                <HeaderRow label="Transporter Phone" value={note.transporter_cellphone} />
                <HeaderRow label="Creditor No." value={note.creditor_number} />
              </View>

              {/* Banking Information */}
              <View className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
                <Text className="text-lg font-semibold text-[#65435C] mb-3">Banking Information</Text>
                <HeaderRow label="Bank" value={note.bank} />
                <HeaderRow label="Branch" value={note.branch} />
                <HeaderRow label="Account No." value={note.account_number} />
              </View>

              {/* Delivery Summary */}
              <View className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
                <Text className="text-lg font-semibold text-[#65435C] mb-3">Delivery Summary</Text>
                <HeaderRow label="Growers" value={note.number_of_growers ?? ''} />
                <HeaderRow label="Bales (expected)" value={note.number_of_bales ?? ''} />
              </View>

              {/* Validation Summary */}
              <View className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
                <Text className="text-lg font-semibold text-[#65435C] mb-3">Validation Summary</Text>
                <HeaderRow label="Bales (validated)" value={note.validated_bales ?? ''} />
                <HeaderRow label="Pending validations" value={note.pending_validation_count ?? ''} />
              </View>

              <View className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
                <Text className="text-lg font-semibold text-[#65435C] mb-3">Grower Lines</Text>
                {lines.length === 0 ? (
                  <Text className="text-gray-600">No lines.</Text>
                ) : (
                  lines.map((ln) => (
                    <View key={ln.id} className="border-b border-gray-200 py-2">
                      <Text className="text-[#65435C] font-semibold">
                        {ln.grower_number || ln.grower_number || 'Grower'}
                      </Text>
                      <Text className="text-gray-700 text-sm">Bales: {ln.number_of_bales ?? ''}</Text>
                      <View className="flex-row gap-2 mt-1 items-center">
                        <Text className="text-gray-500 text-xs">State: {ln.state || ''}</Text>
                        {(ln.physical_validation_status || '').length > 0 && (
                          <Text
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              ln.physical_validation_status === 'validated'
                                ? 'bg-green-100 text-green-800'
                                : ln.physical_validation_status === 'missing'
                                ? 'bg-yellow-100 text-yellow-800'
                                : ln.physical_validation_status === 'variance'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {(ln.physical_validation_status || '').toUpperCase()}
                          </Text>
                        )}
                        <Text className="text-gray-500 text-xs">
                          Validated: {ln.actual_bales_found ?? ''}
                        </Text>
                      </View>
                      <View className="flex-row gap-2 mt-2">
                        <TouchableOpacity
                          className={`${
                            ln.physical_validation_status === 'validated' ||
                            !['checked', 'closed'].includes((note.state || '').toLowerCase())
                              ? 'bg-gray-400'
                              : 'bg-green-600'
                          } px-3 py-2 rounded-md`}
                          disabled={
                            ln.physical_validation_status === 'validated' ||
                            !['checked', 'closed'].includes((note.state || '').toLowerCase())
                          }
                          onPress={() => {
                            router.push(`/receiving/validate-td-line?id=${ln.id}`);
                          }}
                        >
                          <Text className="text-white text-xs font-bold">
                            {ln.physical_validation_status === 'validated'
                              ? 'Validated'
                              : !['checked', 'closed'].includes((note.state || '').toLowerCase())
                              ? 'Validate (Book first)'
                              : 'Validate'}
                          </Text>
                        </TouchableOpacity>
                        {ln.physical_validation_status === 'validated' && ln.grower_delivery_note_id && (
                          <TouchableOpacity
                            className={`${
                              ln.has_been_printed === 1 || ln.state === 'printed'
                                ? 'bg-[#65435C]'
                                : 'bg-blue-600'
                            } px-3 py-2 rounded-md flex-row items-center justify-center gap-1`}
                            onPress={() => handlePrint(ln)}
                            disabled={printingIds.has(ln.id)}
                          >
                            {printingIds.has(ln.id) ? (
                              <ActivityIndicator color="white" size="small" />
                            ) : ln.has_been_printed === 1 || ln.state === 'printed' ? (
                              <>
                                <Printer color="white" size={14} />
                                <Text className="text-white text-xs font-bold">Printed</Text>
                              </>
                            ) : (
                              <>
                                <Printer color="white" size={14} />
                                <Text className="text-white text-xs font-bold">Print</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}
