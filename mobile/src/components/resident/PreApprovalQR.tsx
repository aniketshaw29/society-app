import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
// react-native-qrcode-svg renders the QR; react-native-view-shot captures it
// These packages must be installed: react-native-qrcode-svg, react-native-view-shot, expo-sharing
// If not yet installed, we gracefully degrade.
let QRCode: React.ComponentType<{ value: string; size: number; backgroundColor?: string; color?: string }> | null = null;
let ViewShot: React.ComponentType<{ children: React.ReactNode; ref: React.Ref<{ capture: () => Promise<string> }>; options?: { format: string; quality: number } }> | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  QRCode = (require('react-native-qrcode-svg') as { default: typeof QRCode }).default;
} catch {
  QRCode = null;
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ViewShot = (require('react-native-view-shot') as { default: typeof ViewShot }).default;
} catch {
  ViewShot = null;
}

import * as Sharing from 'expo-sharing';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PreApprovalQRProps {
  qrPayload: string;
  guestName: string;
  validUntil: Date;
}

// ---------------------------------------------------------------------------
// Countdown hook
// ---------------------------------------------------------------------------

function useCountdown(targetDate: Date): string {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function update() {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Expired');
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      if (h > 0) {
        setRemaining(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
      } else {
        setRemaining(`${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
      }
    }

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return remaining;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PreApprovalQR({ qrPayload, guestName, validUntil }: PreApprovalQRProps) {
  const countdown = useCountdown(validUntil);
  const [sharing, setSharing] = useState(false);
  const viewShotRef = useRef<{ capture: () => Promise<string> } | null>(null);

  const isExpired = validUntil.getTime() <= Date.now();

  const handleShare = async () => {
    if (sharing) return;
    try {
      setSharing(true);
      if (viewShotRef.current) {
        const uri = await viewShotRef.current.capture();
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: `QR Code for ${guestName}`,
          });
        } else {
          await Share.share({ message: `QR Code for ${guestName}: ${qrPayload}` });
        }
      } else {
        await Share.share({ message: `QR Code for ${guestName}: ${qrPayload}` });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not share QR code');
    } finally {
      setSharing(false);
    }
  };

  const validUntilStr = validUntil.toLocaleString();

  const qrNode = QRCode ? (
    <QRCode value={qrPayload} size={220} backgroundColor="#FFFFFF" color="#111827" />
  ) : (
    <View style={styles.qrFallback}>
      <Text style={styles.qrFallbackText}>QR</Text>
      <Text style={styles.qrFallbackSub}>Install react-native-qrcode-svg</Text>
    </View>
  );

  const inner = (
    <View style={[styles.qrWrapper, isExpired && styles.qrWrapperExpired]}>
      {qrNode}
    </View>
  );

  return (
    <View style={styles.container}>
      {ViewShot ? (
        // @ts-expect-error dynamic import type
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }}>
          {inner}
        </ViewShot>
      ) : (
        inner
      )}

      <Text style={styles.guestName}>{guestName}</Text>

      {isExpired ? (
        <View style={styles.expiredBadge}>
          <Text style={styles.expiredText}>Expired</Text>
        </View>
      ) : (
        <View style={styles.countdownRow}>
          <Text style={styles.countdownLabel}>Valid for:</Text>
          <Text style={styles.countdown}>{countdown}</Text>
        </View>
      )}

      <Text style={styles.validUntilText}>Until {validUntilStr}</Text>

      <TouchableOpacity
        style={[styles.shareBtn, (isExpired || sharing) && styles.shareBtnDisabled]}
        onPress={handleShare}
        disabled={isExpired || sharing}
      >
        {sharing ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.shareBtnText}>Share QR</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    marginBottom: 20,
  },
  qrWrapperExpired: {
    opacity: 0.4,
  },
  qrFallback: {
    width: 220,
    height: 220,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrFallbackText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#6B7280',
  },
  qrFallbackSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  guestName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  countdownLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  countdown: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1B6B3A',
    fontVariant: ['tabular-nums'],
  },
  expiredBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 6,
  },
  expiredText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },
  validUntilText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 20,
  },
  shareBtn: {
    backgroundColor: '#1B6B3A',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 160,
  },
  shareBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
