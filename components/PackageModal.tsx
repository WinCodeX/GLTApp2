import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import colors from '../theme/colors';
import { createPackage } from '../lib/helpers/package'; // 🔥 Import package helper
import { LocationSelector, AgentSelector, DeliveryTypeSelector } from './Selectors'; // ✅ Custom selectors

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreate: (packageData: any) => void;
};

export default function PackageModal({ visible, onClose, onCreate }: Props) {
  const [currentStep, setCurrentStep] = useState(1);
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [originAgent, setOriginAgent] = useState(null);  // Agent selector
  const [destinationAgent, setDestinationAgent] = useState(null); // Agent selector
  const [originArea, setOriginArea] = useState(null);  // Area selector
  const [destinationArea, setDestinationArea] = useState(null); // Area selector
  const [deliveryType, setDeliveryType] = useState<'doorstep' | 'agent' | 'mixed'>('doorstep');
  const [cost, setCost] = useState(0); // Price calculation

  const [submitting, setSubmitting] = useState(false);

  const handleNext = () => {
    if (currentStep === 5) return;

    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (currentStep === 1) return;
    setCurrentStep((prev) => prev - 1);
  };

  const handleCreate = async () => {
    const packageData = {
      receiverName,
      receiverPhone,
      originAgent,
      destinationAgent,
      originArea,
      destinationArea,
      deliveryType,
      cost,
    };

    setSubmitting(true);
    try {
      await createPackage(packageData);
      Toast.show({ type: 'successToast', text1: 'Package created successfully!' });
      onCreate(packageData);
      onClose();
    } catch (err) {
      Toast.show({ type: 'errorToast', text1: 'Failed to create package.' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <TextInput
              placeholder="Receiver Name"
              value={receiverName}
              onChangeText={setReceiverName}
              style={styles.input}
            />
            <TextInput
              placeholder="Receiver Phone"
              value={receiverPhone}
              onChangeText={setReceiverPhone}
              style={styles.input}
            />
          </>
        );
      case 2:
        return (
          <>
            <Text style={styles.title}>Sender Info will be auto-filled</Text>
          </>
        );
      case 3:
        return (
          <DeliveryTypeSelector
            selectedType={deliveryType}
            onSelectType={setDeliveryType}
          />
        );
      case 4:
        return deliveryType === 'doorstep' ? (
          <LocationSelector
            originArea={originArea}
            destinationArea={destinationArea}
            setOriginArea={setOriginArea}
            setDestinationArea={setDestinationArea}
          />
        ) : (
          <AgentSelector
            originAgent={originAgent}
            destinationAgent={destinationAgent}
            setOriginAgent={setOriginAgent}
            setDestinationAgent={setDestinationAgent}
          />
        );
      case 5:
        return (
          <>
            <Text style={styles.costText}>Estimated Cost: {cost} KES</Text>
            <Button
              mode="contained"
              onPress={handleCreate}
              style={styles.button}
              loading={submitting}
              disabled={submitting}
            >
              Create Package
            </Button>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <TouchableOpacity onPress={onClose} style={styles.dragHandleContainer}>
            <MaterialCommunityIcons name="chevron-down" size={30} color="#bbb" />
          </TouchableOpacity>

          <Text style={styles.title}>Create New Package</Text>

          {renderStep()}

          <View style={styles.buttonsContainer}>
            {currentStep > 1 && (
              <Button mode="outlined" onPress={handleBack} style={styles.button}>
                Back
              </Button>
            )}

            {currentStep < 5 ? (
              <Button mode="contained" onPress={handleNext} style={styles.button}>
                Next
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={handleCreate}
                style={styles.button}
                loading={submitting}
                disabled={submitting}
              >
                Create Package
              </Button>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  sheet: {
    backgroundColor: colors.background,
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  dragHandleContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 10,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2a2a3d',
    color: '#fff',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  button: {
    backgroundColor: colors.primary,
    marginTop: 12,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  costText: {
    fontSize: 16,
    color: colors.primary,
    marginTop: 20,
  },
});