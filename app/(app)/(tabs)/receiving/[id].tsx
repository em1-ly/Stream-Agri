import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, TextInput, ScrollView, Alert, Modal, Button, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, MapPinPlus, Pencil, X, Camera, CalendarIcon } from 'lucide-react-native';
import { powersync } from '@/powersync/system';
import { Picker } from '@react-native-picker/picker';
import { DistributionPlanRecord, FlagsRecord, ProductionSchemeRecord, RegionRecord } from '@/powersync/Schema';
import axios from 'axios';
import * as Location from 'expo-location';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as ImageManipulator from 'expo-image-manipulator';

// Define interfaces for your data types
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

export default function GrowerApplicationFromExisting() {
  const { id, grower_id, production_scheme } = useLocalSearchParams();
  
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

  const [productionCycleList, setProductionCycleList] = useState<string[]>([]);
  const [productionSchemeList, setProductionSchemeList] = useState<string[]>([]);
  const [regionList, setRegionList] = useState<string[]>([]);
  const [activityList, setActivityList] = useState<string[]>([]);
  const [fieldTechnicianList, setFieldTechnicianList] = useState<string[]>([]);

  const cameraRef = useRef<CameraView>(null);
  const UUID = Crypto.randomUUID();

  // Add state for showing date picker
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Fetch existing grower data to pre-fill form
  const getExistingGrowerData = async () => {
    try {
      const result = await powersync.get(`
        SELECT 
          pcr.*,
          g.grower_number,
          g.b010_first_name,
          g.b020_surname,
          g.b030_national_id,
          g.b040_phone_number,
          g.date_of_birth,
          g.gender,
          g.home_latitude,
          g.home_longitude,
          g.barn_latitude,
          g.barn_longitude,
          g.field_latitude,
          g.field_longitude
        FROM 
          odoo_gms_production_cycle_registration pcr
        LEFT JOIN 
          odoo_gms_grower g ON pcr.grower_id = g.id
        WHERE 
          pcr.grower_id = ? AND pcr.production_cycle_name = ?`, 
        [grower_id, production_scheme]);

      if (result) {
        // Pre-fill form with existing data (using type assertion for database results)
        const data = result as any;
        setFirstName(data.b010_first_name || data.first_name || '');
        setSurname(data.b020_surname || data.surname || '');
        setNationalId(data.b030_national_id || '');
        setGrowerNumber(data.grower_number || '');
        setPhoneNumber(data.b040_phone_number || '');
        setHomeLatitude(data.home_latitude || '');
        setHomeLongitude(data.home_longitude || '');
        setBarnLatitude(data.barn_latitude || '');
        setBarnLongitude(data.barn_longitude || '');
        setFieldLatitude(data.field_latitude || '');
        setFieldLongitude(data.field_longitude || '');
        setDateOfBirth(data.date_of_birth || '');
        setGender(data.gender || '');
        setContractScale(data.b010_contract_scale?.toString() || '');
        setContractedYield(data.b020_contracted_yield?.toString() || '');
        setContractedVolume(data.b030_contracted_volume?.toString() || '');
        setContractedPrice(data.b040_contracted_price?.toString() || '');
        setContractedReturn(data.b050_contracted_return?.toString() || '');
        setProductionScheme(data.production_scheme_id?.toString() || '');
        setProductionCycle(data.production_cycle_id?.toString() || '');
        setRegion(data.region_id?.toString() || '');
        setActivity(data.activity_id?.toString() || '');
        setFieldTechnician(data.field_technician_id?.toString() || '');
        
        console.log('Pre-filled grower data:', result);
      }
    } catch (error) {
      console.error('Error fetching existing grower data:', error);
    }
  };

  const getProductionCycle = async () => {
    console.log('Getting Production Cycle');
    const productionCycle = await powersync.execute(`SELECT * FROM odoo_gms_production_cycle`);
    const rows = productionCycle.rows?._array || [];
    setProductionCycleList(rows);
  }

  const getProductionScheme = async () => {
    console.log('Getting Production Scheme');
    const productionScheme = await powersync.execute(`SELECT * FROM odoo_gms_production_scheme`);
    const rows = productionScheme.rows?._array || [];
    setProductionSchemeList(rows);
  }

  const getRegion = async () => {
    console.log('Getting Region');
    const region = await powersync.execute(`SELECT * FROM odoo_gms_region`);
    const rows = region.rows?._array || [];
    setRegionList(rows);
  }

  const getActivity = async () => {
    console.log('Getting Activity');
    const activity = await powersync.execute(`SELECT * FROM odoo_gms_activity`);
    const rows = activity.rows?._array || [];
    setActivityList(rows);
  }

  const getFieldTechnician = async () => {
    console.log('Getting Field Technician');
    const fieldTechnician = await powersync.execute(`SELECT * FROM hr_employee`);
    const rows = fieldTechnician.rows?._array || [];
    setFieldTechnicianList(rows);
  }

  useEffect(() => {
    requestPermission();
    getExistingGrowerData();
    getProductionCycle();
    getProductionScheme();
    getRegion();
    getActivity();
    getFieldTechnician();
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
          const cleanStr = str.replace(/=/g, "");
          const missingPadding = cleanStr.length % 4;
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
    console.log('CREATING NEW GROWER APPLICATION FROM EXISTING');

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
      { column: 'barn_latitude', value: barnLatitude },
      { column: 'barn_longitude', value: barnLongitude },
      { column: 'field_latitude', value: fieldLatitude },
      { column: 'field_longitude', value: fieldLongitude },
      { column: 'gender', value: gender },
      { column: 'grower_date_of_birth', value: dateOfBirth },
      { column: 'b010_contract_scale', value: contractScale },
      { column: 'b020_contracted_yield', value: contractedYield },
      { column: 'b030_contracted_volume', value: contractedVolume },
      { column: 'b040_contracted_price', value: contractedPrice },
      { column: 'b050_contracted_return', value: contractedReturn },
      { column: 'grower_image', value: growerImageEncoded },
      { column: 'grower_national_id_image', value: idImageEncoded },
      { column: 'submitted_by', value: employeeId }
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

    console.log('Dynamic SQL (from existing):', sql);
    console.log('Values:', values);

    try {
      await powersync.execute(sql, values).then(() => {
        console.log('New Grower Application Created');
      }).catch((error) => {
        console.error('Error creating new grower application:', error);
        alert('Error creating new grower application');
      });
    } catch (error) {
      console.error('Error creating new grower application:', error);
      alert('Error creating new grower application');
    }

    alert('New Grower Application Created')
    router.back();
  }

  const getLocation = async () => {
    console.log('Getting Location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log('Status', status);
    if (status !== 'granted') {
      Alert.alert('Permission not granted');
      return;
    } else if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync();
      console.log('Location', location.coords.latitude, location.coords.longitude);
      setHomeLatitude(location.coords.latitude.toString());
      setHomeLongitude(location.coords.longitude.toString());
    } else {
      Alert.alert('Permission not granted');
      return;
    }
  }

  const getBarnLocation = async () => {
    console.log('Getting Barn Location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log('Status', status);
    if (status !== 'granted') {
      Alert.alert('Permission not granted');
      return;
    } else if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync();
      console.log('Location', location.coords.latitude, location.coords.longitude);
      setBarnLatitude(location.coords.latitude.toString());
      setBarnLongitude(location.coords.longitude.toString());
    } else {
      Alert.alert('Permission not granted');
      return;
    }
  }

  const getFieldLocation = async () => {
    console.log('Getting Field Location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log('Status', status);
    if (status !== 'granted') {
      Alert.alert('Permission not granted');
      return;
    } else if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync();
      console.log('Location', location.coords.latitude, location.coords.longitude);
      setFieldLatitude(location.coords.latitude.toString());
      setFieldLongitude(location.coords.longitude.toString());
    } else {
      Alert.alert('Permission not granted');
      return;
    }
  }

  const getEmployeeId = async () => {
    const employeeId = await SecureStore.getItemAsync('odoo_employee_id');
    console.log('Employee ID', employeeId);
    return employeeId;
  }

  const compressImage = async (base64Image: string, imageType: 'grower' | 'id'): Promise<string> => {
    try {
      // Convert base64 to URI format if not already
      const imageUri = base64Image.startsWith('data:image')
        ? base64Image
        : `data:image/jpg;base64,${base64Image}`;

      // Compress the image using ImageManipulator
      // TODO: Upgrade package to latest version
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          // Resize to max width while maintaining aspect ratio
          // Photos need higher resolution than signatures - 1200px is good for portraits
          { resize: { width: 1200 } }
        ],
        {
          compress: 0.35, // Compress to 35% quality (good balance for photos)
          format: ImageManipulator.SaveFormat.JPEG, // JPEG is smaller than PNG for photos
          base64: true // Return as base64
        }
      );

      // Log size comparison for debugging
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

  return (
    <SafeAreaView className="flex-1 bg-[#65435C]">
      <View className="flex-1 mt-6 ">
        <View className="flex-1 bg-white rounded-t-3xl overflow-hidden ">
          <View className="flex-row justify-between items-center p-4 border-b border-gray-100 ">
            <TouchableOpacity className="flex-row items-center" onPress={() => router.back()}>
              <ChevronLeft size={28} color="#65435C" />
            <Text className="text-xl font-bold text-[#65435C]">New Application from Existing</Text>
            </TouchableOpacity>
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
                    >
                      {productionSchemeList.map((item: any) => (
                        <Picker.Item key={item.id} label={item.name} value={item.id} />
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
                    >
                      {productionCycleList.map((item: any) => (
                        <Picker.Item key={item.id} label={item.name} value={item.id} />
                      ))}
                    </Picker>
                    </View>
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Region</Text>
                    <View className="border border-gray-300 rounded-md w-2/3">
                    <Picker
                      selectedValue={region}
                      onValueChange={(itemValue) => setRegion(itemValue)}
                    >
                      {regionList.map((item: any) => (
                        <Picker.Item key={item.id} label={item.name} value={item.id} />
                      ))}
                      </Picker>
                    </View>
                </View>
                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Activity</Text>
                    <View className="border border-gray-300 rounded-md w-2/3">
                    <Picker
                      selectedValue={activity}
                      onValueChange={(itemValue) => setActivity(itemValue)}
                    >
                      {activityList.map((item: any) => (
                        <Picker.Item key={item.id} label={item.name} value={item.id} />
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
                    <Text className="text-gray-600 w-1/3">Home Latitude</Text>
                    <View className="flex-row items-center justify-between w-2/3">
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-[80%] mr-2" 
                        value={homeLatitude + " || " + homeLongitude} 
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

                <View className="flex-row items-center justify-between my-2">
                    <Text className="text-gray-600 w-1/3">Barn Latitude</Text>
                    <View className="flex-row items-center justify-between w-2/3">
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-[80%] mr-2" 
                        value={barnLatitude + " || " + barnLongitude} 
                        editable={false}
                        onChangeText={(text) => {
                            setBarnLatitude(text);
                        }}
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
                    <Text className="text-gray-600 w-1/3">Field Latitude</Text>
                    <View className="flex-row items-center justify-between w-2/3">
                    <TextInput 
                        className="border border-gray-300 rounded-md p-2 w-[80%] mr-2" 
                        value={fieldLatitude + " || " + fieldLongitude} 
                        editable={false}
                        onChangeText={(text) => {
                            setFieldLatitude(text);
                        }}
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
                    >
                      <Picker.Item key="male" label="Male" value="male" />
                      <Picker.Item key="female" label="Female" value="female" />
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

                {/* Save Button */}
                <View className="flex-row justify-evenly mt-8 mb-8 gap-2">
                <TouchableOpacity className="bg-gray-200 rounded-md w-[50%]" onPress={()=> router.back()}>
                    <Text className="text-[#65435C] text-xl text-center p-2">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="bg-[#65435C] rounded-md w-[50%]" onPress={createGrowerApplication}>
                    <Text className="text-white text-xl text-center p-2">Create Application</Text>
                    </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
} 