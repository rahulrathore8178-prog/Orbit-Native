import { Image } from 'expo-image';
import { Search, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { COLORS } from '../ui/neo';

const KEY = process.env.EXPO_PUBLIC_GIPHY_KEY;

type Kind = 'gif' | 'sticker';
type Item = { id: string; url: string; preview: string; width: number; height: number };
export type GiphyPick = { url: string; width: number; height: number; kind: Kind };

async function fetchGiphy(kind: Kind, q: string, signal: AbortSignal): Promise<Item[]> {
    const base = `https://api.giphy.com/v1/${kind === 'gif' ? 'gifs' : 'stickers'}/${q ? 'search' : 'trending'}`;
    const url = `${base}?api_key=${encodeURIComponent(KEY ?? '')}&limit=30&rating=pg-13${q ? `&q=${encodeURIComponent(q)}` : ''}`;
    const res = await fetch(url, { signal });
    const json = await res.json();
    return (json.data ?? []).map((g: any) => ({
        id: g.id,
        url: g.images.fixed_width.url,                    // 200px wide: small and sharp, never the huge original
        preview: g.images.fixed_width_small?.url ?? g.images.fixed_width.url,
        width: Number(g.images.fixed_width.width),
        height: Number(g.images.fixed_width.height),
    }));
}

export default function GiphyPanel({ onPick }: { onPick: (g: GiphyPick) => void }) {
    const { width } = useWindowDimensions();
    const [kind, setKind] = useState<Kind>('gif');
    const [q, setQ] = useState('');
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!KEY) {
            setError('Add EXPO_PUBLIC_GIPHY_KEY to enable GIFs and stickers.');
            return;
        }
        const ctl = new AbortController();
        setLoading(true);
        setError('');
        const t = setTimeout(async () => {
            try {
                setItems(await fetchGiphy(kind, q.trim(), ctl.signal));
            } catch (e: any) {
                if (e?.name !== 'AbortError') setError('Could not load. Check your connection.');
            } finally {
                if (!ctl.signal.aborted) setLoading(false);
            }
        }, q ? 350 : 0);
        return () => { clearTimeout(t); ctl.abort(); };
    }, [kind, q]);

    const cell = Math.floor((width - 32 - 16) / 3);

    return (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {(['gif', 'sticker'] as Kind[]).map((k) => (
                    <Pressable
                        key={k}
                        onPress={() => setKind(k)}
                        style={{
                            paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
                            backgroundColor: kind === k ? COLORS.accent : 'rgba(255,255,255,0.07)',
                        }}
                    >
                        <Text style={{ color: kind === k ? '#fff' : COLORS.muted, fontSize: 12.5, fontWeight: '800' }}>
                            {k === 'gif' ? 'GIFs' : 'Stickers'}
                        </Text>
                    </Pressable>
                ))}
                <View
                    style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 10,
                        borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)',
                    }}
                >
                    <Search size={14} color={COLORS.muted} />
                    <TextInput
                        value={q}
                        onChangeText={setQ}
                        placeholder={`Search ${kind === 'gif' ? 'GIFs' : 'stickers'}`}
                        placeholderTextColor={COLORS.muted}
                        style={{ flex: 1, color: COLORS.text, fontSize: 13, padding: 0 }}
                        returnKeyType="search"
                        autoCorrect={false}
                    />
                    {q ? (
                        <Pressable onPress={() => setQ('')} hitSlop={8}>
                            <X size={14} color={COLORS.muted} />
                        </Pressable>
                    ) : null}
                </View>
            </View>

            {error ? (
                <Text style={{ color: COLORS.muted, fontSize: 13, textAlign: 'center', marginTop: 30 }}>{error}</Text>
            ) : (
                <FlatList
                    key={kind}
                    data={items}
                    numColumns={3}
                    keyExtractor={(g) => g.id}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    columnWrapperStyle={{ gap: 8 }}
                    contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
                    initialNumToRender={12}
                    windowSize={5}
                    ListEmptyComponent={
                        loading ? <ActivityIndicator color="#fff" style={{ marginTop: 30 }} /> : (
                            <Text style={{ color: COLORS.muted, fontSize: 13, textAlign: 'center', marginTop: 30 }}>Nothing found</Text>
                        )
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() => onPick({ url: item.url, width: item.width, height: item.height, kind })}
                            style={{
                                width: cell, height: cell, borderRadius: 14, overflow: 'hidden',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                            }}
                        >
                            <Image
                                source={{ uri: item.preview }}
                                style={{ width: '100%', height: '100%' }}
                                contentFit={kind === 'gif' ? 'cover' : 'contain'}
                                cachePolicy="memory-disk"
                                recyclingKey={item.id}
                            />
                        </Pressable>
                    )}
                />
            )}
            <Text style={{ color: COLORS.muted, fontSize: 10, textAlign: 'center', paddingVertical: 4, opacity: 0.7 }}>
                Powered by GIPHY
            </Text>
        </View>
    );
}