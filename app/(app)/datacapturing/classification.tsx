import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard, ScrollView, Alert, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Scan, ChevronLeft, Wifi, WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { powersync } from '@/powersync/system';

// Toggle to enable/disable verbose logs for the save bale flow
const DEBUG_SAVE_LOGS = false;

import AsyncStorage from '@react-native-async-storage/async-storage';

const CLASSIFIER_NUMBER_STORAGE_KEY = 'last_classifier_number';

interface BaleData {
  id: string;
  barcode: string;
  mass: number;
  timb_grade_name?: string;
  grower_number: string;
  curverid_classifier_number?: number;
}

const ClassificationScreen = () => {
  const router = useRouter(); //driver driver push, driver back
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [barcode, setBarcode] = useState('');
  const [syncStatus, setSyncStatus] = useState(!!powersync.currentStatus?.connected);

  useEffect(() => {
    const unregister = powersync.registerListener({
      statusChanged: (status) => {
        setSyncStatus(!!status.connected);
      },
    });
    return unregister;
  }, []);

  const handleRefresh = async () => {
    loadTimbGrades();
    if (barcode) {
      fetchBaleData(barcode);
    }
  };

  const loadTimbGrades = async () => {
    try {
      const [gradesResult, classifiersResult] = await Promise.all([
        powersync.getAll<any>('SELECT id, name FROM floor_maintenance_timb_grade ORDER BY name'),
        powersync.getAll<any>('SELECT id, classifier_number FROM buyers_classifier ORDER BY classifier_number')
      ]);
      setTimbGrades(gradesResult || []);
      setClassifiers(classifiersResult || []);
      console.log(`📋 Loaded ${gradesResult?.length || 0} TIMB grades, ${classifiersResult?.length || 0} classifiers`);
    } catch (e) {
      console.error('Failed to load TIMB grades:', e);
      setTimbGrades([]);
      setClassifiers([]);
    }
  };

  const [baleData, setBaleData] = useState<BaleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timbGrade, setTimbGrade] = useState('');
  const [timbGradeSearchText, setTimbGradeSearchText] = useState('');
  const [selectedTimbGrade, setSelectedTimbGrade] = useState<{ id: string; name?: string } | null>(null);
  const [classifierNumber, setClassifierNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [timbGrades, setTimbGrades] = useState<any[]>([]);
  const [classifiers, setClassifiers] = useState<any[]>([]);
  const [classifierSearchText, setClassifierSearchText] = useState('');
  const [selectedClassifier, setSelectedClassifier] = useState<{ id: string; classifier_number?: string } | null>(null);
  // Session-based persistence fallback when AsyncStorage is not available
  const [sessionPersistedClassifier, setSessionPersistedClassifier] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Track keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Load TIMB grades from PowerSync
  useEffect(() => {
    loadTimbGrades();
  }, []);

  // Load persisted classifier number when classifiers are loaded
  useEffect(() => {
    const loadPersistedClassifier = async () => {
      try {
        let persisted: string | null = null;
        
        // Try AsyncStorage first
        if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
          persisted = await AsyncStorage.getItem(CLASSIFIER_NUMBER_STORAGE_KEY);
          console.log('📋 Attempting to load from AsyncStorage, found:', persisted);
        }
        
        // Fallback to session storage if AsyncStorage is not available
        if (!persisted && sessionPersistedClassifier) {
          persisted = sessionPersistedClassifier;
          console.log('📋 Using session-persisted classifier:', persisted);
        }
        
        if (persisted && typeof persisted === 'string' && persisted.trim() !== '' && classifiers.length > 0) {
          // Try to find and set the selected classifier from the persisted value
          const classifier = classifiers.find(c => String(c.classifier_number) === persisted.trim());
          if (classifier) {
            setClassifierNumber(String(classifier.classifier_number));
            setClassifierSearchText(String(classifier.classifier_number));
            setSelectedClassifier({ id: String(classifier.id), classifier_number: classifier.classifier_number });
            console.log('📋 Successfully loaded and matched persisted classifier:', classifier.classifier_number);
          } else {
            // Persisted value doesn't match any classifier - clear it
            console.log('📋 Persisted classifier number not found in list, clearing:', persisted);
            setClassifierNumber('');
            setClassifierSearchText('');
            setSelectedClassifier(null);
          }
        } else if (classifiers.length === 0) {
          console.log('📋 Classifiers not loaded yet, will retry when available');
        }
      } catch (e) {
        console.error('📋 Failed to load persisted classifier number:', e);
      }
    };
    loadPersistedClassifier();
  }, [classifiers, sessionPersistedClassifier]);

  useEffect(() => {
    const scannedBarcode = params.scannedBarcode as string;
    if (scannedBarcode) {
      fetchBaleData(scannedBarcode);
    }
  }, [params.scannedBarcode]);

  // Sync TIMB grade when baleData changes
  useEffect(() => {
    if (!baleData) {
      // If no baleData, clear all related TIMB grade states
      setTimbGrade('');
      setTimbGradeSearchText('');
      setSelectedTimbGrade(null);
      return;
      }
      
      // Set TIMB grade if present
      if (baleData.timb_grade_name) {
        setTimbGrade(baleData.timb_grade_name);
        setTimbGradeSearchText(baleData.timb_grade_name);
        // Find and set the selected grade
        const grade = timbGrades.find(g => g.name === baleData.timb_grade_name);
        if (grade) {
          setSelectedTimbGrade({ id: String(grade.id), name: grade.name });
        }
    } else {
      setTimbGrade('');
      setTimbGradeSearchText('');
      setSelectedTimbGrade(null);
    }
  }, [baleData, timbGrades]);

  // Sync classifier number when baleData changes OR when classifiers/persisted value change
  useEffect(() => {
    if (!baleData) {
      // If no baleData, ensure classifier-related states are cleared
      setClassifierNumber('');
      setClassifierSearchText('');
      setSelectedClassifier(null);
      return;
    }

    const classifierNum = baleData.curverid_classifier_number;
    // If bale has a classifier number, use it
    if (classifierNum !== null && classifierNum !== undefined) {
      const value = String(classifierNum);
      setClassifierNumber(value);
      setClassifierSearchText(value);
      if (classifiers.length > 0) {
        const classifier = classifiers.find(c => String(c.classifier_number) === value || String(c.id) === value);
        if (classifier) {
          setSelectedClassifier({ id: String(classifier.id), classifier_number: classifier.classifier_number });
          console.log('📋 useEffect - Set selected classifier from baleData:', classifier.classifier_number);
        } else {
          setSelectedClassifier(null);
          console.log('📋 useEffect - Bale classifier number not found in list, clearing selection');
        }
      } else {
        setSelectedClassifier(null);
      }
      console.log('📋 useEffect - Set classifier number from baleData:', value);
    } else {
      // Bale doesn't have a classifier number, attempt to load persisted value
      console.log('📋 useEffect - Bale has no classifier number. Attempting to load persisted value.');
      
      const loadPersistedClassifier = async () => {
        let persisted: string | null = null;
        
        // Try AsyncStorage first
        try {
          if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
            persisted = await AsyncStorage.getItem(CLASSIFIER_NUMBER_STORAGE_KEY);
            console.log('📋 Loading persisted classifier for new bale from AsyncStorage, found:', persisted);
          }
        } catch (e) {
          console.error('📋 Error loading from AsyncStorage:', e);
        }
        
        // Fallback to session storage if AsyncStorage is not available or empty
        if (!persisted && sessionPersistedClassifier) {
          persisted = sessionPersistedClassifier;
          console.log('📋 Loading persisted classifier for new bale from session state, found:', persisted);
        }

        if (persisted && typeof persisted === 'string' && persisted.trim() !== '' && classifiers.length > 0) {
          const classifier = classifiers.find(c => String(c.classifier_number) === persisted.trim());
          if (classifier) {
            setClassifierNumber(String(classifier.classifier_number));
            setClassifierSearchText(String(classifier.classifier_number));
            setSelectedClassifier({ id: String(classifier.id), classifier_number: classifier.classifier_number });
            console.log('📋 Successfully loaded persisted classifier for new bale:', classifier.classifier_number);
          } else {
            console.log('📋 Persisted classifier not found in list, clearing');
            setClassifierNumber('');
            setClassifierSearchText('');
            setSelectedClassifier(null);
          }
        } else if (classifiers.length === 0) {
          console.log('📋 Classifiers not loaded yet for new bale, will re-evaluate when available.');
          // This case is handled by the dependency array re-triggering this effect.
        } else {
          console.log('📋 No persisted classifier number found for new bale, or persisted value not found in classifiers list.');
          // Ensure states are cleared if no persisted value or no match
          setClassifierNumber('');
          setClassifierSearchText('');
          setSelectedClassifier(null);
        }
      };
      
      loadPersistedClassifier();
    }
  }, [baleData, classifiers, sessionPersistedClassifier]);


  const resetState = (keepBarcode = false) => {
    if (!keepBarcode) {
      setBarcode('');
    }
    setBaleData(null);
    setError(null);
    setTimbGrade('');
    setTimbGradeSearchText('');
    setSelectedTimbGrade(null);
    setClassifierNumber(''); // Explicitly clear classifier number
    setClassifierSearchText('');
    setSelectedClassifier(null);
    setIsRejected(false);
  }

  const checkTimbGradeType = async (gradeName: string): Promise<string | null> => {
    try {
      const grade = await powersync.get<any>(
        'SELECT grade_type FROM floor_maintenance_timb_grade WHERE name = ? LIMIT 1',
        [gradeName.toUpperCase()]
      );
      console.log(`📋 TIMB Grade: ${gradeName}, grade_type: ${grade?.grade_type || 'null'}`);
      return grade?.grade_type || null;
    } catch (e) {
      console.warn('⚠️ Could not check grade_type:', e);
      return null;
    }
  };

  const handleTimbGradeSelect = async (item: any) => {
    const gradeName = item.name || String(item.id);
    setTimbGrade(gradeName);
    setTimbGradeSearchText(gradeName);
    setSelectedTimbGrade({ id: String(item.id), name: item.name });
    
    const gradeType = await checkTimbGradeType(gradeName);
    if (gradeType === 'REASON') {
      Alert.alert(
        '⚠️ Reject Bale?',
        'Are you sure you want to reject this bale?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setTimbGrade('');
              setTimbGradeSearchText('');
              setSelectedTimbGrade(null);
              setIsRejected(false);
            }
          },
          {
            text: 'Yes',
            onPress: () => {
              setIsRejected(true);
            }
          }
        ]
      );
    } else {
      setIsRejected(false);
    }
  };

  const handleTimbGradeChange = (text: string) => {
    setTimbGradeSearchText(text);
    // Clear selection if text doesn't match selected grade
    if (selectedTimbGrade && text !== (selectedTimbGrade.name || selectedTimbGrade.id)) {
      setSelectedTimbGrade(null);
      setTimbGrade('');
    }
    // Don't auto-select on exact match - let user click to select
    // This allows the dropdown to stay visible while typing
  };

  const handleClassifierSelect = (item: any) => {
    const value = item.classifier_number || String(item.id);
    setClassifierNumber(value);
    setClassifierSearchText(value);
    setSelectedClassifier({ id: String(item.id), classifier_number: item.classifier_number });

    // Persist the classifier number for future bales
    const valueToPersist = String(item.classifier_number || value).trim();
    
    // Try AsyncStorage first
    try {
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        AsyncStorage.setItem(CLASSIFIER_NUMBER_STORAGE_KEY, valueToPersist)
          .then(() => {
            console.log('📋 Successfully persisted classifier number to AsyncStorage:', valueToPersist);
          })
          .catch((e: any) => {
            console.error('📋 Failed to persist classifier number to AsyncStorage:', e);
            // Fallback to session storage
            setSessionPersistedClassifier(valueToPersist);
            console.log('📋 Fallback: Persisted classifier number to session state:', valueToPersist);
          });
      } else {
        // Fallback to session storage
        setSessionPersistedClassifier(valueToPersist);
        console.log('📋 AsyncStorage not available, using session state for classifier number:', valueToPersist);
      }
    } catch (e) {
      console.error('📋 Error persisting classifier number:', e);
      // Fallback to session storage
      setSessionPersistedClassifier(valueToPersist);
      console.log('📋 Fallback: Persisted classifier number to session state:', valueToPersist);
    }
  };

  const handleClassifierChange = (text: string) => {
    setClassifierSearchText(text);
    // Clear selection if text doesn't match selected classifier
    if (selectedClassifier && text !== (selectedClassifier.classifier_number || selectedClassifier.id)) {
      setSelectedClassifier(null);
      setClassifierNumber(text);
    }
    // Don't auto-select on exact match - let user click to select
    // This allows the dropdown to stay visible while typing
  };

  const fetchBaleData = async (scannedBarcode: string) => {
    if (!scannedBarcode) return;
    resetState(true);
    setBarcode(scannedBarcode);
    setLoading(true);
    Keyboard.dismiss();

    try {
        const query = `
        SELECT
          rb.id,
          rb.barcode,
          rb.mass,
          tg.name as timb_grade_name,
          gdn.grower_number,
          rb.curverid_classifier_number
        FROM receiving_bale AS rb
        LEFT JOIN floor_maintenance_timb_grade AS tg ON rb.timb_grade = tg.id
        LEFT JOIN receiving_grower_delivery_note AS gdn ON rb.grower_delivery_note_id = gdn.id
        WHERE rb.barcode = ?
      `;

      const result = await powersync.execute(query, [scannedBarcode]);
      
      if (result.rows && result.rows.length > 0) {
        const data = result.rows._array[0] as BaleData;
        console.log('📋 Fetched bale data:', {
          barcode: data.barcode,
          timb_grade_name: data.timb_grade_name,
          curverid_classifier_number: data.curverid_classifier_number
        });
        setBaleData(data);
        // Set TIMB grade if present
        if (data.timb_grade_name) {
          setTimbGrade(data.timb_grade_name);
          setTimbGradeSearchText(data.timb_grade_name);
          // Find and set the selected grade
          const grade = timbGrades.find(g => g.name === data.timb_grade_name);
          if (grade) {
            setSelectedTimbGrade({ id: String(grade.id), name: grade.name });
          }
        } else {
          setTimbGrade('');
          setTimbGradeSearchText('');
          setSelectedTimbGrade(null);
        }
        // Don't set classifier number here - let the useEffect handle it
        // It will use the bale's classifier if present, or load persisted value if not
      } else {
        setError('No bale found with this barcode.');
        setBaleData(null);
      }
    } catch (e) {
      const error = e as Error;
      if (DEBUG_SAVE_LOGS) console.error('Failed to fetch bale data:', error);
      Alert.alert('Error', `Failed to fetch bale data: ${error.message}`);
      setError('An error occurred while fetching bale data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation: Both TIMB grade and classifier number are required
    if (!baleData) {
      setError("Please scan a bale first.");
      return;
    }
    
    if (!selectedTimbGrade) {
      setError("Please select a TIMB grade.");
      Alert.alert('Validation Error', 'TIMB grade is required.');
      return;
    }
    
    if (!selectedClassifier) {
      setError("Please select a classifier number.");
      Alert.alert('Validation Error', 'Classifier number is required.');
      return;
    }
    
    Keyboard.dismiss(); // Dismiss keyboard before saving
    setIsSaving(true);
    setError(null);

    try {
      const timbGradeId = Number(selectedTimbGrade.id);
      
      // Use the selected classifier's ID
      const classifierId = parseInt(selectedClassifier.id, 10);

      await powersync.execute(
        'UPDATE receiving_bale SET timb_grade = ?, curverid_classifier_number = ?, write_date = ? WHERE id = ?',
        [timbGradeId, classifierId, new Date().toISOString(), baleData.id]
      );

      // Persist the classifier number for future bales
      const classifierNumberToPersist = String(selectedClassifier.classifier_number || selectedClassifier.id).trim();
      try {
        if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
          await AsyncStorage.setItem(CLASSIFIER_NUMBER_STORAGE_KEY, classifierNumberToPersist);
          console.log('📋 Successfully persisted classifier number to AsyncStorage after save:', classifierNumberToPersist);
        } else {
          // Fallback to session storage
          setSessionPersistedClassifier(classifierNumberToPersist);
          console.log('📋 AsyncStorage not available, using session state for classifier number:', classifierNumberToPersist);
        }
      } catch (e) {
        console.error('📋 Failed to persist classifier number to AsyncStorage after save:', e);
        // Fallback to session storage
        setSessionPersistedClassifier(classifierNumberToPersist);
        console.log('📋 Fallback: Persisted classifier number to session state:', classifierNumberToPersist);
      }

      // Refresh bale data to get updated values
      await fetchBaleData(baleData.barcode);

      // Build success message with saved details
      const savedDetails: string[] = [];
      if (selectedTimbGrade?.name) savedDetails.push(`TIMB Grade: ${selectedTimbGrade.name}`);
      if (selectedClassifier?.classifier_number) savedDetails.push(`Classifier No: ${selectedClassifier.classifier_number}`);
      
      const detailsText = savedDetails.length > 0 
        ? savedDetails.join('\n')
        : 'No details were updated.';
      
      Alert.alert(
        '✅ Success!',
        `Classification details saved successfully!\n\n${detailsText}\n\n.`,
        [
          {
            text: 'OK',
            onPress: () => {
              openScanner();
            }
          }
        ]
      );

    } catch (e: any) {
        const errorMessage = e.message || 'An error occurred while saving the grade.';
        Alert.alert('Error', `Failed to save TIMB grade: ${errorMessage}`);
        setError(errorMessage);
    } finally {
        setIsSaving(false);
    }
  };

  const openScanner = () => {
    router.push({
      pathname: '/(app)/datacapturing/barcode-scanner',
      params: { returnTo: '/(app)/datacapturing/classification' }
    });
  };

  return (
    <View className="flex-1 bg-[#65435C]">
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom header matching View All TD Notes style */}
      <View style={{ backgroundColor: '#65435C', paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between bg-white py-4 px-4">
          <TouchableOpacity 
            onPress={() => router.replace('/(app)/datacapturing')} 
            className="flex-row items-center"
          >
            <ChevronLeft size={24} color="#65435C" />
            <Text className="text-[#65435C] font-bold text-lg ml-2">Classification</Text>
          </TouchableOpacity>
          <View className="flex-row items-center gap-3">
            {/* PowerSync status indicator */}
            <View className="flex-row items-center">
              <View
                className={`h-2 w-2 rounded-full mr-1 ${
                  syncStatus ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <Text
                className={`text-xs font-semibold ${
                  syncStatus ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {syncStatus ? 'Online' : 'Offline'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleRefresh}
              className="px-3 py-1 rounded-full bg-[#65435C]/10"
            >
              <Text className="text-[#65435C] font-semibold text-base">🔄</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View className="flex-1 bg-white rounded-t-3xl overflow-hidden mt-2">
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined} 
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            style={{ flex: 1, paddingHorizontal: 16 }}
            contentContainerStyle={isKeyboardVisible ? {
              paddingVertical: 16,
              paddingBottom: 400
            } : {
              paddingVertical: 16,
              paddingBottom: 20
            }}
            scrollEnabled={true}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
          <View className="bg-white p-4 rounded-lg shadow-md mb-4">
            <Text className="text-lg font-semibold mb-2 text-gray-700">Barcode</Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 border border-gray-300 rounded-md p-2"
                placeholder="Enter or scan barcode"
                placeholderTextColor="#9CA3AF"
                style={{ color: '#111827' }}
                value={barcode}
                onChangeText={setBarcode}
                onSubmitEditing={() => fetchBaleData(barcode)}
              />
              <TouchableOpacity onPress={openScanner} className="ml-2 p-3 bg-[#1AD3BB] rounded-md">
                <Scan size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {loading && <ActivityIndicator size="large" color="#65435C" />}
          {error && <Text className="text-red-500 text-center p-2">{error}</Text>}

          {baleData && (
            <View>
                <View className="bg-white p-4 rounded-lg shadow-md mb-4">
                    <Text className="text-lg font-bold text-[#65435C] mb-2">Bale Details</Text>
                    <View className="flex-row justify-between mb-1">
                        <Text className="font-semibold text-gray-600">Barcode:</Text>
                        <Text>{baleData.barcode}</Text>
                    </View>
                    <View className="flex-row justify-between mb-1">
                        <Text className="font-semibold text-gray-600">Grower No:</Text>
                        <Text>{baleData.grower_number}</Text>
                    </View>
                    <View className="flex-row justify-between mb-1">
                        <Text className="font-semibold text-gray-600">Mass:</Text>
                        <Text>{baleData.mass} kg</Text>
                    </View>
                    <View className="flex-row justify-between">
                        <Text className="font-semibold text-gray-600">Current Grade:</Text>
                        <Text>{baleData.timb_grade_name || 'N/A'}</Text>
                    </View>
                </View>

                <View className="bg-white p-4 rounded-lg shadow-md">
                    <Text className="text-lg font-semibold mb-2 text-gray-700">Enter TIMB Grade / Reason</Text>
                    
                    {/* TIMB Grade search input */}
                    <View className="mb-3">
                      <TextInput
                        className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                        placeholder="Type to search TIMB grade..."
                        placeholderTextColor="#9CA3AF"
                        style={{ color: '#111827' }}
                        value={timbGradeSearchText}
                      onChangeText={handleTimbGradeChange}
                        autoCapitalize="characters"
                        autoCorrect={false}
                      />
                      {timbGradeSearchText.trim().length > 0 && !selectedTimbGrade && (
                        <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white">
                          <ScrollView 
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled={true}
                          >
                            {(() => {
                              const filtered = timbGrades.filter((g) => {
                                const gradeName = (g.name || String(g.id || '')).toString().toLowerCase();
                                const searchText = timbGradeSearchText.toLowerCase().trim();
                                return gradeName.includes(searchText);
                              });
                              
                              if (filtered.length === 0) {
                                return (
                                  <Text className="text-gray-500 text-center py-3">
                                    No TIMB grades found.
                                  </Text>
                                );
                              }
                              
                              return filtered.slice(0, 25).map((g) => (
                                <TouchableOpacity
                                  key={g.id || `grade-${g.name}`}
                                  className="p-3 border-b border-gray-100 bg-white active:bg-gray-50"
                                  onPress={() => handleTimbGradeSelect(g)}
                                >
                                  <Text className="text-base text-gray-900">
                                    {g.name || String(g.id || 'Unknown')}
                                  </Text>
                                </TouchableOpacity>
                              ));
                            })()}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                    
                    <Text className="font-semibold text-gray-600 mb-1">Classifier Number</Text>
                    <TextInput 
                      className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                      placeholder="Type to search classifier number..."
                      placeholderTextColor="#9CA3AF"
                      style={{ color: '#111827' }}
                      value={classifierSearchText}
                      onChangeText={handleClassifierChange}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                    {classifierSearchText.trim().length > 0 && !selectedClassifier && (
                      <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white">
                        <ScrollView 
                          keyboardShouldPersistTaps="handled"
                          nestedScrollEnabled={true}
                        >
                          {(() => {
                            const filtered = classifiers.filter((c) => {
                              const classifierNumber = (c.classifier_number || String(c.id || '')).toString().toLowerCase();
                              const searchText = classifierSearchText.toLowerCase().trim();
                              return classifierNumber.includes(searchText);
                            });
                            
                            if (filtered.length === 0) {
                              return (
                                <Text className="text-gray-500 text-center py-3">
                                  No classifier numbers found.
                                </Text>
                              );
                            }
                            
                            return filtered.slice(0, 25).map((c) => (
                              <TouchableOpacity
                                key={c.id || `classifier-${c.classifier_number}`}
                                className="p-3 border-b border-gray-100 bg-white active:bg-gray-50"
                                onPress={() => handleClassifierSelect(c)}
                              >
                                <Text className="text-base text-gray-900">
                                  {c.classifier_number || String(c.id || 'Unknown')}
                                </Text>
                              </TouchableOpacity>
                            ));
                          })()}
                        </ScrollView>
                      </View>
                    )}
                    
                    <View className="mb-4" />
                    <TouchableOpacity 
                        onPress={handleSave} 
                        className={`p-3 rounded-md ${isSaving ? 'bg-gray-400' : 'bg-[#65435C]'}`}
                        disabled={isSaving}
                    >
                        <Text className="text-white text-center font-bold">{isSaving ? 'Saving...' : 'Save Details'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
          )}
          
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  </View>
);
};

export default ClassificationScreen;
