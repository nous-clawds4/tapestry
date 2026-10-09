import { Link } from 'react-router-dom';
import BrainstormDesignShell, { Eyebrow } from '../../components/BrainstormDesignShell';
import { MANAGE_TREASURE_MAP_PATH, TA_TREASURE_MAP_PATH } from '../../config/avatarMenuLinks';
import { COPY } from './manageTreasureMap';

/**
 * /treasure-map/advanced — the Advanced Treasure Map management placeholder (manage-treasure-map #1, ADR
 * manage-treasure-map/0001 sub-decision 6). The top of the blueprint's Advanced screen
 * (engineering-team/audits/manage-treasure-map/blueprint/advanced-screen-header.html.txt): the way back, the kicker
 * and the heading; then a line saying the page is coming, which points at the TA Treasure Map page meanwhile (book
 * decision 5). It reads nothing and publishes nothing.
 */
export default function TreasureMapAdvancedPage() {
  const words = COPY.advanced;
  return (
    <BrainstormDesignShell>
      <Link to={MANAGE_TREASURE_MAP_PATH} className="bsd-tm-back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        {words.back}
      </Link>
      <Eyebrow>{words.kicker}</Eyebrow>
      <h1 className="bsd-title">Advanced <span className="bsd-title-accent">Treasure Map</span> management.</h1>
      <p className="bsd-lede">
        {words.placeholderBefore}
        <Link to={TA_TREASURE_MAP_PATH}>{words.placeholderLink}</Link>
        {words.placeholderAfter}
      </p>
    </BrainstormDesignShell>
  );
}
