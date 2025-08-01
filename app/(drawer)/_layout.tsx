// app/drawer/_layout.tsx
import { Drawer } from 'expo-router/drawer';
import CustomDrawerContent from '@/components/CustomDrawerContent';
import colors from '@/theme/colors';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Dimensions } from 'react-native';

const drawerIcons = {
  index: { name: 'home', lib: Feather },
  track: { name: 'map-pin', lib: Feather },
  account: { name: 'user', lib: Feather },
  Support: { name: 'message-circle', lib: Feather },
  FAQs: { name: 'help-circle', lib: Feather },
  History: { name: 'history', lib: MaterialIcons },
  Settings: { name: 'settings-outline', lib: Ionicons },
};

export default function DrawerLayout() {
  const drawerWidth = Dimensions.get('window').width * 0.65;

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ route }) => {
        const iconData = drawerIcons[route.name] || { name: 'circle', lib: Feather };
        const IconComponent = iconData.lib;

        return {
          headerShown: false,
          drawerStyle: {
            backgroundColor: colors.background,
            width: drawerWidth,
          },
          drawerActiveTintColor: colors.primary,
          drawerInactiveTintColor: 'white',
          drawerLabelStyle: {
            fontSize: 16,
            marginLeft: -10,
          },
          drawerIcon: ({ color }) => (
            <IconComponent name={iconData.name} size={20} color={color} />
          ),
        };
      }}
    />
  );
}