import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Save } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';
import { Picker } from '@react-native-picker/picker';

// A reusable input component for our form
const FormInput = ({ label, value, onChangeText, placeholder, keyboardType = 'default' }) => (
  <View className="mb-4">
    <Text className="text-gray-700 mb-1 font-semibold">{label}</Text>
    <TextInput
      className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
    />
  </View>
);

const NewTransporterDNoteScreen = () => {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // Form state for all the fields from your Odoo form
  const [driverName, setDriverName] = useState('');
  const [driverId, setDriverId] = useState('');
  const [driverCellphone, setDriverCellphone] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [transporterCellphone, setTransporterCellphone] = useState('');
  const [creditor, setCreditor] = useState(''); // display name (for UI only)
  const [creditorNumber, setCreditorNumber] = useState('');
  const [bank, setBank] = useState('');
  const [branch, setBranch] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [physicalDnote, setPhysicalDnote] = useState(''); // Note: 'physical_dnote_number' is not in the schema yet
  const [creditors, setCreditors] = useState<{ id: string; name: string; creditor_number: string }[]>([]);
  const [selectedCreditorId, setSelectedCreditorId] = useState<string>('');

  // Load creditors from local DB (synced from Odoo)
  useEffect(() => {
    const loadCreditors = async () => {
      try {
        // Adjust table/column names to your schema if different
        const rows = await powersync.getAll<{ id: string; name: string; creditor_number: string }>(
          "SELECT id, COALESCE(name, '') AS name, COALESCE(creditor_number, '') AS creditor_number FROM grower_creditors_creditor WHERE COALESCE(active, 1) = 1 ORDER BY creditor_number"
        );
        const cleaned = rows
          .filter(r => r && typeof r.id !== 'undefined')
          .map(r => ({ id: String(r.id), name: (r.name || '').trim(), creditor_number: (r.creditor_number || '').trim() }))
          .filter(r => r.name.length > 0);
        setCreditors(cleaned);
      } catch (e) {
        console.warn('Failed to load creditors list:', e);
        setCreditors([]);
      }
    };
    loadCreditors();
  }, []);

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
      // NOTE: We only save the fields that currently exist in your Schema.ts file.
      // Fields like 'creditor' and 'physical_dnote_number' are in the UI but will not be saved
      // until the schema is updated to include them.
      const newRecord = {
        id: uuid(),
        name: trimmedDriver,
        id_number: driverId.trim(),
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
              >
                <Picker.Item label="-- Select Creditor Number --" value="" />
                {creditors.map((c) => (
                  <Picker.Item key={c.id} label={c.creditor_number || c.name} value={c.id} />
                ))}
              </Picker>
            </View>
          </View>
          {/* Display the resolved creditor number (read-only, driven by selection) */}
          <FormInput label="Driver Name" value={driverName} onChangeText={setDriverName} placeholder="e.g., John Doe" />
          <FormInput label="Driver ID Number" value={driverId} onChangeText={setDriverId} placeholder="e.g., 63-1234567 A 00" />
          <FormInput label="Driver Cellphone" value={driverCellphone} onChangeText={setDriverCellphone} placeholder="e.g., 0777123456" keyboardType="phone-pad" />
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
