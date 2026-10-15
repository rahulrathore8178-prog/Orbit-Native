import React, { useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ban, Camera, Trash2 } from 'lucide-react-native';
import OrbitLoader from '@/components/ui/OrbitLoader';
import ActionSheet, { SheetAction } from '@/components/ui/ActionSheet';
import Reveal from '@/components/options/Reveal';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { useProfile } from '@/hooks/useProfile';
import { useProfileActions } from '@/hooks/useProfileActions';
import { ProfilePost, ProfileTabKey } from '@/components/profile/profile';
import FriendsList from './FriendsList';
import OrbitalAvatar from './OrbitalAvatar';
import PostCard from './PostCard';
import ProfileActions from './ProfileActions';
import ProfileIdentity from './ProfileIdentity';
import ProfileTabs from './ProfileTabs';
import ProfileTopBar from './ProfileTopBar';

type Props = {
    /** Omit for your own profile (the tab). Pass an id for anyone else (the pushed page). */
    userId?: string;
};

export default function ProfileScreen({ userId }: Props) {
    const profile = useProfile(userId);
    const actions = useProfileActions(profile);
    const openProfile = useOpenProfile();

    const { user, posts, friends, isOwn, loading, refreshing, refresh } = profile;
    const [tab, setTab] = useState<ProfileTabKey>('posts');
    const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);

    const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

    const confirmDeletePost = (id: string) =>
        Alert.alert('Delete post?', "This can't be undone.", [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => actions.deletePost(id) },
        ]);

    const confirmBlock = () =>
        Alert.alert(`Block ${user?.username}?`, "They won't be able to find or message you.", [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Block', style: 'destructive', onPress: actions.blockUser },
        ]);

    const handleFriendPress = () => {
        if (user?.friendStatus !== 'friends') return actions.toggleFriend();
        Alert.alert(`Remove ${user.username} from friends?`, undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: actions.toggleFriend },
        ]);
    };

    const handleShare = (post: ProfilePost) =>
        Share.share({ message: post.content || 'Check out this post on Orb8' }).catch(() => { });

    // TODO: point these at your chat route and in-app calling once they exist.
    const handleMessage = () => Alert.alert('Coming soon', "Messaging isn't connected to this screen yet.");
    const handleCall = () =>
        user?.phone ? Linking.openURL(`tel:${user.phone}`) : Alert.alert('Coming soon', "Calling isn't available yet.");

    const avatarActions: SheetAction[] = [
        { label: 'Change profile picture', Icon: Camera, onPress: actions.changeAvatar },
        ...(user?.profilePic
            ? [{ label: 'Remove profile picture', Icon: Trash2, onPress: actions.removeAvatar, destructive: true }]
            : []),
    ];

    const moreActions: SheetAction[] = [
        { label: `Block ${user?.username ?? ''}`.trim(), Icon: Ban, onPress: confirmBlock, destructive: true },
    ];
    // console.log('user', user)
    // console.log('friends', friends)

    return (
        <View className="flex-1 bg-black">
            <ProfileTopBar
                handle={user?.handle ?? ''}
                isOwn={isOwn}
                showBack={Boolean(userId)}
                onBack={goBack}
                onSettings={() => router.push('/profile/settings')}
                onMore={() => setMoreMenuOpen(true)}
            />

            {user && (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 48 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#ffffff" />}
                >
                    <Reveal>
                        <OrbitalAvatar
                            uri={user.profilePic}
                            name={user.username}
                            editable={isOwn}
                            uploading={actions.isUploadingAvatar}
                            onPress={() => setAvatarMenuOpen(true)}
                        />
                    </Reveal>

                    <Reveal delay={120} className="mt-1">
                        <ProfileIdentity
                            username={user.username}
                            bio={user.bio}
                            editable={isOwn}
                            onSaveUsername={actions.saveUsername}
                            onSaveBio={actions.saveBio}
                        />
                        {!isOwn && (
                            <View className="mt-5">
                                <ProfileActions
                                    friendStatus={user.friendStatus}
                                    onToggleFriend={handleFriendPress}
                                    onMessage={handleMessage}
                                    onCall={handleCall}
                                />
                            </View>
                        )}
                    </Reveal>

                    <Reveal delay={220} className="mt-6 gap-4 px-5">
                        <ProfileTabs active={tab} onChange={setTab} counts={{ posts: posts.length, friends: friends?.length }} />

                        {tab === 'posts' ? (
                            posts.length === 0 ? (
                                <Text className="mt-4 text-center text-sm text-neutral-500">No posts yet.</Text>
                            ) : (
                                posts.map((post) => (
                                    <PostCard
                                        key={post.id}
                                        post={post}
                                        canDelete={isOwn}
                                        onDelete={confirmDeletePost}
                                        onShare={handleShare}
                                    />
                                ))
                            )
                        ) : (
                            <FriendsList friends={friends} onOpen={openProfile} />
                        )}
                    </Reveal>
                </ScrollView>
            )}

            <ActionSheet visible={avatarMenuOpen && isOwn} onClose={() => setAvatarMenuOpen(false)} actions={avatarActions} />
            <ActionSheet visible={moreMenuOpen && !isOwn} onClose={() => setMoreMenuOpen(false)} actions={moreActions} />

            <OrbitLoader visible={loading} />
        </View>
    );
}