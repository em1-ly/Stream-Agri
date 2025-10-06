import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { powersync } from '@/powersync/system';
import { CheckCircle, Clock, User, Calendar, FileText, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { CircleArrowRight, CircleArrowDown } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';

interface SurveyRegister {
    id: string;
    survey_id: number;
    production_cycle_registration_id: number;
    grower_name: string;
    grower_number: string;
    production_cycle_name?: string;
    c010_status: string;
    b030_scheduled_date?: string;
    create_date: string;
}

interface QuestionAnswer {
    question_id: number;
    question_title: string;
    question_type: string;
    answer_value: string;
    question_sequence: number;
}

interface CompletedSurveyRegister extends SurveyRegister {
    survey_input_id: string;
    completed_date: string;
    questions_answered: number;
    questions_answers?: QuestionAnswer[];
}

const SurveyRegister = () => {
    const { surveyId } = useLocalSearchParams()
    const [activeTab, setActiveTab] = useState<'outstanding' | 'completed'>('outstanding')
    const [outstandingRegisters, setOutstandingRegisters] = useState<SurveyRegister[]>([])
    const [completedRegisters, setCompletedRegisters] = useState<CompletedSurveyRegister[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [surveyTitle, setSurveyTitle] = useState('')
    const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set())
    
    // Log when expandedResponses state changes
    useEffect(() => {
        console.log('🔄 expandedResponses state changed:', Array.from(expandedResponses))
        console.log('🔄 Component should re-render now')
    }, [expandedResponses])

    const getEmployeeId = async () => {
        const employeeId = await SecureStore.getItemAsync('odoo_employee_id')
        return employeeId || '148' // fallback to default
    }

    const toggleResponseExpanded = (responseId: string) => {
        console.log('🔄 toggleResponseExpanded called with:', responseId)
        console.log('📊 Current expandedResponses:', Array.from(expandedResponses))
        
        const newExpanded = new Set(expandedResponses)
        if (newExpanded.has(responseId)) {
            newExpanded.delete(responseId)
            console.log('➖ Removed from expanded:', responseId)
        } else {
            newExpanded.add(responseId)
            console.log('➕ Added to expanded:', responseId)
        }
        
        console.log('📊 New expandedResponses:', Array.from(newExpanded))
        setExpandedResponses(newExpanded)
        console.log('✅ setExpandedResponses called')
    }

    const fetchSurveyData = async () => {
        try {
            console.log('Fetching survey registers for survey_id:', surveyId)
            
            // Get the employee ID
            const employeeId = await getEmployeeId()
            
            // Get survey title
            const surveyData = await powersync.getAll(`
                SELECT title FROM survey_survey WHERE id = ?
            `, [surveyId])
            
            if (surveyData.length > 0) {
                setSurveyTitle(parseTitle((surveyData[0] as any).title))
            }

            // Get outstanding survey registers (draft status)
            const outstanding = await powersync.getAll(`
                SELECT 
                    sr.id,
                    sr.survey_id,
                    sr.production_cycle_registration_id,
                    sr.grower_name,
                    sr.grower_number,
                    sr.c010_status,
                    sr.b030_scheduled_date,
                    sr.create_date,
                    pcr.production_cycle_name
                FROM survey_register sr
                LEFT JOIN odoo_gms_production_cycle_registration pcr ON sr.production_cycle_registration_id = pcr.id
                WHERE sr.survey_id = ? AND sr.employee_id = ? AND sr.c010_status = 'draft'
                ORDER BY sr.b030_scheduled_date ASC, sr.create_date ASC
            `, [surveyId, employeeId])
            
            console.log('Outstanding survey registers:', outstanding)
            setOutstandingRegisters(outstanding as SurveyRegister[])

            // Get completed survey registers (those with survey_user_input records)
            const completed = await powersync.getAll(`
                SELECT 
                    sr.id,
                    sr.survey_id,
                    sr.production_cycle_registration_id,
                    sr.grower_name,
                    sr.grower_number,
                    sr.c010_status,
                    sr.b030_scheduled_date,
                    sr.create_date,
                    pcr.production_cycle_name,
                    sui.id as survey_input_id,
                    sui.create_date as completed_date,
                    COUNT(suil.id) as questions_answered
                FROM survey_register sr
                LEFT JOIN odoo_gms_production_cycle_registration pcr ON sr.production_cycle_registration_id = pcr.id
                INNER JOIN survey_user_input sui ON sr.id = sui.survey_register_id
                LEFT JOIN survey_user_input_line suil ON sui.id = suil.user_input_id
                WHERE sr.survey_id = ? AND sr.employee_id = ?
                GROUP BY sr.id, sui.id
                ORDER BY sui.create_date DESC
            `, [surveyId, employeeId])

            // For each completed survey register, get the questions and answers
            const completedWithQA = await Promise.all(
                (completed as any[]).map(async (register: any) => {
                    const questionsAnswers = await powersync.getAll(`
                        SELECT 
                            suil.question_id,
                            sq.title as question_title,
                            sq.question_type,
                            suil.question_sequence,
                            CASE 
                                WHEN suil.suggested_answer_id IS NOT NULL AND sqa.value IS NOT NULL THEN sqa.value
                                WHEN suil.value_char_box IS NOT NULL THEN suil.value_char_box
                                WHEN suil.value_text_box IS NOT NULL THEN suil.value_text_box
                                WHEN suil.value_numerical_box IS NOT NULL THEN CAST(suil.value_numerical_box AS TEXT)
                                WHEN suil.value_date IS NOT NULL THEN suil.value_date
                                WHEN suil.value_datetime IS NOT NULL THEN suil.value_datetime
                                WHEN suil.value_scale IS NOT NULL THEN CAST(suil.value_scale AS TEXT)
                                ELSE 'No answer'
                            END as answer_value
                        FROM survey_user_input_line suil
                        LEFT JOIN survey_question sq ON suil.question_id = sq.id
                        LEFT JOIN survey_question_answer sqa ON suil.suggested_answer_id = sqa.id
                        WHERE suil.user_input_id = ?
                        ORDER BY suil.question_sequence ASC
                    `, [register.survey_input_id])

                    return {
                        ...register,
                        questions_answers: questionsAnswers as QuestionAnswer[]
                    }
                })
            )
            
            console.log('Completed survey registers with Q&A:', completedWithQA)
            console.log('📋 Setting completedRegisters with', completedWithQA.length, 'items')
            completedWithQA.forEach((item, index) => {
                console.log(`📋 Item ${index}: id=${item.id}, grower=${item.grower_name}, questions=${item.questions_answers?.length || 0}`)
            })
            setCompletedRegisters(completedWithQA as CompletedSurveyRegister[])
            
        } catch (error) {
            console.error('Error fetching survey registers:', error)
            Alert.alert('Error', 'Failed to fetch survey registers')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useFocusEffect(useCallback(() => {
        fetchSurveyData()
    }, [surveyId]))

    const onRefresh = useCallback(() => {
        setRefreshing(true)
        fetchSurveyData()
    }, [surveyId])

    const parseTitle = (title: string | null) => {
        if (!title) return 'Survey';
        try {
            const titleObj = JSON.parse(title);
            console.log('🔄 titleObj:', titleObj)
            return titleObj.en_US || titleObj.en_GB || Object.values(titleObj)[0] || 'Survey';
        } catch (e) {
            return title || 'Survey';
        }
    }

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'No date';
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
        } catch (e) {
            return dateString
        }
    }

    // Add a function to parse the JSON answer values
    const parseAnswerValue = (answerValue: string) => {
        if (!answerValue) return 'No answer';        
        try {
            const answerObj = JSON.parse(answerValue);
            // Try to get English variants first, then fall back to any available value

            return answerObj.en_US || answerObj.en_GB || Object.values(answerObj)[0] || answerValue;
        } catch (e) {
            // If it's not JSON, return as is
            return answerValue;
        }
    }

    const handleOutstandingRegisterPress = (register: SurveyRegister) => {
        router.push(`/monitoring/${surveyId}?registerId=${register.id}&surveyTitle=${encodeURIComponent(surveyTitle)}` as any)
    }

    const handleCompletedRegisterPress = (register: CompletedSurveyRegister) => {
        toggleResponseExpanded(register.id)
    }

    if (loading) {
        return (
            <View className="flex-1 bg-[#65435C] items-center justify-center">
                <ActivityIndicator size="large" color="#1AD3BB" />
                <Text className="text-white text-lg mt-4">Loading survey registers...</Text>
            </View>
        )
    }

    console.log('🔄 SurveyRegister component rendering, expandedResponses:', Array.from(expandedResponses))
    
    return (
        <>
            <Stack.Screen options={{ 
                // title: 'Survey Registers',
                title: surveyTitle,
                headerTitleStyle: {
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#65435C'
                },
                headerShown: true,
            }} />
            <View className="flex-1 bg-[#65435C]">
                <View className="p-4">
                    {/* <View className="bg-white rounded-2xl p-4 mb-4">
                        <Text className="text-lg font-bold text-[#65435C] mb-2">
                            {surveyTitle}
                        </Text>
                        <View className="flex-row justify-between">
                            <Text className="text-gray-600">
                                Outstanding: {outstandingRegisters.length}
                            </Text>
                            <Text className="text-gray-600">
                                Completed: {completedRegisters.length}
                            </Text>
                        </View>
                    </View> */}

                    {/* Tab Switcher */}
                    <View className="flex-row bg-gray-100 rounded-xl p-1 mb-4">
                        <TouchableOpacity
                            className={`flex-1 py-3 rounded-lg ${activeTab === 'outstanding' ? 'bg-[#65435C]' : 'bg-transparent'}`}
                            onPress={() => setActiveTab('outstanding')}
                        >
                            <View className="flex-row items-center justify-center">
                                <Clock size={16} color={activeTab === 'outstanding' ? 'white' : '#65435C'} />
                                <Text className={`text-center font-semibold ml-2 ${activeTab === 'outstanding' ? 'text-white' : 'text-[#65435C]'}`}>
                                    Outstanding: {outstandingRegisters.length}
                                </Text>
                            </View>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            className={`flex-1 py-3 rounded-lg ${activeTab === 'completed' ? 'bg-[#65435C]' : 'bg-transparent'}`}
                            onPress={() => setActiveTab('completed')}
                        >
                            <View className="flex-row items-center justify-center">
                                <CheckCircle size={16} color={activeTab === 'completed' ? 'white' : '#65435C'} />
                                <Text className={`text-center font-semibold ml-2 ${activeTab === 'completed' ? 'text-white' : 'text-[#65435C]'}`}>
                                    Completed: {completedRegisters.length}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Content */}
                <ScrollView 
                    className="flex-1 px-4"
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {activeTab === 'outstanding' ? (
                        <>
                            {outstandingRegisters.length === 0 ? (
                                <View className="flex-col items-center justify-center">
                                <View className="bg-white rounded-2xl p-8 items-center">
                                    <Clock size={48} color="#9CA3AF" />
                                    <Text className="text-gray-500 text-lg font-semibold mt-4">No Outstanding Surveys</Text>
                                    <Text className="text-gray-400 text-center mt-2">
                                        All survey registers have been completed
                                    </Text>
                                </View>
                                  <TouchableOpacity
                                  className="bg-[#1AD3BB] rounded-xl p-4 flex-row items-center justify-center gap-2 mt-4 mb-4"
                                  onPress={() => router.push(`/monitoring/new?id=${surveyId}&surveyTitle=${encodeURIComponent(surveyTitle)}` as any)}
                              >
                                  <Text className="text-white font-bold text-lg">+ New Survey</Text>
                              </TouchableOpacity>
                              </View>
                            ) : (
                                <>
                                    {/* {outstandingRegisters.map((register, index) => (
                                        <TouchableOpacity
                                            key={register.id}
                                            className="bg-white rounded-2xl p-4 mb-4"
                                            onPress={() => handleOutstandingRegisterPress(register)}
                                        >
                                            <View className="flex-row items-center justify-between mb-3">
                                                <View className="flex-row items-center gap-2">
                                                    <View className="h-10 w-10 bg-orange-100 rounded-full items-center justify-center">
                                                        <User size={20} color="#f97316" />
                                                    </View>
                                                    <View>
                                                        <Text className="font-bold text-[#65435C]">
                                                            {register.grower_name}
                                                        </Text>
                                                        <Text className="text-sm text-gray-500">
                                                            {register.grower_number}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <ChevronRight size={20} color="#65435C" />
                                            </View>

                                            <View className="space-y-1">
                                                <Text className="text-gray-700">
                                                    Production Cycle: {register.production_cycle_name || 'Unknown'}
                                                </Text>
                                                {register.b030_scheduled_date && (
                                                    <Text className="text-sm text-gray-500">
                                                        Scheduled: {formatDate(register.b030_scheduled_date)}
                                                    </Text>
                                                )}
                                            </View>

                                            <View className="mt-3 pt-3 border-t border-gray-200">
                                                <Text className="text-xs text-[#65435C] text-center font-semibold">
                                                    Tap to start survey
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))} */}

                                    <FlashList
                                    data={outstandingRegisters}
                                    renderItem={({ item }: { item: any }) => OutstandingSurveyRegisterItem(item, handleOutstandingRegisterPress)}
                                    estimatedItemSize={200}
                                    keyboardShouldPersistTaps="handled"
                                    />
                                    
                                    {/* New Survey Button */}
                                    <TouchableOpacity
                                        className="bg-[#1AD3BB] rounded-xl p-4 flex-row items-center justify-center gap-2 mt-4 mb-4"
                                        onPress={() => router.push(`/monitoring/new?id=${surveyId}&surveyTitle=${encodeURIComponent(surveyTitle)}` as any)}
                                    >
                                        <Text className="text-white font-bold text-lg">+ New Survey</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {completedRegisters.length === 0 ? (
                                <View className="bg-white rounded-2xl p-8 items-center">
                                    <CheckCircle size={48} color="#9CA3AF" />
                                    <Text className="text-gray-500 text-lg font-semibold mt-4">No Completed Surveys</Text>
                                    <Text className="text-gray-400 text-center mt-2">
                                        Completed survey registers will appear here
                                    </Text>
                                </View>
                               
                            ) : (
                                <>
                                    {/* {completedRegisters.map((register, index) => (
                                        <TouchableOpacity
                                            key={register.id}
                                            className="bg-white rounded-2xl p-4 mb-4"
                                            onPress={() => handleCompletedRegisterPress(register)}
                                        >
                                            <View className="flex-row items-center justify-between mb-3">
                                                <View className="flex-row items-center gap-2">
                                                    <View className="h-10 w-10 bg-green-100 rounded-full items-center justify-center">
                                                        <CheckCircle size={20} color="#10B981" />
                                                    </View>
                                                    <View>
                                                        <Text className="font-bold text-[#65435C]">
                                                            {register.grower_name}
                                                        </Text>
                                                        <Text className="text-sm text-gray-500">
                                                            {register.grower_number}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text className="text-xs text-gray-500">
                                                    {formatDate(register.completed_date)}
                                                </Text>
                                            </View>

                                            <View className="space-y-1">
                                                <Text className="text-gray-700">
                                                    Production Cycle: {register.production_cycle_name || 'Unknown'}
                                                </Text>
                                                <Text className="text-sm text-green-600">
                                                    {register.questions_answered} questions answered
                                                </Text>
                                            </View>

                                            <View className="mt-3 pt-3 border-t border-gray-200">
                                                <Text className="text-xs text-gray-500 text-center">
                                                    Tap for details
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))} */}

                                    <FlashList
                                    data={completedRegisters}
                                    extraData={expandedResponses}
                                    renderItem={({ item }: { item: any }) => {
                                        const isExpanded = expandedResponses.has(item.id)
                                        console.log('🎨 Rendering item:', item.id, 'isExpanded:', isExpanded, 'expandedResponses:', Array.from(expandedResponses))
                                        
                                        const formatDate = (dateString: string | null) => {
                                            if (!dateString) return 'No date';
                                            try {
                                                const date = new Date(dateString)
                                                return date.toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })
                                            } catch (e) {
                                                return dateString
                                            }
                                        }

                                        return (
                                            <View className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm">
                                                <TouchableOpacity onPress={() => handleCompletedRegisterPress(item)}>
                                                    <View className="flex-row items-center justify-between">
                                                        <View className="flex-row items-center">
                                                            <View className="h-12 w-12 rounded-full bg-green-100 items-center justify-center mr-3">
                                                                <CheckCircle size={20} color="#10B981" />
                                                            </View>
                                                            
                                                            <View>
                                                                <Text className="text-lg font-bold text-[#65435C] truncate max-w-[200px]">
                                                                    {item.grower_name}
                                                                </Text>
                                                                <Text className="text-gray-500 text-sm">
                                                                    {item.grower_number} - {item.production_cycle_name}
                                                                </Text>
                                                                <Text className="text-sm text-green-600">
                                                                    {item.questions_answered} questions answered
                                                                </Text>
                                                            </View>
                                                        </View>
                                                        
                                                        <Text className="text-xs text-gray-500">
                                                            {formatDate(item.completed_date)}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    className="mt-3 pt-3 border-t border-gray-200 flex-row items-center justify-center"
                                                    onPress={() => {
                                                        console.log('👆 Toggle button pressed for item:', item.id)
                                                        toggleResponseExpanded(item.id)
                                                    }}
                                                >
                                                    <Text className="text-xs text-[#65435C] mr-2">
                                                        {isExpanded ? 'Hide' : 'Show'} Questions & Answers
                                                    </Text>
                                                    {isExpanded ? (
                                                        <ChevronUp size={16} color="#65435C" />
                                                    ) : (
                                                        <ChevronDown size={16} color="#65435C" />
                                                    )}
                                                </TouchableOpacity>

                                                {isExpanded && item.questions_answers && (
                                                    <View className="mt-4 space-y-3">
                                                        {item.questions_answers.map((qa: any, qaIndex: number) => (
                                                            <View key={qa.question_id} className="bg-gray-50 rounded-lg p-3">
                                                                <Text className="font-semibold text-[#65435C] mb-2">
                                                                    {/* Q{qa.question_sequence}: */}
                                                                     {parseTitle(qa.question_title)}
                                                                </Text>
                                                                <Text className="text-gray-700">
                                                                    {parseAnswerValue(qa.answer_value)}
                                                                </Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>
                                        )
                                    }}
                                    estimatedItemSize={200}
                                    keyboardShouldPersistTaps="handled"
                                    />
                                </>
                            )}
                        </>
                    )}
                </ScrollView>

                {/* {!((activeTab === 'outstanding' && loadingOutstanding) || 
              (activeTab === 'completed' && loadingCompleted) && (
            <FlashList
              data={activeTab === 'outstanding' 
                ? Object.values(outstandingRegisters).map(group => ({...group[0], inputLines: group}))
                : activeTab === 'completed' 
                ? Object.values(completedRegisters).map(group => ({...group[0], inputLines: group}))
                : Object.values(completedRegisters).map(group => ({...group[0], inputLines: group}))
              }
              renderItem={({ item }: { item: any }) => surveyRegisterItem(item)}
              estimatedItemSize={200}
              keyboardShouldPersistTaps="handled"
            />
          )} */}
            </View>
        </>
    )
}

export default SurveyRegister

const OutstandingSurveyRegisterItem = (item: any, handleOutstandingRegisterPress: (register: SurveyRegister) => void) => {    
    return (
        <TouchableOpacity className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm" 
        onPress={() => handleOutstandingRegisterPress(item)}>
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                    {/* Avatar circle with initials */}
                    <View className="h-12 w-12 rounded-full bg-[#1AD3BB] items-center justify-center mr-3">
                        <Text className="text-white font-bold text-lg">
                            {item.grower_name.charAt(0)}
                        </Text>
                    </View>
                    
                    <View>
                        <Text className="text-lg font-bold text-[#65435C] truncate max-w-[200px]">{item.grower_name}</Text>
                        <Text className="text-gray-500 text-sm">{item.grower_number} - {item.production_cycle_name}</Text>
                    </View>
                </View>
                
                {/* Right side with action indicator */}
                <View className=" rounded-full h-8 w-8 items-center justify-center">
                  <CircleArrowRight size={24} color="#65435C" />
                </View>
            </View>
        </TouchableOpacity>
    )
}

