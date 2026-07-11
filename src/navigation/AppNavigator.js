import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { APP_CONFIG } from '../config/appConfig';

const splitAppName = (appName) => {
  const match = appName.match(/^([A-Z][a-z]+)([A-Z].*)$/);
  return match ? [match[1], match[2]] : [appName, ''];
};
import { Text, View, TouchableOpacity, Modal } from 'react-native';
import { Compass, CalendarDays, Landmark, Users, GraduationCap, BookOpen, Search, Bell, User, Zap, ClipboardList, Calendar } from 'lucide-react-native';
import NotificationsPanel from '../screens/NotificationsPanel';
import { useNavigation } from '@react-navigation/native';
import DiscoverScreen from '../screens/DiscoverScreen';
import GroupsScreen from '../screens/GroupsScreen';
import HubScreen from '../screens/HubScreen';
import MentorsScreen from '../screens/MentorsScreen';
import TeachersScreen from '../screens/TeachersScreen';
import StudyPlannerScreen from '../screens/StudyPlannerScreen';
import { colors, font, initials, avatarColor } from '../theme';
import { useApp } from '../context/AppContext';
import { myProfile } from '../data';

const Tab = createBottomTabNavigator();

const tabs = [
  { name: 'Discover',   component: DiscoverScreen,    Icon: Compass },
  { name: 'Planner',    component: StudyPlannerScreen,  Icon: CalendarDays },
  { name: 'Hub',        component: HubScreen,          Icon: Landmark },
  { name: 'Groups',     component: GroupsScreen,       Icon: Users },
  { name: 'Mentors',    component: MentorsScreen,      Icon: GraduationCap },
  { name: 'Teachers',   component: TeachersScreen,     Icon: BookOpen },
];

const TIMETABLE_TEAM = ['Shruthi', 'Bhoomika', 'Thirupat'];

function HeaderRight() {
  const navigation = useNavigation();
  const { userProfile, unreadCount, isAppAdmin } = useApp();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const name = userProfile?.name || myProfile.name;
  const isTimetableTeam = !isAppAdmin && (
    name.toLowerCase().includes('hridhya') ||
    TIMETABLE_TEAM.some(n => name.toLowerCase().includes(n.toLowerCase()))
  );
  const av = avatarColor(name);
  const abbr = initials(name);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 12 }}>
      {/* Search */}
      <TouchableOpacity onPress={() => navigation.navigate('Search')} activeOpacity={0.7}>
        <Search size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Notifications */}
      <TouchableOpacity onPress={() => setShowNotifs(true)} activeOpacity={0.7}>
        <View>
          <Bell size={18} color={colors.textSecondary} />
          {unreadCount > 0 && (
            <View style={{
              position: 'absolute', top: -4, right: -4,
              width: 14, height: 14, borderRadius: 7,
              backgroundColor: colors.red,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 8, color: '#fff', fontWeight: '700' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Avatar — tap for profile/sign out menu */}
      <TouchableOpacity onPress={() => setShowMenu(true)} activeOpacity={0.7}>
        <View style={{
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: av.bg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: av.text }}>{abbr}</Text>
        </View>
      </TouchableOpacity>

      <NotificationsPanel
        visible={showNotifs}
        onClose={() => setShowNotifs(false)}
        onOpenDM={(params) => { setShowNotifs(false); navigation.navigate('DM', params); }}
      />

      {/* Avatar menu */}
      <Modal visible={showMenu} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={{
            position: 'absolute', top: 60, right: 12,
            backgroundColor: colors.card,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 14,
            minWidth: 180,
            shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
            elevation: 8,
            overflow: 'hidden',
          }}>
            {/* User info */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
            }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: av.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: av.text }}>{abbr}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>{name}</Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary }} numberOfLines={1}>{userProfile?.course || myProfile.course}</Text>
              </View>
            </View>

            {/* My Profile */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}
              activeOpacity={0.7}
              onPress={() => { setShowMenu(false); navigation.navigate('MyProfile'); }}
            >
              <User size={16} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '500' }}>My Profile</Text>
            </TouchableOpacity>

            {/* Super Admin — only shown for admins */}
            {isAppAdmin && (
              <>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
                    borderTopWidth: 1, borderTopColor: colors.border,
                  }}
                  activeOpacity={0.7}
                  onPress={() => { setShowMenu(false); navigation.navigate('SuperAdmin'); }}
                >
                  <Zap size={16} color={colors.accent} />
                  <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>Super Admin</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}
                  activeOpacity={0.7}
                  onPress={() => { setShowMenu(false); navigation.navigate('TeacherDashboard'); }}
                >
                  <ClipboardList size={16} color={colors.accent} />
                  <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>Teacher Dashboard</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Timetable Planner — shown for timetable team members (student accounts) */}
            {isTimetableTeam && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
                  borderTopWidth: 1, borderTopColor: colors.border,
                }}
                activeOpacity={0.7}
                onPress={() => { setShowMenu(false); navigation.navigate('TeacherDashboard'); }}
              >
                <Calendar size={16} color={colors.accent} />
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>Timetable Planner</Text>
              </TouchableOpacity>
            )}

          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => {
          const tab = tabs.find(t => t.name === route.name);
          const TabIcon = tab?.Icon;
          if (!TabIcon) return null;
          return (
            <TabIcon
              size={focused ? 22 : 20}
              color={focused ? colors.accent : colors.textTertiary}
            />
          );
        },
        tabBarLabel: ({ focused }) => (
          <Text style={{
            fontSize: 10,
            color: focused ? colors.primary : colors.textTertiary,
            fontWeight: focused ? '600' : '400',
            marginTop: -2,
          }}>
            {route.name}
          </Text>
        ),
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontSize: 17,
          fontWeight: '600',
          color: colors.textPrimary,
        },
        headerLeft: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16, gap: 8 }}>
            <View style={{
              width: 30, height: 30, borderRadius: 10,
              backgroundColor: colors.primary,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>✦</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
              {splitAppName(APP_CONFIG.appName)[0]}<Text style={{ color: colors.primary }}>{splitAppName(APP_CONFIG.appName)[1]}</Text>
            </Text>
          </View>
        ),
        headerTitle: '',
        headerRight: () => <HeaderRight />,
      })}
    >
      {tabs.map(tab => (
        <Tab.Screen key={tab.name} name={tab.name} component={tab.component} />
      ))}
    </Tab.Navigator>
  );
}