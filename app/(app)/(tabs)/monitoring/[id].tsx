import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Alert, Platform } from 'react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { powersync, setupPowerSync } from '@/powersync/system';
import { SurveyQuestionRecord } from '@/powersync/Schema';
import { Calendar, Save } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as Crypto from 'expo-crypto'; // Still needed for line UUIDs
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';

const SurveyResponse = () => {
    const { id, registerId, surveyTitle } = useLocalSearchParams()
    const [questions, setQuestions] = useState<SurveyQuestionRecord[]>([])
    const [responses, setResponses] = useState<{[key: string]: any}>({})
    const [loading, setLoading] = useState(true)
    const [questionAnswers, setQuestionAnswers] = useState<{[key: string]: any[]}>({}) // Store answers grouped by question_id
    const [showDatePicker, setShowDatePicker] = useState<{[key: string]: boolean}>({}) // Track which date pickers are visible
    const [productionCycleValue, setProductionCycleValue] = useState('')
    const [productionCycleRegValue, setProductionCycleRegValue] = useState('')
    const [productionCycleReg, setProductionCycleReg] = useState<any[]>([])
    const [latitude, setLatitude] = useState('')
    const [longitude, setLongitude] = useState('')
    const [surveyRegister, setSurveyRegister] = useState<any[]>([])
    const [currentSurveyRegister, setCurrentSurveyRegister] = useState<any>(null)
    const randomID = Math.floor(Math.random() * 1000000); // Random integer ID for local use

    const getEmployeeId = async () => {
        const employeeId = await SecureStore.getItemAsync('odoo_employee_id')
        return employeeId || '148' // fallback to default
    }

    //     const handleProductionCycleChange = async (text: string) => {
    //     console.log('handleProductionCycleChange called with:', text)
        
    //     // Remove CY prefix if it exists and ensure it starts with CY
    //     let cleanText = text.replace(/^CY/i, '')
    //     let prefixedText = `CY${cleanText}`
        
    //     console.log('prefixedText', prefixedText)
        
    //     setProductionCycleValue(prefixedText)
        
    //     // Get employee ID first, then use it in parameterized query
    //     const employeeId = await getEmployeeId()
    //     const productionCycleReg = await powersync.getAll(`
    //         SELECT pcr.id, pcr.grower_name, pcr.production_cycle_name, g.grower_number 
    //         FROM odoo_gms_production_cycle_registration pcr 
    //         JOIN odoo_gms_grower g ON pcr.grower_id = g.id 
    //         WHERE pcr.field_technician_id = ? AND pcr.production_cycle_name LIKE ?
    //     `, [employeeId, `%${prefixedText}%`])
    //     console.log('productionCycleReg query result:', productionCycleReg)
    //     setProductionCycleReg(productionCycleReg)
    // }

    useFocusEffect (useCallback(() => {
        console.log('useEffect SurveyResponse Screen')
        const fetchSurveyData = async () => {
            const employeeId = await getEmployeeId()
            // Fetch Survey Register
            const surveyRegister = await powersync.getAll(`SELECT id, grower_name, grower_number, production_cycle_id, production_cycle_registration_id FROM survey_register WHERE c010_status = 'draft' AND employee_id = ${employeeId} AND survey_id = ${id}`)
            console.log('surveyRegister', surveyRegister)
            console.log('Survey ID', id)
            console.log('Register ID', registerId)
            setSurveyRegister(surveyRegister)
            
            // If registerId is provided, pre-select that register
            if (registerId && surveyRegister.length > 0) {
                const selectedRegister = surveyRegister.find((register: any) => register.id === registerId)
                if (selectedRegister) {
                    console.log('Pre-selecting register:', selectedRegister)
                    setCurrentSurveyRegister(selectedRegister)
                }
            }

            // Fetch questions
            const questions = await powersync.getAll(`SELECT id, survey_id, question_type, title FROM survey_question WHERE survey_id = ${id}`)
            console.log('questions', questions)
            setQuestions(questions as SurveyQuestionRecord[])
            
            // Fetch question answers for choice-based questions
            const answers = await powersync.getAll(`SELECT id, question_id, value FROM survey_question_answer`)
            console.log('survey_question_answer', answers)
            
            // Group answers by question_id
            const answersGrouped: {[key: string]: any[]} = {}
            answers.forEach((answer: any) => {
                const questionId = answer.question_id?.toString()
                if (questionId) {
                    if (!answersGrouped[questionId]) {
                        answersGrouped[questionId] = []
                    }
                    answersGrouped[questionId].push(answer)
                }
            })
            
            setQuestionAnswers(answersGrouped)
            
            // Fetch initial production cycle registrations
            // const employeeId = await getEmployeeId()
            // const allProductionCycles = await powersync.getAll(`
            //     SELECT pcr.id, pcr.grower_name, pcr.production_cycle_name, g.grower_number 
            //     FROM odoo_gms_production_cycle_registration pcr 
            //     JOIN odoo_gms_grower g ON pcr.grower_id = g.id 
            //     WHERE pcr.field_technician_id = ?
            // `, [employeeId])
            // console.log('Initial production cycles:', allProductionCycles)
            // setProductionCycleReg(allProductionCycles)
            
            setLoading(false)
        }
        fetchSurveyData()
    }, []))

    // Parse question title JSON
    const parseTitle = (title: string | null) => {
        if (!title) return 'Untitled Question';
        try {
            const titleObj = JSON.parse(title);
            return titleObj.en_US || titleObj.en_GB || Object.values(titleObj)[0] || 'Untitled Question';
        } catch (e) {
            return title || 'Untitled Question';
        }
    }

    // Parse answer value JSON (same logic as title)
    const parseValue = (value: string | null) => {
        if (!value) return 'Untitled Option';
        try {
            const valueObj = JSON.parse(value);
            return valueObj.en_US || valueObj.en_GB || Object.values(valueObj)[0] || 'Untitled Option';
        } catch (e) {
            return value || 'Untitled Option';
        }
    }

    // Handle response changes
    const handleResponseChange = (questionId: string, value: any) => {
        setResponses(prev => ({
            ...prev,
            [questionId]: value
        }))
    }

    // Format date for display
    const formatDate = (date: Date, includeTime: boolean = false) => {
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }
        
        if (includeTime) {
            options.hour = '2-digit'
            options.minute = '2-digit'
        }
        
        return date.toLocaleDateString('en-US', options)
    }



    // Show date picker
    const showDatePickerModal = (questionId: string) => {
        // For Android, ensure any existing picker is closed first
        if (Platform.OS === 'android') {
            setShowDatePicker(prev => {
                const newState = { ...prev }
                // Close all other pickers
                Object.keys(newState).forEach(key => {
                    newState[key] = false
                })
                return newState
            })
            
            // Small delay to ensure previous picker is fully dismissed
            setTimeout(() => {
                setShowDatePicker(prev => ({
                    ...prev,
                    [questionId]: true
                }))
            }, 100)
        } else {
            setShowDatePicker(prev => ({
                ...prev,
                [questionId]: true
            }))
        }
    }

    // Render different input types based on question_type
    const renderQuestionInput = (question: SurveyQuestionRecord) => {
        const questionId = question.id.toString()
        const currentValue = responses[questionId] || ''
        const questionType = question.question_type || 'text_box'

        switch (questionType) {
            case 'text_box':
            case 'char_box':
                return (
                    <TextInput
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-base"
                        placeholder="Enter your answer..."
                        value={currentValue}
                        onChangeText={(text) => handleResponseChange(questionId, text)}
                        multiline={questionType === 'text_box'}
                        numberOfLines={questionType === 'text_box' ? 4 : 1}
                    />
                )

            case 'numerical_box':
                return (
                    <TextInput
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-base"
                        placeholder="Enter a number..."
                        value={currentValue}
                        onChangeText={(text) => handleResponseChange(questionId, text)}
                        keyboardType="numeric"
                    />
                )

            case 'yes_no':
                return (
                    <View className="flex-row gap-4">
                        <TouchableOpacity
                            className={`flex-1 p-3 rounded-lg border-2 ${currentValue === 'yes' ? 'bg-green-100 border-green-500' : 'bg-gray-50 border-gray-200'}`}
                            onPress={() => handleResponseChange(questionId, 'yes')}
                        >
                            <Text className={`text-center font-semibold ${currentValue === 'yes' ? 'text-green-700' : 'text-gray-600'}`}>
                                Yes
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 p-3 rounded-lg border-2 ${currentValue === 'no' ? 'bg-red-100 border-red-500' : 'bg-gray-50 border-gray-200'}`}
                            onPress={() => handleResponseChange(questionId, 'no')}
                        >
                            <Text className={`text-center font-semibold ${currentValue === 'no' ? 'text-red-700' : 'text-gray-600'}`}>
                                No
                            </Text>
                        </TouchableOpacity>
                    </View>
                )

            case 'simple_choice':
                const simpleChoices = questionAnswers[questionId] || []
                return (
                    <View className="gap-2">
                        {simpleChoices.map((choice) => {
                            const parsedValue = parseValue(choice.value)
                            const isSelected = currentValue === choice.id // Compare with choice.id instead of choice.value
                            return (
                                <TouchableOpacity
                                    key={choice.id}
                                    className={`p-3 rounded-lg border-2 ${isSelected ? 'bg-blue-100 border-blue-500' : 'bg-gray-50 border-gray-200'}`}
                                    onPress={() => handleResponseChange(questionId, choice.id)} // Store choice.id instead of choice.value
                                >
                                    <Text className={`font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                                        {parsedValue}
                                    </Text>
                                </TouchableOpacity>
                            )
                        })}
                        {simpleChoices.length === 0 && (
                            <Text className="text-gray-500 italic">No options available</Text>
                        )}
                    </View>
                )

            case 'multiple_choice':
                const multipleChoices = questionAnswers[questionId] || []
                const selectedChoices = currentValue || []
                return (
                    <View className="gap-2">
                        {multipleChoices.map((choice) => {
                            const parsedValue = parseValue(choice.value)
                            const isSelected = selectedChoices.includes(choice.id) // Compare with choice.id instead of choice.value
                            return (
                                <TouchableOpacity
                                    key={choice.id}
                                    className={`p-3 rounded-lg border-2 ${isSelected ? 'bg-purple-100 border-purple-500' : 'bg-gray-50 border-gray-200'}`}
                                    onPress={() => {
                                        const newSelections = selectedChoices.includes(choice.id)
                                            ? selectedChoices.filter((c: any) => c !== choice.id) // Filter out choice.id
                                            : [...selectedChoices, choice.id] // Add choice.id
                                        handleResponseChange(questionId, newSelections)
                                    }}
                                >
                                    <Text className={`font-semibold ${isSelected ? 'text-purple-700' : 'text-gray-600'}`}>
                                        {parsedValue}
                                    </Text>
                                </TouchableOpacity>
                            )
                        })}
                        {multipleChoices.length === 0 && (
                            <Text className="text-gray-500 italic">No options available</Text>
                        )}
                    </View>
                )

            case 'scale':
                const scaleValues = [1, 2, 3, 4, 5]
                return (
                    <View className="flex-row justify-between gap-2">
                        {scaleValues.map((value) => (
                            <TouchableOpacity
                                key={value}
                                className={`flex-1 p-3 rounded-lg border-2 ${currentValue === value ? 'bg-orange-100 border-orange-500' : 'bg-gray-50 border-gray-200'}`}
                                onPress={() => handleResponseChange(questionId, value)}
                            >
                                <Text className={`text-center font-bold ${currentValue === value ? 'text-orange-700' : 'text-gray-600'}`}>
                                    {value}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )

            case 'date':
            case 'datetime':
                const currentDate = currentValue ? new Date(currentValue) : new Date()
                const displayText = currentValue 
                    ? formatDate(new Date(currentValue), questionType === 'datetime')
                    : `Select ${questionType === 'datetime' ? 'date & time' : 'date'}`
                
                return (
                    <View>
                        <TouchableOpacity
                            className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex-row items-center gap-2"
                            onPress={() => showDatePickerModal(questionId)}
                        >
                            <Calendar size={20} color="#65435C" />
                            <Text className={`text-base ${currentValue ? 'text-gray-800' : 'text-gray-600'}`}>
                                {displayText}
                            </Text>
                        </TouchableOpacity>
                        
                        {showDatePicker[questionId] && Platform.OS === 'ios' && (
                            <DateTimePicker
                                value={currentDate}
                                mode={questionType === 'datetime' ? 'datetime' : 'date'}
                                display="spinner"
                                onChange={(event, selectedDate) => {
                                    // For iOS, we handle this in the Done button
                                }}
                            />
                        )}
                        
                        {showDatePicker[questionId] && Platform.OS === 'android' && (
                            <DateTimePicker
                                value={currentDate}
                                mode={questionType === 'datetime' ? 'datetime' : 'date'}
                                display="default"
                                onChange={(event, selectedDate) => {
                                    // Always hide the picker first for Android
                                    setShowDatePicker(prev => ({ ...prev, [questionId]: false }))
                                    
                                    // Handle the date selection only if user confirmed
                                    if (event.type === 'set' && selectedDate) {
                                        const dateValue = questionType === 'datetime' 
                                            ? selectedDate.toISOString() 
                                            : selectedDate.toISOString().split('T')[0]
                                        handleResponseChange(questionId, dateValue)
                                    }
                                }}
                            />
                        )}
                        
                        {Platform.OS === 'ios' && showDatePicker[questionId] && (
                            <View className="flex-row gap-2 mt-2">
                                <TouchableOpacity
                                    className="flex-1 bg-gray-200 rounded-lg p-2"
                                    onPress={() => setShowDatePicker(prev => ({ ...prev, [questionId]: false }))}
                                >
                                    <Text className="text-center text-gray-700 font-semibold">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="flex-1 bg-[#1AD3BB] rounded-lg p-2"
                                    onPress={() => {
                                        const dateValue = questionType === 'datetime' 
                                            ? currentDate.toISOString() 
                                            : currentDate.toISOString().split('T')[0]
                                        handleResponseChange(questionId, dateValue)
                                        setShowDatePicker(prev => ({ ...prev, [questionId]: false }))
                                    }}
                                >
                                    <Text className="text-center text-white font-semibold">Done</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )

            case 'media':
                return (
                    <TouchableOpacity
                        className="bg-gray-50 border border-gray-200 rounded-lg p-6 items-center"
                        onPress={() => Alert.alert('Media Upload', 'Media picker would open here')}
                    >
                        <Text className="text-gray-600">Tap to upload media</Text>
                    </TouchableOpacity>
                )

            default:
                return (
                    <TextInput
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-base"
                        placeholder="Enter your answer..."
                        value={currentValue}
                        onChangeText={(text) => handleResponseChange(questionId, text)}
                    />
                )
        }
    }

    const handleSubmit = async () => {
        console.log('Survey responses:', responses)
        console.log('Current survey register:', currentSurveyRegister)

        if (!currentSurveyRegister || !currentSurveyRegister.id) {
            Alert.alert('Error', 'Please select a survey register')
            return
        }

        // Get location first
        await getLocation()
        
        // Then submit the survey
        await submitSurveyUserInput()
    }

        const getLocation = async () => {
        try {
            console.log('Getting Location');
            const { status } = await Location.requestForegroundPermissionsAsync();
            console.log('Location permission status:', status);
            
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                console.log('Location obtained:', location.coords.latitude, location.coords.longitude);
                setLatitude(location.coords.latitude.toString());
                setLongitude(location.coords.longitude.toString());
            } else {
                console.log('Location permission not granted, using default coordinates');
                // Don't show alert, just use default coordinates
                setLatitude('37.774929');
                setLongitude('-122.419416');
            }
        } catch (error) {
            console.error('Error getting location:', error);
            // Use default coordinates if location fails
            setLatitude('37.774929');
            setLongitude('-122.419416');
        }
    }

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center">
                <Text className="text-lg text-gray-600">Loading survey...</Text>
            </View>
        )
    }

    const submitSurveyUserInput = async () => {
        try {
            // console.log('Attempting insert with productionCycleRegValue:', productionCycleRegValue)

            // if (!productionCycleRegValue) {
            //     Alert.alert('Error', 'Please select a production cycle')
            //     return
            // }

            // Get employee ID
            const employeeId = await getEmployeeId()
            console.log('Using employee ID:', employeeId)

            const currentID = Crypto.randomUUID()
            
            // Use actual location coordinates or fallback to defaults
            const lat = latitude || '37.774929'
            const lng = longitude || '-122.419416'
            console.log('Using coordinates:', lat, lng)
            
            console.log('CURRENT ID (random integer):', currentID)

            const result = await powersync.execute(
                `INSERT INTO survey_user_input (id, survey_id, a020_reference, production_cycle_registration_id, production_cycle_id, employee_id, captured_latitude, captured_longitude, mobile_app_id, survey_register_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [currentID, id, 'SV00002', currentSurveyRegister.production_cycle_registration_id, currentSurveyRegister.production_cycle_id, employeeId, lat, lng, currentID, currentSurveyRegister.id]
            )
            console.log('survey_user_input insert result:', result)

            // Insert all survey responses

            console.log('Using currentID for survey_user_input_line:', currentID)
            for (const [key, value] of Object.entries(responses)) {
                console.log('Inserting response - key:', key, 'value:', value)
                const lineUUID = Crypto.randomUUID();
                
                // Find the question to get its type
                const question = questions.find(q => q.id.toString() === key);
                const questionType = question?.question_type || 'text_box';
                console.log('Question type for', key, ':', questionType)
                
                // Check for required values
                // if (!productionCycleRegValue) {
                //     console.error('productionCycleRegValue is null/undefined!')
                // }
                if (!employeeId) {
                    console.error('employeeId is null/undefined!')
                }
                
                // Dynamic answer type and value based on question type
                let answerType = '';
                let insertQuery = '';
                let completeParams = [];
                
                if (questionType === 'simple_choice' || questionType === 'multiple_choice') {
                    // Use suggested_answer_id for choice questions
                    answerType = 'suggestion';
                    insertQuery = `INSERT INTO survey_user_input_line (id, user_input_id, survey_id, question_id, question_sequence, suggested_answer_id, answer_type, employee_id, production_registration_cycle_id, mobile_app_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    completeParams = [
                        lineUUID,
                        9999,
                        parseInt(id as string),
                        parseInt(key),
                        0,
                        parseInt(value) || null, // suggested_answer_id
                        answerType,
                        parseInt(employeeId) || null,
                        parseInt(productionCycleRegValue) || null,
                        currentID
                    ];
                } else if (questionType === 'numerical_box') {
                    // Use value_numerical_box for numbers
                    answerType = 'numerical_box';
                    insertQuery = `INSERT INTO survey_user_input_line (id, user_input_id, survey_id, question_id, question_sequence, value_numerical_box, answer_type, employee_id, production_registration_cycle_id, mobile_app_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    completeParams = [
                        lineUUID,
                        9999,
                        parseInt(id as string),
                        parseInt(key),
                        0,
                        parseFloat(value) || null, // value_numerical_box
                        answerType,
                        parseInt(employeeId) || null,
                        parseInt(productionCycleRegValue) || null,
                        currentID
                    ];
                } else if (questionType === 'date') {
                    // Use value_date for dates
                    answerType = 'date';
                    insertQuery = `INSERT INTO survey_user_input_line (id, user_input_id, survey_id, question_id, question_sequence, value_date, answer_type, employee_id, production_registration_cycle_id, mobile_app_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    completeParams = [
                        lineUUID,
                        9999,
                        parseInt(id as string),
                        parseInt(key),
                        0,
                        value || null, // value_date
                        answerType,
                        parseInt(employeeId) || null,
                        parseInt(productionCycleRegValue) || null,
                        currentID
                    ];
                } else if (questionType === 'datetime') {
                    // Use value_datetime for datetime
                    answerType = 'datetime';
                    insertQuery = `INSERT INTO survey_user_input_line (id, user_input_id, survey_id, question_id, question_sequence, value_datetime, answer_type, employee_id, production_registration_cycle_id, mobile_app_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    completeParams = [
                        lineUUID,
                        9999,
                        parseInt(id as string),
                        parseInt(key),
                        0,
                        value || null, // value_datetime
                        answerType,
                        parseInt(employeeId) || null,
                        parseInt(productionCycleRegValue) || null,
                        currentID
                    ];
                }  else if (questionType === 'scale') {
                    // Use value_scale for scale
                    answerType = 'scale';
                    insertQuery = `INSERT INTO survey_user_input_line (id, user_input_id, survey_id, question_id, question_sequence, value_scale, answer_type, employee_id, production_registration_cycle_id, mobile_app_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    completeParams = [
                        lineUUID,
                        9999,
                        parseInt(id as string),
                        parseInt(key),
                        0,
                        value || null, // value_scale
                        answerType,
                        parseInt(employeeId) || null,
                        parseInt(productionCycleRegValue) || null,
                        currentID
                    ];
                } else {
                    // Default to value_text_box for text_box, char_box, yes_no, etc.
                    answerType = 'text_box';
                    insertQuery = `INSERT INTO survey_user_input_line (id, user_input_id, survey_id, question_id, question_sequence, value_text_box, answer_type, employee_id, production_registration_cycle_id, mobile_app_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    completeParams = [
                        lineUUID,
                        9999,
                        parseInt(id as string),
                        parseInt(key),
                        0,
                        value?.toString() || null, // value_text_box
                        answerType,
                        parseInt(employeeId) || null,
                        parseInt(productionCycleRegValue) || null,
                        currentID
                    ];
                }
                
                console.log('Dynamic insert params:', { questionType, answerType, completeParams })

                try {
                    await powersync.execute(insertQuery, completeParams)
                } catch (error) {
                    console.error('INSERT FAILED - No rows affected for line:', completeParams)
                    Alert.alert('Error', `Insert error: ${error}`)
                }
                

                // const lineResult = await powersync.execute(
                //     `INSERT INTO survey_user_input_line (id, user_input_id, survey_id, question_id, question_sequence, suggested_answer_id, answer_type, employee_id, production_registration_cycle_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                //     completeParams
                // )
                // console.log('survey_user_input_line insert result:', lineResult)
                
                // if (lineResult.rowsAffected === 0) {
                //     console.error('INSERT FAILED - No rows affected for line:', completeParams)
                // }
            }

            console.log('Final currentID before success:', currentID)
            Alert.alert('Success', 'Survey responses saved successfully!', [
                { text: 'OK', onPress: () => router.back() }
            ])

            //Get all survey_user_input_line
            const allSurveyUserInputLines = await powersync.getAll(`SELECT * FROM survey_user_input_line WHERE user_input_id = ?`, [currentID])
            console.log('allSurveyUserInputLines', allSurveyUserInputLines)

        } catch (error) {
            console.error('ACTUAL INSERT ERROR:', error)
            Alert.alert('Error', `Insert error: ${error}`)
        }
    }

    return (
        <>
            <Stack.Screen options={{ 
                // title: 'Survey Response',
                title: surveyTitle as string, 
                headerTitleStyle: {
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#65435C'
                },
                headerShown: true,
            }} />
            <View className="flex-1 bg-[#65435C]">
                <ScrollView className="flex-1 p-4">
                    {/* <View className="bg-white rounded-2xl p-4 mb-4 flex-row items-center gap-2">
                    <TextInput
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-base flex-1"
                        style={{ flex: 0.25 }}
                        placeholder="CY"
                        value={productionCycleValue || 'CY'}
                        onChangeText={(text) => handleProductionCycleChange(text)}
                    />
                    <View className="bg-gray-50 border border-gray-200 rounded-lg" style={{ flex: 0.75 }}>
                        <Picker
                            selectedValue={productionCycleRegValue}
                            onValueChange={(itemValue) => setProductionCycleRegValue(itemValue)}
                        >
                            {productionCycleReg.map((item) => (
                                <Picker.Item key={item.id} label={item.grower_number + ' - ' + item.grower_name + ' - ' + item.production_cycle_name} value={item.id} />
                            ))}
                        </Picker>
                    </View>
                    </View> */}

                    <View className="bg-gray-50 border border-gray-200 rounded-lg mb-2" style={{ flex: 0.75 }}>
                        <Picker
                            selectedValue={currentSurveyRegister}
                            onValueChange={(itemValue) => setCurrentSurveyRegister(itemValue)}
                        >
                            {surveyRegister.map((item) => (
                                <Picker.Item key={item.id} label={item.grower_name + ' - ' + item.grower_number} value={item} />
                            ))}
                        </Picker>
                    </View>
                    <View className="bg-white rounded-2xl p-4 mb-4">
                        {questions.map((question, index) => (
                            <View key={question.id} className="mb-6">
                                <Text className="text-lg font-bold text-[#65435C] mb-3">
                                    {index + 1}. {parseTitle(question.title)}
                                </Text>
                                <Text className="text-sm text-gray-500 mb-2 capitalize">
                                    {(question.question_type || 'text_box').replace('_', ' ')}
                                </Text>
                                {renderQuestionInput(question)}
                            </View>
                        ))}
                        
                        <TouchableOpacity
                            className="bg-[#1AD3BB] rounded-xl p-4 flex-row items-center justify-center gap-2 mt-4"
                            onPress={handleSubmit}
                        >
                            <Save size={20} color="white" />
                            <Text className="text-white font-bold text-lg">Submit Survey</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        </>
    )
}

export default SurveyResponse