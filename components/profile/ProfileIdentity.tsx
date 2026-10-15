import React from 'react';
import { View } from 'react-native';
import EditableText from './EditableText';

type Props = {
    username: string;
    bio: string;
    editable: boolean;
    onSaveUsername: (next: string) => void | Promise<void>;
    onSaveBio: (next: string) => void | Promise<void>;
};

export default function ProfileIdentity({ username, bio, editable, onSaveUsername, onSaveBio }: Props) {
    return (
        <View className="items-center px-6">
            <EditableText
                value={username}
                editable={editable}
                maxLength={30}
                onSave={onSaveUsername}
                textClassName="text-center text-[26px] font-bold text-white"
            />
            <View className="mt-2 w-full">
                <EditableText
                    multiline
                    allowEmpty
                    value={bio}
                    editable={editable}
                    maxLength={200}
                    placeholder="Add a bio"
                    onSave={onSaveBio}
                    textClassName="text-center text-sm leading-5 text-neutral-300"
                />
            </View>
        </View>
    );
}