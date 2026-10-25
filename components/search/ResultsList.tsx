import { Reveal } from "./Reaveal";
import type { FriendActions, User } from "../services/search/types";
import { EmptyState } from "./EmptyState";
import { ProfileRow } from "./ProfileRow";
import { SkeletonRow } from "./SeletonRow";

type Props = {
    query: string;
    users: User[];
    loading: boolean;
    error: string | null;
    actions: FriendActions;
    onSelect: (user: User) => void;
    onMessage: (user: User) => void;
};

export function ResultsList({ query, users, loading, error, actions, onSelect, onMessage }: Props) {
    if (loading && users.length === 0) {
        return (
            <>
                {[0, 1, 2, 3].map((i) => (
                    <SkeletonRow key={i} />
                ))}
            </>
        );
    }
    if (error) {
        return <EmptyState title="Search failed" subtitle={error} />;
    }
    if (users.length === 0) {
        return (
            <EmptyState
                title={`No users found for “${query.trim()}”`}
                subtitle="Check the spelling or try another username."
            />
        );
    }
    return (
        <>
            {users.map((user, i) => (
                <Reveal key={user._id} delay={i * 50} duration={500} y={18}>
                    <ProfileRow user={user} actions={actions} onSelect={onSelect} onMessage={onMessage} />
                </Reveal>
            ))}
        </>
    );
}