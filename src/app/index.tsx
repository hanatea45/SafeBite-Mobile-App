import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Tab = 'scanner' | 'pantry' | 'allergies' | 'insights';
type IconName = string;

const COLORS = {
  surface: '#FFFAF5',
  white: '#FFFFFF',
  ink: '#241A15',
  muted: '#82736A',
  primary: '#C2410C',
  primaryContainer: '#F97316',
  primarySoft: '#FFEDD5',
  border: '#F0DED0',
  danger: '#B42318',
  dangerSoft: '#FFDAD6',
  caution: '#A15C00',
  cautionSoft: '#FFE9C7',
  navy: '#431407',
};

type Notify = (message: string) => void;
const ToastContext = createContext<Notify>(() => {});

function useToast() {
  return useContext(ToastContext);
}

function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.toast}>
      <Icon name="check-circle" size={17} color={COLORS.white} />
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

const PROFILE_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDbALenK1Z4_gqThEE1Lpt4nGWaDn3MCNEg7fr_aynquLLFy-QPTYt78-upNOYgXh-3FglnO6XshfdKUJe4lJl69E-dZZjmbO3z4orbpuTdmMT14AW2QVThRY3rSbl_7VyMI2TIsAWc66WPXKlCGqrxTJmgYUel_etYqrCUtfo9eMVr6JmSpj4PczRCGRrOMW45dOCySvN1M_gS3SDgoK4p8Td-ViiPFPT35b4Of3Xh4';

const GRANOLA_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCk5kWbxwvk_50FXWgD26cvFOLxs9bVxd9c4opWtRlMnZNrieGODlkLn5TkDpZw5olgQNG-gtYWqM291JkjLuElsGdkg758WqcpkQomGc0T4sZbsG5HGFn7-tlzFx8n-qVekne-rtnTtmKZzdNiF4PJ_GA3cmqcmYdHQyjvABPCJteKXtakiezoKkPF5bJcRqIuUC3sE1Vi7ec1n3mDRb6auSsfeCv5x9dcHBFct-jV2gHXyZRQk4UM';

const navItems: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'scanner', label: 'Scanner', icon: 'qrcode-scan' },
  { key: 'pantry', label: 'Pantry', icon: 'fridge-outline' },
  { key: 'allergies', label: 'Allergies', icon: 'shield-heart-outline' },
  { key: 'insights', label: 'Insights', icon: 'chart-line' },
];

const ICON_GLYPHS: Record<string, string> = {
  'arrow-left': '‹',
  'account-group-outline': '♧',
  'chevron-down': '⌄',
  'qrcode-scan': '▦',
  'fridge-outline': '▣',
  'shield-heart-outline': '♡',
  'chart-line': '⌁',
  flashlight: '◉',
  'keyboard-outline': '⌨',
  'eye-outline': '◉',
  'cart-plus': '+',
  barcode: '▥',
  'arrow-right': '›',
  magnify: '⌕',
  'tune-vertical': '☷',
  'bottle-soda-outline': '▯',
  leaf: '♣',
  'food-apple-outline': '●',
  plus: '+',
  'shield-check': '✓',
  'shield-check-outline': '✓',
  'check-circle': '✓',
  'tune-variant': '☷',
  'alert-octagon-outline': '!',
  grain: '✣',
  alert: '!',
  'circle-outline': '○',
  'cash-plus': '$',
  'check-circle-outline': '✓',
  'shield-alert-outline': '!',
  'timer-sand': '⌛',
  'share-variant': '↗',
  'auto-fix': '✦',
  'alert-circle': '!',
  'calendar-check-outline': '□',
  'alert-outline': '△',
  'bell-alert-outline': '♧',
  'kitchen-counter': '▦',
  'food-variant': '●',
  account: '●',
  close: '×',
  'plus-circle': '+',
};

function Icon({
  name,
  size = 18,
  color = COLORS.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Text
      accessible
      style={{
        fontSize: size,
        lineHeight: size + 2,
        color,
        fontWeight: '700',
        textAlign: 'center',
      }}
    >
      {ICON_GLYPHS[name] ?? '•'}
    </Text>
  );
}

function Header({
  title,
  onBack,
  profiles = {},
  activeProfile = '',
  onSelectProfile = () => {},
  pantryItems = [],
  onOpenAllergies = () => {},
  hideProfileIcon = false,
}: {
  title?: string;
  onBack?: () => void;
  profiles?: Record<string, Profile>;
  activeProfile?: string;
  onSelectProfile?: (name: string) => void;
  pantryItems?: PantryItem[];
  onOpenAllergies?: (profileName?: string) => void;
  hideProfileIcon?: boolean;
}) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  const profileNames = Object.keys(profiles);
  const allergyAlerts = pantryItems.filter((item) => item.status !== 'Used').flatMap((item) =>
    profileNames.flatMap((profileName) => {
      const profile = profiles[profileName];
      const text = `${item.name} ${item.brand || ''} ${item.description || ''}`.toLowerCase();
      const triggers = [
        ...profile.allergens.map((entry) => entry.name),
        ...profile.preferences.filter((entry) => entry.enabled).map((entry) => entry.name),
      ].filter((trigger) => {
        const key = trigger.toLowerCase().replace(/[-\s]+/g, ' ').trim();
        const terms = key.includes('dairy') || key.includes('milk') ? ['dairy', 'milk', 'whey', 'casein']
          : key.includes('peanut') ? ['peanut']
          : key.includes('nut') ? ['nut', 'almond', 'cashew', 'walnut', 'hazelnut', 'pistachio']
          : key.includes('egg') ? ['egg', 'albumen']
          : key.includes('soy') ? ['soy', 'soya']
          : key.includes('gluten') ? ['gluten', 'wheat', 'barley', 'rye']
          : key.includes('shellfish') ? ['shellfish', 'shrimp', 'crab', 'lobster', 'prawn']
          : key.includes('sesame') ? ['sesame', 'tahini']
          : [key];
        return terms.some((term) => term && text.includes(term));
      });
      return triggers.length ? [{ item, profileName, triggers }] : [];
    })
  );

  return (
    <View style={[styles.header, { zIndex: 20, elevation: 5 }]}>
      <View style={styles.brandRow}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backButton}>
            <Icon name="arrow-left" size={19} />
          </Pressable>
        ) : null}
        <View>
          <Text style={styles.brand}>SafeBite</Text>
          <Text style={styles.brandSub}>{title || 'Scanner'}</Text>
        </View>
      </View>

      {!hideProfileIcon ? (
        <Pressable
          onPress={() => {
            if (profileNames.length === 0) {
              onOpenAllergies();
            } else {
              setAlertsOpen(true);
            }
          }}
          style={styles.avatarButton}
          accessibilityLabel={profileNames.length === 0 ? 'Create allergy profile' : 'View allergy alerts'}
        >
          <View style={[styles.profileIconCircle, { backgroundColor: allergyAlerts.length ? COLORS.dangerSoft : '#DBEAFE' }]}>
            <Icon name="account" size={19} color={allergyAlerts.length ? COLORS.danger : '#2563EB'} />
          </View>
          <View style={[styles.profileAlertDot, { backgroundColor: profileNames.length === 0 ? '#2563EB' : (allergyAlerts.length ? COLORS.danger : '#16A34A') }]} />
        </Pressable>
      ) : null}

      <Modal visible={alertsOpen} transparent animationType="fade" onRequestClose={() => setAlertsOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 68, paddingRight: 16 }} onPress={() => setAlertsOpen(false)}>
          <Pressable onPress={() => {}} style={{ width: 290, maxHeight: '70%', backgroundColor: COLORS.white, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: COLORS.border, elevation: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.ink, marginBottom: 4 }}>Food Safety Alerts</Text>
            <Text style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10 }}>Possible matches against household allergy and enabled dietary profiles.</Text>
            {allergyAlerts.length === 0 ? (
              <Text style={{ color: COLORS.muted, paddingVertical: 12 }}>No matching pantry items found for the current profiles.</Text>
            ) : (
              <ScrollView>
                {allergyAlerts.map((alert, index) => (
                  <Pressable key={`${alert.profileName}-${alert.item.addedAt}-${index}`} onPress={() => { onOpenAllergies(alert.profileName); setAlertsOpen(false); }} style={{ paddingVertical: 11, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                    <Text style={{ color: COLORS.danger, fontSize: 13, fontWeight: '800' }}>{alert.item.name}</Text>
                    <Text style={{ color: COLORS.ink, fontSize: 12, marginTop: 3 }}>Profile: {alert.profileName}</Text>
                    <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>Possible match: {alert.triggers.join(', ')}</Text>
                    <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700', marginTop: 5 }}>Open this allergy profile ›</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function BottomNav({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <View style={styles.bottomNav}>
      {navItems.map((item) => {
        const selected = active === item.key;
        return (
          <Pressable
            key={item.key}
            style={styles.navItem}
            onPress={() => onChange(item.key)}
          >
            <Icon
              name={item.icon}
              size={19}
              color={selected ? COLORS.primary : COLORS.muted}
            />
            <Text style={[styles.navLabel, selected && styles.navLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Pill({
  children,
  tone = 'green',
}: {
  children: React.ReactNode;
  tone?: 'green' | 'red' | 'orange' | 'gray';
}) {
  const palette = {
    green: { bg: COLORS.primarySoft, fg: COLORS.primary },
    red: { bg: COLORS.dangerSoft, fg: COLORS.danger },
    orange: { bg: COLORS.cautionSoft, fg: COLORS.caution },
    gray: { bg: '#EEF0EF', fg: COLORS.muted },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.pillText, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

type Allergen = { name: string; desc: string; severity: 'Severe' | 'Moderate' };
type Preference = { name: string; desc: string; enabled: boolean };
type Profile = {
  age: string;
  sensitivity: string;
  allergens: Allergen[];
  preferences: Preference[];
};
type PantryItem = {
  name: string;
  description?: string;
  barcode?: string;
  brand?: string;
  location: string;
  expiry: string;
  status: 'Available' | 'Used';
  category: 'Fridge' | 'Pantry';
  addedAt: number;
};

type AppState = {
  pantryItems: PantryItem[];
  profiles: Record<string, Profile>;
  activeProfile: string;
  hydrated: boolean;
};

type AppAction =
  | { type: 'HYDRATE'; payload: Partial<AppState> }
  | { type: 'ADD_PANTRY_ITEM'; payload: PantryItem }
  | { type: 'UPDATE_PANTRY_ITEM'; payload: { addedAt: number; item: PantryItem } }
  | { type: 'DELETE_PANTRY_ITEM'; payload: number }
  | { type: 'TOGGLE_PANTRY_ITEM'; payload: number }
  | { type: 'SET_PROFILES'; payload: Record<string, Profile> | ((current: Record<string, Profile>) => Record<string, Profile>) }
  | { type: 'SET_ACTIVE_PROFILE'; payload: string };

const STORAGE_KEY = 'safebite-app-state-v2';

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'HYDRATE': {
      const profiles = action.payload.profiles || state.profiles;
      const pantryItems = Array.isArray(action.payload.pantryItems) ? action.payload.pantryItems : state.pantryItems;
      const requestedProfile = action.payload.activeProfile || state.activeProfile;
      return {
        ...state,
        profiles,
        pantryItems,
        activeProfile: profiles[requestedProfile] ? requestedProfile : (Object.keys(profiles)[0] || ''),
        hydrated: true,
      };
    }
    case 'ADD_PANTRY_ITEM':
      return { ...state, pantryItems: [action.payload, ...state.pantryItems] };
    case 'UPDATE_PANTRY_ITEM':
      return { ...state, pantryItems: state.pantryItems.map((item) => item.addedAt === action.payload.addedAt ? action.payload.item : item) };
    case 'DELETE_PANTRY_ITEM':
      return { ...state, pantryItems: state.pantryItems.filter((item) => item.addedAt !== action.payload) };
    case 'TOGGLE_PANTRY_ITEM':
      return { ...state, pantryItems: state.pantryItems.map((item) => item.addedAt === action.payload ? { ...item, status: item.status === 'Used' ? 'Available' : 'Used' } : item) };
    case 'SET_PROFILES': {
      const profiles = typeof action.payload === 'function' ? action.payload(state.profiles) : action.payload;
      return { ...state, profiles, activeProfile: profiles[state.activeProfile] ? state.activeProfile : (Object.keys(profiles)[0] || '') };
    }
    case 'SET_ACTIVE_PROFILE':
      return { ...state, activeProfile: state.profiles[action.payload] ? action.payload : state.activeProfile };
    default:
      return state;
  }
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const INITIAL_PROFILES: Record<string, Profile> = {
  Leo: {
    age: '6 Years Old',
    sensitivity: 'High Sensitivity',
    allergens: [
      { name: 'Peanuts', desc: 'Anaphylaxis · Emergency EpiPen', severity: 'Severe' },
      { name: 'Tree Nuts', desc: 'Walnuts, almonds, cashews', severity: 'Severe' },
      { name: 'Sesame & Tahini', desc: 'Skin reaction & flares', severity: 'Moderate' },
    ],
    preferences: [
      { name: 'Gluten-Free', desc: 'Celiac safe', enabled: true },
      { name: 'Shellfish-Free', desc: 'Strict avoid', enabled: true },
      { name: 'Dairy-Free', desc: 'Lactose', enabled: false },
      { name: 'Egg-Free', desc: 'Albumen', enabled: false },
    ],
  },
  Emma: {
    age: '9 Years Old',
    sensitivity: 'High Sensitivity',
    allergens: [
      { name: 'Dairy / Milk', desc: 'Hives · Avoid milk proteins', severity: 'Severe' },
      { name: 'Eggs', desc: 'Reaction to egg whites', severity: 'Severe' },
      { name: 'Soy', desc: 'Mild digestive reaction', severity: 'Moderate' },
    ],
    preferences: [
      { name: 'Dairy-Free', desc: 'Strict avoid', enabled: true },
      { name: 'Egg-Free', desc: 'Strict avoid', enabled: true },
      { name: 'Nut-Free', desc: 'Household preference', enabled: false },
      { name: 'Vegetarian', desc: 'No meat', enabled: false },
    ],
  },
  Maya: {
    age: '12 Years Old',
    sensitivity: 'Moderate Sensitivity',
    allergens: [
      { name: 'Dairy / Milk Proteins', desc: 'Lactose sensitivity', severity: 'Moderate' },
      { name: 'Soy', desc: 'Digestive sensitivity', severity: 'Moderate' },
      { name: 'Shellfish', desc: 'Avoid shrimp & crab', severity: 'Severe' },
    ],
    preferences: [
      { name: 'Low-Lactose', desc: 'Limit dairy', enabled: true },
      { name: 'Gluten-Free', desc: 'Preferred', enabled: false },
      { name: 'Egg-Free', desc: 'Preferred', enabled: true },
      { name: 'Pescatarian', desc: 'Fish allowed', enabled: false },
    ],
  },
  Sam: {
    age: 'Adult',
    sensitivity: 'Low Sensitivity',
    allergens: [
      { name: 'Shellfish', desc: 'Avoid shrimp, crab & lobster', severity: 'Moderate' },
      { name: 'Sesame & Tahini', desc: 'Mild reaction', severity: 'Moderate' },
    ],
    preferences: [
      { name: 'Vegetarian', desc: 'No meat', enabled: false },
      { name: 'Low-Sodium', desc: 'Limit added salt', enabled: true },
      { name: 'Nut-Free', desc: 'Household preference', enabled: false },
      { name: 'Dairy-Free', desc: 'Preference', enabled: false },
    ],
  },
};

const INITIAL_PANTRY: PantryItem[] = [
  { name: 'Organic Whole Milk', location: 'Fridge • Horizon Organic', expiry: 'Exp. Tomorrow • 1 Gal', status: 'Available', category: 'Fridge', addedAt: Date.now() - 86400000 * 3 },
  { name: 'Baby Spinach', location: 'Crisper • Earthbound Farm', expiry: 'Exp. in 2 days • 5 oz', status: 'Available', category: 'Fridge', addedAt: Date.now() - 86400000 * 2 },
  { name: 'Chobani Greek Yogurt Blueberry', location: 'Fridge • Dairy Shelf', expiry: 'Good for 4 days • 5.3 oz', status: 'Available', category: 'Fridge', addedAt: Date.now() - 86400000 },
  { name: 'Barilla Gluten-Free Penne', location: 'Pantry • Shelf 2B', expiry: 'Good for 142 days • 12 oz', status: 'Available', category: 'Pantry', addedAt: Date.now() - 86400000 * 8 },
  { name: 'Silk Almond Milk Unsweetened', location: 'Fridge • Door Compartment', expiry: 'Good for 12 days • 64 fl oz', status: 'Available', category: 'Fridge', addedAt: Date.now() - 86400000 * 4 },
];

function ProductSafetyCard({ onDetails, onAddToPantry }: { onDetails: () => void; onAddToPantry: () => void }) {
  return (
    <View style={styles.safetyCard}>
      <View style={styles.productTop}>
        <Image source={{ uri: GRANOLA_IMAGE }} style={styles.productThumbLarge} />
        <View style={{ flex: 1 }}>
          <Text style={styles.productBrand}>NATURE VALLEY</Text>
          <Text style={styles.productTitle}>Crunchy Granola Bars</Text>
          <Text style={styles.productMeta}>Oats 'n Honey • 12 Bars (258g)</Text>
        </View>
        <Text style={styles.justNow}>Just now</Text>
      </View>

      <View style={styles.alertBox}>
        <Icon name="alert" size={16} color={COLORS.danger} />
        <View style={{ flex: 1 }}>
          <Text style={styles.alertTitle}>Contains Almonds & Soy</Text>
          <Text style={styles.alertSub}>Shared equipment with Peanuts</Text>
        </View>
      </View>

      <View style={styles.conflictRow}>
        <View style={styles.initialCircle}>
          <Text style={styles.initialText}>L</Text>
        </View>
        <Text style={styles.conflictText}>Conflicts with Leo's profile</Text>
        <Text style={styles.severeText}>Severe Risk</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.primaryAction} onPress={onDetails}>
          <Icon name="eye-outline" size={15} color={COLORS.white} />
          <Text style={styles.primaryActionText}>View Full Details</Text>
        </Pressable>
        <Pressable style={styles.secondaryAction} onPress={onAddToPantry}>
          <Icon name="cart-plus" size={15} color={COLORS.primary} />
          <Text style={styles.secondaryActionText}>Add to Pantry</Text>
        </Pressable>
      </View>
    </View>
  );
}


function ScannerHome({
  onOpenScanner,
  onManualSearch,
  onManualAdd,
  pantryCount,
  expiringCount,
  profileCount,
  profiles,
  activeProfile,
  onSelectProfile,
  pantryItems,
  onOpenAllergies,
}: {
  onOpenScanner: () => void;
  onManualSearch: (value: string, mode: 'barcode' | 'description') => void;
  onManualAdd: (product: { name: string; brand?: string; barcode?: string; description?: string; quantity?: string; expiryDate?: string; location?: string; category?: 'Fridge' | 'Pantry' }) => void;
  pantryCount: number;
  expiringCount: number;
  profileCount: number;
  profiles: Record<string, Profile>;
  activeProfile: string;
  onSelectProfile: (name: string) => void;
  pantryItems: PantryItem[];
  onOpenAllergies: (profileName?: string) => void;
}) {
  const [manualVisible, setManualVisible] = useState(false);
  const [manualMode, setManualMode] = useState<'barcode' | 'description'>('description');
  const [manualValue, setManualValue] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualBrand, setManualBrand] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualIngredients, setManualIngredients] = useState('');
  const [manualQuantity, setManualQuantity] = useState('');
  const [manualExpiry, setManualExpiry] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [manualCategory, setManualCategory] = useState<'Fridge' | 'Pantry'>('Pantry');

  const resetManualForm = () => {
    setManualValue(''); setManualName(''); setManualBrand(''); setManualBarcode('');
    setManualIngredients(''); setManualQuantity(''); setManualExpiry('');
    setManualLocation(''); setManualCategory('Pantry');
  };

  const submitManualEntry = () => {
    if (manualMode === 'barcode') {
      if (!manualValue.trim()) return;
      onManualSearch(manualValue.trim(), 'barcode');
    } else {
      if (!manualName.trim()) return;
      onManualAdd({
        name: manualName.trim(), brand: manualBrand.trim(), barcode: manualBarcode.trim(),
        description: manualIngredients.trim(), quantity: manualQuantity.trim(),
        expiryDate: manualExpiry.trim(), location: manualLocation.trim(), category: manualCategory,
      });
    }
    resetManualForm();
    setManualVisible(false);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 110,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Header title="Scanner" profiles={profiles} activeProfile={activeProfile} onSelectProfile={onSelectProfile} pantryItems={pantryItems} onOpenAllergies={onOpenAllergies} />
      <View style={{ marginBottom: 22 }}>
        <Text style={{ fontSize: 13, color: COLORS.muted }}>
          YOUR FOOD SAFETY DASHBOARD
        </Text>

        <Text style={{
          fontSize: 27,
          fontWeight: '800',
          color: COLORS.ink,
          marginTop: 5,
        }}>
          Stay SafeBite!
        </Text>

        <Text style={{
          fontSize: 14,
          color: COLORS.muted,
          marginTop: 7,
          lineHeight: 21,
        }}>
          Check your food products and keep track of potential allergens in your household.
        </Text>
      </View>

      <View style={{
        backgroundColor: COLORS.primarySoft,
        borderRadius: 18,
        padding: 20,
        marginBottom: 20,
      }}>
        <Text style={{
          fontSize: 17,
          fontWeight: '800',
          color: COLORS.ink,
          marginBottom: 7,
        }}>
          Check a food product
        </Text>

        <Text style={{
          fontSize: 13,
          color: COLORS.muted,
          lineHeight: 20,
          marginBottom: 18,
        }}>
          Scan a barcode using your camera or enter product information manually.
        </Text>

        <Pressable
          onPress={onOpenScanner}
          style={{
            backgroundColor: COLORS.primary,
            padding: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginBottom: 10,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 9,
          }}
        >
          <Icon name="qrcode-scan" size={20} color={COLORS.white} />
          <Text style={{
            color: COLORS.white,
            fontSize: 14,
            fontWeight: '800',
          }}>
            Scan with Camera
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setManualVisible(true)}
          style={{
            backgroundColor: COLORS.white,
            padding: 16,
            borderRadius: 12,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 9,
            borderWidth: 1,
            borderColor: COLORS.primary,
          }}
        >
          <Icon name="keyboard-outline" size={19} color={COLORS.primary} />
          <Text style={{
            color: COLORS.primary,
            fontSize: 14,
            fontWeight: '800',
          }}>
            Enter Product Manually
          </Text>
        </Pressable>
      </View>

      <Text style={{
        fontSize: 17,
        fontWeight: '800',
        color: COLORS.ink,
        marginBottom: 12,
      }}>
        Your Pantry Overview
      </Text>

      <View style={{
        flexDirection: 'row',
        gap: 9,
        marginBottom: 20,
      }}>
        <View style={{
          flex: 1,
          backgroundColor: COLORS.white,
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}>
          <Icon name="fridge-outline" size={21} color={COLORS.primary} />
          <Text style={{
            fontSize: 23,
            fontWeight: '800',
            color: COLORS.ink,
            marginTop: 8,
          }}>
            {pantryCount}
          </Text>
          <Text style={{ fontSize: 11, color: COLORS.muted }}>
            Pantry Items
          </Text>
        </View>

        <View style={{
          flex: 1,
          backgroundColor: COLORS.white,
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}>
          <Icon name="alert-circle" size={21} color={COLORS.caution} />
          <Text style={{
            fontSize: 23,
            fontWeight: '800',
            color: COLORS.ink,
            marginTop: 8,
          }}>
            {expiringCount}
          </Text>
          <Text style={{ fontSize: 11, color: COLORS.muted }}>
            Expiring Soon
          </Text>
        </View>

        <View style={{
          flex: 1,
          backgroundColor: COLORS.white,
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}>
          <Icon name="account-group-outline" size={21} color={COLORS.primary} />
          <Text style={{
            fontSize: 23,
            fontWeight: '800',
            color: COLORS.ink,
            marginTop: 8,
          }}>
            {profileCount}
          </Text>
          <Text style={{ fontSize: 11, color: COLORS.muted }}>
            Profiles
          </Text>
        </View>
      </View>

      <View style={{
        backgroundColor: COLORS.white,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        <View style={{
          backgroundColor: COLORS.primarySoft,
          width: 42,
          height: 42,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon name="shield-check" size={23} color={COLORS.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{
            fontWeight: '800',
            color: COLORS.ink,
            fontSize: 14,
          }}>
            Your safety matters
          </Text>
          <Text style={{
            fontSize: 12,
            color: COLORS.muted,
            marginTop: 4,
            lineHeight: 18,
          }}>
            Always check product ingredients against your household allergy profiles.
          </Text>
        </View>
      </View>

      <Modal
        visible={manualVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setManualVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.detailModal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Manual Product Entry</Text>
                <Text style={styles.modalSubtitle}>
                  Enter a barcode or product description.
                </Text>
              </View>

              <Pressable
                style={styles.modalClose}
                onPress={() => setManualVisible(false)}
              >
                <Icon name="close" size={18} color={COLORS.muted} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <Pressable
                onPress={() => {
                  setManualMode('barcode');
                  setManualValue('');
                }}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: manualMode === 'barcode'
                    ? COLORS.primary
                    : COLORS.primarySoft,
                }}
              >
                <Text style={{
                  color: manualMode === 'barcode' ? COLORS.white : COLORS.primary,
                  fontWeight: '700',
                }}>
                  Barcode
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setManualMode('description');
                  setManualValue('');
                }}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: manualMode === 'description'
                    ? COLORS.primary
                    : COLORS.primarySoft,
                }}
              >
                <Text style={{
                  color: manualMode === 'description' ? COLORS.white : COLORS.primary,
                  fontWeight: '700',
                }}>
                  Description
                </Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 430 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {manualMode === 'barcode' ? (
                <>
                  <Text style={styles.fieldLabel}>Product barcode</Text>
                  <TextInput style={styles.modalInput} value={manualValue} onChangeText={setManualValue} placeholder="Enter or paste barcode number" placeholderTextColor={COLORS.muted} keyboardType="numeric" autoCapitalize="none" />
                  <Text style={styles.modalSubtitle}>SafeBite will look up the barcode and add the product to your Pantry. You can edit its details afterward.</Text>
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Product name *</Text>
                  <TextInput style={styles.modalInput} value={manualName} onChangeText={setManualName} placeholder="e.g. Whole Milk" placeholderTextColor={COLORS.muted} />
                  <Text style={styles.fieldLabel}>Brand (optional)</Text>
                  <TextInput style={styles.modalInput} value={manualBrand} onChangeText={setManualBrand} placeholder="Brand name" placeholderTextColor={COLORS.muted} />
                  <Text style={styles.fieldLabel}>Barcode (optional)</Text>
                  <TextInput style={styles.modalInput} value={manualBarcode} onChangeText={setManualBarcode} placeholder="Product barcode" placeholderTextColor={COLORS.muted} keyboardType="numeric" />
                  <Text style={styles.fieldLabel}>Ingredients / product description</Text>
                  <TextInput style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]} value={manualIngredients} onChangeText={setManualIngredients} placeholder="Type ingredients or product details" placeholderTextColor={COLORS.muted} multiline />
                  <Text style={styles.fieldLabel}>Quantity</Text>
                  <TextInput style={styles.modalInput} value={manualQuantity} onChangeText={setManualQuantity} placeholder="e.g. 1 bottle / 500 g" placeholderTextColor={COLORS.muted} />
                  <Text style={styles.fieldLabel}>Expiry date</Text>
                  <TextInput style={styles.modalInput} value={manualExpiry} onChangeText={setManualExpiry} placeholder="e.g. 2026-12-30 or Not set" placeholderTextColor={COLORS.muted} />
                  <Text style={styles.fieldLabel}>Storage location</Text>
                  <TextInput style={styles.modalInput} value={manualLocation} onChangeText={setManualLocation} placeholder="e.g. Fridge door / Shelf 2" placeholderTextColor={COLORS.muted} />
                  <Text style={styles.fieldLabel}>Storage category</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    {(['Pantry', 'Fridge'] as const).map((value) => (
                      <Pressable key={value} onPress={() => setManualCategory(value)} style={{ flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', backgroundColor: manualCategory === value ? COLORS.primary : COLORS.primarySoft }}>
                        <Text style={{ color: manualCategory === value ? COLORS.white : COLORS.primary, fontWeight: '700' }}>{value}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
            <Pressable style={[styles.modalPrimaryButton, { marginTop: 12 }]} onPress={submitManualEntry}>
              <Text style={styles.modalPrimaryText}>{manualMode === 'barcode' ? 'Look Up & Add to Pantry' : 'Add Product to Pantry'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}



function PantryScreen({
  items,
  onUseItem,
  onEditItem,
  onDeleteItem,
  profiles,
  activeProfile,
  onSelectProfile,
  onOpenAllergies,
}: {
  items: PantryItem[];
  onUseItem: (item: PantryItem) => void;
  onEditItem: (original: PantryItem, updated: PantryItem) => void;
  onDeleteItem: (item: PantryItem) => void;
  profiles: Record<string, Profile>;
  activeProfile: string;
  onSelectProfile: (name: string) => void;
  onOpenAllergies: (profileName?: string) => void;
}) {
  const notify = useToast();
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<PantryItem | null>(null);
  const [removingItem, setRemovingItem] = useState<PantryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [editCategory, setEditCategory] = useState<'Fridge' | 'Pantry'>('Pantry');

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !q || `${item.name} ${item.brand || ''} ${item.description || ''} ${item.barcode || ''} ${item.location} ${item.expiry} ${item.category}`.toLowerCase().includes(q);
      const matchesFilter = filter === 'All' ||
        (filter === 'Expiring Soon' && /tomorrow|in [1-3] days/i.test(item.expiry) && item.status !== 'Used') ||
        (filter === 'Fridge' && item.category === 'Fridge') ||
        (filter === 'Pantry' && item.category === 'Pantry');
      return matchesSearch && matchesFilter;
    });
  }, [items, query, filter]);

  const availableCount = items.filter((item) => item.status !== 'Used').length;
  const expiringCount = items.filter((item) => /tomorrow|in [1-3] days/i.test(item.expiry) && item.status !== 'Used').length;
  const fridgeCount = items.filter((item) => item.category === 'Fridge' && item.status !== 'Used').length;
  const pantryCount = items.filter((item) => item.category === 'Pantry' && item.status !== 'Used').length;
  const filters = [
    ['All', `All (${availableCount})`],
    ['Expiring Soon', `Expiring Soon (${expiringCount})`],
    ['Fridge', `Fridge (${fridgeCount})`],
    ['Pantry', `Pantry (${pantryCount})`],
  ] as const;

  const openEdit = (item: PantryItem) => {
    setEditing(item);
    setEditName(item.name);
    setEditBrand(item.brand || '');
    setEditDescription(item.description || '');
    setEditLocation(item.location);
    setEditExpiry(item.expiry);
    setEditCategory(item.category);
  };

  const saveEdit = () => {
    if (!editing || !editName.trim()) {
      notify('Product name is required');
      return;
    }
    onEditItem(editing, { ...editing, name: editName.trim(), brand: editBrand.trim(), description: editDescription.trim(), location: editLocation.trim() || 'Pantry • Unassigned', expiry: editExpiry.trim() || 'Expiry not set', category: editCategory });
    setEditing(null);
  };

  const handleConfirmRemove = () => {
  if (!removingItem) return;

  const itemName = removingItem.name;

  // Delete the selected pantry item
  onDeleteItem(removingItem);

  // Close the confirmation popup
  setRemovingItem(null);

  // Show success notification
  notify(`${itemName} removed from your Pantry`);
};

  return (
    <View style={styles.screen}>
      <Header title="Pantry" profiles={profiles} activeProfile={activeProfile} onSelectProfile={onSelectProfile} pantryItems={items} onOpenAllergies={onOpenAllergies} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.searchBarInputWrap}>
          <Icon name="magnify" size={18} color={COLORS.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search items, ingredients, barcode..." placeholderTextColor={COLORS.muted} style={styles.searchInput} autoCapitalize="none" returnKeyType="search" />
          {query.length > 0 ? <Pressable onPress={() => setQuery('')} style={styles.clearSearchButton}><Icon name="close" size={13} color={COLORS.muted} /></Pressable> : null}
          <Icon name="tune-vertical" size={17} color={COLORS.primary} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {filters.map(([key, label]) => {
            const selected = filter === key;
            return <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filterChip, selected && styles.filterChipActive]}><Text style={[styles.filterText, selected && styles.filterTextActive]}>{label}</Text></Pressable>;
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Smart Pantry</Text><Text style={styles.listMeta}>{filteredItems.length} product{filteredItems.length === 1 ? '' : 's'} stored</Text></View>
          <Pill tone="orange">{expiringCount} expiring</Pill>
        </View>

        {filteredItems.length === 0 ? (
          <View style={styles.emptyState}><Icon name="magnify" size={24} color={COLORS.muted} /><Text style={styles.emptyTitle}>No pantry items found</Text><Text style={styles.emptyText}>Scan a product or enter its description from the Scanner dashboard to add it here.</Text></View>
        ) : filteredItems.map((item, index) => (
          <View style={[styles.pantryCard, item.status === 'Used' && styles.pantryCardUsed]} key={`${item.addedAt}-${index}`}>
            <View style={styles.pantryMainPress}>
              <View style={styles.pantryThumb}>{index % 3 === 0 ? <Icon name="bottle-soda-outline" size={22} color={COLORS.primary} /> : index % 3 === 1 ? <Icon name="leaf" size={22} color={COLORS.primary} /> : <Icon name="food-apple-outline" size={22} color={COLORS.primary} />}</View>
              <View style={styles.listText}>
                <Text style={styles.listTitle} numberOfLines={1}>{item.name}</Text>
                {item.brand ? <Text style={styles.listMeta}>{item.brand}</Text> : null}
                <Text style={styles.listMeta}>{item.location}</Text>
                <Text style={styles.listMeta}>{item.expiry}</Text>
                {item.barcode ? <Text style={styles.listMeta}>Barcode: {item.barcode}</Text> : null}
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 7 }}>
              <Pressable style={[styles.usedButton, item.status === 'Used' && styles.usedButtonDone]} onPress={() => onUseItem(item)}>
                <Icon name="check-circle" size={13} color={item.status === 'Used' ? COLORS.primary : COLORS.white} />
                <Text style={[styles.usedButtonText, item.status === 'Used' && styles.usedButtonTextDone]}>{item.status === 'Used' ? 'Used Up' : 'Available'}</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable onPress={() => openEdit(item)} style={{ padding: 6, borderRadius: 7, backgroundColor: COLORS.primarySoft }}><Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '800' }}>Edit</Text></Pressable>
                <Pressable
  onPress={() => setRemovingItem(item)}
  style={{
    padding: 6,
    borderRadius: 7,
    backgroundColor: COLORS.dangerSoft,
  }}
>
  <Text style={{ color: COLORS.danger, fontSize: 11, fontWeight: '800' }}>
    Remove
  </Text>
</Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}><View style={styles.detailModal}>
          <View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={styles.modalTitle}>Edit Pantry Product</Text><Text style={styles.modalSubtitle}>Update the product details and storage information.</Text></View><Pressable style={styles.modalClose} onPress={() => setEditing(null)}><Icon name="close" size={18} color={COLORS.muted} /></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <TextInput style={styles.modalInput} value={editName} onChangeText={setEditName} placeholder="Product name" placeholderTextColor={COLORS.muted} />
            <TextInput style={styles.modalInput} value={editBrand} onChangeText={setEditBrand} placeholder="Brand (optional)" placeholderTextColor={COLORS.muted} />
            <TextInput style={[styles.modalInput, { height: 76, textAlignVertical: 'top', paddingTop: 10 }]} multiline value={editDescription} onChangeText={setEditDescription} placeholder="Ingredients / product description" placeholderTextColor={COLORS.muted} />
            <TextInput style={styles.modalInput} value={editLocation} onChangeText={setEditLocation} placeholder="Storage location" placeholderTextColor={COLORS.muted} />
            <TextInput style={styles.modalInput} value={editExpiry} onChangeText={setEditExpiry} placeholder="Expiry information" placeholderTextColor={COLORS.muted} />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {(['Fridge', 'Pantry'] as const).map((value) => <Pressable key={value} onPress={() => setEditCategory(value)} style={{ flex: 1, padding: 11, borderRadius: 9, alignItems: 'center', backgroundColor: editCategory === value ? COLORS.primary : COLORS.primarySoft }}><Text style={{ color: editCategory === value ? COLORS.white : COLORS.primary, fontWeight: '700' }}>{value}</Text></Pressable>)}
            </View>
            <Pressable style={styles.modalPrimaryButton} onPress={saveEdit}><Text style={styles.modalPrimaryText}>Save Changes</Text></Pressable>
          </ScrollView>
        </View></View>
      </Modal>


<Modal
  visible={removingItem !== null}
  transparent
  animationType="fade"
  onRequestClose={() => setRemovingItem(null)}
>
  <View style={styles.modalBackdrop}>
    <View style={styles.detailModal}>
      <View style={styles.modalHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.modalTitle}>Remove Pantry Item</Text>
          <Text style={styles.modalSubtitle}>
            Are you sure you want to remove this item?
          </Text>
        </View>

        <Pressable
          style={styles.modalClose}
          onPress={() => setRemovingItem(null)}
        >
          <Icon name="close" size={18} color={COLORS.muted} />
        </Pressable>
      </View>

      <View
        style={{
          backgroundColor: COLORS.dangerSoft,
          borderRadius: 12,
          padding: 15,
          marginBottom: 20,
        }}
      >
        <Text style={{
          fontSize: 14,
          fontWeight: '800',
          color: COLORS.ink,
        }}>
          {removingItem?.name}
        </Text>

        <Text style={{
          fontSize: 12,
          color: COLORS.muted,
          marginTop: 5,
        }}>
          This item will be removed from your pantry.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={() => setRemovingItem(null)}
          style={styles.modalSecondaryButton}
        >
          <Text style={styles.modalSecondaryText}>Cancel</Text>
        </Pressable>

        <Pressable
          onPress={handleConfirmRemove}
          style={styles.modalDangerButton}
        >
          <Text style={styles.modalDangerText}>Remove Item</Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>


    </View>
  );
}

function AllergiesScreen({ profiles, setProfiles, activeProfile, onActiveProfileChange }: { profiles: Record<string, Profile>; setProfiles: React.Dispatch<React.SetStateAction<Record<string, Profile>>>; activeProfile: string; onActiveProfileChange: (name: string) => void }) {
  const addOptions = [
    { name: 'Peanuts', desc: 'Peanuts & peanut products', severity: 'Severe' as const },
    { name: 'Tree Nuts', desc: 'Walnuts, almonds, cashews', severity: 'Severe' as const },
    { name: 'Dairy / Milk', desc: 'Milk and milk proteins', severity: 'Severe' as const },
    { name: 'Eggs', desc: 'Eggs & egg ingredients', severity: 'Severe' as const },
    { name: 'Shellfish', desc: 'Shrimp, crab, lobster', severity: 'Severe' as const },
    { name: 'Soy', desc: 'Soybeans & soy ingredients', severity: 'Moderate' as const },
    { name: 'Sesame & Tahini', desc: 'Sesame seeds & tahini', severity: 'Moderate' as const },
    { name: 'Gluten', desc: 'Wheat, barley & rye', severity: 'Moderate' as const },
  ];

  const notify = useToast();
  const [selected, setSelected] = useState(activeProfile || Object.keys(profiles)[0] || '');
  const [popup, setPopup] = useState<'add' | 'remove' | 'addProfile' | 'removeProfile' | null>(null);
  const [popupItem, setPopupItem] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState('');

  useEffect(() => {
    if (activeProfile && profiles[activeProfile] && selected !== activeProfile) setSelected(activeProfile);
    else if (!profiles[selected]) setSelected(Object.keys(profiles)[0] || '');
  }, [profiles, selected, activeProfile]);

  useEffect(() => {
    if (selected) onActiveProfileChange(selected);
  }, [selected]);

  const profile = profiles[selected];
  if (!profile) {
    return (
      <View style={styles.screen}>
        <Header title="Allergies" hideProfileIcon />
        <ScrollView contentContainerStyle={[styles.scrollContent, { flexGrow: 1, justifyContent: 'center' }]} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32 }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.primarySoft || '#E8F7EF', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Icon name="shield-check-outline" size={42} color={COLORS.primary} />
            </View>
            <Text style={[styles.pageTitle, { textAlign: 'center', marginBottom: 8 }]}>Set Up Your Allergy Profiles</Text>
            <Text style={[styles.pageSubtitle, { textAlign: 'center', lineHeight: 20, marginBottom: 22 }]}>There are no household profiles yet. Add a profile to keep each person's allergens and dietary preferences in one place.</Text>
            <Pressable style={[styles.modalPrimaryButton, { alignSelf: 'stretch', paddingVertical: 15 }]} onPress={() => { setNewProfileName(''); setPopup('addProfile'); }}>
              <Text style={styles.modalPrimaryText}>＋ Add First Profile</Text>
            </Pressable>
          </View>
        </ScrollView>
        <Modal visible={popup === 'addProfile'} transparent animationType="fade" onRequestClose={() => setPopup(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.triggerModal}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}><Text style={styles.modalTitle}>Add Household Profile</Text><Text style={styles.modalSubtitle}>Create a safety profile with its own allergens and dietary restrictions.</Text></View>
                <Pressable style={styles.modalClose} onPress={() => setPopup(null)}><Icon name="close" size={18} color={COLORS.muted} /></Pressable>
              </View>
              <TextInput value={newProfileName} onChangeText={setNewProfileName} placeholder="Enter name (e.g. Grandma)" placeholderTextColor={COLORS.muted} style={styles.modalInput} autoFocus />
              <Pressable style={styles.modalPrimaryButton} onPress={addProfile}><Text style={styles.modalPrimaryText}>Create Profile</Text></Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const updateProfile = (updater: (current: Profile) => Profile) => {
    setProfiles((current) => ({ ...current, [selected]: updater(current[selected]) }));
  };

  const togglePreference = (name: string) => {
    const item = profile.preferences.find((preference) => preference.name === name);
    updateProfile((current) => ({ ...current, preferences: current.preferences.map((p) => p.name === name ? { ...p, enabled: !p.enabled } : p) }));
    notify(`${name} ${item?.enabled ? 'unchecked' : 'checked'} for ${selected}`);
  };

  const addAllergen = (option: Allergen) => {
    if (profile.allergens.some((item) => item.name === option.name)) {
      notify(`${option.name} is already on ${selected}'s list`);
      return;
    }
    updateProfile((current) => ({ ...current, allergens: [...current.allergens, option] }));
    setPopup(null);
    setPopupItem(null);
    notify(`${option.name} added to ${selected}'s trigger list`);
  };

  const removeAllergen = (name: string) => {
    updateProfile((current) => ({ ...current, allergens: current.allergens.filter((item) => item.name !== name) }));
    setPopup(null);
    setPopupItem(null);
    notify(`${name} removed from ${selected}'s trigger list`);
  };

  function addProfile() {
    const name = newProfileName.trim();
    if (!name) {
      notify('Enter a profile name first');
      return;
    }
    if (profiles[name]) {
      notify(`${name} already has a profile`);
      return;
    }
    const newProfile: Profile = {
      age: 'New Household Member',
      sensitivity: 'Not Set',
      allergens: [],
      preferences: [
        { name: 'Nut-Free', desc: 'Household preference', enabled: false },
        { name: 'Dairy-Free', desc: 'Preference', enabled: false },
        { name: 'Gluten-Free', desc: 'Preference', enabled: false },
        { name: 'Vegetarian', desc: 'No meat', enabled: false },
      ],
    };
    setProfiles((current) => ({ ...current, [name]: newProfile }));
    setSelected(name);
    onActiveProfileChange(name);
    setNewProfileName('');
    setPopup(null);
    notify(`${name}'s profile was added`);
  }

  const removeProfile = () => {
    setProfiles((current) => {
      const next = { ...current };
      delete next[selected];
      return next;
    });
    const remaining = Object.keys(profiles).filter((name) => name !== selected);
    const nextSelected = remaining[0] || '';
    setSelected(nextSelected);
    onActiveProfileChange(nextSelected);
    setPopup(null);
    setPopupItem(null);
    notify(`${selected}'s profile was removed`);
  };

  return (
    <View style={styles.screen}>
      <Header title="Allergies" hideProfileIcon />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.shieldLabel}><Icon name="shield-check" size={15} color={COLORS.primary} /><Text style={styles.shieldLabelText}>FAMILY SHIELD ACTIVE</Text></View>
        <View style={styles.titleRow}>
          <View><Text style={styles.pageTitle}>Allergen Safeguard</Text><Text style={styles.pageSubtitle}>Household profiles & instant alerts</Text></View>
          <Icon name="shield-check-outline" size={22} color={COLORS.primary} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
          {Object.keys(profiles).map((person) => (
            <Pressable key={person} onPress={() => { setSelected(person); onActiveProfileChange(person); }} style={[styles.personChip, selected === person && styles.personChipActive]}>
              <View style={styles.personAvatar}><Icon name="account" size={15} color={COLORS.muted} /></View>
              <Text style={[styles.personName, selected === person && styles.personNameActive]}>{person}</Text>
              {selected === person && <Icon name="check-circle" size={14} color={COLORS.primary} />}
            </Pressable>
          ))}
          <Pressable style={styles.personChip} onPress={() => { setNewProfileName(''); setPopup('addProfile'); }}>
            <Icon name="plus" size={16} color={COLORS.primary} /><Text style={styles.personName}>Add</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatar}><Icon name="account" size={25} color={COLORS.muted} /></View>
            <View style={{ flex: 1 }}><Text style={styles.profileName}>{selected}'s Profile</Text><Text style={styles.profileMeta}>{profile.age} · {profile.sensitivity}</Text></View>
            <Pressable style={styles.removeProfileButton} onPress={() => setPopup('removeProfile')}><Icon name="close" size={14} color={COLORS.danger} /></Pressable>
          </View>
          <View style={styles.statRow}>
            <StatBox value={String(profile.allergens.filter((item) => item.severity === 'Severe').length)} label="Severe" />
            <StatBox value={String(profile.allergens.filter((item) => item.severity === 'Moderate').length)} label="Moderate" />
            <StatBox value={String(profile.preferences.filter((item) => item.enabled).length)} label="Dietary" />
          </View>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Allergen Triggers</Text><Text style={styles.instantAlert}>INSTANT ALERT</Text></View>
        {profile.allergens.map((item) => (
          <View style={styles.allergenRow} key={item.name}>
            <View style={styles.allergenIcon}><Icon name={item.severity === 'Moderate' ? 'grain' : 'alert-octagon-outline'} size={18} color={item.severity === 'Moderate' ? COLORS.caution : COLORS.danger} /></View>
            <View style={{ flex: 1 }}><View style={styles.allergenTitleRow}><Text style={styles.allergenName}>{item.name}</Text><Pill tone={item.severity === 'Moderate' ? 'orange' : 'red'}>{item.severity}</Pill></View><Text style={styles.listMeta}>{item.desc}</Text></View>
            <Pressable style={styles.removeTriggerButton} onPress={() => { setPopupItem(item.name); setPopup('remove'); }}><Icon name="close" size={13} color={COLORS.danger} /></Pressable>
          </View>
        ))}

        <Pressable style={styles.outlineAdd} onPress={() => { setPopup('add'); setPopupItem(null); }}><Icon name="plus" size={15} color={COLORS.primary} /><Text style={styles.outlineAddText}>Add Trigger or Ingredient</Text></Pressable>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Dietary Preferences</Text><Text style={styles.sectionCount}>Tap to check / uncheck</Text></View>
        <View style={styles.preferenceGrid}>
          {profile.preferences.map((item) => (
            <Pressable style={[styles.preferenceCard, item.enabled && styles.preferenceCardActive]} key={item.name} onPress={() => togglePreference(item.name)}>
              <View style={styles.preferenceTopRow}><Text style={styles.preferenceName}>{item.name}</Text><View style={[styles.preferenceCheck, item.enabled && styles.preferenceCheckActive]}><Icon name={item.enabled ? 'check-circle' : 'circle-outline'} size={15} color={item.enabled ? COLORS.white : COLORS.muted} /></View></View>
              <Text style={styles.preferenceDesc}>{item.desc}</Text><Text style={[styles.preferenceState, item.enabled && styles.preferenceStateActive]}>{item.enabled ? 'Checked' : 'Unchecked'}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal visible={popup !== null} transparent animationType="fade" onRequestClose={() => { setPopup(null); setPopupItem(null); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.triggerModal}>
            {popup === 'addProfile' ? (
              <View>
                <View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={styles.modalTitle}>Add Household Profile</Text><Text style={styles.modalSubtitle}>Create a separate safety profile with its own allergens and dietary restrictions.</Text></View><Pressable style={styles.modalClose} onPress={() => setPopup(null)}><Icon name="close" size={18} color={COLORS.muted} /></Pressable></View>
                <TextInput value={newProfileName} onChangeText={setNewProfileName} placeholder="Enter name (e.g. Grandma)" placeholderTextColor={COLORS.muted} style={styles.modalInput} autoFocus />
                <Pressable style={styles.modalPrimaryButton} onPress={addProfile}><Text style={styles.modalPrimaryText}>Create Profile</Text></Pressable>
              </View>
            ) : popup === 'removeProfile' ? (
              <View>
                <View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={styles.modalTitle}>Remove {selected}'s Profile?</Text><Text style={styles.modalSubtitle}>This will delete all associated custom allergen triggers and preferences.</Text></View><Pressable style={styles.modalClose} onPress={() => setPopup(null)}><Icon name="close" size={18} color={COLORS.muted} /></Pressable></View>
                <View style={styles.modalButtonRow}>
                  <Pressable style={styles.modalSecondaryButton} onPress={() => setPopup(null)}><Text style={styles.modalSecondaryText}>Cancel</Text></Pressable>
                  <Pressable style={styles.modalDangerButton} onPress={removeProfile}><Text style={styles.modalDangerText}>Remove</Text></Pressable>
                </View>
              </View>
            ) : popup === 'add' ? (
              <View>
                <View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={styles.modalTitle}>Add Allergen Trigger</Text><Text style={styles.modalSubtitle}>Select common allergen or ingredient to safeguard {selected}.</Text></View><Pressable style={styles.modalClose} onPress={() => setPopup(null)}><Icon name="close" size={18} color={COLORS.muted} /></Pressable></View>
                <ScrollView style={{ maxHeight: 280 }}>
                  {addOptions.map((opt) => (
                    <Pressable key={opt.name} style={styles.modalOptionRow} onPress={() => addAllergen(opt)}>
                      <View style={{ flex: 1 }}><Text style={styles.modalOptionTitle}>{opt.name}</Text><Text style={styles.modalOptionSub}>{opt.desc}</Text></View>
                      <Pill tone={opt.severity === 'Severe' ? 'red' : 'orange'}>{opt.severity}</Pill>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : popup === 'remove' && popupItem ? (
              <View>
                <View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={styles.modalTitle}>Remove {popupItem}?</Text><Text style={styles.modalSubtitle}>Instant alerts will no longer scan for this item on {selected}'s profile.</Text></View><Pressable style={styles.modalClose} onPress={() => setPopup(null)}><Icon name="close" size={18} color={COLORS.muted} /></Pressable></View>
                <View style={styles.modalButtonRow}>
                  <Pressable style={styles.modalSecondaryButton} onPress={() => setPopup(null)}><Text style={styles.modalSecondaryText}>Cancel</Text></Pressable>
                  <Pressable style={styles.modalDangerButton} onPress={() => removeAllergen(popupItem)}><Text style={styles.modalDangerText}>Remove Trigger</Text></Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InsightsScreen({ pantryItems, profiles, activeProfile, onSelectProfile }: { pantryItems: PantryItem[]; profiles: Record<string, Profile>; activeProfile: string; onSelectProfile: (name: string) => void }) {
  const [period, setPeriod] = useState('This Week');
  const notify = useToast();
  const stats = {
    'This Week': { waste: '$12.40', consumed: '91%', blocked: '2 items', shelfLife: '11 days', eaten: 84, frozen: 10, tossed: 6, rescued: 2 },
    'This Month': { waste: '$42.50', consumed: '94%', blocked: '6 items', shelfLife: '14 days', eaten: 88, frozen: 8, tossed: 4, rescued: 5 },
    'Last 3 Months': { waste: '$126.80', consumed: '96%', blocked: '17 items', shelfLife: '16 days', eaten: 91, frozen: 6, tossed: 3, rescued: 14 },
  }[period];

  return (
    <View style={styles.screen}>
      <Header title="Insights" hideProfileIcon />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {['This Week', 'This Month', 'Last 3 Months'].map((p) => {
            const active = period === p;
            return (
              <Pressable key={p} onPress={() => { setPeriod(p); notify(`Switched period to ${p}`); }} style={[styles.periodChip, active && styles.periodChipActive]}>
                <Text style={[styles.periodText, active && styles.periodTextActive]}>{p}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.heroMetricCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroMetricLabel}>Estimated Food Waste Cost</Text>
            <Text style={styles.heroMetricValue}>{stats?.waste}</Text>
            <Text style={styles.heroMetricSub}>Saved ~ $18.50 compared to last period</Text>
          </View>
          <View style={styles.heroMetricIcon}><Icon name="cash-plus" size={22} color={COLORS.primary} /></View>
        </View>

        <View style={styles.insightsGrid}>
          <View style={styles.insightBox}><Text style={styles.insightBoxValue}>{stats?.consumed}</Text><Text style={styles.insightBoxLabel}>Consumed Before Expiring</Text></View>
          <View style={styles.insightBox}><Text style={styles.insightBoxValue}>{stats?.blocked}</Text><Text style={styles.insightBoxLabel}>Allergen Triggers Blocked</Text></View>
          <View style={styles.insightBox}><Text style={styles.insightBoxValue}>{stats?.shelfLife}</Text><Text style={styles.insightBoxLabel}>Average Shelf Life Extension</Text></View>
          <View style={styles.insightBox}><Text style={styles.insightBoxValue}>5 items</Text><Text style={styles.insightBoxLabel}>Expiring in Next 48 Hours</Text></View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function App() {
  const params = useLocalSearchParams<{ scanBarcode?: string; scanName?: string; scanBrand?: string; scanQuantity?: string; scanCategory?: string; scanIngredients?: string; scanToken?: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('scanner');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [appState, dispatch] = useReducer(appReducer, {
    pantryItems: INITIAL_PANTRY,
    profiles: INITIAL_PROFILES,
    activeProfile: Object.keys(INITIAL_PROFILES)[0] || '',
    hydrated: false,
  });
  const { pantryItems, profiles, activeProfile, hydrated } = appState;
  const setActiveProfile = (name: string) => dispatch({ type: 'SET_ACTIVE_PROFILE', payload: name });
  const setProfiles: React.Dispatch<React.SetStateAction<Record<string, Profile>>> = (value) => dispatch({ type: 'SET_PROFILES', payload: value as Record<string, Profile> | ((current: Record<string, Profile>) => Record<string, Profile>) });
  const [modalType, setModalType] = useState<'details' | 'addPantry' | 'addItem' | null>(null);
  const lastScanToken = React.useRef('');
  const saveQueue = React.useRef<Promise<void>>(Promise.resolve());

  // Restore the latest app state once at startup, then persist every state change.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && saved) {
          const parsed = JSON.parse(saved);
          dispatch({ type: 'HYDRATE', payload: {
            pantryItems: Array.isArray(parsed.pantryItems) ? parsed.pantryItems : undefined,
            profiles: parsed.profiles && typeof parsed.profiles === 'object' ? parsed.profiles : undefined,
            activeProfile: typeof parsed.activeProfile === 'string' ? parsed.activeProfile : undefined,
          } });
        } else if (mounted) {
          dispatch({ type: 'HYDRATE', payload: {} });
        }
      } catch (error) {
        console.warn('SafeBite local data could not be restored:', error);
        if (mounted) dispatch({ type: 'HYDRATE', payload: {} });
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const snapshot = JSON.stringify({ pantryItems, profiles, activeProfile });
    // Serialize writes so a slower older save cannot overwrite a newer state snapshot.
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(STORAGE_KEY, snapshot))
      .catch((error) => console.warn('SafeBite local data could not be saved:', error));
  }, [hydrated, pantryItems, profiles, activeProfile]);

  const notify: Notify = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((current) => (current === msg ? null : current)), 2500);
  };

  const addPantryProduct = (product: { name: string; barcode?: string; brand?: string; description?: string; quantity?: string; expiryDate?: string; location?: string; category?: string }) => {
    const cleanName = product.name.trim();
    if (!cleanName) { notify('Please enter a product name'); return; }
    const duplicate = pantryItems.find((item) => product.barcode?.trim() && item.barcode === product.barcode.trim());
    if (duplicate) {
      notify(`${duplicate.name} is already in your pantry`);
      setActiveTab('pantry');
      return;
    }
    const categoryText = (product.category || '').toLowerCase();
    const category: 'Fridge' | 'Pantry' = categoryText.includes('fridge') || categoryText.includes('chilled') ? 'Fridge' : 'Pantry';
    const newItem: PantryItem = {
      name: cleanName,
      barcode: product.barcode?.trim() || undefined,
      brand: product.brand?.trim() || undefined,
      description: product.description?.trim() || undefined,
      location: product.location?.trim() || (category === 'Fridge' ? 'Fridge • Unassigned' : 'Pantry • Unassigned'),
      expiry: [product.quantity?.trim() ? `Quantity: ${product.quantity.trim()}` : '', product.expiryDate?.trim() ? `Expiry: ${product.expiryDate.trim()}` : 'Expiry not set'].filter(Boolean).join(' • '),
      status: 'Available',
      category: product.category === 'Fridge' || product.category === 'Pantry' ? product.category : category,
      addedAt: Date.now(),
    };
    dispatch({ type: 'ADD_PANTRY_ITEM', payload: newItem });
    notify(`${cleanName} added to your pantry`);
    setActiveTab('pantry');
  };

  const handleUseItem = (item: PantryItem) => {
    dispatch({ type: 'TOGGLE_PANTRY_ITEM', payload: item.addedAt });
    notify(`${item.name} marked ${item.status === 'Used' ? 'available' : 'used up'}`);
  };

  const handleEditItem = (original: PantryItem, updated: PantryItem) => {
    dispatch({ type: 'UPDATE_PANTRY_ITEM', payload: { addedAt: original.addedAt, item: updated } });
    notify(`${updated.name} updated`);
  };

  const handleDeleteItem = (item: PantryItem) => {
    dispatch({ type: 'DELETE_PANTRY_ITEM', payload: item.addedAt });
    notify(`${item.name} removed from pantry`);
  };

  const openAllergyProfile = (profileName?: string) => {
    if (profileName) setActiveProfile(profileName);
    setActiveTab('allergies');
  };

  const lookupBarcode = async (barcode: string) => {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
      const result = await response.json();
      if (result.status !== 1 || !result.product) {
        addPantryProduct({ name: `Unknown product (${barcode})`, barcode, description: 'Product not found in Open Food Facts. Edit to add the product description and ingredients.' });
        return;
      }
      const product = result.product;
      addPantryProduct({
        name: product.product_name || product.product_name_en || `Product ${barcode}`,
        barcode,
        brand: product.brands || '',
        quantity: product.quantity || '',
        category: product.categories || '',
        description: product.ingredients_text || product.ingredients_text_en || '',
      });
    } catch {
      addPantryProduct({
        name: `Unknown product (${barcode})`,
        barcode,
        description: 'Product details could not be retrieved. Edit this pantry item to enter the product name, ingredients, and other details.',
      });
    }
  };

  useEffect(() => {
    if (activeProfile && !profiles[activeProfile]) setActiveProfile(Object.keys(profiles)[0] || '');
  }, [profiles, activeProfile]);

  useEffect(() => {
    const barcode = params.scanBarcode;
    const token = params.scanToken;
    if (!barcode || !token || lastScanToken.current === token) return;
    lastScanToken.current = token;
    addPantryProduct({
      name: params.scanName || `Unknown product (${barcode})`,
      barcode,
      brand: params.scanBrand || '',
      quantity: params.scanQuantity || '',
      category: params.scanCategory || '',
      description: params.scanIngredients || '',
    });
    router.setParams({ scanBarcode: undefined, scanName: undefined, scanBrand: undefined, scanQuantity: undefined, scanCategory: undefined, scanIngredients: undefined, scanToken: undefined });
  }, [params.scanToken]);

  const handleManualSearch = async (value: string, mode: 'barcode' | 'description') => {
    if (mode === 'barcode') await lookupBarcode(value);
    else addPantryProduct({ name: value, description: value });
  };

  const handleManualAdd = (product: { name: string; brand?: string; barcode?: string; description?: string; quantity?: string; expiryDate?: string; location?: string; category?: 'Fridge' | 'Pantry' }) => {
    addPantryProduct(product);
  };

  if (!hydrated) {
    return (
      <SafeAreaView style={[styles.safeArea, { alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
        <Text style={{ color: COLORS.primary, fontSize: 20, fontWeight: '800' }}>SafeBite</Text>
        <Text style={{ color: COLORS.muted, marginTop: 8 }}>Loading your saved pantry and profiles...</Text>
      </SafeAreaView>
    );
  }

  return (
    <ToastContext.Provider value={notify}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
        <View style={styles.appContainer}>
          
{activeTab === 'scanner' && (
  <ScannerHome
    onOpenScanner={() => router.push('/camera')}
    onManualSearch={handleManualSearch}
    onManualAdd={handleManualAdd}
    profiles={profiles}
    activeProfile={activeProfile}
    onSelectProfile={setActiveProfile}
    pantryCount={pantryItems.filter(
      (item) => item.status !== 'Used'
    ).length}
    expiringCount={pantryItems.filter(
      (item) =>
        /tomorrow|in [1-3] days/i.test(item.expiry) &&
        item.status !== 'Used'
    ).length}
    profileCount={Object.keys(profiles).length}
    pantryItems={pantryItems}
    onOpenAllergies={openAllergyProfile}
  />
)}

          {activeTab === 'pantry' && (
            <PantryScreen
              items={pantryItems}
              onUseItem={handleUseItem}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              profiles={profiles}
              activeProfile={activeProfile}
              onSelectProfile={setActiveProfile}
              onOpenAllergies={openAllergyProfile}
            />
          )}
          {activeTab === 'allergies' && (
            <AllergiesScreen profiles={profiles} setProfiles={setProfiles} activeProfile={activeProfile} onActiveProfileChange={setActiveProfile} />
          )}
          {activeTab === 'insights' && (
            <InsightsScreen pantryItems={pantryItems} profiles={profiles} activeProfile={activeProfile} onSelectProfile={setActiveProfile} />
          )}

          <BottomNav active={activeTab} onChange={setActiveTab} />
          <Toast message={toastMessage} />

          <Modal visible={modalType !== null} transparent animationType="slide" onRequestClose={() => setModalType(null)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.detailModal}>
                {modalType === 'details' ? (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.modalHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalTitle}>Product Safety Analysis</Text>
                        <Text style={styles.modalSubtitle}>Nature Valley Crunchy Granola Bars</Text>
                      </View>
                      <Pressable style={styles.modalClose} onPress={() => setModalType(null)}>
                        <Icon name="close" size={18} color={COLORS.muted} />
                      </Pressable>
                    </View>
                    <View style={styles.modalAlertBanner}>
                      <Icon name="alert" size={16} color={COLORS.danger} />
                      <Text style={styles.modalAlertText}>Severe allergen conflict found for Leo (Peanuts/Almonds equipment).</Text>
                    </View>
                    <Text style={styles.modalSectionHeading}>Ingredients List</Text>
                    <Text style={styles.modalBodyText}>Whole Grain Oats, Sugar, Canola Oil, Whole Grain Wheat, Peanut Butter, Almond Flour, Honey, Soy Lecithin.</Text>
                    <Pressable style={styles.modalPrimaryButton} onPress={() => setModalType(null)}>
                      <Text style={styles.modalPrimaryText}>Got It</Text>
                    </Pressable>
                  </ScrollView>
                ) : (
                  <View>
                    <View style={styles.modalHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalTitle}>Added to Pantry</Text>
                        <Text style={styles.modalSubtitle}>Item successfully logged into storage.</Text>
                      </View>
                      <Pressable style={styles.modalClose} onPress={() => setModalType(null)}>
                        <Icon name="close" size={18} color={COLORS.muted} />
                      </Pressable>
                    </View>
                    <Pressable style={styles.modalPrimaryButton} onPress={() => { setModalType(null); setActiveTab('pantry'); }}>
                      <Text style={styles.modalPrimaryText}>View in Pantry</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.surface },
  appContainer: { flex: 1, backgroundColor: COLORS.surface },
  screen: { flex: 1, backgroundColor: COLORS.surface },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 90, paddingTop: 8 },
  scannerHomeContent: { flexGrow: 1, minHeight: '100%', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 104, justifyContent: 'center' },
  scannerHomeInner: { width: '100%', alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  scannerOpenButton: { alignSelf: 'stretch', minHeight: 56, paddingVertical: 16, borderRadius: 14, zIndex: 2, elevation: 3 },
  scannerOpenButtonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  brand: { fontSize: 18, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },
  brandSub: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  backButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F2F1', alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  profileAlertDot: { position: 'absolute', top: -1, right: -1, width: 11, height: 11, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.white },
  familyPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 4 },
  familyText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  familyCount: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  avatarButton: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: '100%', height: '100%' },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 64, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 4 },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%' },
  navLabel: { fontSize: 11, fontWeight: '600', color: COLORS.muted, marginTop: 2 },
  navLabelActive: { color: COLORS.primary, fontWeight: '700' },
  toast: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: COLORS.navy, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 8, zIndex: 999, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  toastText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '700' },
  scanToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  circleTool: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center' },
  modeToggle: { flexDirection: 'row', backgroundColor: COLORS.border, borderRadius: 20, padding: 2 },
  modeButton: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 18 },
  modeActive: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  modeText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  modeTextActive: { color: COLORS.ink, fontWeight: '700' },
  cameraFrame: { width: '100%', height: 260, borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.ink, marginBottom: 10, position: 'relative' },
  cameraImage: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  scanCornerTL: { position: 'absolute', top: 20, left: 20, width: 24, height: 24, borderTopWidth: 3, borderLeftWidth: 3, borderColor: COLORS.primaryContainer },
  scanCornerTR: { position: 'absolute', top: 20, right: 20, width: 24, height: 24, borderTopWidth: 3, borderRightWidth: 3, borderColor: COLORS.primaryContainer },
  scanCornerBL: { position: 'absolute', bottom: 20, left: 20, width: 24, height: 24, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: COLORS.primaryContainer },
  scanCornerBR: { position: 'absolute', bottom: 20, right: 20, width: 24, height: 24, borderBottomWidth: 3, borderRightWidth: 3, borderColor: COLORS.primaryContainer },
  scanLine: { width: '70%'},
  barcodeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14 },
  barcodeText: { fontSize: 12, fontWeight: '600', color: COLORS.muted, letterSpacing: 1 },
  safetyCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  productTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  productThumbLarge: { width: 50, height: 50, borderRadius: 8, backgroundColor: COLORS.border },
  productBrand: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 0.5 },
  productTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  productMeta: { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  justNow: { fontSize: 11, color: COLORS.muted, alignSelf: 'flex-start' },
  alertBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.dangerSoft, padding: 10, borderRadius: 10, gap: 10, marginBottom: 10 },
  alertTitle: { fontSize: 13, fontWeight: '700', color: COLORS.danger },
  alertSub: { fontSize: 11, color: COLORS.danger, opacity: 0.9 },
  conflictRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  initialCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
  conflictText: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.ink },
  severeText: { fontSize: 12, fontWeight: '700', color: COLORS.danger },
  actionRow: { flexDirection: 'row', gap: 10 },
  primaryAction: { flex: 1, backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  primaryActionText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  secondaryAction: { flex: 1, backgroundColor: COLORS.primarySoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  secondaryActionText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  sectionCount: { fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, gap: 12 },
  productThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.border },
  placeholderThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  listText: { flex: 1 },
  listTitle: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  listMeta: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  linkButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6, marginTop: 4 },
  linkButtonText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  searchBarInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.ink },
  clearSearchButton: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  filterTextActive: { color: COLORS.white },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30, gap: 6 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  emptyText: { fontSize: 12, color: COLORS.muted, textAlign: 'center' },
  pantryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, gap: 10 },
  pantryCardUsed: { opacity: 0.5 },
  pantryMainPress: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  pantryThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  usedButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  usedButtonDone: { backgroundColor: COLORS.primarySoft },
  usedButtonText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  usedButtonTextDone: { color: COLORS.primary },
  floatingAdd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 12, gap: 6, marginTop: 10 },
  floatingAddText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  shieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 6 },
  shieldLabelText: { fontSize: 10, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pageTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
  pageSubtitle: { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  personChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8, gap: 6 },
  personChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  personAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  personName: { fontSize: 12, fontWeight: '600', color: COLORS.ink },
  personNameActive: { color: COLORS.primary, fontWeight: '700' },
  profileCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  profileAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  profileName: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  profileMeta: { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  removeProfileButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, backgroundColor: COLORS.surface, padding: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statValue: { fontSize: 15, fontWeight: '800', color: COLORS.ink },
  statLabel: { fontSize: 10, fontWeight: '600', color: COLORS.muted, marginTop: 1 },
  instantAlert: { fontSize: 10, fontWeight: '800', color: COLORS.danger, letterSpacing: 0.5 },
  allergenRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, gap: 10 },
  allergenIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  allergenTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  allergenName: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  removeTriggerButton: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  outlineAdd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.primary, paddingVertical: 10, borderRadius: 12, gap: 6, marginBottom: 14, backgroundColor: COLORS.primarySoft },
  outlineAddText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  preferenceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preferenceCard: { width: '48%', backgroundColor: COLORS.white, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  preferenceCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  preferenceTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  preferenceName: { fontSize: 12, fontWeight: '700', color: COLORS.ink },
  preferenceCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  preferenceCheckActive: { backgroundColor: COLORS.primary },
  preferenceDesc: { fontSize: 10, color: COLORS.muted, marginBottom: 6 },
  preferenceState: { fontSize: 10, fontWeight: '700', color: COLORS.muted },
  preferenceStateActive: { color: COLORS.primary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  triggerModal: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  detailModal: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  modalSubtitle: { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  modalClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { color: COLORS.ink, fontSize: 12, fontWeight: '700', marginBottom: 5, marginTop: 7 },
  modalInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 14, color: COLORS.ink, marginBottom: 14 },
  modalPrimaryButton: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 6 },
  modalPrimaryText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  modalButtonRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalSecondaryButton: { flex: 1, backgroundColor: COLORS.border, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalSecondaryText: { color: COLORS.ink, fontSize: 13, fontWeight: '700' },
  modalDangerButton: { flex: 1, backgroundColor: COLORS.danger, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalDangerText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  modalOptionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalOptionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.ink },
  modalOptionSub: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  modalAlertBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.dangerSoft, padding: 10, borderRadius: 10, gap: 8, marginBottom: 12 },
  modalAlertText: { fontSize: 12, fontWeight: '700', color: COLORS.danger, flex: 1 },
  modalSectionHeading: { fontSize: 13, fontWeight: '700', color: COLORS.ink, marginBottom: 4 },
  modalBodyText: { fontSize: 12, color: COLORS.muted, lineHeight: 18, marginBottom: 16 },
  periodChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  periodChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  periodTextActive: { color: COLORS.white },
  heroMetricCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  heroMetricLabel: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  heroMetricValue: { fontSize: 24, fontWeight: '800', color: COLORS.ink, marginVertical: 2 },
  heroMetricSub: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  heroMetricIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  insightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  insightBox: { width: '48%', backgroundColor: COLORS.white, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  insightBoxValue: { fontSize: 18, fontWeight: '800', color: COLORS.ink, marginBottom: 4 },
  insightBoxLabel: { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
});