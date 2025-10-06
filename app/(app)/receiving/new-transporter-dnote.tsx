import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Save } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';

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
  const [creditor, setCreditor] = useState(''); // Note: 'creditor' field is not in the schema yet
  const [creditorNumber, setCreditorNumber] = useState('');
  const [bank, setBank] = useState('');
  const [branch, setBranch] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [physicalDnote, setPhysicalDnote] = useState(''); // Note: 'physical_dnote_number' is not in the schema yet

  const handleSave = async () => {
    if (!driverName || !vehicleReg) {
      Alert.alert('Missing Information', 'Please fill in at least the Driver Name and Vehicle Registration.');
      return;
    }
    setIsSaving(true);

    try {
      // NOTE: We only save the fields that currently exist in your Schema.ts file.
      // Fields like 'creditor' and 'physical_dnote_number' are in the UI but will not be saved
      // until the schema is updated to include them.
      const newRecord = {
        id: uuid(),
        name: driverName,
        id_number: driverId,
        cellphone: driverCellphone,
        vehicle_registration: vehicleReg,
        transporter_name: transporterName,
        transporter_cellphone: transporterCellphone,
        creditor_number: creditorNumber,
        bank: bank,
        branch: branch,
        account_number: accountNumber,
        state: 'open', // Default state on creation
        create_date: new Date().toISOString(),
        write_date: new Date().toISOString(),
      };
      
      const columns = Object.keys(newRecord);
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(newRecord);

      await powersync.execute(
        `INSERT INTO odoo_receiving_transporter_delivery_note (${columns.join(', ')}) VALUES (${placeholders})`,
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
          <FormInput label="Creditor" value={creditor} onChangeText={setCreditor} placeholder="Creditor name or ID" />
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
