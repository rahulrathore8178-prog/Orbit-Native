import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// TODO: adjust this path to wherever your NeoView / GlassPanel / COLORS live
import { COLORS, GlassPanel, NeoView } from '@/components/ui/neo';

/* -------------------------------------------------------------------------- */
/*  Config – fill this in                                                      */
/* -------------------------------------------------------------------------- */

// TODO: put your "send post as message" endpoint here
const SHARE_POST_URI = '';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ShareTarget = {
    id: string;
    name: string;
    username?: string;
    avatar?: string; // image url, optional
    memberCount?: number; // for orbitals
};

export type SharePayload = {
    postId: string;
    friendIds: string[];
    orbitalIds: string[];
    message?: string;
};

type TabKey = 'friends' | 'orbitals';

type ShareModalProps = {
    visible: boolean;
    postId: string | null;
    friends: ShareTarget[];
    orbitals: ShareTarget[];
    onClose: () => void;
    /** Optional override. If omitted, the default sendPostAsMessage() is used. */
    onSend?: (payload: SharePayload) => Promise<void> | void;
};

/* -------------------------------------------------------------------------- */
/*  API call (URI intentionally empty)                                         */
/* -------------------------------------------------------------------------- */

export async function sendPostAsMessage(payload: SharePayload): Promise<void> {
    if (!SHARE_POST_URI) {
        console.warn('[ShareModal] SHARE_POST_URI is empty – nothing was sent.', payload);
        return;
    }
    const res = await fetch(SHARE_POST_URI, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // TODO: add auth header if needed
            // Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error(`Share failed with status ${res.status}`);
    }
}

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                               */
/* -------------------------------------------------------------------------- */

const keyOf = (tab: TabKey, id: string) => `${tab}:${id}`;

function Avatar({ target, size = 44 }: { target: ShareTarget; size?: number }) {
    if (target.avatar) {
        return (
            <Image
                source={{ uri: target.avatar }}
                style={{ width: size, height: size, borderRadius: size / 2 }}
            />
        );
    }
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: COLORS.glassBorder,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: size * 0.4 }}>
                {target.name.trim().charAt(0).toUpperCase() || '?'}
            </Text>
        </View>
    );
}

function TabBar({
    active,
    onChange,
    counts,
}: {
    active: TabKey;
    onChange: (t: TabKey) => void;
    counts: Record<TabKey, number>;
}) {
    const tabs: { key: TabKey; label: string }[] = [
        { key: 'friends', label: 'Friends' },
        { key: 'orbitals', label: 'Orbitals' },
    ];

    return (
        <NeoView
            pressed
            radius={18}
            style={{ height: 54 }}
            contentStyle={{ flexDirection: 'row', padding: 5, alignItems: 'stretch' }}
        >
            {tabs.map((t) => {
                const isActive = active === t.key;
                const content = (
                    <View style={styles.tabInner}>
                        <Text
                            style={{
                                color: isActive ? COLORS.text : COLORS.muted,
                                fontWeight: '700',
                                fontSize: 14,
                            }}
                        >
                            {counts[t.key]}
                        </Text>
                        <Text
                            style={{
                                color: isActive ? COLORS.text : COLORS.muted,
                                fontWeight: isActive ? '700' : '500',
                                fontSize: 14,
                                marginLeft: 6,
                            }}
                        >
                            {t.label}
                        </Text>
                    </View>
                );

                return (
                    <TouchableOpacity
                        key={t.key}
                        activeOpacity={0.8}
                        onPress={() => onChange(t.key)}
                        style={{ flex: 1 }}
                    >
                        {isActive ? (
                            <NeoView radius={14} style={{ flex: 1 }}>
                                {content}
                            </NeoView>
                        ) : (
                            <View style={{ flex: 1 }}>{content}</View>
                        )}
                    </TouchableOpacity>
                );
            })}
        </NeoView>
    );
}

function TargetRow({
    target,
    selected,
    isOrbital,
    onToggle,
}: {
    target: ShareTarget;
    selected: boolean;
    isOrbital: boolean;
    onToggle: () => void;
}) {
    const subtitle = isOrbital
        ? target.memberCount != null
            ? `${target.memberCount} members`
            : undefined
        : target.username
            ? `@${target.username}`
            : undefined;

    return (
        <TouchableOpacity activeOpacity={0.85} onPress={onToggle} style={{ marginBottom: 10 }}>
            <GlassPanel
                radius={16}
                style={selected ? { borderColor: 'rgba(47,174,255,0.55)' } : undefined}
            >
                <View style={styles.row}>
                    <Avatar target={target} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text numberOfLines={1} style={styles.rowTitle}>
                            {target.name}
                        </Text>
                        {!!subtitle && (
                            <Text numberOfLines={1} style={styles.rowSub}>
                                {subtitle}
                            </Text>
                        )}
                    </View>
                    <NeoView
                        radius={9}
                        pressed={!selected}
                        accent={selected}
                        style={{ width: 28, height: 28 }}
                    >
                        {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </NeoView>
                </View>
            </GlassPanel>
        </TouchableOpacity>
    );
}

/* -------------------------------------------------------------------------- */
/*  Modal                                                                      */
/* -------------------------------------------------------------------------- */

export default function ShareModal({
    visible,
    postId,
    friends,
    orbitals,
    onClose,
    onSend,
}: ShareModalProps) {
    const [tab, setTab] = useState<TabKey>('friends');
    const [selected, setSelected] = useState<string[]>([]);
    const [query, setQuery] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // reset every time the modal is opened
    useEffect(() => {
        if (visible) {
            setTab('friends');
            setSelected([]);
            setQuery('');
            setMessage('');
            setError(null);
            setSending(false);
        }
    }, [visible]);

    const data = tab === 'friends' ? friends : orbitals;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return data;
        return data.filter(
            (t) => t.name.toLowerCase().includes(q) || t.username?.toLowerCase().includes(q),
        );
    }, [data, query]);

    const toggle = useCallback((key: string) => {
        setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    }, []);

    const selectedCount = selected.length;

    const handleSend = async () => {
        if (!postId || selectedCount === 0 || sending) return;

        const payload: SharePayload = {
            postId,
            friendIds: selected.filter((k) => k.startsWith('friends:')).map((k) => k.slice(8)),
            orbitalIds: selected.filter((k) => k.startsWith('orbitals:')).map((k) => k.slice(9)),
            message: message.trim() || undefined,
        };

        try {
            setSending(true);
            setError(null);
            await (onSend ?? sendPostAsMessage)(payload);
            onClose();
        } catch (e) {
            setError('Could not send. Please try again.');
        } finally {
            setSending(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.root}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.sheetWrap}
                >
                    <GlassPanel
                        blur
                        radius={28}
                        style={{ backgroundColor: 'rgba(18,21,27,0.92)', maxHeight: '100%' }}
                    >
                        <View style={styles.sheet}>
                            {/* grabber + header */}
                            <View style={styles.grabber} />
                            <View style={styles.header}>
                                <Text style={styles.title}>Share post</Text>
                                <TouchableOpacity onPress={onClose} hitSlop={10}>
                                    <NeoView radius={14} style={{ width: 32, height: 32 }}>
                                        <Ionicons name="close" size={16} color={COLORS.text} />
                                    </NeoView>
                                </TouchableOpacity>
                            </View>

                            {/* tab bar */}
                            <TabBar
                                active={tab}
                                onChange={setTab}
                                counts={{ friends: friends.length, orbitals: orbitals.length }}
                            />

                            {/* search */}
                            <View style={{ marginTop: 14 }}>
                                <NeoView
                                    pressed
                                    radius={14}
                                    style={{ height: 44 }}
                                    contentStyle={{
                                        flexDirection: 'row',
                                        paddingHorizontal: 12,
                                        alignItems: 'center',
                                        justifyContent: 'flex-start',
                                    }}
                                >
                                    <Ionicons name="search" size={16} color={COLORS.muted} />
                                    <TextInput
                                        value={query}
                                        onChangeText={setQuery}
                                        placeholder={`Search ${tab}`}
                                        placeholderTextColor={COLORS.muted}
                                        style={styles.input}
                                        autoCorrect={false}
                                    />
                                    {!!query && (
                                        <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                                            <Ionicons name="close-circle" size={16} color={COLORS.muted} />
                                        </TouchableOpacity>
                                    )}
                                </NeoView>
                            </View>

                            {/* list */}
                            <FlatList
                                data={filtered}
                                keyExtractor={(item) => keyOf(tab, item.id)}
                                style={{ marginTop: 14, flexGrow: 0, maxHeight: 360 }}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => {
                                    const key = keyOf(tab, item.id);
                                    return (
                                        <TargetRow
                                            target={item}
                                            isOrbital={tab === 'orbitals'}
                                            selected={selected.includes(key)}
                                            onToggle={() => toggle(key)}
                                        />
                                    );
                                }}
                                ListEmptyComponent={
                                    <View style={styles.empty}>
                                        <Ionicons
                                            name={tab === 'friends' ? 'people-outline' : 'planet-outline'}
                                            size={28}
                                            color={COLORS.muted}
                                        />
                                        <Text style={styles.emptyText}>
                                            {query ? 'No matches found' : `No ${tab} yet`}
                                        </Text>
                                    </View>
                                }
                            />

                            {/* optional message */}
                            {selectedCount > 0 && (
                                <View style={{ marginTop: 6 }}>
                                    <NeoView
                                        pressed
                                        radius={14}
                                        style={{ minHeight: 44 }}
                                        contentStyle={{
                                            paddingHorizontal: 12,
                                            alignItems: 'stretch',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <TextInput
                                            value={message}
                                            onChangeText={setMessage}
                                            placeholder="Add a message (optional)"
                                            placeholderTextColor={COLORS.muted}
                                            style={[styles.input, { marginLeft: 0 }]}
                                        />
                                    </NeoView>
                                </View>
                            )}

                            {!!error && <Text style={styles.error}>{error}</Text>}

                            {/* send button */}
                            <TouchableOpacity
                                activeOpacity={0.85}
                                disabled={selectedCount === 0 || sending}
                                onPress={handleSend}
                                style={{ marginTop: 14, opacity: selectedCount === 0 ? 0.5 : 1 }}
                            >
                                <NeoView
                                    radius={16}
                                    accent={selectedCount > 0}
                                    style={{ height: 50 }}
                                    contentStyle={{ flexDirection: 'row' }}
                                >
                                    {sending ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="paper-plane" size={16} color="#fff" />
                                            <Text style={styles.sendText}>
                                                {selectedCount > 0 ? `Send (${selectedCount})` : 'Select to send'}
                                            </Text>
                                        </>
                                    )}
                                </NeoView>
                            </TouchableOpacity>
                        </View>
                    </GlassPanel>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
    sheetWrap: { paddingHorizontal: 8, paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
    sheet: { padding: 16, paddingTop: 10 },
    grabber: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.18)',
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    title: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
    tabInner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    row: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    rowTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
    rowSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
    input: { flex: 1, color: COLORS.text, fontSize: 14, marginLeft: 8, paddingVertical: 0 },
    empty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
    emptyText: { color: COLORS.muted, fontSize: 13 },
    error: { color: '#FF6B6B', fontSize: 12, marginTop: 10, textAlign: 'center' },
    sendText: { color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 8 },
});