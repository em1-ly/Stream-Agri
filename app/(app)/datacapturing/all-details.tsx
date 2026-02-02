import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Scan, ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { powersync } from '@/powersync/system';

// AsyncStorage for persisting classifier number and buyer number
let RNAsync: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RNAsync = require('@react-native-async-storage/async-storage').default;
} catch {}

const CLASSIFIER_NUMBER_STORAGE_KEY = 'last_classifier_number';
const BUYER_NUMBER_STORAGE_KEY = 'last_buyer_number';

interface BaleData {
  id: string;
  barcode: string;
  mass: number;
  grower_number: string;
  // Fields from the screenshot
  sale_date?: string;
  number_of_bales_delivered?: number;
  group_number?: number;
  lot_number?: string;
  current_seq?: number;
  // Hessian (optional if available in local schema) 
  hessian_name?: string;
  // Editable fields
  timb_grade_name?: string;
  buyer_code?: string;
  buyer_grade_grade?: string;
  price?: number;
  salecode_name?: string;
  classifier_number?: string;
  buyer_number?: string;
  curverid_classifier_number?: number;
  curverid_buyer_number?: number;
}

interface AllDetailsFormState {
    timbGrade: string;
    buyer: string;
    buyerGrade: string;
    price: string;
    saleCode: string;
    hessian: string;
    lotNumber: string;
    groupNumber: string;
    classifierNumber: string;
    buyerNumber: string;
}

const AllDetailsScreen = () => {
  const router = useRouter();
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
    await loadOptions();
    if (barcode) {
      await fetchBaleData(barcode);
    }
    Alert.alert('Refreshed', 'Data has been updated.');
  };

  const loadOptions = async () => {
    try {
      const [timbGradesResult, buyersResult, saleCodesResult, classifiersResult, buyingStaffResult] = await Promise.all([
        powersync.getAll<any>('SELECT id, name FROM floor_maintenance_timb_grade ORDER BY name'),
        powersync.getAll<any>('SELECT id, buyer_code FROM buyers_buyer ORDER BY buyer_code'),
        powersync.getAll<any>('SELECT id, name FROM data_processing_salecode ORDER BY name'),
        powersync.getAll<any>('SELECT id, classifier_number FROM buyers_classifier ORDER BY classifier_number'),
        powersync.getAll<any>('SELECT id, buyer_number FROM buyers_buying_staff ORDER BY buyer_number')
      ]);
      setTimbGrades(timbGradesResult || []);
      setBuyers(buyersResult || []);
      setSaleCodes(saleCodesResult || []);
      setClassifiers(classifiersResult || []);
      setBuyingStaff(buyingStaffResult || []);
    } catch (e) {
      console.error('Failed to load dropdown options:', e);
    }
  };

  const [baleData, setBaleData] = useState<BaleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [rejectionDetails, setRejectionDetails] = useState<{ action_type: string } | null>(null);
  const [formState, setFormState] = useState<AllDetailsFormState>({
    timbGrade: '',
    buyer: '',
    buyerGrade: '',
    price: '',
    saleCode: '',
    hessian: '',
    lotNumber: '',
    groupNumber: '',
    classifierNumber: '',
    buyerNumber: '',
  });

  const [timbGrades, setTimbGrades] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [buyerGrades, setBuyerGrades] = useState<any[]>([]);
  const [saleCodes, setSaleCodes] = useState<any[]>([]);
  const [classifiers, setClassifiers] = useState<any[]>([]);
  const [buyingStaff, setBuyingStaff] = useState<any[]>([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  
  // Search text states for type-to-search dropdowns
  const [timbGradeSearchText, setTimbGradeSearchText] = useState('');
  const [buyerSearchText, setBuyerSearchText] = useState('');
  const [buyerGradeSearchText, setBuyerGradeSearchText] = useState('');
  const [saleCodeSearchText, setSaleCodeSearchText] = useState('');
  const [classifierNumberSearchText, setClassifierNumberSearchText] = useState('');
  const [buyerNumberSearchText, setBuyerNumberSearchText] = useState('');
  
  // Selected items for type-to-search dropdowns
  const [selectedTimbGrade, setSelectedTimbGrade] = useState<{ id: string; name?: string } | null>(null);
  const [selectedBuyer, setSelectedBuyer] = useState<{ id: string; buyer_code?: string } | null>(null);
  const [selectedBuyerGrade, setSelectedBuyerGrade] = useState<{ id: string; grade?: string } | null>(null);
  const [selectedSaleCode, setSelectedSaleCode] = useState<{ id: string; name?: string } | null>(null);
  const [selectedClassifier, setSelectedClassifier] = useState<{ id: string; classifier_number?: string } | null>(null);
  const [selectedBuyingStaff, setSelectedBuyingStaff] = useState<{ id: string; buyer_number?: string } | null>(null);
  
  // Persist last entered classifier number and buyer number
  const [lastClassifierNumber, setLastClassifierNumber] = useState<string>('');
  const [lastBuyerNumber, setLastBuyerNumber] = useState<string>('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [sessionPersistedBuyerNumber, setSessionPersistedBuyerNumber] = useState<string | null>(null);

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

  // Load persisted values on component mount
  useEffect(() => {
    const loadPersistedValues = async () => {
      try {
        if (RNAsync && typeof RNAsync.getItem === 'function') {
          const [persistedClassifier, persistedBuyer] = await Promise.all([
            RNAsync.getItem(CLASSIFIER_NUMBER_STORAGE_KEY),
            RNAsync.getItem(BUYER_NUMBER_STORAGE_KEY)
          ]);
          
          if (persistedClassifier && typeof persistedClassifier === 'string' && persistedClassifier.trim() !== '') {
            setLastClassifierNumber(persistedClassifier.trim());
          }
          
          if (persistedBuyer && typeof persistedBuyer === 'string' && persistedBuyer.trim() !== '') {
            setLastBuyerNumber(persistedBuyer.trim());
            setSessionPersistedBuyerNumber(persistedBuyer.trim());
          }
        }
      } catch (e) {
        console.error('Failed to load persisted values:', e);
      }
    };
    loadPersistedValues();
  }, []);

  // Load dropdown options from PowerSync
  useEffect(() => {
    loadOptions();
  }, []);

  // Load buyer grades when buyer is selected
  useEffect(() => {
    const loadBuyerGrades = async () => {
      if (selectedBuyerId) {
        try {
          const gradesResult = await powersync.getAll<any>(
            'SELECT id, grade FROM buyers_grade WHERE buyer = ? ORDER BY grade',
            [parseInt(selectedBuyerId)]
          );
          setBuyerGrades(gradesResult || []);
        } catch (e) {
          console.error('Failed to load buyer grades:', e);
          setBuyerGrades([]);
        }
      } else {
        setBuyerGrades([]);
      }
    };
    loadBuyerGrades();
  }, [selectedBuyerId]);

  // Set selectedBuyerId whenever the selected buyer changes
  useEffect(() => {
    if (selectedBuyer) {
      setSelectedBuyerId(selectedBuyer.id);
    } else if (formState.buyer && buyers.length > 0) {
      const buyer = buyers.find(b => b.buyer_code === formState.buyer.toUpperCase());
      setSelectedBuyerId(buyer ? String(buyer.id) : null);
      } else {
        setSelectedBuyerId(null);
      }
  }, [selectedBuyer, formState.buyer, buyers]);

  useEffect(() => {
    if (isRejected && rejectionDetails) {
      setFormState(prevState => ({
        ...prevState,
        price: '0',
        saleCode: rejectionDetails.action_type || ''
      }));
    }
  }, [isRejected, rejectionDetails]);

  useEffect(() => {
    const scannedBarcode = params.scannedBarcode as string;
    if (scannedBarcode && scannedBarcode !== barcode) {
      fetchBaleData(scannedBarcode);
    }
  }, [params.scannedBarcode]);

  // Sync buyer number when baleData changes OR when buyingStaff/persisted value change (like classification.tsx)
  useEffect(() => {
    if (!baleData) {
      // If no baleData, ensure buyer number states are cleared
      setFormState(prevState => ({ ...prevState, buyerNumber: '' }));
      setBuyerNumberSearchText('');
      setSelectedBuyingStaff(null);
      return;
    }

    const buyerNumber = baleData.curverid_buyer_number;
    // If bale has a buyer number, use it
    if (buyerNumber !== null && buyerNumber !== undefined) {
      const value = String(buyerNumber);
      setFormState(prevState => ({ ...prevState, buyerNumber: value }));
      setBuyerNumberSearchText(value);
      if (buyingStaff.length > 0) {
        // First try to find by ID (most reliable)
        let staff = buyingStaff.find(bs => bs.id === buyerNumber);
        // If not found by ID, try matching buyer_number string with ID string
        if (!staff) {
          staff = buyingStaff.find(bs => String(bs.buyer_number) === value || String(bs.id) === value);
        }
        if (staff) {
          setSelectedBuyingStaff({ id: String(staff.id), buyer_number: staff.buyer_number });
          // Update form state and search text with the actual buyer_number string
          const actualBuyerNumber = String(staff.buyer_number);
          setFormState(prevState => ({ ...prevState, buyerNumber: actualBuyerNumber }));
          setBuyerNumberSearchText(actualBuyerNumber);
          console.log('📋 useEffect - Set selected buying staff from baleData:', staff.buyer_number);
        } else {
          setSelectedBuyingStaff(null);
          console.log('📋 useEffect - Bale buyer number not found in list, clearing selection');
        }
      } else {
        setSelectedBuyingStaff(null);
      }
      console.log('📋 useEffect - Set buyer number from baleData:', value);
    } else {
      // Bale doesn't have a buyer number, attempt to load persisted value
      console.log('📋 useEffect - Bale has no buyer number. Attempting to load persisted value.');
      
      const loadPersistedBuyerNumber = async () => {
        let persisted: string | null = null;
        
        // Try AsyncStorage first
        try {
          if (RNAsync && typeof RNAsync.getItem === 'function') {
            persisted = await RNAsync.getItem(BUYER_NUMBER_STORAGE_KEY);
            console.log('📋 Loading persisted buyer number for new bale from AsyncStorage, found:', persisted);
          }
        } catch (e) {
          console.error('📋 Error loading from AsyncStorage:', e);
        }
        
        // Fallback to session storage if AsyncStorage is not available or empty
        if (!persisted && sessionPersistedBuyerNumber) {
          persisted = sessionPersistedBuyerNumber;
          console.log('📋 Loading persisted buyer number for new bale from session state, found:', persisted);
        }

        if (persisted && typeof persisted === 'string' && persisted.trim() !== '' && buyingStaff.length > 0) {
          const staff = buyingStaff.find(bs => String(bs.buyer_number) === persisted.trim());
          if (staff) {
            setFormState(prevState => ({ ...prevState, buyerNumber: String(staff.buyer_number) }));
            setBuyerNumberSearchText(String(staff.buyer_number));
            setSelectedBuyingStaff({ id: String(staff.id), buyer_number: staff.buyer_number });
            console.log('📋 Successfully loaded persisted buyer number for new bale:', staff.buyer_number);
          } else {
            console.log('📋 Persisted buyer number not found in list, clearing');
            setFormState(prevState => ({ ...prevState, buyerNumber: '' }));
            setBuyerNumberSearchText('');
            setSelectedBuyingStaff(null);
          }
        } else if (buyingStaff.length === 0) {
          console.log('📋 Buying staff not loaded yet for new bale, will re-evaluate when available.');
          // This case is handled by the dependency array re-triggering this effect.
        } else {
          console.log('📋 No persisted buyer number found for new bale, or persisted value not found in buying staff list.');
          // Ensure states are cleared if no persisted value or no match
          setFormState(prevState => ({ ...prevState, buyerNumber: '' }));
          setBuyerNumberSearchText('');
          setSelectedBuyingStaff(null);
        }
      };
      
      loadPersistedBuyerNumber();
    }
  }, [baleData, buyingStaff, sessionPersistedBuyerNumber]);

  useEffect(() => {
    if (baleData) {
      const timbGrade = baleData.timb_grade_name || '';
      const buyerCode = baleData.buyer_code || '';
      const buyerGrade = baleData.buyer_grade_grade || '';
      const saleCode = baleData.salecode_name || '';
      
      // Use the human-readable classifier_number for display.
      // curverid_classifier_number is the foreign key ID; classifier_number is the visible code (e.g. "4").
      const classifierNumberId = baleData.classifier_number
        ? String(baleData.classifier_number)
        : (lastClassifierNumber || '');
      
      setFormState(prevState => ({
        timbGrade: timbGrade,
        buyer: buyerCode,
        buyerGrade: buyerGrade,
        price: baleData.price?.toString() || '',
        saleCode: saleCode,
        hessian: baleData.hessian_name || '',
        lotNumber: baleData.lot_number || '',
        groupNumber: baleData.group_number?.toString() || '',
        classifierNumber: classifierNumberId || '',
        buyerNumber: prevState.buyerNumber, // Keep existing buyerNumber from the sync effect above
      }));
      
      // Set search texts and selected items
      setTimbGradeSearchText(timbGrade);
      setBuyerSearchText(buyerCode);
      setBuyerGradeSearchText(buyerGrade);
      setSaleCodeSearchText(saleCode);
      setClassifierNumberSearchText(classifierNumberId || '');
      // buyerNumberSearchText is set by the sync effect above
      
      // Find and set selected TIMB grade
      if (timbGrades.length > 0 && timbGrade) {
        const tg = timbGrades.find(tg => tg.name === timbGrade);
        if (tg) {
          setSelectedTimbGrade({ id: String(tg.id), name: tg.name });
        } else {
          setSelectedTimbGrade(null);
        }
      } else {
        setSelectedTimbGrade(null);
      }
      
      // Find and set selected buyer
      if (buyers.length > 0 && buyerCode) {
        const buyer = buyers.find(b => b.buyer_code === buyerCode);
        if (buyer) {
          setSelectedBuyer({ id: String(buyer.id), buyer_code: buyer.buyer_code });
        } else {
          setSelectedBuyer(null);
        }
      } else {
        setSelectedBuyer(null);
      }
      
      // Find and set selected buyer grade
      if (buyerGrades.length > 0 && buyerGrade) {
        const bg = buyerGrades.find(bg => bg.grade === buyerGrade);
        if (bg) {
          setSelectedBuyerGrade({ id: String(bg.id), grade: bg.grade });
        } else {
          setSelectedBuyerGrade(null);
        }
      } else {
        setSelectedBuyerGrade(null);
      }
      
      // Find and set selected sale code
      if (saleCodes.length > 0 && saleCode) {
        const sc = saleCodes.find(sc => sc.name === saleCode);
        if (sc) {
          setSelectedSaleCode({ id: String(sc.id), name: sc.name });
        } else {
          setSelectedSaleCode(null);
        }
      } else {
        setSelectedSaleCode(null);
      }
      
      // Find and set selected classifier based on the visible classifier_number, not the foreign key ID
      const classifierNumberVal = baleData.classifier_number
        ? String(baleData.classifier_number)
        : '';
      if (classifiers.length > 0 && classifierNumberVal) {
        // Find by matching classifier_number string with the ID string (like abitration.tsx)
        const classifier = classifiers.find(c => String(c.classifier_number) === classifierNumberVal);
        if (classifier) {
          setSelectedClassifier({ id: String(classifier.id), classifier_number: classifier.classifier_number });
          // Update form state and search text with the actual classifier_number string
          const actualClassifierNumber = String(classifier.classifier_number);
          setClassifierNumberSearchText(actualClassifierNumber);
          setFormState(prevState => ({ ...prevState, classifierNumber: actualClassifierNumber }));
        } else {
          setSelectedClassifier(null);
        }
      } else {
        setSelectedClassifier(null);
      }
      
      // selectedBuyingStaff is set by the sync effect above
    }
  }, [baleData, timbGrades, buyers, buyerGrades, saleCodes, classifiers, lastClassifierNumber]);

  const resetState = (keepBarcode = false) => {
    if (!keepBarcode) setBarcode('');
    setBaleData(null);
    setError(null);
    setIsRejected(false);
    setFormState({ timbGrade: '', buyer: '', buyerGrade: '', price: '', saleCode: '', hessian: '', lotNumber: '', groupNumber: '', classifierNumber: '', buyerNumber: '' });
    setTimbGradeSearchText('');
    setBuyerSearchText('');
    setBuyerGradeSearchText('');
    setSaleCodeSearchText('');
    setClassifierNumberSearchText('');
    setBuyerNumberSearchText('');
    setSelectedTimbGrade(null);
    setSelectedBuyer(null);
    setSelectedBuyerGrade(null);
    setSelectedSaleCode(null);
    setSelectedClassifier(null);
    setSelectedBuyingStaff(null);
  };

  const getTimbGradeDetails = async (gradeName: string): Promise<{ grade_type: string; action_type: string } | null> => {
    try {
      const grade = await powersync.get<any>(
        `SELECT
          tg.grade_type,
          sc.name as action_type_name
        FROM floor_maintenance_timb_grade AS tg
        LEFT JOIN data_processing_salecode AS sc ON tg.action_type = sc.id
        WHERE tg.name = ?
        LIMIT 1`,
        [gradeName.toUpperCase()]
      );
      console.log(
        `📋 TIMB Grade: ${gradeName}, grade_type: ${grade?.grade_type || 'null'}, action_type: ${
          grade?.action_type_name || 'null'
        }`
      );
      return grade ? { grade_type: grade.grade_type, action_type: grade.action_type_name } : null;
    } catch (e) {
      console.warn('⚠️ Could not check grade_type:', e);
      return null;
    }
  };

  const checkTimbGradeForRejection = async (gradeName: string) => {
    if (gradeName) {
      const gradeDetails = await getTimbGradeDetails(gradeName);
      if (gradeDetails?.grade_type === 'REASON') {
        setRejectionDetails(gradeDetails);
        Alert.alert('⚠️ Reject Bale?', 'Are you sure you want to reject this bale?', [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setFormState(prevState => ({ ...prevState, timbGrade: '' }));
              setIsRejected(false);
              setRejectionDetails(null);
            }
          },
          {
            text: 'Yes',
            onPress: () => {
              setIsRejected(true);
            }
          }
        ]);
      } else {
        setIsRejected(false);
        setRejectionDetails(null);
      }
    } else {
      setIsRejected(false);
      setRejectionDetails(null);
    }
  };

  const handleTimbGradeSelect = async (item: any) => {
    const gradeName = item.name || String(item.id);
    setFormState(prevState => ({ ...prevState, timbGrade: gradeName }));
    setTimbGradeSearchText(gradeName);
    setSelectedTimbGrade({ id: String(item.id), name: item.name });
    await checkTimbGradeForRejection(gradeName);
  };

  const handleTimbGradeChange = async (text: string) => {
    setTimbGradeSearchText(text);
    // Clear selection if text doesn't match selected grade
    if (selectedTimbGrade && text !== (selectedTimbGrade.name || selectedTimbGrade.id)) {
      setSelectedTimbGrade(null);
      setFormState(prevState => ({ ...prevState, timbGrade: text }));
    }
    
    // If text matches a grade, set it
    if (text && timbGrades.length > 0) {
      const matchedGrade = timbGrades.find(tg => 
        (tg.name || String(tg.id)).toLowerCase() === text.toLowerCase()
      );
      if (matchedGrade) {
        await handleTimbGradeSelect(matchedGrade);
      } else if (text) {
        // Still check for rejection even if not matched
        await checkTimbGradeForRejection(text);
      }
    } else if (text) {
      await checkTimbGradeForRejection(text);
    } else {
      setIsRejected(false);
      setRejectionDetails(null);
    }
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
          rb.group_number,
          rb.lot_number,
          rb.current_seq,
          rb.price,
          rb.curverid_classifier_number,
          rb.curverid_buyer_number,
          bc.classifier_number,
          bbs.buyer_number,
          gdn.grower_number,
          gdn.selling_date as sale_date,
          gdn.number_of_bales_delivered,
          tg.name as timb_grade_name,
          b.buyer_code,
          bg.grade as buyer_grade_grade,
          cs.name as salecode_name,
          rh.name as hessian_name
        FROM receiving_bale AS rb
        LEFT JOIN receiving_grower_delivery_note AS gdn ON rb.grower_delivery_note_id = gdn.id
        LEFT JOIN floor_maintenance_timb_grade AS tg ON rb.timb_grade = tg.id
        LEFT JOIN buyers_buyer AS b ON rb.buyer = b.id
        LEFT JOIN buyers_grade AS bg ON rb.buyer_grade = bg.id
        LEFT JOIN data_processing_salecode AS cs ON rb.salecode_id = cs.id
        LEFT JOIN receiving_hessian AS rh ON rb.hessian = rh.id
        LEFT JOIN buyers_classifier AS bc ON rb.curverid_classifier_number = bc.id
        LEFT JOIN buyers_buying_staff AS bbs ON rb.curverid_buyer_number = bbs.id
        WHERE rb.barcode = ?
      `;

      const result = await powersync.execute(query, [scannedBarcode]);
      
      if (result.rows && result.rows.length > 0) {
        setBaleData(result.rows._array[0] as BaleData);
      } else {
        setError('No bale found with this barcode.');
        setBaleData(null);
      }
    } catch (e) {
      const error = e as Error;
      Alert.alert('Error', `Failed to fetch bale data: ${error.message}`);
      setError('An error occurred while fetching bale data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation: TIMB Grade, Buyer, Buyer Grade, and Price are required
    if (!baleData) {
      setError("Please scan a bale first.");
      Alert.alert('Validation Error', 'Please scan a bale first.');
      return;
    }
    
    if (!selectedTimbGrade) {
      setError("Please select a TIMB grade.");
      Alert.alert('Validation Error', 'TIMB grade is required.');
      return;
    }
    
    if (!selectedBuyer) {
      setError("Please select a buyer.");
      Alert.alert('Validation Error', 'Buyer is required.');
      return;
    }
    
    if (!selectedBuyerGrade) {
      setError("Please select a buyer grade.");
      Alert.alert('Validation Error', 'Buyer grade is required.');
      return;
    }
    
    if (!formState.price || formState.price.trim() === '') {
      setError("Please enter a price.");
      Alert.alert('Validation Error', 'Price is required.');
      return;
    }
    
    // Validate price is a valid number
    const priceValue = parseFloat(formState.price.trim());
    if (isNaN(priceValue) || priceValue < 0) {
      setError("Price must be a valid number (0 or greater).");
      Alert.alert('Validation Error', 'Price must be a valid number (0 or greater).');
      return;
    }
    
    Keyboard.dismiss();
    setIsSaving(true);
    setError(null);
  
    const gradeDetails = formState.timbGrade ? await getTimbGradeDetails(formState.timbGrade) : null;
    let finalPriceValue = priceValue;

    // Special handling for rejected bales
    if (gradeDetails?.grade_type === 'REASON') {
      if (!formState.saleCode) {
        Alert.alert('⚠️ Validation Error', 'Sale Code is required for rejected bales.', [{ text: 'OK' }]);
        setIsSaving(false);
        return;
      }
      if (finalPriceValue !== 0) {
        finalPriceValue = 0;
        setFormState(prevState => ({ ...prevState, price: '0' }));
      }
    }

    try {
      // Resolve names/codes to IDs
      let timbGradeId: number | null = null;
      let buyerId: number | null = null;
      let buyerGradeId: number | null = null;
      let salecodeId: number | null = null;
      let hessianId: number | null = null;

      // Resolve TIMB Grade
      if (formState.timbGrade) {
        const timbGrade = await powersync.get<any>(
          'SELECT id FROM floor_maintenance_timb_grade WHERE name = ? LIMIT 1',
          [formState.timbGrade.toUpperCase()]
        );
        if (timbGrade) {
          timbGradeId = timbGrade.id;
        } else {
          throw new Error(`TIMB Grade "${formState.timbGrade}" not found locally. Please sync the app.`);
        }
      }

      // Resolve Buyer
      if (formState.buyer) {
        const buyer = await powersync.get<any>(
          'SELECT id FROM buyers_buyer WHERE buyer_code = ? LIMIT 1',
          [formState.buyer.toUpperCase()]
        );
        if (buyer) {
          buyerId = buyer.id;
        } else {
          throw new Error(`Buyer "${formState.buyer}" not found locally. Please sync the app.`);
        }
      }

      // Resolve Buyer Grade (depends on buyer)
      if (formState.buyerGrade && buyerId) {
        const buyerGrade = await powersync.get<any>(
          'SELECT id FROM buyers_grade WHERE grade = ? AND buyer = ? LIMIT 1',
          [formState.buyerGrade.toUpperCase(), buyerId]
        );
        if (buyerGrade) {
          buyerGradeId = buyerGrade.id;
        } else {
          throw new Error(`Buyer Grade "${formState.buyerGrade}" not found for buyer "${formState.buyer}". Please sync the app.`);
        }
      } else if (formState.buyerGrade && !buyerId) {
        throw new Error('Cannot set Buyer Grade without a valid Buyer.');
      }

      // Resolve Sale Code
      if (formState.saleCode) {
        const salecode = await powersync.get<any>(
          'SELECT id FROM data_processing_salecode WHERE name = ? LIMIT 1',
          [formState.saleCode.toUpperCase()]
        );
        if (salecode) {
          salecodeId = salecode.id;
        } else {
          throw new Error(`Sale Code "${formState.saleCode}" not found locally. Please sync the app.`);
        }
      }

      // Resolve Hessian
      if (formState.hessian) {
        const hessian = await powersync.get<any>(
          'SELECT id FROM receiving_hessian WHERE name = ? LIMIT 1',
          [formState.hessian]
        );
        if (hessian) {
          hessianId = hessian.id;
        } else {
          throw new Error(`Hessian "${formState.hessian}" not found locally. Please sync the app.`);
        }
      }

      // Resolve classifier and buyer number to IDs
      let classifierId: number | null = null;
      let buyerNumberId: number | null = null;
      
      if (selectedClassifier) {
        classifierId = parseInt(selectedClassifier.id, 10);
      } else if (formState.classifierNumber && classifiers.length > 0) {
        const classifier = classifiers.find(c => String(c.classifier_number) === formState.classifierNumber);
        if (classifier) {
          classifierId = classifier.id;
        }
      }
      
      if (selectedBuyingStaff) {
        buyerNumberId = parseInt(selectedBuyingStaff.id, 10);
      } else if (formState.buyerNumber && buyingStaff.length > 0) {
        const staff = buyingStaff.find(bs => String(bs.buyer_number) === formState.buyerNumber);
        if (staff) {
          buyerNumberId = staff.id;
        }
      }

      // Price value is already validated and set above
      console.log(`💰 Saving price: formState.price="${formState.price}", parsed value=${finalPriceValue}, isRejected=${isRejected}`);

      // Update the bale with resolved IDs
      await powersync.execute(
        `UPDATE receiving_bale SET
          timb_grade = ?,
          buyer = ?,
          buyer_grade = ?,
          price = ?,
          salecode_id = ?,
          hessian = ?,
          lot_number = ?,
          group_number = ?,
          curverid_classifier_number = ?,
          curverid_buyer_number = ?,
          write_date = ?
        WHERE id = ?`,
        [
          timbGradeId,
          buyerId,
          buyerGradeId,
          finalPriceValue,
          salecodeId,
          hessianId,
          formState.lotNumber || null,
          formState.groupNumber ? parseInt(formState.groupNumber, 10) : null,
          classifierId,
          buyerNumberId,
          new Date().toISOString(),
          baleData.id
        ]
      );

      // Persist buyer number after successful save (like classification.tsx)
      if (selectedBuyingStaff?.buyer_number) {
        const buyerNumberToPersist = String(selectedBuyingStaff.buyer_number).trim();
        try {
          if (RNAsync && typeof RNAsync.setItem === 'function') {
            await RNAsync.setItem(BUYER_NUMBER_STORAGE_KEY, buyerNumberToPersist);
            setSessionPersistedBuyerNumber(buyerNumberToPersist);
            console.log('📋 Successfully persisted buyer number to AsyncStorage after save:', buyerNumberToPersist);
          } else {
            // Fallback to session storage
            setSessionPersistedBuyerNumber(buyerNumberToPersist);
            console.log('📋 AsyncStorage not available, using session state for buyer number:', buyerNumberToPersist);
          }
        } catch (e) {
          console.error('📋 Failed to persist buyer number to AsyncStorage after save:', e);
          // Fallback to session storage
          setSessionPersistedBuyerNumber(buyerNumberToPersist);
          console.log('📋 Fallback: Persisted buyer number to session state:', buyerNumberToPersist);
        }
      }

      // Refresh bale data to get updated values
      await fetchBaleData(baleData.barcode);

      // Build success message with saved details
      const savedDetails: string[] = [];
      if (formState.timbGrade) savedDetails.push(`TIMB Grade: ${formState.timbGrade}`);
      if (formState.buyer) savedDetails.push(`Buyer: ${formState.buyer}`);
      if (formState.buyerGrade) savedDetails.push(`Buyer Grade: ${formState.buyerGrade}`);
      if (formState.saleCode) savedDetails.push(`Sale Code: ${formState.saleCode}`);
      if (formState.hessian) savedDetails.push(`Hessian: ${formState.hessian}`);
      if (formState.lotNumber) savedDetails.push(`Lot Number: ${formState.lotNumber}`);
      if (formState.groupNumber) savedDetails.push(`Group Number: ${formState.groupNumber}`);
      
      const detailsText = savedDetails.length > 0 
        ? savedDetails.join('\n')
        : 'No details were updated.';
      
      Alert.alert(
        '✅ Success!',
        `All details saved successfully!\n\n${detailsText}\n\n.`,
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
      const errorMessage = e.message || 'An error occurred while saving.';
      Alert.alert('Error', `Failed to save details: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndRelease = async () => {
    // Validation: TIMB Grade, Buyer, Buyer Grade, and Price are required
    if (!baleData) {
      setError("Please scan a bale first.");
      Alert.alert('Validation Error', 'Please scan a bale first.');
      return;
    }
    
    if (!selectedTimbGrade) {
      setError("Please select a TIMB grade.");
      Alert.alert('Validation Error', 'TIMB grade is required.');
      return;
    }
    
    if (!selectedBuyer) {
      setError("Please select a buyer.");
      Alert.alert('Validation Error', 'Buyer is required.');
      return;
    }
    
    if (!selectedBuyerGrade) {
      setError("Please select a buyer grade.");
      Alert.alert('Validation Error', 'Buyer grade is required.');
      return;
    }
    
    if (!formState.price || formState.price.trim() === '') {
      setError("Please enter a price.");
      Alert.alert('Validation Error', 'Price is required.');
      return;
    }
    
    // Validate price is a valid number
    const priceValue = parseFloat(formState.price.trim());
    if (isNaN(priceValue) || priceValue < 0) {
      setError("Price must be a valid number (0 or greater).");
      Alert.alert('Validation Error', 'Price must be a valid number (0 or greater).');
      return;
    }
    
    Keyboard.dismiss();
    setIsReleasing(true);
    setError(null);
    
    const gradeDetails = formState.timbGrade ? await getTimbGradeDetails(formState.timbGrade) : null;
    let finalPriceValue = priceValue;

    // Special handling for rejected bales
    if (gradeDetails?.grade_type === 'REASON') {
      if (!formState.saleCode) {
        Alert.alert('⚠️ Validation Error', 'Sale Code is required for rejected bales.', [{ text: 'OK' }]);
        setIsReleasing(false);
        return;
      }
      if (finalPriceValue !== 0) {
        finalPriceValue = 0;
        setFormState(prevState => ({ ...prevState, price: '0' }));
      }
    }
    
    try {
      // Resolve names/codes to IDs
      let timbGradeId: number | null = null;
      let buyerId: number | null = null;
      let buyerGradeId: number | null = null;
      let salecodeId: number | null = null;
      let hessianId: number | null = null;

      // Resolve TIMB Grade
      if (formState.timbGrade) {
        const timbGrade = await powersync.get<any>(
          'SELECT id FROM floor_maintenance_timb_grade WHERE name = ? LIMIT 1',
          [formState.timbGrade.toUpperCase()]
        );
        if (timbGrade) {
          timbGradeId = timbGrade.id;
        } else {
          throw new Error(`TIMB Grade "${formState.timbGrade}" not found locally. Please sync the app.`);
        }
      }

      // Resolve Buyer
      if (formState.buyer) {
        const buyer = await powersync.get<any>(
          'SELECT id FROM buyers_buyer WHERE buyer_code = ? LIMIT 1',
          [formState.buyer.toUpperCase()]
        );
        if (buyer) {
          buyerId = buyer.id;
        } else {
          throw new Error(`Buyer "${formState.buyer}" not found locally. Please sync the app.`);
        }
      }

      // Resolve Buyer Grade (depends on buyer)
      if (formState.buyerGrade && buyerId) {
        const buyerGrade = await powersync.get<any>(
          'SELECT id FROM buyers_grade WHERE grade = ? AND buyer = ? LIMIT 1',
          [formState.buyerGrade.toUpperCase(), buyerId]
        );
        if (buyerGrade) {
          buyerGradeId = buyerGrade.id;
        } else {
          throw new Error(`Buyer Grade "${formState.buyerGrade}" not found for buyer "${formState.buyer}". Please sync the app.`);
        }
      } else if (formState.buyerGrade && !buyerId) {
        throw new Error('Cannot set Buyer Grade without a valid Buyer.');
      }

      // Resolve Sale Code
      if (formState.saleCode) {
        const salecode = await powersync.get<any>(
          'SELECT id FROM data_processing_salecode WHERE name = ? LIMIT 1',
          [formState.saleCode.toUpperCase()]
        );
        if (salecode) {
          salecodeId = salecode.id;
        } else {
          throw new Error(`Sale Code "${formState.saleCode}" not found locally. Please sync the app.`);
        }
      }

      // Resolve Hessian
      if (formState.hessian) {
        const hessian = await powersync.get<any>(
          'SELECT id FROM receiving_hessian WHERE name = ? LIMIT 1',
          [formState.hessian]
        );
        if (hessian) {
          hessianId = hessian.id;
        } else {
          throw new Error(`Hessian "${formState.hessian}" not found locally. Please sync the app.`);
        }
      }

      // Resolve classifier and buyer number to IDs
      let classifierId: number | null = null;
      let buyerNumberId: number | null = null;
      
      if (selectedClassifier) {
        classifierId = parseInt(selectedClassifier.id, 10);
      } else if (formState.classifierNumber && classifiers.length > 0) {
        const classifier = classifiers.find(c => String(c.classifier_number) === formState.classifierNumber);
        if (classifier) {
          classifierId = classifier.id;
        }
      }
      
      if (selectedBuyingStaff) {
        buyerNumberId = parseInt(selectedBuyingStaff.id, 10);
      } else if (formState.buyerNumber && buyingStaff.length > 0) {
        const staff = buyingStaff.find(bs => String(bs.buyer_number) === formState.buyerNumber);
        if (staff) {
          buyerNumberId = staff.id;
        }
      }

      // Price value is already validated and set above
      console.log(`💰 Releasing with price: formState.price="${formState.price}", parsed value=${finalPriceValue}, isRejected=${isRejected}`);

      // Update the bale with resolved IDs and set is_released
      await powersync.execute(
        `UPDATE receiving_bale SET
          timb_grade = ?,
          buyer = ?,
          buyer_grade = ?,
          price = ?,
          salecode_id = ?,
          hessian = ?,
          lot_number = ?,
          group_number = ?,
          curverid_classifier_number = ?,
          curverid_buyer_number = ?,
          is_released = 1,
          write_date = ?
        WHERE id = ?`,
        [
          timbGradeId,
          buyerId,
          buyerGradeId,
          finalPriceValue,
          salecodeId,
          hessianId,
          formState.lotNumber || null,
          formState.groupNumber ? parseInt(formState.groupNumber, 10) : null,
          classifierId,
          buyerNumberId,
          new Date().toISOString(),
          baleData.id
        ]
      );

      // Persist buyer number after successful save (like classification.tsx)
      if (selectedBuyingStaff?.buyer_number) {
        const buyerNumberToPersist = String(selectedBuyingStaff.buyer_number).trim();
        try {
          if (RNAsync && typeof RNAsync.setItem === 'function') {
            await RNAsync.setItem(BUYER_NUMBER_STORAGE_KEY, buyerNumberToPersist);
            setSessionPersistedBuyerNumber(buyerNumberToPersist);
            console.log('📋 Successfully persisted buyer number to AsyncStorage after release:', buyerNumberToPersist);
          } else {
            // Fallback to session storage
            setSessionPersistedBuyerNumber(buyerNumberToPersist);
            console.log('📋 AsyncStorage not available, using session state for buyer number:', buyerNumberToPersist);
          }
        } catch (e) {
          console.error('📋 Failed to persist buyer number to AsyncStorage after release:', e);
          // Fallback to session storage
          setSessionPersistedBuyerNumber(buyerNumberToPersist);
          console.log('📋 Fallback: Persisted buyer number to session state:', buyerNumberToPersist);
        }
      }

      // Refresh bale data to get updated values
      await fetchBaleData(baleData.barcode);

      // Check if this is the last bale being released for this grower on this sale date and sale number
      let isLastBaleReleased = false;
      try {
        // Get the delivery note info to find grower, sale date and sale number
        const deliveryNote = await powersync.get<any>(
          `SELECT grower_number, selling_date as sale_date, floor_sale as sale_number 
           FROM receiving_grower_delivery_note 
           WHERE id = (SELECT grower_delivery_note_id FROM receiving_bale WHERE id = ?)`,
          [baleData.id]
        );
        
        if (deliveryNote?.grower_number && deliveryNote?.sale_date && deliveryNote?.sale_number != null) {
          // Count all bales for this grower on this sale date and sale number
          const allBalesResult = await powersync.get<{ count: number }>(
            `SELECT COUNT(*) as count 
             FROM receiving_bale rb
             JOIN receiving_grower_delivery_note gdn ON rb.grower_delivery_note_id = gdn.id
             WHERE gdn.grower_number = ? AND gdn.selling_date = ? AND gdn.floor_sale = ?`,
            [deliveryNote.grower_number, deliveryNote.sale_date, deliveryNote.sale_number]
          );
          
          // Count released bales for this grower on this sale date and sale number (including the one we just released)
          const releasedBalesResult = await powersync.get<{ count: number }>(
            `SELECT COUNT(*) as count 
             FROM receiving_bale rb
             JOIN receiving_grower_delivery_note gdn ON rb.grower_delivery_note_id = gdn.id
             WHERE gdn.grower_number = ? AND gdn.selling_date = ? AND gdn.floor_sale = ? AND rb.is_released = 1`,
            [deliveryNote.grower_number, deliveryNote.sale_date, deliveryNote.sale_number]
          );
          
          const totalBales = allBalesResult?.count || 0;
          const releasedBales = releasedBalesResult?.count || 0;
          
          console.log(`📊 Grower ${deliveryNote.grower_number} on ${deliveryNote.sale_date} (Sale ${deliveryNote.sale_number}): ${releasedBales}/${totalBales} bales released`);
          
          // If all bales are released, this is the last one
          if (totalBales > 0 && releasedBales === totalBales) {
            isLastBaleReleased = true;
            console.log(`🎉 Last bale released for grower ${deliveryNote.grower_number} on sale date ${deliveryNote.sale_date}, sale ${deliveryNote.sale_number}`);
          }
        }
      } catch (checkError) {
        console.warn('⚠️ Error checking if all bales are released:', checkError);
        // Continue even if check fails
      }

      // Build success message with saved details
      const savedDetails: string[] = [];
      if (formState.timbGrade) savedDetails.push(`TIMB Grade: ${formState.timbGrade}`);
      if (formState.buyer) savedDetails.push(`Buyer: ${formState.buyer}`);
      if (formState.buyerGrade) savedDetails.push(`Buyer Grade: ${formState.buyerGrade}`);
      if (formState.saleCode) savedDetails.push(`Sale Code: ${formState.saleCode}`);
      if (formState.hessian) savedDetails.push(`Hessian: ${formState.hessian}`);
      if (formState.lotNumber) savedDetails.push(`Lot Number: ${formState.lotNumber}`);
      if (formState.groupNumber) savedDetails.push(`Group Number: ${formState.groupNumber}`);
      if (formState.classifierNumber) savedDetails.push(`Classifier Number: ${formState.classifierNumber}`);
      if (formState.buyerNumber) savedDetails.push(`Buyer Number: ${formState.buyerNumber}`);
      savedDetails.push('Status: Released');
      
      const detailsText = savedDetails.length > 0 
        ? savedDetails.join('\n')
        : 'No details were updated.';
      
      // Show different message if this was the last bale
      if (isLastBaleReleased) {
        Alert.alert(
          '🎉 Sale Released!',
          `The last bale released for that grower on that sale date!\n\n${detailsText}\n\nAll bales in this sale have been released.`,
          [
            {
              text: 'OK',
              onPress: () => {
                openScanner();
              }
            }
          ]
        );
      } else {
        Alert.alert(
          '✅ Success!',
          `Released successfully!\n\n${detailsText}\n\n.`,
          [
            {
              text: 'OK',
              onPress: () => {
                openScanner();
              }
            }
          ]
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save and release');
    } finally {
      setIsReleasing(false);
    }
  };

  const openScanner = () => {
    router.push({
      pathname: '/(app)/datacapturing/barcode-scanner',
      params: { returnTo: '/(app)/datacapturing/all-details' }
    });
  };

  const handleFormChange = (name: keyof AllDetailsFormState, value: string) => {
    setFormState(prevState => ({ ...prevState, [name]: value }));
  };

  const handleBuyerSelect = (item: any) => {
    const buyerCode = item.buyer_code || String(item.id);
    setFormState(prevState => ({ ...prevState, buyer: buyerCode, buyerGrade: '' }));
    setBuyerSearchText(buyerCode);
    setSelectedBuyer({ id: String(item.id), buyer_code: item.buyer_code });
    setSelectedBuyerId(String(item.id));
    setBuyerGradeSearchText('');
    setSelectedBuyerGrade(null);
  };

  const handleBuyerChange = (text: string) => {
    setBuyerSearchText(text);
    // Clear selection if text doesn't match selected buyer
    if (selectedBuyer && text !== (selectedBuyer.buyer_code || selectedBuyer.id)) {
      setSelectedBuyer(null);
      setFormState(prevState => ({ ...prevState, buyer: text, buyerGrade: '' }));
      setBuyerGradeSearchText('');
      setSelectedBuyerGrade(null);
    }
    
    // If text matches a buyer code, set it
    if (text && buyers.length > 0) {
      const matchedBuyer = buyers.find(b => 
        (b.buyer_code || String(b.id)).toLowerCase() === text.toLowerCase()
      );
      if (matchedBuyer) {
        handleBuyerSelect(matchedBuyer);
      }
    }
  };

  const handleBuyerGradeSelect = (item: any) => {
    const grade = item.grade || String(item.id);
    setFormState(prevState => ({ ...prevState, buyerGrade: grade }));
    setBuyerGradeSearchText(grade);
    setSelectedBuyerGrade({ id: String(item.id), grade: item.grade });
  };

  const handleBuyerGradeChange = (text: string) => {
    setBuyerGradeSearchText(text);
    // Clear selection if text doesn't match selected grade
    if (selectedBuyerGrade && text !== (selectedBuyerGrade.grade || selectedBuyerGrade.id)) {
      setSelectedBuyerGrade(null);
      setFormState(prevState => ({ ...prevState, buyerGrade: text }));
    }
    
    // If text matches a grade, set it
    if (text && buyerGrades.length > 0) {
      const matchedGrade = buyerGrades.find(bg => 
        (bg.grade || String(bg.id)).toLowerCase() === text.toLowerCase()
      );
      if (matchedGrade) {
        handleBuyerGradeSelect(matchedGrade);
      }
    }
  };

  const handleSaleCodeSelect = (item: any) => {
    const name = item.name || String(item.id);
    setFormState(prevState => ({ ...prevState, saleCode: name }));
    setSaleCodeSearchText(name);
    setSelectedSaleCode({ id: String(item.id), name: item.name });
  };

  const handleSaleCodeChange = (text: string) => {
    setSaleCodeSearchText(text);
    // Clear selection if text doesn't match selected sale code
    if (selectedSaleCode && text !== (selectedSaleCode.name || selectedSaleCode.id)) {
      setSelectedSaleCode(null);
      setFormState(prevState => ({ ...prevState, saleCode: text }));
    }
    
    // If text matches a sale code, set it
    if (text && saleCodes.length > 0) {
      const matchedSaleCode = saleCodes.find(sc => 
        (sc.name || String(sc.id)).toLowerCase() === text.toLowerCase()
      );
      if (matchedSaleCode) {
        handleSaleCodeSelect(matchedSaleCode);
      }
    }
  };

  const handleClassifierSelect = (item: any) => {
    const classifierNum = item.classifier_number || String(item.id);
    setFormState(prevState => ({ ...prevState, classifierNumber: classifierNum }));
    setClassifierNumberSearchText(classifierNum);
    setSelectedClassifier({ id: String(item.id), classifier_number: item.classifier_number });
    
    // Persist to AsyncStorage
    if (RNAsync && typeof RNAsync.setItem === 'function') {
      RNAsync.setItem(CLASSIFIER_NUMBER_STORAGE_KEY, classifierNum.trim()).catch((e: any) => {
        console.error('Failed to persist classifier number:', e);
      });
    }
    setLastClassifierNumber(classifierNum);
  };

  const handleClassifierChange = (text: string) => {
    setClassifierNumberSearchText(text);
    // Clear selection if text doesn't match selected classifier
    if (selectedClassifier && text !== (selectedClassifier.classifier_number || selectedClassifier.id)) {
      setSelectedClassifier(null);
      setFormState(prevState => ({ ...prevState, classifierNumber: text }));
    }
    
    // If text matches a classifier, set it
    if (text && classifiers.length > 0) {
      const matchedClassifier = classifiers.find(c => 
        (c.classifier_number || String(c.id)).toLowerCase() === text.toLowerCase()
      );
      if (matchedClassifier) {
        handleClassifierSelect(matchedClassifier);
      }
    }
  };

  const handleBuyerNumberSelect = (item: any) => {
    const buyerNum = item.buyer_number ? String(item.buyer_number) : ''; // Always use buyer_number string
    setFormState(prevState => ({ ...prevState, buyerNumber: buyerNum }));
    setBuyerNumberSearchText(buyerNum);
    setSelectedBuyingStaff({ id: String(item.id), buyer_number: item.buyer_number });
    
    const valueToPersist = buyerNum.trim();
    // Persist to AsyncStorage
    if (valueToPersist) {
      (async () => {
        try {
          if (RNAsync && typeof RNAsync.setItem === 'function') {
            await RNAsync.setItem(BUYER_NUMBER_STORAGE_KEY, valueToPersist);
            setSessionPersistedBuyerNumber(valueToPersist);
            setLastBuyerNumber(valueToPersist);
            console.log('📋 Successfully persisted buyer number to AsyncStorage:', valueToPersist);
          } else {
            setSessionPersistedBuyerNumber(valueToPersist);
            setLastBuyerNumber(valueToPersist);
            console.log('📋 AsyncStorage not available, using session state for buyer number:', valueToPersist);
          }
        } catch (e) {
          console.error('📋 Failed to persist buyer number:', e);
          setSessionPersistedBuyerNumber(valueToPersist);
          setLastBuyerNumber(valueToPersist);
          console.log('📋 Fallback: Persisted buyer number to session state:', valueToPersist);
        }
      })();
    }
  };

  const handleBuyerNumberChange = (text: string) => {
    setBuyerNumberSearchText(text);
    // Clear selection if text doesn't match selected buying staff's buyer_number (not ID)
    if (selectedBuyingStaff && text !== String(selectedBuyingStaff.buyer_number || '')) {
      setSelectedBuyingStaff(null);
      setFormState(prevState => ({ ...prevState, buyerNumber: text }));
    }
    
    // If text matches a buyer number, set it
    if (text && buyingStaff.length > 0) {
      const matchedStaff = buyingStaff.find(bs => 
        (bs.buyer_number || String(bs.id)).toLowerCase() === text.toLowerCase()
      );
      if (matchedStaff) {
        handleBuyerNumberSelect(matchedStaff);
      }
    }
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
            <Text className="text-[#65435C] font-bold text-lg ml-2">Release</Text>
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
                  <Text className="text-lg font-bold text-[#65435C] mb-3">Bale Details</Text>
                  
                  <View className="flex-row justify-between mb-2 pb-2 border-b border-gray-200">
                    <Text className="font-semibold text-gray-600">Sale Date:</Text>
                    <Text className="text-gray-800">{baleData.sale_date || 'N/A'}</Text>
                  </View>
                  <View className="flex-row justify-between mb-2 pb-2 border-b border-gray-200">
                    <Text className="font-semibold text-gray-600">No. of Bales:</Text>
                    <Text className="text-gray-800">{baleData.number_of_bales_delivered || 'N/A'}</Text>
                  </View>
                  <View className="flex-row justify-between mb-2 pb-2 border-b border-gray-200">
                    <Text className="font-semibold text-gray-600">Barcode:</Text>
                    <Text className="text-gray-800">{baleData.barcode}</Text>
                  </View>
                  <View className="flex-row justify-between mb-2 pb-2 border-b border-gray-200">
                    <Text className="font-semibold text-gray-600">Grower:</Text>
                    <Text className="text-gray-800">{baleData.grower_number}</Text>
                  </View>

                  <View className="flex-row mt-2">
                      <View className="flex-1 pr-2">
                          <Text className="font-semibold text-gray-600">Mass:</Text>
                          <Text className="text-gray-800 p-2 bg-gray-100 rounded-md text-center">{baleData.mass} kg</Text>
                      </View>
                      <View className="flex-1 pl-2">
                          <Text className="font-semibold text-gray-600">SEQ:</Text>
                          <Text className="text-gray-800 p-2 bg-gray-100 rounded-md text-center">{baleData.current_seq || 'N/A'}</Text>
                      </View>
                  </View>

                   <View className="flex-row mt-2">
                      <View className="flex-1 pr-2">
                          <Text className="font-semibold text-gray-600">Group:</Text>
                          <Text className="text-gray-800 p-2 bg-gray-100 rounded-md text-center">{baleData.group_number || 'N/A'}</Text>
                      </View>
                      <View className="flex-1 pl-2">
                          <Text className="font-semibold text-gray-600">Lot:</Text>
                          <Text className="text-gray-800 p-2 bg-gray-100 rounded-md text-center">{baleData.lot_number || 'N/A'}</Text>
                      </View>
                  </View>
              </View>

              <View className="bg-white p-4 rounded-lg shadow-md">
                  <Text className="text-lg font-semibold mb-2 text-gray-700">Enter All Details</Text>

                  <Text className="font-semibold text-gray-600 mb-1">TIMB Grade / Reason</Text>
                  <TextInput
                    className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                      placeholderTextColor="#9CA3AF"
                      style={{ color: '#111827' }}
                    placeholder="Type to search TIMB grade..."
                    value={timbGradeSearchText}
                    onChangeText={handleTimbGradeChange}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {timbGradeSearchText && typeof timbGradeSearchText === 'string' && timbGradeSearchText.trim().length > 0 && !selectedTimbGrade && (
                    <View className="max-h-48 border border-gray-200 rounded-lg mt-2">
                      <ScrollView keyboardShouldPersistTaps="handled">
                        {timbGrades
                          .filter((tg) =>
                            (tg.name || String(tg.id))
                              ?.toString()
                              .toLowerCase()
                              .includes(timbGradeSearchText.toLowerCase())
                          )
                          .slice(0, 25)
                          .map((tg) => (
                            <TouchableOpacity
                              key={tg.id}
                              className="p-3 border-b border-gray-100 bg-white"
                              onPress={() => handleTimbGradeSelect(tg)}
                            >
                              <Text className="text-base text-gray-900">
                                {tg.name || String(tg.id)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        {timbGrades.filter((tg) =>
                          (tg.name || String(tg.id))
                            ?.toString()
                            .toLowerCase()
                            .includes(timbGradeSearchText.toLowerCase())
                        ).length === 0 && (
                          <Text className="text-gray-500 text-center py-3">
                            No TIMB grades found.
                          </Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                  <View className="mb-3" />

                  <Text className="font-semibold text-gray-600 mb-1">Buyer</Text>
                  <TextInput
                    className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                      placeholderTextColor="#9CA3AF"
                      style={{ color: '#111827' }}
                    placeholder="Type to search buyer code..."
                    value={buyerSearchText}
                    onChangeText={handleBuyerChange}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {buyerSearchText && typeof buyerSearchText === 'string' && buyerSearchText.trim().length > 0 && !selectedBuyer && (
                    <View className="max-h-48 border border-gray-200 rounded-lg mt-2">
                      <ScrollView keyboardShouldPersistTaps="handled">
                        {buyers
                          .filter((b) =>
                            (b.buyer_code || String(b.id))
                              ?.toString()
                              .toLowerCase()
                              .includes(buyerSearchText.toLowerCase())
                          )
                          .slice(0, 25)
                          .map((b) => (
                            <TouchableOpacity
                              key={b.id}
                              className="p-3 border-b border-gray-100 bg-white"
                              onPress={() => handleBuyerSelect(b)}
                            >
                              <Text className="text-base text-gray-900">
                                {b.buyer_code || String(b.id)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        {buyers.filter((b) =>
                          (b.buyer_code || String(b.id))
                            ?.toString()
                            .toLowerCase()
                            .includes(buyerSearchText.toLowerCase())
                        ).length === 0 && (
                          <Text className="text-gray-500 text-center py-3">
                            No buyers found.
                          </Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                  <View className="mb-3" />
                  
                  <Text className="font-semibold text-gray-600 mb-1">Buyer Grade</Text>
                  <TextInput
                    className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                      placeholderTextColor="#9CA3AF"
                      style={{ color: '#111827' }}
                    placeholder="Type to search buyer grade..."
                    value={buyerGradeSearchText}
                    onChangeText={handleBuyerGradeChange}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {buyerGradeSearchText && typeof buyerGradeSearchText === 'string' && buyerGradeSearchText.trim().length > 0 && !selectedBuyerGrade && (
                    <View className="max-h-48 border border-gray-200 rounded-lg mt-2">
                      <ScrollView keyboardShouldPersistTaps="handled">
                        {buyerGrades
                          .filter((bg) =>
                            (bg.grade || String(bg.id))
                              ?.toString()
                              .toLowerCase()
                              .includes(buyerGradeSearchText.toLowerCase())
                          )
                          .slice(0, 25)
                          .map((bg) => (
                            <TouchableOpacity
                              key={bg.id}
                              className="p-3 border-b border-gray-100 bg-white"
                              onPress={() => handleBuyerGradeSelect(bg)}
                            >
                              <Text className="text-base text-gray-900">
                                {bg.grade || String(bg.id)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        {buyerGrades.filter((bg) =>
                          (bg.grade || String(bg.id))
                            ?.toString()
                            .toLowerCase()
                            .includes(buyerGradeSearchText.toLowerCase())
                        ).length === 0 && (
                          <Text className="text-gray-500 text-center py-3">
                            No buyer grades found.
                          </Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                  <View className="mb-3" />
                  
                  <Text className="font-semibold text-gray-600 mb-1">Price</Text>
                  <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholderTextColor="#9CA3AF" style={{ color: '#111827' }} placeholder="Price" value={formState.price} onChangeText={(val) => handleFormChange('price', val)} keyboardType="numeric" />
                  
                  <Text className="font-semibold text-gray-600 mb-1">Sale Code {isRejected && <Text className="text-red-500">*</Text>}</Text>
                  <TextInput
                    className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                    placeholderTextColor="#9CA3AF"
                    style={{ color: '#111827' }}
                    placeholder={isRejected ? "Type to search sale code (Required)..." : "Type to search sale code..."}
                    value={saleCodeSearchText}
                    onChangeText={handleSaleCodeChange}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {saleCodeSearchText && typeof saleCodeSearchText === 'string' && saleCodeSearchText.trim().length > 0 && !selectedSaleCode && (
                    <View className="max-h-48 border border-gray-200 rounded-lg mt-2">
                      <ScrollView keyboardShouldPersistTaps="handled">
                        {saleCodes
                          .filter((sc) =>
                            (sc.name || String(sc.id))
                              ?.toString()
                              .toLowerCase()
                              .includes(saleCodeSearchText.toLowerCase())
                          )
                          .slice(0, 25)
                          .map((sc) => (
                            <TouchableOpacity
                              key={sc.id}
                              className="p-3 border-b border-gray-100 bg-white"
                              onPress={() => handleSaleCodeSelect(sc)}
                            >
                              <Text className="text-base text-gray-900">
                                {sc.name || String(sc.id)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        {saleCodes.filter((sc) =>
                          (sc.name || String(sc.id))
                            ?.toString()
                            .toLowerCase()
                            .includes(saleCodeSearchText.toLowerCase())
                        ).length === 0 && (
                          <Text className="text-gray-500 text-center py-3">
                            No sale codes found.
                          </Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                  <View className="mb-3" />

                  <Text className="font-semibold text-gray-600 mb-1">Hessian</Text>
                  <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholderTextColor="#9CA3AF" style={{ color: '#111827' }} placeholder="Hessian" value={formState.hessian} onChangeText={(val) => handleFormChange('hessian', val)} autoCapitalize="characters" />

                  <Text className="font-semibold text-gray-600 mb-1">Lot Number</Text>
                  <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholderTextColor="#9CA3AF" style={{ color: '#111827' }} placeholder="Lot Number" value={formState.lotNumber} onChangeText={(val) => handleFormChange('lotNumber', val)} autoCapitalize="characters" />

                  <Text className="font-semibold text-gray-600 mb-1">Group Number</Text>
                  <TextInput className="border border-gray-300 rounded-md p-2 mb-3" placeholderTextColor="#9CA3AF" style={{ color: '#111827' }} placeholder="Group Number" value={formState.groupNumber} onChangeText={(val) => handleFormChange('groupNumber', val)} keyboardType="numeric" />

                  <Text className="font-semibold text-gray-600 mb-1">Classifier Number</Text>
                  <TextInput
                      className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                      placeholderTextColor="#9CA3AF"
                      style={{ color: '#111827' }}
                      placeholder="Type to search classifier number..."
                    value={classifierNumberSearchText}
                    onChangeText={handleClassifierChange}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {classifierNumberSearchText && typeof classifierNumberSearchText === 'string' && classifierNumberSearchText.trim().length > 0 && !selectedClassifier && (
                    <View className="max-h-48 border border-gray-200 rounded-lg mt-2">
                      <ScrollView keyboardShouldPersistTaps="handled">
                        {classifiers
                          .filter((c) =>
                            (c.classifier_number || String(c.id))
                              ?.toString()
                              .toLowerCase()
                              .includes(classifierNumberSearchText.toLowerCase())
                          )
                          .slice(0, 25)
                          .map((c) => (
                            <TouchableOpacity
                              key={c.id}
                              className="p-3 border-b border-gray-100 bg-white"
                              onPress={() => handleClassifierSelect(c)}
                            >
                              <Text className="text-base text-gray-900">
                                {c.classifier_number || String(c.id)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        {classifiers.filter((c) =>
                          (c.classifier_number || String(c.id))
                            ?.toString()
                            .toLowerCase()
                            .includes(classifierNumberSearchText.toLowerCase())
                        ).length === 0 && (
                          <Text className="text-gray-500 text-center py-3">
                            No classifier numbers found.
                          </Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                  <View className="mb-3" />

                  <Text className="font-semibold text-gray-600 mb-1">Buyer Number</Text>
                  <TextInput
                      className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                      placeholderTextColor="#9CA3AF"
                      style={{ color: '#111827' }}
                      placeholder="Type to search buyer number..."
                    value={buyerNumberSearchText}
                    onChangeText={handleBuyerNumberChange}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {buyerNumberSearchText && typeof buyerNumberSearchText === 'string' && buyerNumberSearchText.trim().length > 0 && !selectedBuyingStaff && (
                    <View className="max-h-48 border border-gray-200 rounded-lg mt-2">
                      <ScrollView keyboardShouldPersistTaps="handled">
                        {buyingStaff
                          .filter((bs) =>
                            (bs.buyer_number || String(bs.id))
                              ?.toString()
                              .toLowerCase()
                              .includes(buyerNumberSearchText.toLowerCase())
                          )
                          .slice(0, 25)
                          .map((bs) => (
                            <TouchableOpacity
                              key={bs.id}
                              className="p-3 border-b border-gray-100 bg-white"
                              onPress={() => handleBuyerNumberSelect(bs)}
                            >
                              <Text className="text-base text-gray-900">
                                {bs.buyer_number || String(bs.id)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        {buyingStaff.filter((bs) =>
                          (bs.buyer_number || String(bs.id))
                            ?.toString()
                            .toLowerCase()
                            .includes(buyerNumberSearchText.toLowerCase())
                        ).length === 0 && (
                          <Text className="text-gray-500 text-center py-3">
                            No buyer numbers found.
                          </Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                  <View className="mb-4" />
                  
                  <TouchableOpacity onPress={handleSaveAndRelease} className={`p-3 rounded-md ${isReleasing ? 'bg-gray-400' : 'bg-green-600'}`} disabled={isReleasing}>
                    {isReleasing ? (
                      <View className="flex-row items-center justify-center">
                        <ActivityIndicator color="white" size="small" className="mr-2" />
                        <Text className="text-white text-center font-bold">Releasing...</Text>
                      </View>
                    ) : (
                      <Text className="text-white text-center font-bold">Release Bale</Text>
                    )}
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

export default AllDetailsScreen;
