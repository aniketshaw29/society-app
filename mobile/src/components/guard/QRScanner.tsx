import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QRScannerProps {
  onScan: (decodedString: string) => void;
  onEnterOTP?: () => void;
  scanning?: boolean;
}

// ---------------------------------------------------------------------------
// QRScanner component
// Full-screen barcode scanner with green viewfinder frame
// ---------------------------------------------------------------------------

export function QRScanner({ onScan, onEnterOTP, scanning = true }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const lastScanRef = useRef<string | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, []);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (!scanning || scanned) return;
    const data = result.data;
    if (!data || data === lastScanRef.current) return;

    lastScanRef.current = data;
    setScanned(true);
    setShowSuccess(true);
    Vibration.vibrate(200);

    // Pass to parent
    onScan(data);

    // Reset after 3s to allow re-scanning
    cooldownRef.current = setTimeout(() => {
      setScanned(false);
      setShowSuccess(false);
      lastScanRef.current = null;
    }, 3000);
  };

  // ---- Permission states ----

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionBody}>
          Please allow camera access to scan QR codes at the gate.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        {onEnterOTP && (
          <TouchableOpacity onPress={onEnterOTP} style={styles.otpLink}>
            <Text style={styles.otpLinkText}>Enter OTP Instead</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top dim */}
        <View style={styles.dimTop} />

        {/* Middle row: left dim | viewfinder | right dim */}
        <View style={styles.middleRow}>
          <View style={styles.dimSide} />

          {/* Viewfinder */}
          <View style={[styles.viewfinder, showSuccess && styles.viewfinderSuccess]}>
            {/* Corner marks */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>

          <View style={styles.dimSide} />
        </View>

        {/* Bottom dim */}
        <View style={styles.dimBottom}>
          {showSuccess ? (
            <View style={styles.successBadge}>
              <Text style={styles.successText}>QR Detected!</Text>
            </View>
          ) : (
            <Text style={styles.scanHint}>Align QR code within the frame</Text>
          )}

          {onEnterOTP && (
            <TouchableOpacity onPress={onEnterOTP} style={styles.otpLink}>
              <Text style={styles.otpLinkText}>Enter OTP Instead</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const VIEWFINDER_SIZE = 260;
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 4;
const CORNER_COLOR_DEFAULT = '#22C55E';
const CORNER_COLOR_SUCCESS = '#10B981';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 15,
    color: '#D1D5DB',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  permissionBtn: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  dimTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  middleRow: {
    flexDirection: 'row',
    height: VIEWFINDER_SIZE,
  },
  dimSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    position: 'relative',
  },
  viewfinderSuccess: {
    // subtle scale hint — handled by corner color
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: CORNER_COLOR_DEFAULT,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR_SUCCESS,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR_SUCCESS,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR_SUCCESS,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: CORNER_COLOR_SUCCESS,
  },
  dimBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
    gap: 20,
  },
  scanHint: {
    color: '#FFFFFF',
    fontSize: 15,
    opacity: 0.85,
  },
  successBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
  },
  successText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  otpLink: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  otpLinkText: {
    color: '#93C5FD',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
