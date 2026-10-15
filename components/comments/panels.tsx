import { Delete, Search } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { IconButton } from '../posts/PostMedia';
import { COLORS, GlassPanel, NeoView } from '../ui/neo';
import { Gif, hasGiphyKey, searchGifs, trendingGifs } from './giphy';

const EMOJI_SETS = [
    {
        key: 'smileys',
        icon: '😀',
        items: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😎 🤩 🥳 😏 😒 😔 😢 😭 😤 😡 🤯 😱 🤔 🫡 😴 🤗'.split(' '),
    },
    {
        key: 'gestures',
        icon: '👍',
        items: '👍 👎 👏 🙌 🙏 🤝 💪 👌 ✌️ 🤞 🤟 🤘 👋 🫶 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💯 🔥 ✨ ⭐ 🎉 🎊 💥 ⚡ 👀'.split(' '),
    },
    {
        key: 'tech',
        icon: '🚀',
        items: '💻 📱 ⌨️ 🖥️ 🚀 🛸 🪐 🌍 🌙 ☀️ 🌈 🎮 🎧 🎵 📸 🎬 📚 💡 🔑 🏆 🎯 ✅ ❌ ⚠️ 🤖 🧠 🔧 📈'.split(' '),
    },
    {
        key: 'food',
        icon: '🍕',
        items: '🍕 🍔 🍟 🌮 🍜 🍣 🍩 🍪 🎂 🍫 ☕ 🍺 🍎 🍉 🍓 🥑 🍿 🥤'.split(' '),
    },
    {
        key: 'animals',
        icon: '🐶',
        items: '🐶 🐱 🐼 🦊 🦁 🐯 🐸 🐵 🦄 🐢 🦋 🐝 🐙 🐬 🦅 🐧'.split(' '),
    },
];

/** Removes the last emoji/character (also drops the variation selector that follows ❤️, ✌️, etc). */
export function removeLastChar(s: string) {
    const chars = Array.from(s);
    const last = chars.pop();
    if (last === '\uFE0F' && chars.length) chars.pop();
    return chars.join('');
}

export function EmojiPanel({ onPick, onBackspace }: { onPick: (e: string) => void; onBackspace: () => void }) {
    const [cat, setCat] = useState(0);
    const { width } = useWindowDimensions();
    const cell = Math.floor((width - 32) / 8);

    return (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                {EMOJI_SETS.map((c, i) => (
                    <Pressable key={c.key} onPress={() => setCat(i)} accessibilityRole="tab">
                        {({ pressed }) => (
                            <NeoView radius={12} pressed={pressed || cat === i} style={{ width: 42, height: 36 }}>
                                <Text style={{ fontSize: 17 }}>{c.icon}</Text>
                            </NeoView>
                        )}
                    </Pressable>
                ))}
                <View style={{ flex: 1 }} />
                <IconButton Icon={Delete} label="Backspace" onPress={onBackspace} size={38} />
            </View>

            <FlatList
                data={EMOJI_SETS[cat].items}
                numColumns={8}
                keyExtractor={(e) => e}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() => onPick(item)}
                        style={({ pressed }) => ({
                            width: cell,
                            height: cell,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: pressed ? 0.5 : 1,
                        })}
                    >
                        <Text style={{ fontSize: 26 }}>{item}</Text>
                    </Pressable>
                )}
            />
        </View>
    );
}

export function GifPanel({ onPick }: { onPick: (g: Gif) => void }) {
    const [q, setQ] = useState('');
    const [gifs, setGifs] = useState<Gif[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const reqRef = useRef(0);
    const { width } = useWindowDimensions();
    const gap = 8;
    const itemW = (width - 32 - gap * 2) / 3;

    useEffect(() => {
        if (!hasGiphyKey) return;
        const id = ++reqRef.current;
        setLoading(true);
        setError('');
        const t = setTimeout(
            async () => {
                try {
                    const res = q.trim() ? await searchGifs(q.trim()) : await trendingGifs();
                    if (id === reqRef.current) setGifs(res);
                } catch {
                    if (id === reqRef.current) setError('Could not load GIFs');
                } finally {
                    if (id === reqRef.current) setLoading(false);
                }
            },
            q ? 350 : 0
        );
        return () => clearTimeout(t);
    }, [q]);

    if (!hasGiphyKey) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                <Text style={{ color: COLORS.muted, fontSize: 13, textAlign: 'center' }}>
                    Add EXPO_PUBLIC_GIPHY_KEY to your .env to enable GIFs.
                </Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 4 }}>
            <GlassPanel radius={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
                <Search size={16} color={COLORS.muted} />
                <TextInput
                    value={q}
                    onChangeText={setQ}
                    placeholder="Search GIFs"
                    placeholderTextColor={COLORS.muted}
                    selectionColor="#ffffff"
                    autoCorrect={false}
                    returnKeyType="search"
                    style={{ flex: 1, color: COLORS.text, fontSize: 14, paddingVertical: 9 }}
                />
                {loading && <ActivityIndicator size="small" color={COLORS.muted} />}
            </GlassPanel>

            {error ? (
                <Text style={{ color: '#c98a8a', fontSize: 12, textAlign: 'center', marginTop: 16 }}>{error}</Text>
            ) : (
                <FlatList
                    data={gifs}
                    numColumns={3}
                    keyExtractor={(g) => g.id}
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator={false}
                    columnWrapperStyle={{ gap }}
                    contentContainerStyle={{ paddingTop: 10, gap }}
                    renderItem={({ item }) => (
                        <Pressable onPress={() => onPick(item)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                            <Image
                                source={{ uri: item.thumb }}
                                style={{ width: itemW, height: itemW * 0.8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' }}
                            />
                        </Pressable>
                    )}
                    ListEmptyComponent={
                        !loading ? (
                            <Text style={{ color: COLORS.muted, fontSize: 12, textAlign: 'center', marginTop: 16 }}>
                                No GIFs found.
                            </Text>
                        ) : null
                    }
                    ListFooterComponent={
                        <Text style={{ color: COLORS.muted, fontSize: 10, textAlign: 'center', paddingVertical: 8 }}>
                            Powered by GIPHY
                        </Text>
                    }
                />
            )}
        </View>
    );
}