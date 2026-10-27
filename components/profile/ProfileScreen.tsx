import React, { useMemo, useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, Share, Text, useWindowDimensions, View } from 'react-native';
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
import Postcard from '../postCard/PostCard';
import ProfileActions from './ProfileActions';
import ProfileIdentity from './ProfileIdentity';
import ProfileTabs from './ProfileTabs';
import ProfileTopBar from './ProfileTopBar';
import RequestsList from './RequestsList';
import { SwipePager, useSwipeTabs } from '@/hooks/global/UseSwipeTabs';
import { usePostSheets } from '../postCard/UsePostSheet';
import { toPostcardProps } from '../postCard/toPostCardProps';
import { useCurrentUser } from '@/hooks/feed/useHomeFeed';
import PrivateNotice from './PrivateNotice';
import FriendsView from './FriendsView';

type Props = {
    /** Omit for your own profile (the tab). Pass an id for anyone else (the pushed page). */
    userId?: string;
};

export default function ProfileScreen({ userId }: Props) {
    const profile = useProfile(userId);
    const actions = useProfileActions(profile);
    const openProfile = useOpenProfile();
    const currentUser = useCurrentUser();

    const { user, posts, requests, postsLocked, friends, isOwn, loading, refreshing, refresh } = profile;
    const locked = postsLocked && !isOwn;
    // Requests tab: your own profile only.
    const showRequests = isOwn;
    // The pager sits inside px-5 (20 + 20), so cards must be exactly that much narrower than the screen.
    const { width: screenWidth } = useWindowDimensions();
    const cardWidth = screenWidth - 40;
    const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const { openComments, openShare, commentsCountFor, sheets } = usePostSheets(currentUser);

    const author = useMemo(
        () => ({ id: user?.id, username: user?.username ?? '', profilePic: user?.profilePic }),
        [user],
    );

    const TAB_KEYS = useMemo<ProfileTabKey[]>(
        () => ['posts', 'friends', ...(showRequests ? (['requests'] as const) : [])],
        [showRequests],
    );

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

    // Message is for profiles only (never for orbitals).
    const handleMessage = () => {
        router.push({ pathname: '/chats/[id]', params: { id: userId } } as any)
    };

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

    const swipe = useSwipeTabs({ count: TAB_KEYS.length });
    const tab = TAB_KEYS[swipe.index] ?? 'posts';

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
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets
                    contentContainerStyle={{ paddingBottom: 120 }}
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
                                    locked={locked}
                                />
                            </View>
                        )}
                    </Reveal>

                    <Reveal delay={220} className="mt-6 gap-4 px-5">
                        {locked ? (
                            <PrivateNotice friendStatus={user.friendStatus} onAction={handleFriendPress} />
                        ) : (
                            <>
                                <ProfileTabs
                                    tabs={TAB_KEYS}
                                    active={tab}
                                    progress={swipe.progress}
                                    onChange={(key) => swipe.goTo(TAB_KEYS.indexOf(key))}
                                    counts={{
                                        posts: posts.length,
                                        friends: friends?.length ?? 0,
                                        requests: requests.length,
                                    }}
                                />

                                <SwipePager swipe={swipe} autoHeight minPageHeight={320}>
                                    <View key="posts" className="gap-4">
                                        {posts.length === 0 ? (
                                            <Text className="mt-4 text-center text-sm text-neutral-500">No posts yet.</Text>
                                        ) : (
                                            posts.map((post) => (
                                                <Postcard
                                                    key={post.id}
                                                    {...toPostcardProps(post, author)}
                                                    commentsCount={commentsCountFor(post.id, post.commentsCount)}
                                                    isOwn={isOwn}
                                                    cardWidth={cardWidth}
                                                    manageable={isOwn}
                                                    onArchive={actions.archivePost}
                                                    onEditCaption={actions.editCaption}
                                                    disableAuthorPress
                                                    onDelete={actions.deletePost}
                                                    onPressComments={openComments}
                                                    onClickShare={openShare}
                                                />
                                            ))
                                        )}
                                    </View>

                                    <View key="friends" className="gap-4">
                                        <FriendsView friends={friends} onOpen={openProfile} />
                                    </View>

                                    {showRequests && (
                                        <View key="requests" className="gap-4">
                                            <RequestsList
                                                requests={requests}
                                                onOpen={openProfile}
                                                onAccept={actions.acceptRequest}
                                                onReject={actions.rejectRequest}
                                            />
                                        </View>
                                    )}
                                </SwipePager>
                            </>
                        )}
                    </Reveal>
                </ScrollView>
            )}

            <ActionSheet visible={avatarMenuOpen && isOwn} onClose={() => setAvatarMenuOpen(false)} actions={avatarActions} />
            <ActionSheet visible={moreMenuOpen && !isOwn} onClose={() => setMoreMenuOpen(false)} actions={moreActions} />
            {sheets}
            <OrbitLoader visible={loading} />
        </View>
    );
}