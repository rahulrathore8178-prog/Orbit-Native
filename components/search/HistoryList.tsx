import { EmptyState } from "./EmptyState";
import { HistoryRow } from "./HistoryRow";

type Props = {
    history: string[];
    /** extra delay so the first render waits for the intro animation */
    introDelay: number;
    onPick: (term: string) => void;
    onRemove: (term: string) => void;
};

export function HistoryList({ history, introDelay, onPick, onRemove }: Props) {
    if (history.length === 0) {
        return <EmptyState title="No searches yet" subtitle="Search for people on Orbit." delay={introDelay} />;
    }
    return (
        <>
            {history.map((term, i) => (
                <HistoryRow key={term} term={term} delay={introDelay + i * 60} onPick={onPick} onRemove={onRemove} />
            ))}
        </>
    );
}