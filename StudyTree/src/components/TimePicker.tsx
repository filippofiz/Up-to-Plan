import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Colors } from '../constants/colors';

interface TimePickerProps {
  value: string;
  onChangeTime: (time: string) => void;
  label?: string;
}

export default function TimePicker({ value, onChangeTime, label }: TimePickerProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedHour, setSelectedHour] = useState(value.split(':')[0] || '08');
  const [selectedMinute, setSelectedMinute] = useState(value.split(':')[1] || '00');

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  const handleConfirm = () => {
    onChangeTime(`${selectedHour}:${selectedMinute}`);
    setShowModal(false);
  };

  return (
    <>
      <TouchableOpacity style={styles.timeButton} onPress={() => setShowModal(true)}>
        <Text style={styles.timeText}>{value || '08:00'}</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{label || 'Seleziona ora'}</Text>
            
            <View style={styles.pickersContainer}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Ora</Text>
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                  {hours.map(hour => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.pickerItem,
                        selectedHour === hour && styles.pickerItemActive
                      ]}
                      onPress={() => setSelectedHour(hour)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        selectedHour === hour && styles.pickerItemTextActive
                      ]}>
                        {hour}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.separator}>:</Text>

              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Minuti</Text>
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                  {minutes.map(minute => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.pickerItem,
                        selectedMinute === minute && styles.pickerItemActive
                      ]}
                      onPress={() => setSelectedMinute(minute)}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        selectedMinute === minute && styles.pickerItemTextActive
                      ]}>
                        {minute}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmText}>Conferma</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  timeButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    minWidth: 70,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 16,
    color: Colors.secondary,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  pickersContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 200,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 14,
    color: Colors.gray500,
    marginBottom: 10,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  pickerItem: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  pickerItemActive: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    marginHorizontal: 10,
  },
  pickerItemText: {
    fontSize: 18,
    color: Colors.gray600,
  },
  pickerItemTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  separator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginHorizontal: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.gray300,
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.gray600,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmText: {
    color: 'white',
    fontWeight: 'bold',
  },
});