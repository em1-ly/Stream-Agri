import React, { useCallback, useEffect } from 'react'
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native'
import { router, Stack, useFocusEffect } from 'expo-router'
import { AlertCircle, BarChart, PlugZap, Unplug } from 'lucide-react-native'
import { useNetwork } from '@/NetworkContext'
import { powersync, setupPowerSync } from '@/powersync/system';
import { SurveySurveyRecord, SurveyQuestionRecord, SurveyQuestionAnswerRecord } from '@/powersync/Schema';
import { useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const Monitoring = () => {
  const { isConnected } = useNetwork()
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<SurveySurveyRecord[]>([]);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestionRecord[]>([]);
  const [surveyQuestionAnswers, setSurveyQuestionAnswers] = useState<SurveyQuestionAnswerRecord[]>([]);

  const [syncStatus, setSyncStatus] = useState(false);

  const getEmployeeId = async () => {
    const employeeId = await SecureStore.getItemAsync('odoo_employee_id')
    return employeeId || '148'
  }

  useFocusEffect(
    useCallback(() => {
      console.log('useFocusEffect Monitoring Screen');
      powersync.registerListener({
        statusChanged: (status) => {
          setSyncStatus(status.connected);
          // console.log('PowerSync status Monitoring Screen:', status);
        }
      });
    }, [])
  );

  useFocusEffect(useCallback(() => {
    console.log('useEffect growers')
    // Initialize PowerSync if not already initialized
    setupPowerSync();
    
    const fetchSurveysWithCounts = async () => {
      try {
        const employeeId = await getEmployeeId();
        const surveysWithCounts = await powersync.getAll(`
          SELECT 
            ss.id, 
            ss.title, 
            ss.active, 
            ss.access_token, 
            ss.session_code, 
            ss.create_date,
            COUNT(sr.id) as outstanding_survey_registers
          FROM survey_survey ss
          LEFT JOIN survey_register sr ON ss.id = sr.survey_id 
            AND sr.employee_id = ? 
            AND sr.c010_status = 'draft'
          GROUP BY ss.id, ss.title, ss.active, ss.access_token, ss.session_code, ss.create_date
        `, [employeeId]);
        
        setSurveys(surveysWithCounts as any);
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching surveys:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchSurveysWithCounts();
  }, []));


  if (loading) {
    return <View className="flex-1 items-center justify-center">
      <ActivityIndicator size="large" color="#65435C" />
    </View>
  }

  if (error) {
    return <View className="flex-1 items-center justify-center">
      <Text>Error: {error}</Text>
    </View>
  }

  console.log('surveys', surveys)


  return (
    <>
     <Stack.Screen options={{ 
        title: 'M & E',
        headerTitleStyle: {
          fontSize: 24,
          fontWeight: 'bold',
          color: '#65435C'
        },
        headerShown: true,
        headerRight: () => (
            <View className="mr-4 flex-row items-center gap-2">
                <TouchableOpacity onPress={()=> console.log('refreshing')}>
                  {syncStatus === true ? (
                    <PlugZap size={24} color="#1AD3BB" />

                  ) : (
                    <Unplug size={24} color="red" />
                  )}
                </TouchableOpacity>
            </View>
        )
      }} />
      <View className="flex-1 p-4 bg-[#65435C]">

        <FlatList
          data={surveys}
          // numColumns={1}
          // columnWrapperStyle={{ justifyContent: 'space-between' }}
          renderItem={({ item }) => {
            // Parse the title JSON string to get localized text
            let displayTitle = item.title || 'Untitled';
            try {
              if (item.title && typeof item.title === 'string') {
                const titleObj = JSON.parse(item.title);
                // Try to get English text, defaulting to en_US, then en_GB, then first available
                const firstValue = Object.values(titleObj)[0];
                displayTitle = titleObj.en_US || titleObj.en_GB || (typeof firstValue === 'string' ? firstValue : displayTitle);
              }
            } catch (e) {
              // If parsing fails, use the original title or fallback
              console.warn('Failed to parse title JSON:', item.title);
              displayTitle = item.title || 'Untitled';
            }

            return (
              <TouchableOpacity 
                className="bg-white rounded-2xl p-6 items-center justify-center h-40 mb-4 shadow-lg" 
                style={{ 
                  width: '100%',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 5,
                  borderLeftWidth: 4,
                  borderLeftColor: '#1AD3BB'
                }}
                // onPress={() => router.push(`/monitoring/${item.id}` as any)}
              >
                <View className="flex-row items-center justify-evenly mx-16">
                <View className="flex-col items-center justify-between w-full">
                <View className="h-10 w-10 bg-[#1AD3BB] rounded-full items-center justify-center mb-3">
                  <BarChart size={20} color="white" />
                </View>
                <Text className="text-lg font-bold text-[#65435C] text-center leading-tight">
                  {displayTitle}
                </Text>
                  <Text className="text-sm text-gray-500 mt-1 text-center">
                    Survey
                  </Text>
                </View>

                <View className="flex-col items-center justify-between w-full">
                  <TouchableOpacity className="bg-[#65435C] rounded-xl p-2 w-[60%] mb-2 items-center justify-center"
                  onPress={() => router.push(`/monitoring/surveyRegister?surveyId=${item.id}` as any)}
                  >
                    <Text className="text-white text-center">View Survey</Text>
                  </TouchableOpacity>
                  {/* <TouchableOpacity className="bg-[#65435C] rounded-xl p-2 w-[60%] items-center justify-center"
                  onPress={() => router.push(`/monitoring/completed?id=${item.id}` as any)}
                  >
                    <Text className="text-white text-center">View Completed</Text>
                  </TouchableOpacity> */}
                  {/* // TODO: Add number of outstanding survey registers for each survey */}
                                    {(item as any).outstanding_survey_registers > 0 ? (
                    <View className="flex-row items-center justify-center mt-1">
                      <Text className="text-sm text-red-600 text-center font-semibold mr-1">
                        {(item as any).outstanding_survey_registers} Outstanding
                      </Text>
                      <AlertCircle size={16} color="red" />
                    </View>
                  ) : (
                    <Text className="text-sm text-green-600 mt-1 text-center font-semibold">
                      Completed
                    </Text>
                  )}
                </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
        {/* <View className="bg-white rounded-2xl p-4 flex-row items-center gap-4">
          <View className="h-12 w-12 bg-[#65435C] rounded-xl items-center justify-center">
            <BarChart size={24} color="#1AD3BB" />
          </View>
          <Text className="text-xl font-semibold text-[#65435C]">M&E Dashboard</Text>
        </View> */}
      </View>
    </>
  )
}

export default Monitoring


