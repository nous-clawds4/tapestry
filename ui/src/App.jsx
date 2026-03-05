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
import NewElement from './pages/concepts/NewElement';
import ElementDetail from './pages/concepts/ElementDetail';
import NewConcept from './pages/concepts/NewConcept';
import NewProperty from './pages/concepts/NewProperty';
import AddNodeAsElement from './pages/concepts/AddNodeAsElement';
import AddNodeReview from './pages/concepts/AddNodeReview';
import ListsIndex from './pages/lists/Index';
import DListDetail from './pages/lists/DListDetail';
import DListOverview from './pages/lists/DListOverview';
import DListItems from './pages/lists/DListItems';
import DListRaw from './pages/lists/DListRaw';
import DListActions from './pages/lists/DListActions';
import NewDList from './pages/lists/NewDList';
import NewDListItem from './pages/lists/NewDListItem';
import NodesIndex from './pages/nodes/Index';
import NodeDetail from './pages/nodes/NodeDetail';
import NodeOverview from './pages/nodes/NodeOverview';
import NodeJson from './pages/nodes/NodeJson';
import NodeConcepts from './pages/nodes/NodeConcepts';
import NodeRelationships from './pages/nodes/NodeRelationships';
import NodeRaw from './pages/nodes/NodeRaw';
import RelationshipsIndex from './pages/relationships/Index';
import TrustedListsIndex from './pages/trustedLists/Index';
import UsersIndex from './pages/users/Index';
import UserDetail from './pages/users/UserDetail';
import AboutIndex from './pages/about/Index';
import SettingsIndex from './pages/settings/Index';
import EventsIndex from './pages/events/Index';
import DListItemsList from './pages/events/DListItemsList';
import DListItemDetail from './pages/events/DListItemDetail';
import DListItemOverview from './pages/events/DListItemOverview';
import DListItemRaw from './pages/events/DListItemRaw';
import DListItemActions from './pages/events/DListItemActions';
import ManageIndex from './pages/manage/Index';
import Audit from './pages/manage/Audit';
const router = createBrowserRouter([
  {
    path: '/kg',
    element: <Layout />,
    handle: { crumb: 'Home' },
    children: [
      { index: true, element: <Navigate to="concepts" replace /> },
      {
        path: 'concepts',
        handle: { crumb: 'Concepts' },
        children: [
          { index: true, element: <ConceptList /> },
          { path: 'new', element: <NewConcept />, handle: { crumb: 'New Concept' } },
          {
            path: ':uuid',
            element: <ConceptDetail />,
            handle: { crumb: 'Detail' },
            children: [
              { index: true, element: <ConceptOverview /> },
              { path: 'health', element: <ConceptHealth />, handle: { crumb: 'Health Audit' } },
              { path: 'elements', element: <ConceptElements />, handle: { crumb: 'Elements' } },
              { path: 'elements/new', element: <NewElement />, handle: { crumb: 'New Element' } },
              { path: 'elements/add-node', element: <AddNodeAsElement />, handle: { crumb: 'Add Node' } },
              { path: 'elements/add-node/review', element: <AddNodeReview />, handle: { crumb: 'Review' } },
              { path: 'elements/:elemUuid', element: <ElementDetail />, handle: { crumb: 'Element' } },
              { path: 'properties', element: <ConceptProperties />, handle: { crumb: 'Properties' } },
              { path: 'properties/new', element: <NewProperty />, handle: { crumb: 'New Property' } },
              { path: 'dag', element: <ConceptDag />, handle: { crumb: 'DAG' } },
              { path: 'schema', element: <ConceptSchema />, handle: { crumb: 'Schema' } },
            ],
          },
        ],
      },
      {
        path: 'lists',
        handle: { crumb: 'Simple Lists' },
        children: [
          { index: true, element: <ListsIndex /> },
          { path: 'new', element: <NewDList />, handle: { crumb: 'New List' } },
          {
            path: ':id',
            element: <DListDetail />,
            handle: { crumb: 'Detail' },
            children: [
              { index: true, element: <DListOverview /> },
              { path: 'items', element: <DListItems />, handle: { crumb: 'Items' } },
              { path: 'items/new', element: <NewDListItem />, handle: { crumb: 'New Item' } },
              { path: 'raw', element: <DListRaw />, handle: { crumb: 'Raw Data' } },
              { path: 'actions', element: <DListActions />, handle: { crumb: 'Actions' } },
            ],
          },
        ],
      },
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
              { path: 'raw', element: <NodeRaw />, handle: { crumb: 'Raw Data' } },
            ],
          },
        ],
      },
      {
        path: 'events',
        handle: { crumb: 'Events' },
        children: [
          { index: true, element: <EventsIndex /> },
          {
            path: 'dlist-items',
            handle: { crumb: 'DList Items' },
            children: [
              { index: true, element: <DListItemsList /> },
              {
                path: ':id',
                element: <DListItemDetail />,
                handle: { crumb: 'Detail' },
                children: [
                  { index: true, element: <DListItemOverview /> },
                  { path: 'raw', element: <DListItemRaw />, handle: { crumb: 'Raw Data' } },
                  { path: 'actions', element: <DListItemActions />, handle: { crumb: 'Actions' } },
                ],
              },
            ],
          },
        ],
      },
      {
        path: 'users',
        handle: { crumb: 'Nostr Users' },
        children: [
          { index: true, element: <UsersIndex /> },
          { path: ':pubkey', element: <UserDetail />, handle: { crumb: 'Profile' } },
        ],
      },
      { path: 'relationships', element: <RelationshipsIndex />, handle: { crumb: 'Relationships' } },
      { path: 'trusted-lists', element: <TrustedListsIndex />, handle: { crumb: 'Trusted Lists' } },
      {
        path: 'manage',
        element: <ManageIndex />,
        handle: { crumb: 'Manage' },
        children: [
          { path: 'audit', element: <Audit />, handle: { crumb: 'Audit' } },
        ],
      },
      { path: 'about', element: <AboutIndex />, handle: { crumb: 'About' } },
      { path: 'settings', element: <SettingsIndex />, handle: { crumb: 'Settings' } },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
