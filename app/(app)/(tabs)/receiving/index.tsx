import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { Stack, Link } from 'expo-router';
import { ChevronRight, Users, Archive, TrendingUp, Database, TrendingDown, BarChart3 } from 'lucide-react-native';

// --- Re-usable components for the tabs ---

// 1. Dashboard Component
// 1. Dashboard Component (NEW IMPLEMENTATION)
const DashboardComponent = () => (
  <ScrollView style={styles.dashboardScrollView}>
    {/* Section 1: Measures */}
    <Text style={styles.sectionTitle}>Measures</Text>
    <View style={styles.measuresContainer}>
      <View style={styles.metricBox}>
        <Users size={24} color="#65435C" />
        <Text style={styles.metricValue}>1,250</Text>
        <Text style={styles.metricLabel}>Grower Counts</Text>
      </View>
      <View style={styles.metricBox}>
        <Archive size={24} color="#65435C" />
        <Text style={styles.metricValue}>15,800</Text>
        <Text style={styles.metricLabel}>Bale Counts</Text>
      </View>
    </View>

    {/* Section 2: Main Structure */}
    <Text style={styles.sectionTitle}>Receiving Status</Text>
    <View style={styles.structureCard}>
      {/* Level 1: Structure */}
      <Text style={styles.hierarchyText1}>Structure: Main Floor</Text>
      
      {/* Level 2: Sale Day */}
      <View style={styles.hierarchyLevel}>
        <Text style={styles.hierarchyText2}>Sale Day: 2025-10-02</Text>
        
        {/* Level 3: Province */}
        <View style={styles.hierarchyLevel}>
          <Text style={styles.hierarchyText3}>Province: Mashonaland West</Text>
          
          {/* Level 4: PC */}
          <View style={styles.hierarchyLevel}>
            <Text style={styles.hierarchyText4}>PC: Karoi</Text>

            {/* Level 5: FO */}
            <View style={styles.hierarchyLevel}>
              <Text style={styles.hierarchyText5}>FO: Tengwe</Text>
              <View style={styles.statusGrid}>
                  <Text style={styles.statusItem}>Booked: 300</Text>
                  <Text style={styles.statusItem}>Received: 250</Text>
                  <Text style={styles.statusItem}>Released: 245</Text>
                  <Text style={styles.statusItem}>Paid: 240</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>

    {/* Section 3: Sale Day Summary */}
    <Text style={styles.sectionTitle}>Sale Day Summary</Text>
    <View style={styles.structureCard}>
       {/* Level 1: Structure */}
       <Text style={styles.hierarchyText1}>Structure: Main Floor</Text>
      
       {/* Level 2: Sale Day */}
       <View style={styles.hierarchyLevel}>
         <Text style={styles.hierarchyText2}>Sale Day: 2025-10-02</Text>
         <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}><TrendingUp size={16} color="#10B981" /><Text>Bales Laid: 5,200</Text></View>
            <View style={styles.summaryItem}><Database size={16} color="#3B82F6" /><Text>Bales Purchased: 4,800</Text></View>
            <View style={styles.summaryItem}><TrendingDown size={16} color="#EF4444" /><Text>Bales Rejected: 400</Text></View>
            <View style={styles.summaryItem}><BarChart3 size={16} color="#8B5CF6" /><Text>Volume Purchased: 480,000 kg</Text></View>
            <View style={styles.summaryItem}><Text style={{fontWeight: 'bold'}}>$</Text><Text>Ave Price: $2.50/kg</Text></View>
         </View>
       </View>
    </View>
  </ScrollView>
);

// 2. Menu Component (This is from our old menu.tsx file)
const menuItems = [
  { id: '1', title: 'New Transporter DNote', href: '/receiving/new-transporter-dnote' },
  { id: '2', title: 'View All TD Notes', href: '/receiving/view-all-td-notes' },
  { id: '3', title: 'View all Grower D Notes', href: '/receiving/view-all-grower-d-notes' },
  { id: '4', title: 'Add Bale to GD Note', href: '/receiving/add-bale-to-gd-note' },
  { id: '5', title: 'Sequencing Scanner', href: '/receiving/sequencing-scanner' },
  { id: '6', title: 'Transporter Details', href: '/receiving/transporter-details' },
  { id: '7', title: 'Check Grower Sequences', href: '/receiving/check-grower-sequences' },
  { id: '8', title: 'Grower Bookings', href: '/receiving/grower-bookings' },
  { id: '9', 'title': 'Row Management', href: '/receiving/row-management' },
  { id: '10', title: 'Create Daily Rows', href: '/receiving/create-daily-rows' },
  { id: '11', title: 'Start New Lay', href: '/receiving/start-new-lay' },
];

const MenuComponent = () => {
    const renderItem = ({ item }: { item: typeof menuItems[0] }) => (
        <Link href={item.href as any} asChild>
          <TouchableOpacity style={styles.itemContainer}>
            <Text style={styles.itemText}>{item.title}</Text>
            <ChevronRight color="#65435C" size={20} />
          </TouchableOpacity>
        </Link>
      );

    return (
        <FlatList
            data={menuItems}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
    );
};


// --- The main screen component ---

export default function ReceivingScreen() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'menu'>('dashboard');

  return (
    <>
      <Stack.Screen options={{ title: 'Receiving' }} />
      <View style={styles.pageContainer}>
        <View style={styles.cardContainer}>
          {/* Tab Switcher */}
          <View style={styles.tabSwitcherContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'dashboard' && styles.activeTab]}
              onPress={() => setActiveTab('dashboard')}
            >
              <Text style={[styles.tabText, activeTab === 'dashboard' && styles.activeTabText]}>
                Dashboard
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'menu' && styles.activeTab]}
              onPress={() => setActiveTab('menu')}
            >
               <Text style={[styles.tabText, activeTab === 'menu' && styles.activeTabText]}>
                Menu
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Content based on active tab */}
          {activeTab === 'dashboard' ? <DashboardComponent /> : <MenuComponent />}
        </View>
      </View>
    </>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#65435C',
  },
  cardContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
  },
  tabSwitcherContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#65435C',
  },
  tabText: {
    textAlign: 'center',
    fontWeight: '600',
    color: '#65435C',
  },
  activeTabText: {
    color: 'white',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#65435C',
  },
  subtitleText: {
    fontSize: 16,
    color: 'gray',
    marginTop: 8,
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  itemText: {
    fontSize: 16,
    color: '#333',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 8,
  },
});