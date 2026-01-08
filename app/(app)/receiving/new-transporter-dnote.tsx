import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Save } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { DriverRecord } from '@/powersync/Schema';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';
import { Picker } from '@react-native-picker/picker';

// A reusable input component for our form
const FormInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  editable?: boolean;
}) => (
  <View className="mb-4">
    <Text className="text-gray-700 mb-1 font-semibold">{label}</Text>
    <TextInput
      className={`border border-gray-300 rounded-lg p-3 text-base ${editable ? 'bg-gray-100' : 'bg-gray-200'}`}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      style={{ color: '#111827' }}
      keyboardType={keyboardType}
      editable={editable}
    />
  </View>
);

const NewTransporterDNoteScreen = () => {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // Form state for all the fields from your Odoo form
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverIdNumber, setDriverIdNumber] = useState('');
  const [driverCellphone, setDriverCellphone] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [transporterCellphone, setTransporterCellphone] = useState('');
  const [creditor, setCreditor] = useState(''); // display name (for UI only)
  const [creditorNumber, setCreditorNumber] = useState('');
  const [bank, setBank] = useState('');
  const [branch, setBranch] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [physicalDnote, setPhysicalDnote] = useState(''); 
  const [creditors, setCreditors] = useState<{ id: string; name: string; creditor_number: string }[]>([]);
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [selectedCreditorId, setSelectedCreditorId] = useState<string>('');

  // Load creditors and drivers from local DB
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [credRows, driverRows] = await Promise.all([
          powersync.getAll<{ id: string; name: string; creditor_number: string }>(
          "SELECT id, COALESCE(name, '') AS name, COALESCE(creditor_number, '') AS creditor_number FROM grower_creditors_creditor WHERE COALESCE(active, 1) = 1 ORDER BY creditor_number"
          ),
          powersync.getAll<DriverRecord>('SELECT * FROM warehouse_driver ORDER BY name ASC')
        ]);
        
        const cleanedCreds = credRows
          .filter(r => r && typeof r.id !== 'undefined')
          .map(r => ({ id: String(r.id), name: (r.name || '').trim(), creditor_number: (r.creditor_number || '').trim() }))
          .filter(r => r.name.length > 0);
        
        setCreditors(cleanedCreds);
        setDrivers(driverRows);
      } catch (e) {
        console.warn('Failed to load form data:', e);
      }
    };
    fetchData();
  }, []);

  const handleDriverChange = (val: string) => {
    setSelectedDriverId(val);
    const driver = drivers.find(d => String(d.id) === val);
    if (driver) {
      setDriverName(driver.name || '');
      setDriverIdNumber(driver.national_id || '');
      setDriverCellphone(driver.cellphone || '');
    } else {
      setDriverName('');
      setDriverIdNumber('');
      setDriverCellphone('');
    }
  };

  // When a creditor is selected, set display name and creditor number
  useEffect(() => {
    if (!selectedCreditorId) return;
    const found = creditors.find(c => c.id === selectedCreditorId);
    if (found) {
      setCreditor(found.name || '');
      setCreditorNumber((found.creditor_number || '').trim());
    }
  }, [selectedCreditorId, creditors]);

  const handleSave = async () => {
    const trimmedDriver = driverName.trim();
    const trimmedVehicle = vehicleReg.trim();
    const trimmedCreditorNumber = creditorNumber.trim();

    if (!trimmedDriver || !trimmedVehicle) {
      Alert.alert('Missing Information', 'Please fill in at least the Driver Name and Vehicle Registration.');
      return;
    }

    // Creditor Number mandatory (align with Odoo form behaviour)
    if (!trimmedCreditorNumber) {
      Alert.alert('Missing Information', 'Creditor Number is required before saving the Transporter Delivery Note.');
      return;
    }
    if (!selectedCreditorId) {
      Alert.alert('Missing Information', 'Please select a Creditor (from Odoo) before saving.');
      return;
    }
    setIsSaving(true);

    try {
      const newRecord = {
        id: uuid(),
        driver_id: selectedDriverId ? Number(selectedDriverId) : null,
        name: trimmedDriver,
        id_number: driverIdNumber.trim(),
        cellphone: driverCellphone.trim(),
        vehicle_registration: trimmedVehicle,
        transporter_name: transporterName.trim(),
        transporter_cellphone: transporterCellphone.trim(),
        creditor_number: trimmedCreditorNumber,
        bank: bank.trim(),
        branch: branch.trim(),
        account_number: accountNumber.trim(),
        state: 'open', // Default state on creation
        create_date: new Date().toISOString(),
        write_date: new Date().toISOString(),
      };
      
      const columns = Object.keys(newRecord);
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(newRecord);

      await powersync.execute(
        `INSERT INTO receiving_transporter_delivery_note (${columns.join(', ')}) VALUES (${placeholders})`,
        values
      );

      Alert.alert('Success', 'Delivery Note created successfully.');
      router.back();

    } catch (error) {
      console.error('Error saving new delivery note:', error);
      Alert.alert('Error', `Failed to save the delivery note. Please check the console for details.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ 
        title: 'New Transporter DNote',
        headerTitleStyle: { fontSize: 20, fontWeight: 'bold', color: '#65435C' }
      }} />
      <ScrollView className="flex-1 bg-white p-5">
        <View className="mb-6 p-4 bg-gray-50 rounded-lg">
          <Text className="text-xl font-bold text-[#65435C] mb-3">Driver Information</Text>
           {/* Creditor selection from Odoo-synced table */}
           <View className="mb-4">
            <Text className="text-gray-700 mb-1 font-semibold">Creditor Number</Text>
            <View className="bg-gray-100 border border-gray-300 rounded-lg">
              <Picker
                selectedValue={selectedCreditorId}
                onValueChange={(val) => setSelectedCreditorId(String(val || ''))}
                style={{ height: 50, color: selectedCreditorId ? '#111827' : '#4B5563' }}
              >
                <Picker.Item label="-- Select Creditor Number --" value="" color="#9CA3AF" />
                {creditors.map((c) => (
                  <Picker.Item key={c.id} label={c.creditor_number || c.name} value={c.id} color="#374151" />
                ))}
              </Picker>
            </View>
          </View>
          {/* Display the resolved creditor number (read-only, driven by selection) */}
          <View className="mb-4">
            <Text className="text-gray-700 mb-1 font-semibold">Driver</Text>
            <View className="bg-gray-100 border border-gray-300 rounded-lg">
              <Picker
                selectedValue={selectedDriverId}
                onValueChange={handleDriverChange}
                style={{ height: 50, color: selectedDriverId ? '#111827' : '#4B5563' }}
              >
                <Picker.Item label="-- Select Driver --" value="" color="#9CA3AF" />
                {drivers.map((d) => (
                  <Picker.Item key={String(d.id)} label={d.name || ''} value={String(d.id)} color="#374151" />
                ))}
              </Picker>
            </View>
          </View>
          <FormInput label="Driver National ID" value={driverIdNumber} onChangeText={setDriverIdNumber} placeholder="e.g., 63-1234567 A 00" editable={!selectedDriverId} />
          <FormInput label="Driver Cellphone" value={driverCellphone} onChangeText={setDriverCellphone} placeholder="e.g., 0777123456" keyboardType="phone-pad" editable={!selectedDriverId} />
        </View>

        <View className="mb-6 p-4 bg-gray-50 rounded-lg">
          <Text className="text-xl font-bold text-[#65435C] mb-3">Transport Information</Text>
          
          <FormInput label="Truck Registration" value={vehicleReg} onChangeText={setVehicleReg} placeholder="e.g., ABE 1234" />
          <FormInput label="Transporter Name" value={transporterName} onChangeText={setTransporterName} placeholder="e.g., ABC Transport" />
          <FormInput label="Transporter Cellphone" value={transporterCellphone} onChangeText={setTransporterCellphone} placeholder="e.g., 0777654321" keyboardType="phone-pad" />
        </View>

        <View className="mb-6 p-4 bg-gray-50 rounded-lg">
          <Text className="text-xl font-bold text-[#65435C] mb-3">Banking & Other Info</Text>
         
          <FormInput label="Creditor Number" value={creditorNumber} onChangeText={setCreditorNumber} placeholder="Creditor account number" />
          <FormInput label="Bank" value={bank} onChangeText={setBank} placeholder="e.g., CBZ Bank" />
          <FormInput label="Branch" value={branch} onChangeText={setBranch} placeholder="e.g., Harare Main Street" />
          <FormInput label="Account Number" value={accountNumber} onChangeText={setAccountNumber} placeholder="e.g., 1234567890" keyboardType="numeric" />
          <FormInput label="Physical DNote Number" value={physicalDnote} onChangeText={setPhysicalDnote} placeholder="Number from the physical paper note" />
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className={`bg-[#65435C] p-4 rounded-lg flex-row justify-center items-center ${isSaving ? 'opacity-50' : ''}`}
        >
          {isSaving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Save size={24} color="white" />
          )}
          <Text className="text-white text-lg font-bold ml-3">{isSaving ? 'Saving...' : 'Save Delivery Note'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
};

export default NewTransporterDNoteScreen;
