// import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native'
// import React, { useCallback, useEffect, useState } from 'react'
// import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
// import { powersync } from '@/powersync/system';
// import { CheckCircle, MapPin, User, Calendar, FileText } from 'lucide-react-native';
// import * as SecureStore from 'expo-secure-store';

// interface CompletedSurveyResponse {
//     id: string;
//     survey_id: number;
//     survey_title: string;
//     production_cycle_registration_id: number;
//     grower_name: string;
//     grower_number: string;
//     production_cycle_name: string;
//     create_date: string;
// }

// const Completed = () => {
//     const { id } = useLocalSearchParams()
//     const [completedResponses, setCompletedResponses] = useState<CompletedSurveyResponse[]>([])
//     const [loading, setLoading] = useState(true)
//     const [refreshing, setRefreshing] = useState(false)

//     const getEmployeeId = async () => {
//         const employeeId = await SecureStore.getItemAsync('employeeId')
//         return employeeId
//     }

//     const employeeId = getEmployeeId()

//     const fetchCompletedSurveys = async () => {
//         try {
//             console.log('Fetching completed surveys for survey_id:', id)

//             const surveyResponses = await powersync.getAll(`
//                 SELECT 
//                     sui.id,
//                     sui.survey_id,
//                     ss.title as survey_title,
//                     sui.production_cycle_registration_id,
//                     pcr.grower_name,
//                     g.grower_number,
//                     pcr.production_cycle_name,
//                     sui.create_date
//                 FROM survey_user_input sui
//                 LEFT JOIN survey_survey ss ON sui.survey_id = ss.id
//                 LEFT JOIN odoo_gms_production_cycle_registration pcr ON sui.production_cycle_registration_id = pcr.id
//                 LEFT JOIN odoo_gms_grower g ON pcr.grower_id = g.id
//                 WHERE sui.survey_id = ?
//                 ORDER BY sui.create_date DESC
//             `, [id])
            
//             console.log('Completed survey responses:', surveyResponses)
//             setCompletedResponses(surveyResponses as CompletedSurveyResponse[])
//         } catch (error) {
//             console.error('Error fetching completed surveys:', error)
//             Alert.alert('Error', 'Failed to fetch completed survey responses')
//         } finally {
//             setLoading(false)
//             setRefreshing(false)
//         }
//     }

//     useEffect(() => {
//         fetchCompletedSurveys()
//     }, [id])

//     const onRefresh = useCallback(() => {
//         setRefreshing(true)
//         fetchCompletedSurveys()
//     }, [id])

//     const parseTitle = (title: string | null) => {
//         if (!title) return 'Survey Response';
//         try {
//             const titleObj = JSON.parse(title);
//             return titleObj.en_US || titleObj.en_GB || Object.values(titleObj)[0] || 'Survey Response';
//         } catch (e) {
//             return title || 'Survey Response';
//         }
//     }

//     const formatDate = (dateString: string) => {
//         try {
//             const date = new Date(dateString)
//             return date.toLocaleDateString('en-US', {
//                 year: 'numeric',
//                 month: 'short',
//                 day: 'numeric',
//                 hour: '2-digit',
//                 minute: '2-digit'
//             })
//         } catch (e) {
//             return dateString
//         }
//     }

//     const viewResponseDetails = (response: CompletedSurveyResponse) => {
//         Alert.alert(
//             'Response Details',
//             `PCR ID: ${response.production_cycle_registration_id}\nGrower: ${response.grower_number || 'Unknown'} - ${response.grower_name || 'Unknown'}\nProduction Cycle: ${response.production_cycle_name || 'Unknown'}\nSubmitted: ${formatDate(response.create_date)}`,
//             [{ text: 'OK' }]
//         )
//     }

//     if (loading) {
//         return (
//             <View className="flex-1 bg-[#65435C] items-center justify-center">
//                 <Text className="text-white text-lg">Loading completed responses...</Text>
//             </View>
//         )
//     }

//     return (
//         <>
//             <Stack.Screen options={{ 
//                 title: 'Completed Responses',
//                 headerTitleStyle: {
//                     fontSize: 20,
//                     fontWeight: 'bold',
//                     color: '#65435C'
//                 },
//                 headerShown: true,
//             }} />
//             <View className="flex-1 bg-[#65435C]">
//                 <ScrollView 
//                     className="flex-1 p-4"
//                     refreshControl={
//                         <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
//                     }
//                 >
//                     {completedResponses.length === 0 ? (
//                         <View className="bg-white rounded-2xl p-8 items-center">
//                             <FileText size={48} color="#9CA3AF" />
//                             <Text className="text-gray-500 text-lg font-semibold mt-4">No Completed Responses</Text>
//                             <Text className="text-gray-400 text-center mt-2">
//                                 Completed survey responses will appear here
//                             </Text>
//                         </View>
//                     ) : (
//                         <>
//                             <View className="bg-white rounded-2xl p-4 mb-4">
//                                 <View className="flex-row items-center gap-2 mb-2">
//                                     <CheckCircle size={24} color="#10B981" />
//                                     <Text className="text-lg font-bold text-[#65435C]">
//                                     Survey: {parseTitle(completedResponses[0]?.survey_title)}
//                                     </Text>
//                                 </View>
//                                 <Text className="text-gray-600">
//                                 {completedResponses.length} Completed Response{completedResponses.length !== 1 ? 's' : ''}

//                                 </Text>
//                             </View>

//                             {completedResponses.map((response, index) => (
//                                 <TouchableOpacity
//                                     key={response.id}
//                                     className="bg-white rounded-2xl p-4 mb-4"
//                                     onPress={() => viewResponseDetails(response)}
//                                 >
//                                     <View className="flex-row items-center justify-between mb-3">
//                                         <View className="flex-row items-center gap-2">
//                                             {/* <CheckCircle size={16} color="#10B981" /> */}
//                                             <Text className="font-bold text-[#65435C]">
//                                                 {response.grower_name}
//                                             </Text>
//                                         </View>
//                                         <Text className="text-xs text-gray-500">
//                                             {formatDate(response.create_date)}
//                                         </Text>
//                                     </View>

//                                     <View className="space-y-2">
//                                         <View className="flex-row items-center gap-2">
//                                             <Text className="text-gray-700 flex-1">
//                                                 {response.grower_number || 'Unknown'} - {response.production_cycle_name || 'Unknown'} - {parseTitle(response.survey_title) || 'Unknown'}
//                                             </Text>
//                                         </View>
//                                     </View>

//                                     <View className="mt-3 pt-3 border-t border-gray-200">
//                                         <Text className="text-xs text-gray-500 text-center">
//                                             Tap for more details
//                                         </Text>
//                                     </View>
//                                 </TouchableOpacity>
//                             ))}
//                         </>
//                     )}
//                 </ScrollView>
//             </View>
//         </>
//     )
// }

// export default Completed

















import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { powersync } from '@/powersync/system';
import { CheckCircle, MapPin, User, Calendar, FileText, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

interface QuestionAnswer {
    question_id: number;
    question_title: string;
    question_type: string;
    answer_value: string;
    question_sequence: number;
}

interface CompletedSurveyResponse {
    id: string;
    survey_id: number;
    survey_title: string;
    production_cycle_registration_id: number;
    grower_name: string;
    grower_number: string;
    production_cycle_name: string;
    create_date: string;
    questions_answers: QuestionAnswer[];
}

const Completed = () => {
    const { id } = useLocalSearchParams()
    const [completedResponses, setCompletedResponses] = useState<CompletedSurveyResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set())

    const getEmployeeId = async () => {
        const employeeId = await SecureStore.getItemAsync('odoo_employee_id')
        return employeeId
    }

    const toggleResponseExpanded = (responseId: string) => {
        const newExpanded = new Set(expandedResponses)
        if (newExpanded.has(responseId)) {
            newExpanded.delete(responseId)
        } else {
            newExpanded.add(responseId)
        }
        setExpandedResponses(newExpanded)
    }

    const fetchCompletedSurveys = async () => {
        try {
            console.log('Fetching completed surveys for survey_id:', id)
            
            // Get the employee ID first
            const employeeId = await getEmployeeId()
    
            // First get the survey responses
            const surveyResponses = await powersync.getAll(`
                SELECT 
                    sui.id,
                    sui.survey_id,
                    ss.title as survey_title,
                    sui.production_cycle_registration_id,
                    pcr.grower_name,
                    g.grower_number,
                    pcr.production_cycle_name,
                    sui.create_date
                FROM survey_user_input sui
                LEFT JOIN survey_survey ss ON sui.survey_id = ss.id
                INNER JOIN odoo_gms_production_cycle_registration pcr ON pcr.field_technician_id = ? AND sui.production_cycle_registration_id = pcr.id
                LEFT JOIN odoo_gms_grower g ON pcr.grower_id = g.id
                WHERE sui.survey_id = ?
                ORDER BY sui.create_date DESC
            `, [employeeId, id])

        // For each survey response, get the questions and answers
        const responsesWithQA = await Promise.all(
            surveyResponses.map(async (response: any) => {
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
                `, [response.id])

                return {
                    ...response,
                    questions_answers: questionsAnswers as QuestionAnswer[]
                }
            })
        )
            
        console.log('Completed survey responses with Q&A:', responsesWithQA)
        setCompletedResponses(responsesWithQA as CompletedSurveyResponse[])
    } catch (error) {
        console.error('Error fetching completed surveys:', error)
        Alert.alert('Error', 'Failed to fetch completed survey responses')
    } finally {
        setLoading(false)
        setRefreshing(false)
    }
}

    useEffect(() => {
        fetchCompletedSurveys()
    }, [id])

    const onRefresh = useCallback(() => {
        setRefreshing(true)
        fetchCompletedSurveys()
    }, [id])

    const parseTitle = (title: string | null) => {
        if (!title) return 'Survey Response';
        try {
            const titleObj = JSON.parse(title);
            return titleObj.en_US || titleObj.en_GB || Object.values(titleObj)[0] || 'Survey Response';
        } catch (e) {
            return title || 'Survey Response';
        }
    }

    const formatDate = (dateString: string) => {
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

    const viewResponseDetails = (response: CompletedSurveyResponse) => {
        const questionCount = response.questions_answers?.length || 0
        Alert.alert(
            'Response Details',
            `PCR ID: ${response.production_cycle_registration_id}\nGrower: ${response.grower_number || 'Unknown'} - ${response.grower_name || 'Unknown'}\nProduction Cycle: ${response.production_cycle_name || 'Unknown'}\nQuestions Answered: ${questionCount}\nSubmitted: ${formatDate(response.create_date)}`,
            [{ text: 'OK' }]
        )
    }

    if (loading) {
        return (
            <View className="flex-1 bg-[#65435C] items-center justify-center">
                <Text className="text-white text-lg">Loading completed responses...</Text>
            </View>
        )
    }

    return (
        <>
            <Stack.Screen options={{ 
                title: 'Completed Responses',
                headerTitleStyle: {
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#65435C'
                },
                headerShown: true,
            }} />
            <View className="flex-1 bg-[#65435C]">
                <ScrollView 
                    className="flex-1 p-4"
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {completedResponses.length === 0 ? (
                        <View className="bg-white rounded-2xl p-8 items-center">
                            <FileText size={48} color="#9CA3AF" />
                            <Text className="text-gray-500 text-lg font-semibold mt-4">No Completed Responses</Text>
                            <Text className="text-gray-400 text-center mt-2">
                                Completed survey responses will appear here
                            </Text>
                        </View>
                    ) : (
                        <>
                            <View className="bg-white rounded-2xl p-4 mb-4">
                                <View className="flex-row items-center gap-2 mb-2">
                                    <CheckCircle size={24} color="#10B981" />
                                    <Text className="text-lg font-bold text-[#65435C]">
                                    Survey: {parseTitle(completedResponses[0]?.survey_title)}
                                    </Text>
                                </View>
                                <Text className="text-gray-600">
                                {completedResponses.length} Completed Response{completedResponses.length !== 1 ? 's' : ''}
                                </Text>
                            </View>

                            {completedResponses.map((response, index) => {
                                const isExpanded = expandedResponses.has(response.id)
                                return (
                                    <View key={response.id} className="bg-white rounded-2xl p-4 mb-4">
                                        <TouchableOpacity
                                            onPress={() => viewResponseDetails(response)}
                                        >
                                            <View className="flex-row items-center justify-between mb-3">
                                                <View className="flex-row items-center gap-2">
                                                    <Text className="font-bold text-[#65435C]">
                                                        {response.grower_name}
                                                    </Text>
                                                </View>
                                                <Text className="text-xs text-gray-500">
                                                    {formatDate(response.create_date)}
                                                </Text>
                                            </View>

                                            <View className="space-y-2">
                                                <View className="flex-row items-center gap-2">
                                                    <Text className="text-gray-700 flex-1">
                                                        {response.grower_number || 'Unknown'} - {response.production_cycle_name || 'Unknown'} - {parseTitle(response.survey_title) || 'Unknown'}
                                                    </Text>
                                                </View>
                                                <Text className="text-sm text-gray-500">
                                                    {response.questions_answers?.length || 0} questions answered
                                                </Text>
                                            </View>
                                        </TouchableOpacity>

                                        {/* Toggle button for questions/answers */}
                                        <TouchableOpacity
                                            className="mt-3 pt-3 border-t border-gray-200 flex-row items-center justify-center"
                                            onPress={() => toggleResponseExpanded(response.id)}
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

                                        {/* Questions and Answers */}
                                            {isExpanded && response.questions_answers && (
                                                <View className="mt-4 space-y-3">
                                                    {response.questions_answers.map((qa, qaIndex) => (
                                                        <View key={qa.question_id} className="bg-gray-50 rounded-lg p-3">
                                                            <Text className="font-semibold text-[#65435C] mb-2">
                                                                Q{qa.question_sequence}: {parseTitle(qa.question_title)}
                                                            </Text>
                                                            <Text className="text-gray-700">
                                                                {parseAnswerValue(qa.answer_value)}
                                                            </Text>
                                                            {/* <Text className="text-xs text-gray-500 mt-1">
                                                                Type: {qa.question_type}
                                                            </Text> */}
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                    </View>
                                )
                            })}
                        </>
                    )}
                </ScrollView>
            </View>
        </>
    )
}

export default Completed