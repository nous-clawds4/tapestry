import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ConceptList from './pages/concepts/ConceptList';
import ConceptDetail from './pages/concepts/ConceptDetail';
import ConceptOverview from './pages/concepts/ConceptOverview';
import ConceptElements from './pages/concepts/ConceptElements';
import ConceptProperties from './pages/concepts/ConceptProperties';
import ConceptDag from './pages/concepts/ConceptDag';
import ConceptSchema from './pages/concepts/ConceptSchema';
import ConceptHealth from './pages/concepts/ConceptHealth';
import ConceptCoreNodes from './pages/concepts/ConceptCoreNodes';
import ConceptVisualization from './pages/concepts/ConceptVisualization';
import NewElement from './pages/concepts/NewElement';
import ElementDetail from './pages/concepts/ElementDetail';
import NewConcept from './pages/concepts/NewConcept';
import NewProperty from './pages/concepts/NewProperty';
import AddNodeAsElement from './pages/concepts/AddNodeAsElement';
import AddNodeReview from './pages/concepts/AddNodeReview';
import NewSet from './pages/concepts/NewSet';
import SetDetail from './pages/concepts/SetDetail';
import ListsIndex from './pages/lists/Index';
import DListDetail from './pages/lists/DListDetail';
import DListOverview from './pages/lists/DListOverview';
import DListItems from './pages/lists/DListItems';
import DListRaw from './pages/lists/DListRaw';
import DListActions from './pages/lists/DListActions';
import DListRatings from './pages/lists/DListRatings';
import NewDList from './pages/lists/NewDList';
import NewDListItem from './pages/lists/NewDListItem';
import NodesIndex from './pages/nodes/Index';
import NodeDetail from './pages/nodes/NodeDetail';
import NodeOverview from './pages/nodes/NodeOverview';
import NodeJson from './pages/nodes/NodeJson';
import NodeConcepts from './pages/nodes/NodeConcepts';
import NodeRelationships from './pages/nodes/NodeRelationships';
import NodeRaw from './pages/nodes/NodeRaw';
import NodeNeo4j from './pages/nodes/NodeNeo4j';
import RelationshipsIndex from './pages/relationships/Index';
import TrustedListsIndex from './pages/trustedLists/Index';
import TrustedAssertions from './pages/grapevine/TrustedAssertions';
import TrustedAssertionsList from './pages/grapevine/TrustedAssertionsList';
import TrustDetermination from './pages/grapevine/TrustDetermination';
import TrustedLists from './pages/grapevine/TrustedLists';
import TrustedListDetail from './pages/grapevine/TrustedListDetail';
import UsersIndex from './pages/users/Index';
import UserSearch from './pages/users/Search';
import UserDetail from './pages/users/UserDetail';
import AboutIndex from './pages/about/Index';
import SettingsIndex from './pages/settings/Index';

import DListItemsList from './pages/events/DListItemsList';
import DListItemDetail from './pages/events/DListItemDetail';
import DListItemOverview from './pages/events/DListItemOverview';
import DListItemRaw from './pages/events/DListItemRaw';
import DListItemActions from './pages/events/DListItemActions';
import DListItemNeo4j from './pages/events/DListItemNeo4j';
import DListItemRatings from './pages/events/DListItemRatings';

import Neo4jOverview from './pages/databases/Neo4jOverview';
import StrfryOverview from './pages/databases/StrfryOverview';
import ExportPage from './pages/io/ExportPage';
import ImportPage from './pages/io/ImportPage';
import Dashboard from './pages/Dashboard';
const router = createBrowserRouter([
  {
    path: '/kg',
    element: <Layout />,
    handle: { crumb: 'Home' },
    children: [
      { index: true, element: <Dashboard /> },
      {
        path: 'concepts',
        handle: { crumb: 'Concepts' },
        children: [
          { index: true, element: <ConceptList />, handle: { crumb: 'Concept Headers' } },
          { path: 'new', element: <NewConcept />, handle: { crumb: 'New Concept' } },
          {
            path: ':uuid',
            element: <ConceptDetail />,
            handle: { crumb: 'Detail' },
            children: [
              { index: true, element: <ConceptOverview /> },
              { path: 'core-nodes', element: <ConceptCoreNodes />, handle: { crumb: 'Core Nodes' } },
              { path: 'health', element: <ConceptHealth />, handle: { crumb: 'Health Audit' } },
              { path: 'elements', element: <ConceptElements />, handle: { crumb: 'Elements' } },
              { path: 'elements/new', element: <NewElement />, handle: { crumb: 'New Element' } },
              { path: 'elements/add-node', element: <AddNodeAsElement />, handle: { crumb: 'Add Node' } },
              { path: 'elements/add-node/review', element: <AddNodeReview />, handle: { crumb: 'Review' } },
              { path: 'elements/:elemUuid', element: <ElementDetail />, handle: { crumb: 'Element' } },
              { path: 'properties', element: <ConceptProperties />, handle: { crumb: 'Properties' } },
              { path: 'properties/new', element: <NewProperty />, handle: { crumb: 'New Property' } },
              { path: 'dag', element: <ConceptDag />, handle: { crumb: 'Organization (Sets)' } },
              { path: 'dag/new-set', element: <NewSet />, handle: { crumb: 'New Set' } },
              { path: 'dag/:setUuid', element: <SetDetail />, handle: { crumb: 'Set Detail' } },
              { path: 'visualization', element: <ConceptVisualization />, handle: { crumb: 'Visualization' } },
              { path: 'schema', element: <ConceptSchema />, handle: { crumb: 'Schema' } },
            ],
          },
        ],
      },
      {
        path: 'lists',
        handle: { crumb: 'Simple Lists' },
        children: [
          { index: true, element: <ListsIndex />, handle: { crumb: 'List Headers' } },
          { path: 'new', element: <NewDList />, handle: { crumb: 'New List' } },
          {
            path: 'items',
            handle: { crumb: 'List Items' },
            children: [
              { index: true, element: <DListItemsList /> },
              {
                path: ':id',
                element: <DListItemDetail />,
                handle: { crumb: 'Detail' },
                children: [
                  { index: true, element: <DListItemOverview /> },
                  { path: 'ratings', element: <DListItemRatings />, handle: { crumb: 'Ratings' } },
                  { path: 'raw', element: <DListItemRaw />, handle: { crumb: 'Raw Nostr Event' } },
                  { path: 'neo4j', element: <DListItemNeo4j />, handle: { crumb: 'Neo4j' } },
                  { path: 'actions', element: <DListItemActions />, handle: { crumb: 'Actions' } },
                ],
              },
            ],
          },
          {
            path: ':id',
            element: <DListDetail />,
            handle: { crumb: 'Detail' },
            children: [
              { index: true, element: <DListOverview /> },
              { path: 'items', element: <DListItems />, handle: { crumb: 'Items' } },
              { path: 'items/new', element: <NewDListItem />, handle: { crumb: 'New Item' } },
              { path: 'ratings', element: <DListRatings />, handle: { crumb: 'Ratings' } },
              { path: 'raw', element: <DListRaw />, handle: { crumb: 'Raw Data' } },
              { path: 'actions', element: <DListActions />, handle: { crumb: 'Actions' } },
            ],
          },
        ],
      },
      {
        path: 'databases',
        handle: { crumb: 'Databases' },
        children: [
          {
            path: 'neo4j',
            handle: { crumb: 'Neo4j' },
            children: [
              { index: true, element: <Neo4jOverview />, handle: { crumb: 'Overview' } },
              {
                path: 'nodes',
                handle: { crumb: 'Nodes' },
                children: [
                  { index: true, element: <NodesIndex /> },
                  {
                    path: ':uuid',
                    element: <NodeDetail />,
                    handle: { crumb: 'Detail' },
                    children: [
                      { index: true, element: <NodeOverview /> },
                      { path: 'json', element: <NodeJson />, handle: { crumb: 'JSON' } },
                      { path: 'concepts', element: <NodeConcepts />, handle: { crumb: 'Concepts' } },
                      { path: 'relationships', element: <NodeRelationships />, handle: { crumb: 'Relationships' } },
                      { path: 'neo4j', element: <NodeNeo4j />, handle: { crumb: 'Neo4j' } },
                      { path: 'raw', element: <NodeRaw />, handle: { crumb: 'Raw Data' } },
                    ],
                  },
                ],
              },
            ],
          },
          { path: 'strfry', element: <StrfryOverview />, handle: { crumb: 'Strfry' } },
        ],
      },
      {
        path: 'nodes',
        children: [
          { index: true, element: <Navigate to="/kg/databases/neo4j/nodes" replace /> },
          { path: ':uuid', element: <Navigate to="/kg/databases/neo4j/nodes" replace /> },
        ],
      },

      {
        path: 'grapevine',
        handle: { crumb: 'My Grapevine' },
        children: [
          { path: 'trusted-assertions', element: <TrustedAssertions />, handle: { crumb: 'TA Treasure Map' } },
          { path: 'assertions', element: <TrustedAssertionsList />, handle: { crumb: 'Trusted Assertions' } },
          { path: 'trust-determination', element: <TrustDetermination />, handle: { crumb: 'Trust Determination' } },
          { path: 'trusted-lists', element: <TrustedLists />, handle: { crumb: 'Trusted Lists' } },
          { path: 'trusted-lists/:dTag', element: <TrustedListDetail />, handle: { crumb: 'Detail' } },
        ],
      },
      {
        path: 'users',
        handle: { crumb: 'Nostr Users' },
        children: [
          { index: true, element: <UsersIndex /> },
          { path: 'search', element: <UserSearch />, handle: { crumb: 'Search' } },
          { path: ':pubkey', element: <UserDetail />, handle: { crumb: 'Profile' } },
        ],
      },
      { path: 'relationships', element: <RelationshipsIndex />, handle: { crumb: 'Relationships' } },
      { path: 'trusted-lists', element: <TrustedListsIndex />, handle: { crumb: 'Trusted Lists' } },
      {
        path: 'manage/audit',
        element: <Navigate to="/kg/settings/auditing" replace />,
      },
      {
        path: 'io',
        handle: { crumb: 'I/O' },
        children: [
          { path: 'import', element: <ImportPage />, handle: { crumb: 'Import' } },
          { path: 'export', element: <ExportPage />, handle: { crumb: 'Export' } },
        ],
      },
      { path: 'about', element: <AboutIndex />, handle: { crumb: 'About' } },
      {
        path: 'settings',
        element: <SettingsIndex />,
        handle: { crumb: 'Settings' },
        children: [
          { index: true, handle: { crumb: null } },
          { path: 'relays', handle: { crumb: 'Relays' } },
          { path: 'databases', handle: { crumb: 'Databases' } },
          { path: 'uuids', handle: { crumb: 'Concept UUIDs' } },
          { path: 'firmware', handle: { crumb: 'Firmware' } },
          { path: 'system', handle: { crumb: 'System' } },
          { path: 'auditing', handle: { crumb: 'Auditing Tools' } },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
