import { GitCompare, Flag, TrendingUp, X } from 'lucide-react';
import type { TKey } from '../../i18n';

export type HubTab = 'compare' | 'race' | 'weekly';

const TABS: { id: HubTab; labelKey: TKey; descKey: TKey; icon: React.ReactNode }[] = [
  { id: 'compare', labelKey: 'hubCompare', descKey: 'hubCompareDesc', icon: <GitCompare className="h-4 w-4" /> },
  { id: 'race',    labelKey: 'hubRace',    descKey: 'hubRaceDesc',    icon: <Flag className="h-4 w-4" /> },
  { id: 'weekly',  labelKey: 'hubWeekly',  descKey: 'hubWeeklyDesc',  icon: <TrendingUp className="h-4 w-4" /> },
];

interface Props {
  active: HubTab | null;
  onSelect: (tab: HubTab | null) => void;
  tr: (key: TKey) => string;
}

export default function HubNav({ active, onSelect, tr }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {TABS.map(tab => {
        const isActive = active === tab.id;
        const label = tr(tab.labelKey);
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(isActive ? null : tab.id)}
            className={`d3-btn ${isActive ? 'd3-btn-primary' : ''}`}
            title={isActive ? label : tr(tab.descKey)}
          >
            {tab.icon}
            {label}
            {isActive && <X className="h-3.5 w-3.5 opacity-80" />}
          </button>
        );
      })}

      {active && (
        <button
          onClick={() => onSelect(null)}
          className="d3-btn ml-auto"
          title={tr('closeWindow')}
        >
          <X className="h-3.5 w-3.5" /> {tr('closeWindow')}
        </button>
      )}
    </div>
  );
}
