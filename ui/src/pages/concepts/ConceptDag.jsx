import { useOutletContext } from 'react-router-dom';

export default function ConceptDag() {
  const { uuid } = useOutletContext();

  return (
    <div>
      <h2>DAG Structure</h2>
      <p className="placeholder">
        Class thread visualization will be ported here from the existing explorer.
        <br />
        Concept UUID: <code>{uuid}</code>
      </p>
    </div>
  );
}
