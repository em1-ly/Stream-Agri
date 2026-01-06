import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Scan } from 'lucide-react-native';
import { powersync } from '@/powersync/setup';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BUYER_NUMBER_STORAGE_KEY = 'last_buyer_number';

// Define the structure for the bale data, including buyer details
interface BaleData {
  id: string;
  barcode: string;
  mass: number;
  grower_number: string;
  timb_grade_name?: string;
  buyer_code?: string;
  buyer_grade_grade?: string;
  price?: number;
  salecode_name?: string;
  curverid_buyer_number?: number;
}

// Define the structure for the form state
interface BuyerFormState {
    buyer: string;
    buyerGrade: string;
    price: string;
    saleCode: string;
    buyerNumber: string;
}

const BuyerDetailsScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [barcode, setBarcode] = useState('');
  const [baleData, setBaleData] = useState<BaleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState<BuyerFormState>({
    buyer: '',
    buyerGrade: '',
    price: '',
    saleCode: '',
    buyerNumber: '',
  });
  const [buyers, setBuyers] = useState<any[]>([]);
  const [buyerGrades, setBuyerGrades] = useState<any[]>([]);
  const [saleCodes, setSaleCodes] = useState<any[]>([]);
  const [buyingStaff, setBuyingStaff] = useState<any[]>([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  
  // Search text states for type-to-search dropdowns
  const [buyerSearchText, setBuyerSearchText] = useState('');
  const [buyerGradeSearchText, setBuyerGradeSearchText] = useState('');
  const [saleCodeSearchText, setSaleCodeSearchText] = useState('');
  const [buyerNumberSearchText, setBuyerNumberSearchText] = useState('');
  
  // Selected items for type-to-search dropdowns
  const [selectedBuyer, setSelectedBuyer] = useState<{ id: string; buyer_code?: string } | null>(null);
  const [selectedBuyerGrade, setSelectedBuyerGrade] = useState<{ id: string; grade?: string } | null>(null);
  const [selectedSaleCode, setSelectedSaleCode] = useState<{ id: string; name?: string } | null>(null);
  const [selectedBuyingStaff, setSelectedBuyingStaff] = useState<{ id: string; buyer_number?: string } | null>(null);
  const [hasInitializedForm, setHasInitializedForm] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  // Session-based persistence fallback when AsyncStorage is not available
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

  // Load dropdown options from PowerSync
  useEffect(() => {
    const loadOptions = async () => {
      try {
        // Load buyers
        const buyersResult = await powersync.getAll<any>(
          'SELECT id, buyer_code FROM buyers_buyer ORDER BY buyer_code'
        );
        setBuyers(buyersResult || []);

        // Load sale codes
        const saleCodesResult = await powersync.getAll<any>(
          'SELECT id, name FROM data_processing_salecode ORDER BY name'
        );
        setSaleCodes(saleCodesResult || []);

        // Load buying staff
        const buyingStaffResult = await powersync.getAll<any>(
          'SELECT id, buyer_number FROM buyers_buying_staff ORDER BY buyer_number'
        );
        setBuyingStaff(buyingStaffResult || []);
        console.log(`📋 Loaded ${buyersResult?.length || 0} buyers, ${saleCodesResult?.length || 0} sale codes, ${buyingStaffResult?.length || 0} buying staff`);
      } catch (e) {
        console.error('Failed to load dropdown options:', e);
        setBuyers([]);
        setSaleCodes([]);
        setBuyingStaff([]);
      }
    };
    loadOptions();
  }, []);

  // Load persisted buyer number when buying staff are loaded
  useEffect(() => {
    const loadPersistedBuyerNumber = async () => {
      try {
        let persisted: string | null = null;
        
        // Try AsyncStorage first
        if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
          persisted = await AsyncStorage.getItem(BUYER_NUMBER_STORAGE_KEY);
          console.log('📋 Attempting to load buyer number from AsyncStorage, found:', persisted);
        }
        
        // Fallback to session storage if AsyncStorage is not available
        if (!persisted && sessionPersistedBuyerNumber) {
          persisted = sessionPersistedBuyerNumber;
          console.log('📋 Using session-persisted buyer number:', persisted);
        }
        
        if (persisted && typeof persisted === 'string' && persisted.trim() !== '' && buyingStaff.length > 0) {
          // Try to find and set the selected buying staff from the persisted value
          const staff = buyingStaff.find(bs => String(bs.buyer_number) === persisted.trim());
          if (staff) {
            setFormState(prevState => ({ ...prevState, buyerNumber: String(staff.buyer_number) }));
            setBuyerNumberSearchText(String(staff.buyer_number));
            setSelectedBuyingStaff({ id: String(staff.id), buyer_number: staff.buyer_number });
            console.log('📋 Successfully loaded and matched persisted buyer number:', staff.buyer_number);
          } else {
            // Persisted value doesn't match any buying staff - clear it
            console.log('📋 Persisted buyer number not found in list, clearing:', persisted);
            setFormState(prevState => ({ ...prevState, buyerNumber: '' }));
            setBuyerNumberSearchText('');
            setSelectedBuyingStaff(null);
          }
        } else if (buyingStaff.length === 0) {
          console.log('📋 Buying staff not loaded yet, will retry when available');
        }
      } catch (e) {
        console.error('📋 Failed to load persisted buyer number:', e);
      }
    };
    loadPersistedBuyerNumber();
  }, [buyingStaff, sessionPersistedBuyerNumber]);

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
        }
      } else {
        setBuyerGrades([]);
      }
    };
    loadBuyerGrades();
  }, [selectedBuyerId]);

  // Set selectedBuyerId whenever the selected buyer changes
  // Only update if formState.buyer matches a buyer code (don't interfere with user typing)
  useEffect(() => {
    if (selectedBuyer) {
      setSelectedBuyerId(selectedBuyer.id);
    } else if (formState.buyer && buyers.length > 0 && hasInitializedForm) {
      // Only try to match if form has been initialized (to avoid interfering with user input)
      const buyer = buyers.find(b => b.buyer_code === formState.buyer);
      setSelectedBuyerId(buyer ? String(buyer.id) : null);
    } else {
      setSelectedBuyerId(null);
    }
  }, [selectedBuyer, formState.buyer, buyers, hasInitializedForm]);

  useEffect(() => {
    const scannedBarcode = params.scannedBarcode as string;
    if (scannedBarcode) {
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
        const staff = buyingStaff.find(bs => String(bs.buyer_number) === value || String(bs.id) === value);
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
          if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
            persisted = await AsyncStorage.getItem(BUYER_NUMBER_STORAGE_KEY);
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

  // Reset hasInitializedForm when baleData changes (new bale scanned)
  useEffect(() => {
    if (baleData) {
      setHasInitializedForm(false);
    }
  }, [baleData?.id]);

  useEffect(() => {
    // Pre-fill the form when baleData is loaded (only once per baleData change)
    // This effect only runs once per bale - after that, user can freely edit without interference
    if (baleData && !hasInitializedForm && buyers.length > 0) {
      // Use buyer_code from database, default to "CP4" if not set
      const buyerCode = baleData.buyer_code || 'CP4';
      const buyerGrade = baleData.buyer_grade_grade || '';
      const saleCode = baleData.salecode_name || '';
      
      // Get buyer number from the sync effect (it should already be set)
      const currentBuyerNumber = buyerNumberSearchText || '';
      
      setFormState(prevState => ({
        buyer: buyerCode,
        buyerGrade: buyerGrade,
        price: baleData.price?.toString() || '',
        saleCode: saleCode,
        buyerNumber: currentBuyerNumber, // Use buyerNumber from sync effect
      }));
      
      // Set search texts and selected items from database values
      setBuyerSearchText(buyerCode);
      setBuyerGradeSearchText(buyerGrade);
      setSaleCodeSearchText(saleCode);
      // buyerNumberSearchText is already set by the sync effect above
      
      // Find and set selected buyer from database (or default to CP4)
      if (buyerCode) {
        const buyer = buyers.find(b => b.buyer_code === buyerCode);
        if (buyer) {
          setSelectedBuyer({ id: String(buyer.id), buyer_code: buyer.buyer_code });
          setSelectedBuyerId(String(buyer.id));
        } else {
          setSelectedBuyer(null);
          setSelectedBuyerId(null);
        }
      } else {
        setSelectedBuyer(null);
        setSelectedBuyerId(null);
      }
      
      // Mark as initialized - this prevents this effect from running again
      // User can now freely edit without it resetting
      setHasInitializedForm(true);
    }
  }, [baleData, buyers, hasInitializedForm, buyerNumberSearchText]);

  // Update buyer grade and sale code selections when they become available
  useEffect(() => {
    if (baleData && hasInitializedForm) {
      const buyerGrade = baleData.buyer_grade_grade || '';
      const saleCode = baleData.salecode_name || '';
      
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
    }
  }, [baleData, buyerGrades, saleCodes, hasInitializedForm]);

  const resetState = (keepBarcode = false) => {
    if (!keepBarcode) setBarcode('');
    setBaleData(null);
    setError(null);
    setFormState({ buyer: '', buyerGrade: '', price: '', saleCode: '', buyerNumber: '' });
    setBuyerSearchText('');
    setBuyerGradeSearchText('');
    setSaleCodeSearchText('');
    setBuyerNumberSearchText('');
    setSelectedBuyer(null);
    setSelectedBuyerGrade(null);
    setSelectedSaleCode(null);
    setSelectedBuyingStaff(null);
    setHasInitializedForm(false);
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
          rb.buyer as buyer_id,
          rb.buyer_grade as buyer_grade_id,
          rb.salecode_id,
          gdn.grower_number,
          tg.name as timb_grade_name,
          b.buyer_code,
          bg.grade as buyer_grade_grade,
          rb.price,
          cs.name as salecode_name,
          rb.curverid_buyer_number
        FROM receiving_bale AS rb
        LEFT JOIN receiving_grower_delivery_note AS gdn ON rb.grower_delivery_note_id = gdn.id
        LEFT JOIN floor_maintenance_timb_grade AS tg ON rb.timb_grade = tg.id
        LEFT JOIN buyers_buyer AS b ON rb.buyer = b.id
        LEFT JOIN buyers_grade AS bg ON rb.buyer_grade = bg.id
        LEFT JOIN data_processing_salecode AS cs ON rb.salecode_id = cs.id
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
    // Validation: Buyer, Buyer Number, Buyer Grade, and Price are required
    if (!baleData) {
      setError("Please scan a bale first.");
      Alert.alert('Validation Error', 'Please scan a bale first.');
      return;
    }
    
    if (!selectedBuyer) {
      setError("Please select a buyer.");
      Alert.alert('Validation Error', 'Buyer is required.');
      return;
    }
    
    if (!selectedBuyingStaff) {
      setError("Please select a buyer number.");
      Alert.alert('Validation Error', 'Buyer number is required.');
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
    
    Keyboard.dismiss(); // Dismiss keyboard before saving
    setIsSaving(true);
    setError(null);
  
    try {
      // Find IDs from the selected values
      const buyer = buyers.find(b => b.buyer_code === formState.buyer);
      const buyerGrade = buyerGrades.find(bg => bg.grade === formState.buyerGrade);
      const saleCode = saleCodes.find(sc => sc.name === formState.saleCode);

      const buyerId = buyer ? buyer.id : null;
      const buyerGradeId = buyerGrade ? buyerGrade.id : null;
      const saleCodeId = saleCode ? saleCode.id : null; // Sale code is optional
      const buyerNumberId = selectedBuyingStaff ? parseInt(selectedBuyingStaff.id, 10) : null;

      // 1. Save locally to PowerSync first
      try {
        const now = new Date().toISOString();
        await powersync.execute(
          `UPDATE receiving_bale 
           SET buyer = ?, 
               buyer_grade = ?, 
               salecode_id = ?, 
               price = ?,
               curverid_buyer_number = ?,
               write_date = ?
           WHERE barcode = ? OR id = ?`,
          [
            buyerId,
            buyerGradeId,
            saleCodeId,
            priceValue,
            buyerNumberId,
            now,
            baleData.barcode,
            baleData.id
          ]
        );
        console.log('✅ Buyer details saved locally to PowerSync');
      } catch (localError) {
        console.error('⚠️ Failed to save locally:', localError);
        // Continue with server save even if local save fails
      }

      // Persist buyer number after successful save (like classification.tsx)
      const buyerNumberToPersist = String(selectedBuyingStaff.buyer_number || selectedBuyingStaff.id).trim();
      try {
        if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
          await AsyncStorage.setItem(BUYER_NUMBER_STORAGE_KEY, buyerNumberToPersist);
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

      // Refresh bale data to get updated values
      await fetchBaleData(baleData.barcode);

      // Build success message with saved details
      const savedDetails: string[] = [];
      if (formState.buyer) savedDetails.push(`Buyer: ${formState.buyer}`);
      if (formState.buyerGrade) savedDetails.push(`Buyer Grade: ${formState.buyerGrade}`);
      if (selectedBuyingStaff?.buyer_number) savedDetails.push(`Buyer Number: ${selectedBuyingStaff.buyer_number}`);
      if (formState.price) savedDetails.push(`Price: ${formState.price}`);
      if (formState.saleCode) savedDetails.push(`Sale Code: ${formState.saleCode}`);
      
      const detailsText = savedDetails.length > 0 
        ? savedDetails.join('\n')
        : 'No details were updated.';
      
      Alert.alert(
        '✅ Success!',
        `Buyer details saved successfully!\n\n${detailsText}\n\n.`,
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
      Alert.alert('Error', `Failed to save buyer details: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const openScanner = () => {
    router.push({
      pathname: '/(app)/datacapturing/barcode-scanner',
      params: { returnTo: '/(app)/datacapturing/buyer-details' }
    });
  };

  const handleFormChange = (name: keyof BuyerFormState, value: string) => {
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
    // Update search text immediately - this is what the user sees
    setBuyerSearchText(text);
    
    // Update form state
    setFormState(prevState => ({ ...prevState, buyer: text }));
    
    // Clear selection if text doesn't match selected buyer or is empty
    if (!text || (selectedBuyer && text !== (selectedBuyer.buyer_code || selectedBuyer.id))) {
      setSelectedBuyer(null);
      if (!text) {
        // Clear buyer grade when buyer is cleared
        setFormState(prevState => ({ ...prevState, buyer: '', buyerGrade: '' }));
        setBuyerGradeSearchText('');
        setSelectedBuyerGrade(null);
      }
    }
    // Don't auto-select on exact match - let user click to select
    // This allows the dropdown to stay visible while typing
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
    // Don't auto-select on exact match - let user click to select
    // This allows the dropdown to stay visible while typing
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
    // Don't auto-select on exact match - let user click to select
    // This allows the dropdown to stay visible while typing
  };

  const handleBuyingStaffSelect = (item: any) => {
    // Always use the buyer_number string, never the ID
    const buyerNumber = item.buyer_number ? String(item.buyer_number) : '';
    setFormState(prevState => ({ ...prevState, buyerNumber: buyerNumber }));
    setBuyerNumberSearchText(buyerNumber);
    setSelectedBuyingStaff({ id: String(item.id), buyer_number: item.buyer_number });

    // Persist the buyer number for future bales
    const valueToPersist = String(item.buyer_number || buyerNumber).trim();
    
    // Try AsyncStorage first
    try {
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        AsyncStorage.setItem(BUYER_NUMBER_STORAGE_KEY, valueToPersist)
          .then(() => {
            console.log('📋 Successfully persisted buyer number to AsyncStorage:', valueToPersist);
          })
          .catch((e: any) => {
            console.error('📋 Failed to persist buyer number to AsyncStorage:', e);
            // Fallback to session storage
            setSessionPersistedBuyerNumber(valueToPersist);
            console.log('📋 Fallback: Persisted buyer number to session state:', valueToPersist);
          });
      } else {
        // Fallback to session storage
        setSessionPersistedBuyerNumber(valueToPersist);
        console.log('📋 AsyncStorage not available, using session state for buyer number:', valueToPersist);
      }
    } catch (e) {
      console.error('📋 Error persisting buyer number:', e);
      // Fallback to session storage
      setSessionPersistedBuyerNumber(valueToPersist);
      console.log('📋 Fallback: Persisted buyer number to session state:', valueToPersist);
    }
  };

  const handleBuyingStaffChange = (text: string) => {
    setBuyerNumberSearchText(text);
    // Clear selection if text doesn't match selected buying staff's buyer_number (not ID)
    if (selectedBuyingStaff && text !== String(selectedBuyingStaff.buyer_number || '')) {
      setSelectedBuyingStaff(null);
      setFormState(prevState => ({ ...prevState, buyerNumber: text }));
    }
    
    // If text matches a buyer number, auto-select it (like classification.tsx does)
    if (text && buyingStaff.length > 0) {
      const matchedStaff = buyingStaff.find(bs => 
        String(bs.buyer_number).toLowerCase() === text.toLowerCase()
      );
      if (matchedStaff) {
        handleBuyingStaffSelect(matchedStaff);
      }
    }
    // Don't auto-select on exact match - let user click to select
    // This allows the dropdown to stay visible while typing
  };

  return (
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
        
        {/* Barcode Scanner Input */}
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

        {/* Bale Details and Form */}
        {baleData && (
          <View>
              <View className="bg-white p-4 rounded-lg shadow-md mb-4">
                  <Text className="text-lg font-bold text-[#65435C] mb-2">Bale Details</Text>
                  <View className="flex-row justify-between mb-1"><Text className="font-semibold text-gray-600">Barcode:</Text><Text>{baleData.barcode}</Text></View>
                  <View className="flex-row justify-between mb-1"><Text className="font-semibold text-gray-600">Grower No:</Text><Text>{baleData.grower_number}</Text></View>
                  <View className="flex-row justify-between mb-1"><Text className="font-semibold text-gray-600">Mass:</Text><Text>{baleData.mass} kg</Text></View>
                  <View className="flex-row justify-between"><Text className="font-semibold text-gray-600">TIMB Grade:</Text><Text>{baleData.timb_grade_name || 'N/A'}</Text></View>
              </View>

              <View className="bg-white p-4 rounded-lg shadow-md">
                  <Text className="text-lg font-semibold mb-2 text-gray-700">Enter Buyer Details</Text>
                  
                  <Text className="font-semibold text-gray-600 mb-1">Buyer</Text>
                  <TextInput
                    className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                      placeholderTextColor="#9CA3AF"
                      style={{ color: '#111827' }}
                    placeholder="Type to search buyer code (e.g. CP4)..."
                    value={buyerSearchText}
                    onChangeText={handleBuyerChange}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {buyerSearchText.trim().length > 0 && !selectedBuyer && (
                    <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white">
                      <ScrollView 
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                      >
                        {(() => {
                          const filtered = buyers.filter((b) => {
                            const buyerCode = (b.buyer_code || String(b.id || '')).toString().toLowerCase();
                            const searchText = buyerSearchText.toLowerCase().trim();
                            return buyerCode.includes(searchText);
                          });
                          
                          if (filtered.length === 0) {
                            return (
                              <Text className="text-gray-500 text-center py-3">
                                No buyers found.
                              </Text>
                            );
                          }
                          
                          return filtered.slice(0, 25).map((b) => (
                            <TouchableOpacity
                              key={b.id || `buyer-${b.buyer_code}`}
                              className="p-3 border-b border-gray-100 bg-white active:bg-gray-50"
                              onPress={() => handleBuyerSelect(b)}
                            >
                              <Text className="text-base text-gray-900">
                                {b.buyer_code || String(b.id || 'Unknown')}
                              </Text>
                            </TouchableOpacity>
                          ));
                        })()}
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
                    onChangeText={handleBuyingStaffChange}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {buyerNumberSearchText.trim().length > 0 && !selectedBuyingStaff && (
                    <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white">
                      <ScrollView 
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                      >
                        {(() => {
                          const filtered = buyingStaff.filter((bs) => {
                            const buyerNumber = (bs.buyer_number || String(bs.id || '')).toString().toLowerCase();
                            const searchText = buyerNumberSearchText.toLowerCase().trim();
                            return buyerNumber.includes(searchText);
                          });
                          
                          if (filtered.length === 0) {
                            return (
                              <Text className="text-gray-500 text-center py-3">
                                No buyer numbers found.
                              </Text>
                            );
                          }
                          
                          return filtered.slice(0, 25).map((bs) => (
                            <TouchableOpacity
                              key={bs.id || `buyingstaff-${bs.buyer_number}`}
                              className="p-3 border-b border-gray-100 bg-white active:bg-gray-50"
                              onPress={() => handleBuyingStaffSelect(bs)}
                            >
                              <Text className="text-base text-gray-900">
                                {bs.buyer_number || String(bs.id || 'Unknown')}
                              </Text>
                            </TouchableOpacity>
                          ));
                        })()}
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
                  {buyerGradeSearchText.trim().length > 0 && !selectedBuyerGrade && (
                    <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white">
                      <ScrollView 
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                      >
                        {(() => {
                          const filtered = buyerGrades.filter((bg) => {
                            const gradeName = (bg.grade || String(bg.id || '')).toString().toLowerCase();
                            const searchText = buyerGradeSearchText.toLowerCase().trim();
                            return gradeName.includes(searchText);
                          });
                          
                          if (filtered.length === 0) {
                            return (
                              <Text className="text-gray-500 text-center py-3">
                                No buyer grades found.
                              </Text>
                            );
                          }
                          
                          return filtered.slice(0, 25).map((bg) => (
                            <TouchableOpacity
                              key={bg.id || `grade-${bg.grade}`}
                              className="p-3 border-b border-gray-100 bg-white active:bg-gray-50"
                              onPress={() => handleBuyerGradeSelect(bg)}
                            >
                              <Text className="text-base text-gray-900">
                                {bg.grade || String(bg.id || 'Unknown')}
                              </Text>
                            </TouchableOpacity>
                          ));
                        })()}
                      </ScrollView>
                    </View>
                  )}
                  
                  <View className="mb-3" />
                  
                  <Text className="font-semibold text-gray-600 mb-1">Price</Text>
                  <TextInput 
                    className="border border-gray-300 rounded-md p-2 mb-3" 
                    placeholder="Price" 
                    placeholderTextColor="#9CA3AF"
                    style={{ color: '#111827' }}
                    value={formState.price} 
                    onChangeText={(val) => handleFormChange('price', val)} 
                    keyboardType="numeric" 
                  />
                  
                  <Text className="font-semibold text-gray-600 mb-1">Sale Code</Text>
                  <TextInput
                    className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-base"
                      placeholderTextColor="#9CA3AF"
                      style={{ color: '#111827' }}
                    placeholder="Type to search sale code..."
                    value={saleCodeSearchText}
                    onChangeText={handleSaleCodeChange}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {saleCodeSearchText.trim().length > 0 && !selectedSaleCode && (
                    <View className="max-h-48 border border-gray-200 rounded-lg mt-2 bg-white">
                      <ScrollView 
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                      >
                        {(() => {
                          const filtered = saleCodes.filter((sc) => {
                            const saleCodeName = (sc.name || String(sc.id || '')).toString().toLowerCase();
                            const searchText = saleCodeSearchText.toLowerCase().trim();
                            return saleCodeName.includes(searchText);
                          });
                          
                          if (filtered.length === 0) {
                            return (
                              <Text className="text-gray-500 text-center py-3">
                                No sale codes found.
                              </Text>
                            );
                          }
                          
                          return filtered.slice(0, 25).map((sc) => (
                            <TouchableOpacity
                              key={sc.id || `salecode-${sc.name}`}
                              className="p-3 border-b border-gray-100 bg-white active:bg-gray-50"
                              onPress={() => handleSaleCodeSelect(sc)}
                            >
                              <Text className="text-base text-gray-900">
                                {sc.name || String(sc.id || 'Unknown')}
                              </Text>
                            </TouchableOpacity>
                          ));
                        })()}
                      </ScrollView>
                    </View>
                  )}
                  
                  <View className="mb-4" />
                  
                  <TouchableOpacity onPress={handleSave} className={`p-3 rounded-md ${isSaving ? 'bg-gray-400' : 'bg-[#65435C]'}`} disabled={isSaving}>
                      <Text className="text-white text-center font-bold">{isSaving ? 'Saving...' : 'Save Details'}</Text>
                  </TouchableOpacity>
              </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default BuyerDetailsScreen;
