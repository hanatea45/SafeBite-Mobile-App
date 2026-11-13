
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.text}>Preparing camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Camera Permission</Text>

        <Text style={styles.text}>
          Allow camera access to scan food product barcodes.
        </Text>

        <Pressable
          style={styles.button}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>SafeBite Scanner</Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: [
              'ean13',
              'ean8',
              'upc_a',
              'upc_e',
              'qr',
            ],
          }}
          onBarcodeScanned={
            scanned
              ? undefined
              : ({ data }) => {
                  setScanned(true);

                  Alert.alert(
                    'Barcode Detected',
                    `Scanned code: ${data}`,
                    [
                      {
                        text: 'Scan Again',
                        onPress: () => setScanned(false),
                      },
                      {
                        text: 'Done',
                        onPress: () => router.back(),
                      },
                    ]
                  );
                }
          }
        />

        <View
          pointerEvents="none"
          style={styles.scanFrame}
        />
      </View>

      <Text style={styles.text}>
        Point your camera at a food product barcode.
      </Text>

      {scanned && (
        <Pressable
          style={styles.button}
          onPress={() => setScanned(false)}
        >
          <Text style={styles.buttonText}>
            Scan Another Product
          </Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF7ED',
    padding: 20,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFF7ED',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },

  title: {
    fontSize: 21,
    fontWeight: '700',
    color: '#292524',
  },

  text: {
    color: '#78716C',
    textAlign: 'center',
    marginVertical: 16,
  },

  cameraContainer: {
    height: 400,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#292524',
    justifyContent: 'center',
    alignItems: 'center',
  },

  scanFrame: {
    width: '75%',
    height: 150,
    borderWidth: 3,
    borderColor: '#F97316',
    borderRadius: 12,
  },

  button: {
    backgroundColor: '#F97316',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 12,
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  backText: {
    color: '#EA580C',
    fontWeight: '700',
    marginVertical: 12,
  },
});
