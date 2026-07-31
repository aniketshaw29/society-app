import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CameraView,
  CameraType,
  useCameraPermissions,
} from 'expo-camera';

// ============================================================
// Screen
// ============================================================

export default function CapturePhotoScreen() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = params.returnTo ?? '/(guard)/log-visitor';

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const cameraRef = useRef<CameraView>(null);

  // ── Permission gate ───────────────────────────────────────────────────────

  if (!permission) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSub}>
          Allow camera access to capture a visitor photo.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>Grant Access</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Camera actions ────────────────────────────────────────────────────────

  const toggleFacing = () => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
        skipProcessing: false,
      });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
      }
    } catch (err) {
      console.error('[CapturePhoto] takePictureAsync error:', err);
    } finally {
      setCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
  };

  const handleUsePhoto = useCallback(() => {
    if (!capturedUri) return;
    // Navigate back with the captured URI as a param
    router.navigate({
      pathname: returnTo as Parameters<typeof router.navigate>[0],
      params: { photoUri: capturedUri },
    });
  }, [capturedUri, returnTo]);

  // ── Preview mode (after capture) ─────────────────────────────────────────

  if (capturedUri) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Image
          source={{ uri: capturedUri }}
          style={styles.preview}
          resizeMode="cover"
        />

        <View style={styles.previewActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.retakeButton]}
            onPress={handleRetake}
            activeOpacity={0.8}
          >
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.useButton]}
            onPress={handleUsePhoto}
            activeOpacity={0.8}
          >
            <Text style={styles.useText}>Use Photo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Camera viewfinder ─────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      >
        {/* Top bar */}
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
            accessibilityLabel="Close camera"
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.cameraTitle}>Capture Visitor Photo</Text>

          {/* Toggle front/back */}
          <TouchableOpacity
            style={styles.flipButton}
            onPress={toggleFacing}
            accessibilityLabel="Flip camera"
          >
            <Text style={styles.flipText}>⟳</Text>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Viewfinder guide overlay */}
        <View style={styles.viewfinderGuide} pointerEvents="none">
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </View>
      </CameraView>

      {/* Bottom capture controls */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.captureRing, capturing && styles.captureRingActive]}
          onPress={() => void handleCapture()}
          disabled={capturing}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
        >
          {capturing ? (
            <ActivityIndicator color="#1a73e8" size="small" />
          ) : (
            <View style={styles.captureInner} />
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const CAPTURE_SIZE = 72;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 32,
    gap: 16,
  },
  // Permission screen
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  permissionSub: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Camera
  camera: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cameraTitle: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  flipButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipText: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  // Viewfinder corners
  viewfinderGuide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerTL: {
    position: 'absolute',
    top: '25%',
    left: '15%',
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  cornerTR: {
    position: 'absolute',
    top: '25%',
    right: '15%',
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  cornerBL: {
    position: 'absolute',
    bottom: '25%',
    left: '15%',
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  cornerBR: {
    position: 'absolute',
    bottom: '25%',
    right: '15%',
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  // Bottom bar + capture button
  bottomBar: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingVertical: 24,
  },
  captureRing: {
    width: CAPTURE_SIZE,
    height: CAPTURE_SIZE,
    borderRadius: CAPTURE_SIZE / 2,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  captureRingActive: {
    borderColor: '#93C5FD',
  },
  captureInner: {
    width: CAPTURE_SIZE - 16,
    height: CAPTURE_SIZE - 16,
    borderRadius: (CAPTURE_SIZE - 16) / 2,
    backgroundColor: '#FFFFFF',
  },
  // Preview (after capture)
  preview: {
    flex: 1,
  },
  previewActions: {
    flexDirection: 'row',
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  useButton: {
    backgroundColor: '#1a73e8',
  },
  useText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
