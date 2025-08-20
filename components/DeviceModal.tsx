// components/DeviceModal.tsx - Updated to use global Bluetooth context
import React, { FC, useCallback } from "react";
import {
  FlatList,
  ListRenderItemInfo,
  Modal,
  SafeAreaView,
  Text,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { BluetoothDevice } from '../contexts/BluetoothContext'; // FIXED: Import from context

type DeviceModalListItemProps = {
  item: ListRenderItemInfo<BluetoothDevice>;
  connectToDevice: (device: BluetoothDevice) => void;
  closeModal: () => void;
};

type DeviceModalProps = {
  devices: BluetoothDevice[];
  visible: boolean;
  isScanning: boolean;
  connectToDevice: (device: BluetoothDevice) => void;
  closeModal: () => void;
  onRescan: () => void;
};

const DeviceModalListItem: FC<DeviceModalListItemProps> = (props) => {
  const { item, connectToDevice, closeModal } = props;

  const connectAndCloseModal = useCallback(() => {
    connectToDevice(item.item);
    closeModal();
  }, [closeModal, connectToDevice, item.item]);

  return (
    <TouchableOpacity
      onPress={connectAndCloseModal}
      style={modalStyle.deviceItem}
    >
      <View style={modalStyle.deviceInfo}>
        <MaterialIcons
          name={
            item.item.deviceType === 'printer' ? 'print' : 
            item.item.deviceType === 'scanner' ? 'qr-code-scanner' : 
            'bluetooth'
          }
          size={24}
          color="#a0aec0"
        />
        <View style={modalStyle.deviceText}>
          <Text style={modalStyle.deviceName}>{item.item.name}</Text>
          <Text style={modalStyle.deviceStatus}>
            {item.item.type.toUpperCase()} • {item.item.deviceType}
          </Text>
          <Text style={modalStyle.deviceAddress}>{item.item.address}</Text>
          {item.item.rssi && (
            <Text style={modalStyle.deviceRssi}>Signal: {item.item.rssi} dBm</Text>
          )}
        </View>
      </View>
      <View style={modalStyle.deviceStatusBadge}>
        <Text style={modalStyle.deviceStatusText}>Connect</Text>
      </View>
    </TouchableOpacity>
  );
};

const DeviceModal: FC<DeviceModalProps> = (props) => {
  const { devices, visible, isScanning, connectToDevice, closeModal, onRescan } = props;

  const renderDeviceModalListItem = useCallback(
    (item: ListRenderItemInfo<BluetoothDevice>) => {
      return (
        <DeviceModalListItem
          item={item}
          connectToDevice={connectToDevice}
          closeModal={closeModal}
        />
      );
    },
    [closeModal, connectToDevice]
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={closeModal}
    >
      <View style={modalStyle.modalOverlay}>
        <View style={modalStyle.deviceModal}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={modalStyle.modalHeader}
          >
            <Text style={modalStyle.modalTitle}>Available Devices</Text>
            <TouchableOpacity
              onPress={closeModal}
              style={modalStyle.modalCloseButton}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <View style={modalStyle.modalContent}>
            {isScanning ? (
              <View style={modalStyle.scanningContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={modalStyle.scanningText}>Scanning for devices...</Text>
              </View>
            ) : (
              <FlatList
                contentContainerStyle={modalStyle.modalFlatlistContainer}
                data={devices}
                renderItem={renderDeviceModalListItem}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={modalStyle.emptyDeviceList}>
                    <MaterialIcons name="bluetooth-disabled" size={48} color="#a0aec0" />
                    <Text style={modalStyle.emptyDeviceText}>No devices found</Text>
                    <Text style={modalStyle.emptyDeviceSubtext}>
                      Make sure your devices are discoverable and try scanning again
                    </Text>
                  </View>
                }
              />
            )}

            <TouchableOpacity
              style={modalStyle.rescanButton}
              onPress={onRescan}
              disabled={isScanning}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={modalStyle.rescanButtonGradient}
              >
                <MaterialIcons name="refresh" size={20} color="#fff" />
                <Text style={modalStyle.rescanButtonText}>
                  {isScanning ? 'Scanning...' : 'Rescan'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const modalStyle = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  deviceModal: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    borderWidth: 1,
    borderTopColor: '#2d3748',
    borderLeftColor: '#2d3748',
    borderRightColor: '#2d3748',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  modalFlatlistContainer: {
    flexGrow: 1,
  },
  scanningContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  scanningText: {
    fontSize: 16,
    color: '#a0aec0',
    marginTop: 16,
    fontWeight: '500',
  },
  deviceItem: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2d3748',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceText: {
    marginLeft: 12,
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  deviceStatus: {
    fontSize: 12,
    color: '#a0aec0',
    fontWeight: '500',
  },
  deviceAddress: {
    fontSize: 11,
    color: '#718096',
    fontWeight: '500',
    marginTop: 2,
  },
  deviceRssi: {
    fontSize: 11,
    color: '#718096',
    fontWeight: '500',
    marginTop: 2,
  },
  deviceStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#667eea',
  },
  deviceStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  emptyDeviceList: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyDeviceText: {
    fontSize: 16,
    color: '#a0aec0',
    fontWeight: '600',
    marginTop: 16,
  },
  emptyDeviceSubtext: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  rescanButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
  },
  rescanButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  rescanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default DeviceModal;