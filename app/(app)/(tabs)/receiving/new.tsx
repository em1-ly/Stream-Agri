import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, TextInput, ScrollView, Alert, Modal, Button, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, MapPinPlus, Pencil, X, Camera, CalendarIcon } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { Picker } from '@react-native-picker/picker';
import { GrowerApplicationDraftRecord } from '@/powersync/Schema';
// import * as Location from 'expo-location';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as ImageManipulator from 'expo-image-manipulator';

interface GrowerApplication {
  grower_number: string;
  production_cycle_id: string;
  production_scheme_id: string;
  region_id: string;
  distribution_plan: string;
  production_cycle_name: string;
  b010_first_name: string;
  b020_surname: string;
  activity_id: string;
  b030_national_id: string;
  b040_phone_number: string;
  date_of_birth: string;
  gender: string;
  grower_image: string;
  grower_national_id_image: string;
  home_latitude: string;
  home_longitude: string;
  barn_latitude: string;
  barn_longitude: string;
  field_latitude: string;
  field_longitude: string;
}

export default function NewGrowerApplicationModal() {
  const [firstName, setFirstName] = useState<string>('');
  const [surname, setSurname] = useState<string>('');
  const [nationalId, setNationalId] = useState<string>('');
  const [growerNumber, setGrowerNumber] = useState<string>('');
  const [middleName, setMiddleName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [homeLatitude, setHomeLatitude] = useState<string>('');
  const [homeLongitude, setHomeLongitude] = useState<string>('');
  const [barnLatitude, setBarnLatitude] = useState<string>('');
  const [barnLongitude, setBarnLongitude] = useState<string>('');
  const [fieldLatitude, setFieldLatitude] = useState<string>('');
  const [fieldLongitude, setFieldLongitude] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [productionScheme, setProductionScheme] = useState<string>('');
  // const [productionCycleRegistration, setProductionCycleRegistration] = useState<string>('');
  const [productionCycle, setProductionCycle] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [activity, setActivity] = useState<string>('');
  const [fieldTechnician, setFieldTechnician] = useState<string>('');

  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [activeCamera, setActiveCamera] = useState<'grower' | 'id' | null>(null);
  const [growerImage, setGrowerImage] = useState<string | null>(null);
  const [idImage, setIdImage] = useState<string | null>(null);
  const [growerImageEncoded, setGrowerImageEncoded] = useState<string | null>(null);
  const [idImageEncoded, setIdImageEncoded] = useState<string | null>(null);

  const [contractScale, setContractScale] = useState<string>('');
  const [contractedYield, setContractedYield] = useState<string>('');
  const [contractedVolume, setContractedVolume] = useState<string>('');
  const [contractedPrice, setContractedPrice] = useState<string>('');
  const [contractedReturn, setContractedReturn] = useState<string>('');

  // const [productionCycleRegistrationList, setProductionCycleRegistrationList] = useState<string[]>([]);
  const [productionCycleList, setProductionCycleList] = useState<string[]>([]);
  const [productionSchemeList, setProductionSchemeList] = useState<string[]>([]);
  const [regionList, setRegionList] = useState<string[]>([]);
  const [activityList, setActivityList] = useState<string[]>([]);
  const [fieldTechnicianList, setFieldTechnicianList] = useState<string[]>([]);

  const cameraRef = useRef<CameraView>(null);
  const UUID = Crypto.randomUUID();

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [drafts, setDrafts] = useState<GrowerApplicationDraftRecord[]>([]);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showSaveDraftModal, setShowSaveDraftModal] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  const getProductionCycle = async () => {
    console.log('Getting Production Cycle');
    const productionCycle = await powersync.execute(`SELECT * FROM odoo_gms_production_cycle`);
    const rows = productionCycle.rows?._array || [];
    setProductionCycleList(rows);
    setProductionCycle(rows[0].id);
  }

  const getProductionScheme = async () => {
    console.log('Getting Production Scheme');
    const productionScheme = await powersync.execute(`SELECT * FROM odoo_gms_production_scheme`);
    const rows = productionScheme.rows?._array || [];
    setProductionSchemeList(rows);
    setProductionScheme(rows[0].id);
  }

  const getRegion = async () => {
    console.log('Getting Region');
    try {
      const employeeId = await SecureStore.getItemAsync('odoo_employee_id');
      const currentEmployeeId = employeeId || '';
      const productionCycleName = 'CY26';
      console.log('Fetching regions for employee ID:', currentEmployeeId, 'and production cycle name:', productionCycleName);

      const userRegions = await powersync.execute(`
        SELECT DISTINCT region_id 
        FROM odoo_gms_hr_management 
        WHERE employee = ? AND production_cycle_id = (
          SELECT id FROM odoo_gms_production_cycle WHERE name = ?
        )
      `, [currentEmployeeId, productionCycleName]);
      
      const userRegionIds = userRegions.rows?._array?.map((row: any) => row.region_id) || [];
      console.log('User accessible region IDs for production cycle', productionCycleName, ':', userRegionIds);
      
      if (userRegionIds.length === 0) {
        console.log('No regions found for employee', currentEmployeeId, 'in production cycle', productionCycleName);
        setRegionList([]);
        return;
      }
      
      // Now get the region details for the accessible regions
      const placeholders = userRegionIds.map(() => '?').join(',');
      const region = await powersync.execute(`
        SELECT * FROM odoo_gms_region 
        WHERE id IN (${placeholders})
        ORDER BY name
      `, userRegionIds);
      
      const rows = region.rows?._array || [];
      console.log('Filtered regions for user and production cycle:', rows);
      
      setRegionList(rows);
      if (rows.length > 0) {
        setRegion(rows[0].id);
      }
    } catch (error) {
      console.error('Error fetching user regions:', error);
      // Fallback to all regions if there's an error
      const region = await powersync.execute(`SELECT * FROM odoo_gms_region`);
      const rows = region.rows?._array || [];
      setRegionList(rows);
      if (rows.length > 0) {
        setRegion(rows[0].id);
      }
    }
  }

  const getActivity = async () => {
    console.log('Getting Activity');
    const activity = await powersync.execute(`SELECT * FROM odoo_gms_activity`);
    const rows = activity.rows?._array || [];
    setActivityList(rows);
    setActivity(rows[0].id);
    console.log('Activity', rows);
  }

  const getFieldTechnician = async () => {
    console.log('Getting Field Technician');
    const fieldTechnician = await powersync.execute(`SELECT * FROM hr_employee`);
    const rows = fieldTechnician.rows?._array || [];
    setFieldTechnicianList(rows);
    setFieldTechnician(rows[0].id);
    console.log('Field Technician', rows);
  }

  const getEmployeeId = async () => {
    const employeeId = await SecureStore.getItemAsync('odoo_employee_id');
    console.log('Employee ID', employeeId);
    return employeeId;
  }

  const compressImage = async (base64Image: string, imageType: 'grower' | 'id'): Promise<string> => {
    try {
      const imageUri = base64Image.startsWith('data:image')
        ? base64Image
        : `data:image/jpg;base64,${base64Image}`;

      // TODO: Upgrade package to latest version
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          { resize: { width: 1200 } }
        ],
        {
          compress: 0.35, 
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        }
      );

      const originalSize = base64Image.length;
      const compressedSize = (manipulatedImage.base64 || '').length;
      const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
      console.log(`${imageType} image compressed: ${originalSize} → ${compressedSize} bytes (${reduction}% reduction)`);

      return manipulatedImage.base64 || '';
    } catch (error) {
      console.error(`Error compressing ${imageType} image:`, error);
      // Fall back to original if compression fails
      return base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    }
  };

  // Draft management functions
  const loadDrafts = async () => {
    try {
      const employeeId = await getEmployeeId();
      const result = await powersync.execute(
        'SELECT * FROM grower_application_drafts WHERE submitted_by = ? ORDER BY modified_at DESC',
        [employeeId]
      );
      const draftList = result.rows?._array || [];
      setDrafts(draftList);
    } catch (error) {
      console.error('Error loading drafts:', error);
    }
  };

  const saveDraft = async (name: string) => {
    try {
      const employeeId = await getEmployeeId();
      const draftId = Crypto.randomUUID();
      const formData = {
        firstName,
        surname,
        middleName,
        nationalId,
        growerNumber,
        phoneNumber,
        homeLatitude,
        homeLongitude,
        barnLatitude,
        barnLongitude,
        fieldLatitude,
        fieldLongitude,
        dateOfBirth,
        gender,
        productionScheme,
        productionCycle,
        region,
        activity,
        fieldTechnician,
        contractScale,
        contractedYield,
        contractedVolume,
        contractedPrice,
        contractedReturn,
        growerImageEncoded,
        idImageEncoded
      };

      const timestamp = new Date().toISOString();
      await powersync.execute(
        `INSERT INTO grower_application_drafts (
          id, draft_name, form_data, created_at, modified_at, submitted_by
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          draftId,
          name,
          JSON.stringify(formData),
          timestamp,
          timestamp,
          employeeId
        ]
      );

      Alert.alert('Success', 'Draft saved successfully!');
      setShowSaveDraftModal(false);
      setDraftName('');
      loadDrafts();
    } catch (error) {
      console.error('Error saving draft:', error);
      Alert.alert('Error', 'Failed to save draft');
    }
  };

  const loadDraft = async (draftId: string) => {
    try {
      const result = await powersync.execute(
        'SELECT * FROM grower_application_drafts WHERE id = ?',
        [draftId]
      );
      
      if (result.rows?._array && result.rows._array.length > 0) {
        const draft = result.rows._array[0];
        const formData = JSON.parse(draft.form_data);
        
        // Load all form data back into state
        setFirstName(formData.firstName || '');
        setSurname(formData.surname || '');
        setMiddleName(formData.middleName || '');
        setNationalId(formData.nationalId || '');
        setGrowerNumber(formData.growerNumber || '');
        setPhoneNumber(formData.phoneNumber || '');
        setHomeLatitude(formData.homeLatitude || '');
        setHomeLongitude(formData.homeLongitude || '');
        setBarnLatitude(formData.barnLatitude || '');
        setBarnLongitude(formData.barnLongitude || '');
        setFieldLatitude(formData.fieldLatitude || '');
        setFieldLongitude(formData.fieldLongitude || '');
        setDateOfBirth(formData.dateOfBirth || '');
        setGender(formData.gender || '');
        setProductionScheme(formData.productionScheme || '');
        setProductionCycle(formData.productionCycle || '');
        setRegion(formData.region || '');
        setActivity(formData.activity || '');
        setFieldTechnician(formData.fieldTechnician || '');
        setContractScale(formData.contractScale || '');
        setContractedYield(formData.contractedYield || '');
        setContractedVolume(formData.contractedVolume || '');
        setContractedPrice(formData.contractedPrice || '');
        setContractedReturn(formData.contractedReturn || '');
        
        if (formData.growerImageEncoded) {
          setGrowerImageEncoded(formData.growerImageEncoded);
          setGrowerImage(`data:image/jpg;base64,${formData.growerImageEncoded}`);
        }
        
        if (formData.idImageEncoded) {
          setIdImageEncoded(formData.idImageEncoded);
          setIdImage(`data:image/jpg;base64,${formData.idImageEncoded}`);
        }

        setSelectedDraftId(draftId);
        setShowDraftModal(false);
        Alert.alert('Success', 'Draft loaded successfully!');
      }
    } catch (error) {
      console.error('Error loading draft:', error);
      Alert.alert('Error', 'Failed to load draft');
    }
  };

  const deleteDraft = async (draftId: string) => {
    try {
      await powersync.execute(
        'DELETE FROM grower_application_drafts WHERE id = ?',
        [draftId]
      );
      loadDrafts();
      Alert.alert('Success', 'Draft deleted successfully!');
    } catch (error) {
      console.error('Error deleting draft:', error);
      Alert.alert('Error', 'Failed to delete draft');
    }
  };

  useEffect(() => {
    requestPermission();
    // getProductionCycleRegistration();
    getProductionCycle();
    getProductionScheme();
    getRegion(); 
    getActivity();
    getFieldTechnician();
    loadDrafts();
  }, []);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View>
        <Text>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const takePicture = async () => {
    if (!showCamera || !cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true });

      if (photo?.base64) {
        const base64Data = photo.base64;
        
        const fixBase64Padding = (str: string) => {
          // Remove any existing padding
          const cleanStr = str.replace(/=/g, "");
          // Calculate how much padding we need
          const missingPadding = cleanStr.length % 4;
          // Add the right amount of padding
          return missingPadding ? cleanStr + '='.repeat(4 - missingPadding) : cleanStr;
        };
        
        const paddedBase64 = fixBase64Padding(base64Data);
        
        // Compress the image based on camera type
        const imageType = activeCamera === 'grower' ? 'grower' : 'id';
        const compressedBase64 = await compressImage(paddedBase64, imageType);
        
        if (activeCamera === 'grower') {
          setGrowerImage(`data:image/jpg;base64,${compressedBase64}`);
          setGrowerImageEncoded(compressedBase64);
        } else if (activeCamera === 'id') {
          setIdImage(`data:image/jpg;base64,${compressedBase64}`);
          setIdImageEncoded(compressedBase64);
        }
      }
      
      setShowCamera(false);
      setActiveCamera(null);
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const openCamera = (type: 'grower' | 'id') => {
    setActiveCamera(type);
    setShowCamera(true);
  };

  

  const createGrowerApplication = async () => {
    console.log('CREATING GROWER APPLICATION');

    await powersync.execute(`
      INSERT INTO media_files (id, mobile_grower_image, mobile_grower_national_id_image, create_date, write_date, model)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [UUID, growerImageEncoded, idImageEncoded, new Date().toISOString(), new Date().toISOString(), 'odoo_gms_grower_application']);

    const employeeId = await getEmployeeId();

    // Define field mappings - only include fields that have non-empty values
    const fieldMappings = [
      { column: 'id', value: UUID, required: true }, // UUID is always required
      { column: 'production_cycle_id', value: productionCycle },
      { column: 'production_scheme_id', value: productionScheme },
      { column: 'region_id', value: region },
      { column: 'activity_id', value: activity },
      { column: 'field_technician_id', value: employeeId },
      { column: 'grower_number', value: growerNumber },
      { column: 'b010_first_name', value: firstName },
      { column: 'b020_surname', value: surname },
      { column: 'middle_name', value: middleName },
      { column: 'b030_national_id', value: nationalId },
      { column: 'b040_phone_number', value: phoneNumber },
      { column: 'home_latitude', value: homeLatitude },
      { column: 'home_longitude', value: homeLongitude },
      { column: 'gender', value: gender },
      { column: 'grower_date_of_birth', value: dateOfBirth },
      { column: 'b010_contract_scale', value: contractScale },
      { column: 'b020_contracted_yield', value: contractedYield },
      { column: 'b030_contracted_volume', value: contractedVolume },
      { column: 'b040_contracted_price', value: contractedPrice },
      { column: 'b050_contracted_return', value: contractedReturn },
      // { column: 'grower_image', value: growerImageEncoded },
      // { column: 'grower_national_id_image', value: idImageEncoded },
      { column: 'submitted_by', value: employeeId },
      { column: 'barn_latitude', value: barnLatitude },
      { column: 'barn_longitude', value: barnLongitude },
      { column: 'field_latitude', value: fieldLatitude },
      { column: 'field_longitude', value: fieldLongitude },
      { column: 'mobile_app_id', value: UUID }
    ];

    // Filter out empty values (keep required fields and non-empty values)
    const validFields = fieldMappings.filter(field => 
      field.required || (field.value && field.value.toString().trim() !== '')
    );

    // Build the dynamic SQL statement
    const columns = validFields.map(field => field.column).join(', ');
    const placeholders = validFields.map(() => '?').join(', ');
    const values = validFields.map(field => field.value);

    const sql = `INSERT INTO odoo_gms_grower_application (${columns}) VALUES (${placeholders})`;

    console.log('Dynamic SQL:', sql);
    console.log('Values:', values);

    try {
      await powersync.execute(sql, values).then(() => {
        console.log('Grower Application Created');
      }).catch((error) => {
        console.error('Error creating grower application:', error);
        alert('Error creating grower application');
      });
    } catch (error) {
      console.error('Error creating grower application:', error);
      alert('Error creating grower application');
    }

    // Delete the draft if it was loaded from an existing draft
    if (selectedDraftId) {
      try {
        await powersync.execute(
          'DELETE FROM grower_application_drafts WHERE id = ?',
          [selectedDraftId]
        );
        console.log('Draft deleted after successful submission');
      } catch (error) {
        console.error('Error deleting draft after submission:', error);
      }
    }

    alert('Grower Created')
    router.back();
  }

  const getLocation = async () => {
    // Location removed: set defaults
    setHomeLatitude('0');
    setHomeLongitude('0');
  }

  const getBarnLocation = async () => {
    setBarnLatitude('0');
    setBarnLongitude('0');
  }

  const getFieldLocation = async () => {
    setFieldLatitude('0');
    setFieldLongitude('0');
  }


  return (
    <SafeAreaView className="flex-1 bg-[#65435C]">
      <View className="flex-1 mt-6 ">
        <View className="flex-1 bg-white rounded-t-3xl overflow-hidden ">
          <View className="flex-row justify-between items-center p-4 border-b border-gray-100 ">
            <TouchableOpacity className="flex-row items-center" onPress={() => router.back()}>
              <ChevronLeft size={28} color="#65435C" />
            <Text className="text-xl font-bold text-[#65435C]">Add New Grower</Text>
            </TouchableOpacity>
            {drafts.length > 0 && (
              <TouchableOpacity 
                className="bg-[#1AD3BB] px-3 py-2 rounded-lg"
                onPress={() => setShowDraftModal(true)}
              >
                <Text className="text-white font-medium">Load Draft</Text>
              </TouchableOpacity>
            )}
          </View>
        
          {showCamera ? (
            <View className="flex-1">
              <CameraView 
                ref={cameraRef}
                style={{flex: 1}} 
                facing={facing}
              >
                <View className="flex-1 justify-between p-4">
                  <View className="flex-row justify-between">
                    <TouchableOpacity 
                      className="bg-white p-2 rounded-full" 
                      onPress={toggleCameraFacing}
                    >
                      <Camera size={24} color="#65435C" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      className="bg-white p-2 rounded-full" 
                      onPress={() => setShowCamera(false)}
                    >
                      <X size={24} color="#65435C" />
                    </TouchableOpacity>
                  </View>
                  <View className="items-center mb-10">
                    <TouchableOpacity 
                      className="bg-white p-4 rounded-full" 
                      onPress={takePicture}
                    >
                      <View className="bg-[#65435C] h-12 w-12 rounded-full" />
                    </TouchableOpacity>
                  </View>
                </View>
              </CameraView>
            </View>
          ) : (
            <ScrollView className="flex-1 px-4 py-2 pt-4" keyboardShouldPersistTaps="handled">
              <View className="flex-1">
              <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Grower Number</Text>
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-2/3" 
                        value={growerNumber} 
                        // editable={false}
                        onChangeText={(text) => {
                            setGrowerNumber(text);
                        }}
                    />
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">First Name</Text>
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-2/3" 
                        value={firstName} 
                        // editable={false}
                        onChangeText={(text) => {
                            setFirstName(text);
                        }}
                    />
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Middle Name</Text>
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-2/3" 
                        value={middleName} 
                        onChangeText={(text) => {
                            setMiddleName(text);
                        }}
                    />
                </View>

                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Surname</Text>
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-2/3" 
                        value={surname} 
                        // editable={false}
                        onChangeText={(text) => {
                            setSurname(text);
                        }}
                    />
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">National ID</Text>
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-2/3" 
                        value={nationalId} 
                        onChangeText={(text) => {
                            setNationalId(text);
                        }}
                    />
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Phone Number</Text>
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-2/3" 
                        value={phoneNumber} 
                        keyboardType="phone-pad"
                        onChangeText={(text) => {
                            setPhoneNumber(text);
                        }}
                    />
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Contract Scale</Text>
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-2/3" 
                        value={contractScale} 
                        // editable={false}
                        onChangeText={(text) => {
                            setContractScale(text);
                        }}
                    />
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Contracted Yield</Text>
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-2/3" 
                        value={contractedYield} 
                        // editable={false}
                        onChangeText={(text) => {
                            setContractedYield(text);
                        }}
                    />
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Contracted Volume</Text>
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-2/3" 
                        value={contractedVolume} 
                        // editable={false}
                        onChangeText={(text) => {
                            setContractedVolume(text);
                        }}
                    />
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Contracted Price</Text>
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-2/3" 
                        value={contractedPrice} 
                        // editable={false}
                        onChangeText={(text) => {
                            setContractedPrice(text);
                        }}
                    />
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Contracted Return</Text>
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-2/3" 
                        value={contractedReturn} 
                        // editable={false}
                        onChangeText={(text) => {
                            setContractedReturn(text);
                        }}
                    />
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Production Scheme</Text>
                    <View className="border border-gray-300 rounded-md w-2/3">
                    <Picker
                      selectedValue={productionScheme}
                      onValueChange={(itemValue) => setProductionScheme(itemValue)}
                      style={{ color: '#111827' }}
                    >
                      {productionSchemeList.map((item: any) => (
                        <Picker.Item key={item.id} label={item.name} value={item.id} color="#374151" />
                      ))}

                    </Picker>
                    </View>
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Production Cycle</Text>
                    <View className="border border-gray-300 rounded-md w-2/3">
                    <Picker
                      selectedValue={productionCycle}
                      onValueChange={(itemValue) => setProductionCycle(itemValue)}
                      style={{ color: '#111827' }}
                    >
                      {productionCycleList.map((item: any) => (
                        <Picker.Item key={item.id} label={item.name} value={item.id} color="#374151" />
                      ))}
                    </Picker>
                    </View>
                </View>
                {/* <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Production Cycle Registration</Text>
                    <View className="border border-gray-300 rounded-md w-2/3">
                    <Picker
                      selectedValue={productionCycleRegistration}
                      onValueChange={(itemValue) => setProductionCycleRegistration(itemValue)}
                    >
                      {productionCycleRegistrationList.map((item: any) => (
                        <Picker.Item key={item.id} label={item.name} value={item.id} />
                      ))}
                      </Picker>
                    </View>
                </View> */}
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Region</Text>
                    <View className="border border-gray-300 rounded-md w-2/3">
                    <Picker
                      selectedValue={region}
                      onValueChange={(itemValue) => setRegion(itemValue)}
                      style={{ color: '#111827' }}
                    >
                      {regionList.length > 0 ? (
                        regionList.map((item: any) => (
                          <Picker.Item key={item.id} label={item.name} value={item.id} color="#374151" />
                        ))
                      ) : (
                        <Picker.Item label="No regions assigned" value="" color="#9CA3AF" />
                      )}
                      </Picker>
                    </View>
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Activity</Text>
                    <View className="border border-gray-300 rounded-md w-2/3">
                    <Picker
                      selectedValue={activity}
                      onValueChange={(itemValue) => setActivity(itemValue)}
                      style={{ color: '#111827' }}
                    >
                      {activityList.map((item: any) => (
                        <Picker.Item key={item.id} label={item.name} value={item.id} color="#374151" />
                      ))}
                      </Picker>
                    </View>
                </View>
                {/* <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Field Technician</Text>
                    <View className="border border-gray-300 rounded-md w-2/3">
                    <Picker
                      selectedValue={fieldTechnician}
                      onValueChange={(itemValue) => setFieldTechnician(itemValue)}
                    >
                      {fieldTechnicianList.map((item: any) => (
                        <Picker.Item key={item.id} label={item.name} value={item.id} />
                      ))}
                      </Picker>
                    </View>
                </View> */}
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Home Location</Text>
                    <View className="flex-row items-center justify-between w-2/3">
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-[80%] mr-2" 
                        value={homeLatitude + ' || ' + homeLongitude} 
                        editable={false}
                        onChangeText={(text) => {
                            setHomeLatitude(text);
                        }}
                    />
                    <TouchableOpacity onPress={() => {
                      getLocation();
                    }}
                    className="bg-gray-200 rounded-md p-2 w-[15%]"
                    >
                      <MapPinPlus size={20} color="#65435C" />
                    </TouchableOpacity>
                    </View>
                </View>
                {/* <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Longitude</Text>
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-2/3" 
                        value={longitude} 
                        editable={false}
                        onChangeText={(text) => {
                            setLongitude(text);
                        }}
                    />
                </View> */}

                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Barn Location</Text>
                    <View className="flex-row items-center justify-between w-2/3">
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-[80%] mr-2" 
                        value={barnLatitude + ' || ' + barnLongitude} 
                        editable={false}
                    />
                    <TouchableOpacity onPress={() => {
                      getBarnLocation();
                    }}
                    className="bg-gray-200 rounded-md p-2 w-[15%]"
                    >
                      <MapPinPlus size={20} color="#65435C" />
                    </TouchableOpacity>
                    </View>
                </View>

                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Field Location</Text>
                    <View className="flex-row items-center justify-between w-2/3">
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-[80%] mr-2" 
                        value={fieldLatitude + ' || ' + fieldLongitude} 
                        editable={false}
                    />
                    <TouchableOpacity onPress={() => {
                      getFieldLocation();
                    }}
                    className="bg-gray-200 rounded-md p-2 w-[15%]"
                    >
                      <MapPinPlus size={20} color="#65435C" />
                    </TouchableOpacity>
                    </View>
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Date of Birth</Text>
                    <View className="border border-gray-300 rounded-md p-2 w-2/3 flex-row justify-between items-center">
                        <Text>{dateOfBirth || "Select date"}</Text>
                        <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                            <CalendarIcon size={20} color="#65435C" />
                        </TouchableOpacity>
                    </View>
                </View>
                {showDatePicker && (
                  <DateTimePicker
                    value={dateOfBirth ? new Date(dateOfBirth) : new Date()}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate && event.type !== 'dismissed') {
                        const formattedDate = selectedDate.toISOString().split('T')[0];
                        console.log('Formatted Date', formattedDate)
                        setDateOfBirth(formattedDate);
                      }
                    }}
                  />
                )}
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Gender</Text>
                    <View className="border border-gray-300 rounded-md w-2/3">
                    <Picker
                      selectedValue={gender}
                      onValueChange={(itemValue) => setGender(itemValue)}
                      style={{ color: '#111827' }}
                    >
                      <Picker.Item key="male" label="Male" value="male" color="#374151" />
                      <Picker.Item key="female" label="Female" value="female" color="#374151" />
                    </Picker>
                    </View>
                </View>
                <View className="flex-row items-center justify-between my-4">
                  <TouchableOpacity 
                    className="bg-white border border-gray-300 rounded-lg p-2 w-[48%] h-40"
                    onPress={() => openCamera('grower')}
                  >
                    {growerImage ? (
                      <Image 
                        source={{ uri: growerImage }} 
                        className="w-full h-full rounded-lg" 
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="items-center justify-center h-full">
                        <Camera size={40} color="#65435C" />
                        <Text className="text-gray-600 mt-2 text-center">Grower Image</Text>
                        <Text className="text-gray-400 text-xs text-center mt-1">Tap to capture</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    className="bg-white border border-gray-300 rounded-lg p-2 w-[48%] h-40"
                    onPress={() => openCamera('id')}
                  >
                    {idImage ? (
                      <Image 
                        source={{ uri: idImage }} 
                        className="w-full h-full rounded-lg" 
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="items-center justify-center h-full">
                        <Camera size={40} color="#65435C" />
                        <Text className="text-gray-600 mt-2 text-center">National ID Image</Text>
                        <Text className="text-gray-400 text-xs text-center mt-1">Tap to capture</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Action Buttons */}
                <View className="flex-row justify-evenly mt-8 mb-8 gap-2">
                  <TouchableOpacity className="bg-gray-200 rounded-md w-[30%]" onPress={()=> router.back()}>
                    <Text className="text-[#65435C] text-lg text-center p-2">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    className="bg-[#1AD3BB] rounded-md w-[32%]" 
                    onPress={() => setShowSaveDraftModal(true)}
                  >
                    <Text className="text-white text-lg text-center p-2">Save Draft</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="bg-[#65435C] rounded-md w-[32%]" onPress={createGrowerApplication}>
                    <Text className="text-white text-lg text-center p-2">Submit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      {/* Save Draft Modal */}
      <Modal visible={showSaveDraftModal} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-lg p-6 w-[80%]">
            <Text className="text-lg font-bold text-[#65435C] mb-4">Save Draft</Text>
            <Text className="text-gray-600 mb-4">Give your draft a name:</Text>
            <TextInput 
              className="border border-gray-300 rounded-md p-3 mb-4"
              placeholder="Draft name (e.g., John Doe - Pending)"
              value={draftName}
              onChangeText={setDraftName}
            />
            <View className="flex-row justify-end gap-2">
              <TouchableOpacity 
                className="bg-gray-200 px-4 py-2 rounded-md"
                onPress={() => {
                  setShowSaveDraftModal(false);
                  setDraftName('');
                }}
              >
                <Text className="text-[#65435C]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="bg-[#1AD3BB] px-4 py-2 rounded-md"
                onPress={() => {
                  if (draftName.trim()) {
                    saveDraft(draftName.trim());
                  } else {
                    Alert.alert('Error', 'Please enter a draft name');
                  }
                }}
              >
                <Text className="text-white">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Load Draft Modal */}
      <Modal visible={showDraftModal} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-lg p-6 w-[90%] max-h-[70%]">
            <Text className="text-lg font-bold text-[#65435C] mb-4">Load Draft</Text>
            <ScrollView className="max-h-96">
              {drafts.map((draft) => (
                <View key={draft.id} className="border border-gray-200 rounded-lg p-3 mb-3">
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1">
                      <Text className="font-medium text-[#65435C]">{draft.draft_name}</Text>
                      <Text className="text-gray-500 text-sm">
                        Modified: {draft.modified_at ? new Date(draft.modified_at).toLocaleDateString() : 'Unknown'}
                      </Text>
                    </View>
                    <View className="flex-row gap-2">
                      <TouchableOpacity 
                        className="bg-[#1AD3BB] px-3 py-1 rounded"
                        onPress={() => loadDraft(draft.id)}
                      >
                        <Text className="text-white text-sm">Load</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        className="bg-red-500 px-3 py-1 rounded"
                        onPress={() => {
                          Alert.alert(
                            'Delete Draft',
                            'Are you sure you want to delete this draft?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => deleteDraft(draft.id) }
                            ]
                          );
                        }}
                      >
                        <Text className="text-white text-sm">Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity 
              className="bg-gray-200 px-4 py-2 rounded-md mt-4"
              onPress={() => setShowDraftModal(false)}
            >
              <Text className="text-[#65435C] text-center">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}






























