import { Check } from 'lucide-react-native';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { resolveUrl, type MyOrbital } from '../../constants/createPost/external';
import { theme } from '../../constants/createPost/theme';
import { GlassCard } from '../ui/createPost/GlassCard';
import { NeoButton } from '../ui/createPost/NeoButton';

type Props = {
  orbitals: MyOrbital[] | null;
  status: 'idle' | 'loading' | 'failed';
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
};

function OrbitalChip({ orbital, selected, onPress }: { orbital: MyOrbital; selected: boolean; onPress: () => void }) {
  const img = resolveUrl(orbital.image);
  return (
    <NeoButton onPress={onPress} selected={selected} radius={16} label={`Orbital ${orbital.name}`}>
      <View style={styles.chip}>
        {img ? (
          <Image source={{ uri: img }} style={styles.chipImg} />
        ) : (
          <View style={[styles.chipImg, styles.chipFallback]}>
            <Text style={styles.chipInitial}>{(orbital.name?.trim()?.[0] ?? '?').toUpperCase()}</Text>
          </View>
        )}
        <Text numberOfLines={1} style={[styles.chipText, selected && { color: theme.colors.accent }]}>
          {orbital.name}
        </Text>
        {selected && <Check size={14} color={theme.colors.accent} strokeWidth={2.6} />}
      </View>
    </NeoButton>
  );
}

/** Wrapping chips (no nested horizontal scroll), so swiping anywhere switches tabs cleanly. */
export function OrbitalPicker({ orbitals, status, selectedId, onSelect, onRetry }: Props) {
  return (
    <GlassCard radius={22} style={styles.card}>
      <Text style={styles.heading}>Post to orbital</Text>

      {status === 'loading' && !orbitals ? (
        <ActivityIndicator color={theme.colors.accent} style={{ paddingVertical: 10 }} />
      ) : status === 'failed' && !orbitals ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>Could not load your orbitals</Text>
          <NeoButton onPress={onRetry} radius={12} label="Retry loading orbitals">
            <Text style={styles.retry}>Retry</Text>
          </NeoButton>
        </View>
      ) : !orbitals?.length ? (
        <Text style={styles.empty}>You don&apos;t have any orbitals to post to yet.</Text>
      ) : (
        <View style={styles.wrap}>
          {orbitals.map((o) => (
            <OrbitalChip key={o._id} orbital={o} selected={o._id === selectedId} onPress={() => onSelect(o._id)} />
          ))}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { flexGrow: 1, alignSelf: 'stretch', paddingVertical: 14, paddingHorizontal: 14 },
  heading: {
    color: theme.colors.muted,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  chipImg: { width: 22, height: 22, borderRadius: 11 },
  chipFallback: { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  chipInitial: { color: theme.colors.text, fontSize: 11, fontWeight: '800' },
  chipText: { color: theme.colors.text, fontSize: 13.5, fontWeight: '700', maxWidth: 150 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  errorText: { color: theme.colors.danger, fontSize: 13, flex: 1 },
  retry: { color: theme.colors.text, fontSize: 12.5, fontWeight: '800', paddingHorizontal: 14, paddingVertical: 8 },
  empty: { color: theme.colors.textDim, fontSize: 13.5 },
});
